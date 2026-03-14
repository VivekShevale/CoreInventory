from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from ..extensions import db
from ..models import Operation, OperationLine, Warehouse, Location, Product, StockLevel
from ..utils.reference import generate_reference
from ..utils.stock_utils import update_stock, record_move

transfers_bp = Blueprint('transfers', __name__)


def stock_at_location(product_id, location_id):
    if not location_id:
        return 0
    sl = StockLevel.query.filter_by(product_id=product_id, location_id=location_id).first()
    return sl.quantity if sl else 0


@transfers_bp.route('/', methods=['GET'])
@jwt_required()
def get_transfers():
    status = request.args.get('status')
    search = request.args.get('search', '')
    query = Operation.query.filter_by(operation_type='transfer')
    if status:
        query = query.filter_by(status=status)
    if search:
        query = query.filter(
            (Operation.reference.ilike(f'%{search}%')) |
            (Operation.contact.ilike(f'%{search}%'))
        )
    ops = query.order_by(Operation.created_at.desc()).all()
    return jsonify([o.to_dict() for o in ops]), 200


@transfers_bp.route('/<int:oid>', methods=['GET'])
@jwt_required()
def get_transfer(oid):
    op = Operation.query.filter_by(id=oid, operation_type='transfer').first_or_404()
    return jsonify(op.to_dict()), 200


@transfers_bp.route('/', methods=['POST'])
@jwt_required()
def create_transfer():
    user_id = get_jwt_identity()
    data = request.get_json()

    from_location_id = int(data['from_location_id']) if data.get('from_location_id') else None
    to_location_id = int(data['to_location_id']) if data.get('to_location_id') else None
    warehouse_id = int(data['warehouse_id']) if data.get('warehouse_id') else None

    wh = Warehouse.query.get(warehouse_id) if warehouse_id else None
    wh_code = wh.short_code if wh else 'WH'
    reference = generate_reference(wh_code, 'transfer')

    # Determine initial status by checking stock at source
    lines = data.get('lines', [])
    status = 'draft'
    if lines and from_location_id:
        all_ok = all(
            stock_at_location(int(l['product_id']), from_location_id) >= float(l['quantity'])
            for l in lines
        )
        status = 'ready' if all_ok else 'waiting'

    op = Operation(
        reference=reference,
        operation_type='transfer',
        status=status,
        from_location_id=from_location_id,
        to_location_id=to_location_id,
        warehouse_id=warehouse_id,
        contact=data.get('notes', ''),
        scheduled_date=datetime.fromisoformat(data['scheduled_date']) if data.get('scheduled_date') else None,
        responsible_id=int(user_id),
        notes=data.get('notes'),
    )
    db.session.add(op)
    db.session.flush()

    for line in lines:
        ol = OperationLine(
            operation_id=op.id,
            product_id=int(line['product_id']),
            quantity=float(line['quantity'])
        )
        db.session.add(ol)

    db.session.commit()
    return jsonify(op.to_dict()), 201


@transfers_bp.route('/<int:oid>', methods=['PUT'])
@jwt_required()
def update_transfer(oid):
    op = Operation.query.filter_by(id=oid, operation_type='transfer').first_or_404()
    if op.status == 'done':
        return jsonify({'error': 'Cannot edit a completed transfer'}), 400
    data = request.get_json()

    if 'notes' in data: op.notes = data['notes']
    if 'from_location_id' in data:
        op.from_location_id = int(data['from_location_id']) if data['from_location_id'] else None
    if 'to_location_id' in data:
        op.to_location_id = int(data['to_location_id']) if data['to_location_id'] else None
    if 'warehouse_id' in data:
        op.warehouse_id = int(data['warehouse_id']) if data['warehouse_id'] else None
    if data.get('scheduled_date'):
        op.scheduled_date = datetime.fromisoformat(data['scheduled_date'])

    if 'lines' in data:
        OperationLine.query.filter_by(operation_id=op.id).delete()
        for line in data['lines']:
            ol = OperationLine(
                operation_id=op.id,
                product_id=int(line['product_id']),
                quantity=float(line['quantity'])
            )
            db.session.add(ol)
        db.session.flush()

    if op.status not in ['done', 'canceled'] and op.from_location_id and op.lines:
        all_ok = all(
            stock_at_location(l.product_id, op.from_location_id) >= l.quantity
            for l in op.lines
        )
        op.status = 'ready' if all_ok else 'waiting'

    db.session.commit()
    return jsonify(op.to_dict()), 200


@transfers_bp.route('/<int:oid>/validate', methods=['POST'])
@jwt_required()
def validate_transfer(oid):
    op = Operation.query.filter_by(id=oid, operation_type='transfer').first_or_404()
    if op.status != 'ready':
        return jsonify({'error': 'Only ready transfers can be validated'}), 400

    # Final stock check
    for line in op.lines:
        avail = stock_at_location(line.product_id, op.from_location_id)
        p = Product.query.get(line.product_id)
        if avail < line.quantity:
            return jsonify({'error': f'Insufficient stock for {p.name if p else "product"} at source location (available: {avail})'}), 400

    # Move stock: deduct from source, add to dest
    for line in op.lines:
        update_stock(line.product_id, op.from_location_id, -line.quantity)
        update_stock(line.product_id, op.to_location_id, line.quantity)
        record_move(
            operation_id=op.id,
            product_id=line.product_id,
            from_location_id=op.from_location_id,
            to_location_id=op.to_location_id,
            quantity=line.quantity,
            move_type='transfer',
            reference=op.reference,
            contact=f'{op.from_location.name if op.from_location else ""} → {op.to_location.name if op.to_location else ""}',
        )

    op.status = 'done'
    op.validated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(op.to_dict()), 200


@transfers_bp.route('/<int:oid>/cancel', methods=['POST'])
@jwt_required()
def cancel_transfer(oid):
    op = Operation.query.filter_by(id=oid, operation_type='transfer').first_or_404()
    if op.status == 'done':
        return jsonify({'error': 'Cannot cancel a completed transfer'}), 400
    op.status = 'canceled'
    db.session.commit()
    return jsonify(op.to_dict()), 200
