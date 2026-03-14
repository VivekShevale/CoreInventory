from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from ..extensions import db
from ..models import Operation, OperationLine, Warehouse, Product, StockLevel
from ..utils.reference import generate_reference
from ..utils.stock_utils import update_stock, record_move

receipts_bp = Blueprint('receipts', __name__)

def _stock_at_location(product_id, location_id):
    if not location_id:
        p = Product.query.get(product_id)
        return p.total_stock() if p else 0
    sl = StockLevel.query.filter_by(product_id=product_id, location_id=location_id).first()
    return sl.quantity if sl else 0


def _promote_waiting_deliveries(product_ids):
    """Re-check all waiting deliveries; promote to ready if stock now sufficient."""
    waiting_ops = Operation.query.filter(
        Operation.operation_type == 'delivery',
        Operation.status == 'waiting'
    ).all()
    for delivery in waiting_ops:
        all_ok = all(
            _stock_at_location(line.product_id, delivery.from_location_id) >= line.quantity
            for line in delivery.lines
        )
        if all_ok:
            delivery.status = 'ready'




def get_wh_code(warehouse_id):
    wh = Warehouse.query.get(warehouse_id)
    return wh.short_code if wh else 'WH'


@receipts_bp.route('/', methods=['GET'])
@jwt_required()
def get_receipts():
    status = request.args.get('status')
    warehouse_id = request.args.get('warehouse_id')
    search = request.args.get('search', '')
    query = Operation.query.filter_by(operation_type='receipt')
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


@receipts_bp.route('/<int:oid>', methods=['GET'])
@jwt_required()
def get_receipt(oid):
    op = Operation.query.filter_by(id=oid, operation_type='receipt').first_or_404()
    return jsonify(op.to_dict()), 200


@receipts_bp.route('/', methods=['POST'])
@jwt_required()
def create_receipt():
    user_id = get_jwt_identity()
    data = request.get_json()
    warehouse_id = int(data['warehouse_id']) if data.get('warehouse_id') else None
    wh_code = get_wh_code(warehouse_id)
    reference = generate_reference(wh_code, 'receipt')

    op = Operation(
        reference=reference,
        operation_type='receipt',
        status='draft',
        to_location_id=int(data['to_location_id']) if data.get('to_location_id') else None,
        warehouse_id=warehouse_id,
        contact=data.get('contact'),
        scheduled_date=datetime.fromisoformat(data['scheduled_date']) if data.get('scheduled_date') else None,
        responsible_id=int(user_id),
        notes=data.get('notes')
    )
    db.session.add(op)
    db.session.flush()

    for line in data.get('lines', []):
        ol = OperationLine(operation_id=op.id, product_id=line['product_id'], quantity=line['quantity'])
        db.session.add(ol)

    db.session.commit()
    return jsonify(op.to_dict()), 201


@receipts_bp.route('/<int:oid>', methods=['PUT'])
@jwt_required()
def update_receipt(oid):
    op = Operation.query.filter_by(id=oid, operation_type='receipt').first_or_404()
    if op.status == 'done':
        return jsonify({'error': 'Cannot edit a done receipt'}), 400
    data = request.get_json()

    if 'contact' in data: op.contact = data['contact']
    if 'notes' in data: op.notes = data['notes']
    if 'to_location_id' in data: op.to_location_id = int(data['to_location_id']) if data['to_location_id'] else None
    if 'warehouse_id' in data: op.warehouse_id = int(data['warehouse_id']) if data['warehouse_id'] else None
    if data.get('scheduled_date'):
        op.scheduled_date = datetime.fromisoformat(data['scheduled_date'])

    # Update lines
    if 'lines' in data:
        OperationLine.query.filter_by(operation_id=op.id).delete()
        for line in data['lines']:
            ol = OperationLine(operation_id=op.id, product_id=line['product_id'], quantity=line['quantity'])
            db.session.add(ol)

    db.session.commit()
    return jsonify(op.to_dict()), 200


@receipts_bp.route('/<int:oid>/confirm', methods=['POST'])
@jwt_required()
def confirm_receipt(oid):
    """Move from draft to ready"""
    op = Operation.query.filter_by(id=oid, operation_type='receipt').first_or_404()
    if op.status != 'draft':
        return jsonify({'error': 'Can only confirm draft receipts'}), 400
    op.status = 'ready'
    db.session.commit()
    return jsonify(op.to_dict()), 200


@receipts_bp.route('/<int:oid>/validate', methods=['POST'])
@jwt_required()
def validate_receipt(oid):
    """Move from ready to done, update stock, then auto-promote waiting deliveries."""
    op = Operation.query.filter_by(id=oid, operation_type='receipt').first_or_404()
    if op.status not in ['ready', 'draft']:
        return jsonify({'error': 'Receipt must be ready to validate'}), 400

    received_product_ids = []
    for line in op.lines:
        update_stock(line.product_id, op.to_location_id, line.quantity)
        record_move(
            operation_id=op.id,
            product_id=line.product_id,
            from_location_id=None,
            to_location_id=op.to_location_id,
            quantity=line.quantity,
            move_type='in',
            reference=op.reference,
            contact=op.contact
        )
        received_product_ids.append(line.product_id)

    op.status = 'done'
    op.validated_at = datetime.utcnow()

    # Auto-promote waiting deliveries that now have enough stock
    _promote_waiting_deliveries(received_product_ids)

    db.session.commit()
    return jsonify(op.to_dict()), 200


@receipts_bp.route('/<int:oid>/cancel', methods=['POST'])
@jwt_required()
def cancel_receipt(oid):
    op = Operation.query.filter_by(id=oid, operation_type='receipt').first_or_404()
    if op.status == 'done':
        return jsonify({'error': 'Cannot cancel a done receipt'}), 400
    op.status = 'canceled'
    db.session.commit()
    return jsonify(op.to_dict()), 200
