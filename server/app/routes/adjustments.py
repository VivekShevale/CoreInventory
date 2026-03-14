from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from ..extensions import db
from ..models import Operation, OperationLine, StockLevel, Warehouse
from ..utils.reference import generate_reference
from ..utils.stock_utils import record_move

adjustments_bp = Blueprint('adjustments', __name__)


@adjustments_bp.route('/', methods=['GET'])
@jwt_required()
def get_adjustments():
    query = Operation.query.filter_by(operation_type='adjustment')
    ops = query.order_by(Operation.created_at.desc()).all()
    return jsonify([o.to_dict() for o in ops]), 200


@adjustments_bp.route('/', methods=['POST'])
@jwt_required()
def create_adjustment():
    user_id = get_jwt_identity()
    data = request.get_json()
    warehouse_id = data.get('warehouse_id')
    wh = Warehouse.query.get(warehouse_id)
    wh_code = wh.short_code if wh else 'WH'
    reference = generate_reference(wh_code, 'adjustment')

    op = Operation(
        reference=reference,
        operation_type='adjustment',
        status='done',
        to_location_id=data.get('location_id'),
        warehouse_id=warehouse_id,
        responsible_id=int(user_id),
        notes=data.get('notes', 'Manual stock adjustment'),
        validated_at=datetime.utcnow()
    )
    db.session.add(op)
    db.session.flush()

    for line in data.get('lines', []):
        product_id = int(line['product_id'])
        location_id = int(data.get('location_id')) if data.get('location_id') else None
        new_qty = float(line['quantity'])

        # Get current stock
        sl = StockLevel.query.filter_by(product_id=product_id, location_id=location_id).first()
        old_qty = sl.quantity if sl else 0
        delta = new_qty - old_qty

        if sl:
            sl.quantity = new_qty
        else:
            sl = StockLevel(product_id=product_id, location_id=location_id, quantity=new_qty)
            db.session.add(sl)

        ol = OperationLine(operation_id=op.id, product_id=product_id, quantity=abs(delta))
        db.session.add(ol)

        record_move(
            operation_id=op.id,
            product_id=product_id,
            from_location_id=location_id if delta < 0 else None,
            to_location_id=location_id if delta >= 0 else None,
            quantity=abs(delta),
            move_type='adjustment',
            reference=reference,
            contact='Stock Adjustment'
        )

    db.session.commit()
    return jsonify(op.to_dict()), 201
