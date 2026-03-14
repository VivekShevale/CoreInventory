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


def stock_at_location(product_id, location_id):
    """Get stock quantity for a product at a specific location."""
    if not location_id:
        p = Product.query.get(product_id)
        return p.total_stock() if p else 0
    sl = StockLevel.query.filter_by(product_id=product_id, location_id=location_id).first()
    return sl.quantity if sl else 0


def compute_status(lines, from_location_id):
    """Return 'ready' if all lines have enough stock, else 'waiting'."""
    for line in lines:
        pid = line.get('product_id') if isinstance(line, dict) else line.product_id
        qty = line.get('quantity') if isinstance(line, dict) else line.quantity
        if stock_at_location(pid, from_location_id) < qty:
            return 'waiting'
    return 'ready'


def promote_waiting_deliveries(product_ids):
    """After a receipt is validated, re-check all waiting deliveries
    that contain any of the newly stocked products and promote to ready if possible."""
    waiting_ops = Operation.query.filter(
        Operation.operation_type == 'delivery',
        Operation.status == 'waiting'
    ).all()
    for op in waiting_ops:
        op_product_ids = {l.product_id for l in op.lines}
        if op_product_ids.intersection(set(product_ids)):
            new_status = compute_status(op.lines, op.from_location_id)
            if new_status == 'ready':
                op.status = 'ready'


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
    from_location_id = int(data['from_location_id']) if data.get('from_location_id') else None
    wh_code = get_wh_code(warehouse_id)
    reference = generate_reference(wh_code, 'delivery')

    op = Operation(
        reference=reference,
        operation_type='delivery',
        status='draft',
        from_location_id=from_location_id,
        warehouse_id=warehouse_id,
        contact=data.get('contact'),
        scheduled_date=datetime.fromisoformat(data['scheduled_date']) if data.get('scheduled_date') else None,
        responsible_id=int(user_id),
        notes=data.get('notes')
    )
    db.session.add(op)
    db.session.flush()

    lines = data.get('lines', [])
    for line in lines:
        ol = OperationLine(
            operation_id=op.id,
            product_id=int(line['product_id']),
            quantity=float(line['quantity'])
        )
        db.session.add(ol)
    db.session.flush()

    # Determine status based on stock at source location
    if lines:
        op.status = compute_status(lines, from_location_id)
    else:
        op.status = 'draft'

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
    if 'from_location_id' in data:
        op.from_location_id = int(data['from_location_id']) if data['from_location_id'] else None
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

    # Re-compute status (never downgrade a done/canceled op)
    if op.status not in ['done', 'canceled']:
        op.status = compute_status(op.lines, op.from_location_id)

    db.session.commit()
    return jsonify(op.to_dict()), 200


@delivery_bp.route('/<int:oid>/validate', methods=['POST'])
@jwt_required()
def validate_delivery(oid):
    op = Operation.query.filter_by(id=oid, operation_type='delivery').first_or_404()
    if op.status != 'ready':
        return jsonify({'error': 'Only ready deliveries can be validated'}), 400

    # Final stock check at source location
    for line in op.lines:
        avail = stock_at_location(line.product_id, op.from_location_id)
        p = Product.query.get(line.product_id)
        if avail < line.quantity:
            return jsonify({'error': f'Insufficient stock for {p.name if p else line.product_id} at selected location (available: {avail})'}), 400

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


@delivery_bp.route('/products-at-location/<int:location_id>', methods=['GET'])
@jwt_required()
def products_at_location(location_id):
    """Return products that have stock > 0 at a specific location."""
    stock_rows = StockLevel.query.filter(
        StockLevel.location_id == location_id,
        StockLevel.quantity > 0
    ).all()
    result = []
    for sl in stock_rows:
        p = sl.product
        if p:
            result.append({
                'id': p.id,
                'name': p.name,
                'sku': p.sku,
                'unit_of_measure': p.unit_of_measure,
                'on_hand': sl.quantity,
                'free_to_use': p.free_to_use(),
                'cost_price': p.cost_price,
                'category_name': p.category.name if p.category else None,
            })
    return jsonify(result), 200
