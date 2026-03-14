from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from ..extensions import db
from ..models import Operation, OperationLine, Warehouse, Product, StockLevel
from ..utils.reference import generate_reference
from ..utils.stock_utils import update_stock, record_move

delivery_bp = Blueprint('delivery', __name__)


def get_wh_code(warehouse_id):
    wh = Warehouse.query.get(warehouse_id)
    return wh.short_code if wh else 'WH'


@delivery_bp.route('/', methods=['GET'])
@jwt_required()
def get_deliveries():
    status = request.args.get('status')
    warehouse_id = request.args.get('warehouse_id')
    search = request.args.get('search', '')
    query = Operation.query.filter_by(operation_type='delivery')
    if status:
        query = query.filter_by(status=status)
    if warehouse_id:
        query = query.filter_by(warehouse_id=warehouse_id)
    if search:
        query = query.filter(
            (Operation.reference.ilike(f'%{search}%')) |
            (Operation.contact.ilike(f'%{search}%'))
        )
    ops = query.order_by(Operation.created_at.desc()).all()
    return jsonify([o.to_dict() for o in ops]), 200


@delivery_bp.route('/<int:oid>', methods=['GET'])
@jwt_required()
def get_delivery(oid):
    op = Operation.query.filter_by(id=oid, operation_type='delivery').first_or_404()
    return jsonify(op.to_dict()), 200


@delivery_bp.route('/', methods=['POST'])
@jwt_required()
def create_delivery():
    user_id = get_jwt_identity()
    data = request.get_json()
    warehouse_id = int(data['warehouse_id']) if data.get('warehouse_id') else None
    wh_code = get_wh_code(warehouse_id)
    reference = generate_reference(wh_code, 'delivery')

    op = Operation(
        reference=reference,
        operation_type='delivery',
        status='draft',
        from_location_id=int(data['from_location_id']) if data.get('from_location_id') else None,
        warehouse_id=warehouse_id,
        contact=data.get('contact'),
        scheduled_date=datetime.fromisoformat(data['scheduled_date']) if data.get('scheduled_date') else None,
        responsible_id=int(user_id),
        notes=data.get('notes')
    )
    db.session.add(op)
    db.session.flush()

    # Check stock, set waiting if any product is out of stock
    has_waiting = False
    for line in data.get('lines', []):
        ol = OperationLine(operation_id=op.id, product_id=line['product_id'], quantity=line['quantity'])
        db.session.add(ol)
        p = Product.query.get(line['product_id'])
        if p and p.total_stock() < line['quantity']:
            has_waiting = True

    if has_waiting:
        op.status = 'waiting'

    db.session.commit()
    return jsonify(op.to_dict()), 201


@delivery_bp.route('/<int:oid>', methods=['PUT'])
@jwt_required()
def update_delivery(oid):
    op = Operation.query.filter_by(id=oid, operation_type='delivery').first_or_404()
    if op.status == 'done':
        return jsonify({'error': 'Cannot edit a done delivery'}), 400
    data = request.get_json()

    if 'contact' in data: op.contact = data['contact']
    if 'notes' in data: op.notes = data['notes']
    if 'from_location_id' in data: op.from_location_id = int(data['from_location_id']) if data['from_location_id'] else None
    if 'warehouse_id' in data: op.warehouse_id = int(data['warehouse_id']) if data['warehouse_id'] else None
    if data.get('scheduled_date'):
        op.scheduled_date = datetime.fromisoformat(data['scheduled_date'])

    if 'lines' in data:
        OperationLine.query.filter_by(operation_id=op.id).delete()
        has_waiting = False
        for line in data['lines']:
            ol = OperationLine(operation_id=op.id, product_id=line['product_id'], quantity=line['quantity'])
            db.session.add(ol)
            p = Product.query.get(line['product_id'])
            if p and p.total_stock() < line['quantity']:
                has_waiting = True
        if op.status == 'draft' and has_waiting:
            op.status = 'waiting'

    db.session.commit()
    return jsonify(op.to_dict()), 200


@delivery_bp.route('/<int:oid>/check', methods=['POST'])
@jwt_required()
def check_availability(oid):
    op = Operation.query.filter_by(id=oid, operation_type='delivery').first_or_404()
    if op.status != 'draft':
        return jsonify({'error': 'Can only check draft deliveries'}), 400
    has_waiting = False
    for line in op.lines:
        p = Product.query.get(line.product_id)
        if not p or p.total_stock() < line.quantity:
            has_waiting = True
            break
    op.status = 'waiting' if has_waiting else 'ready'
    db.session.commit()
    return jsonify(op.to_dict()), 200


@delivery_bp.route('/<int:oid>/validate', methods=['POST'])
@jwt_required()
def validate_delivery(oid):
    op = Operation.query.filter_by(id=oid, operation_type='delivery').first_or_404()
    if op.status not in ['ready', 'waiting', 'draft']:
        return jsonify({'error': 'Cannot validate'}), 400

    for line in op.lines:
        p = Product.query.get(line.product_id)
        if not p or p.total_stock() < line.quantity:
            return jsonify({'error': f'Insufficient stock for {p.name if p else line.product_id}'}), 400

    for line in op.lines:
        update_stock(line.product_id, op.from_location_id, -line.quantity)
        record_move(
            operation_id=op.id,
            product_id=line.product_id,
            from_location_id=op.from_location_id,
            to_location_id=None,
            quantity=line.quantity,
            move_type='out',
            reference=op.reference,
            contact=op.contact
        )

    op.status = 'done'
    op.validated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(op.to_dict()), 200


@delivery_bp.route('/<int:oid>/cancel', methods=['POST'])
@jwt_required()
def cancel_delivery(oid):
    op = Operation.query.filter_by(id=oid, operation_type='delivery').first_or_404()
    if op.status == 'done':
        return jsonify({'error': 'Cannot cancel a done delivery'}), 400
    op.status = 'canceled'
    db.session.commit()
    return jsonify(op.to_dict()), 200
