from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import datetime, date
from ..extensions import db
from ..models import Operation, Product, StockLevel

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    today = datetime.utcnow().date()

    # Total products
    total_products = Product.query.count()

    # Low stock / out of stock
    products = Product.query.all()
    low_stock = 0
    out_of_stock = 0
    for p in products:
        total = p.total_stock()
        if total == 0:
            out_of_stock += 1
        elif total <= p.reorder_point and p.reorder_point > 0:
            low_stock += 1

    # Pending receipts (not done/canceled)
    pending_receipts = Operation.query.filter(
        Operation.operation_type == 'receipt',
        Operation.status.in_(['draft', 'ready'])
    ).count()

    # Pending deliveries
    pending_deliveries = Operation.query.filter(
        Operation.operation_type == 'delivery',
        Operation.status.in_(['draft', 'waiting', 'ready'])
    ).count()

    # Internal transfers scheduled
    internal_transfers = Operation.query.filter(
        Operation.operation_type == 'transfer',
        Operation.status.in_(['draft', 'ready'])
    ).count()

    # Receipt blocks
    receipts = Operation.query.filter(
        Operation.operation_type == 'receipt',
        Operation.status.in_(['draft', 'ready'])
    ).all()

    receipts_to_receive = len([r for r in receipts if r.status == 'ready'])
    receipts_late = len([r for r in receipts if r.scheduled_date and r.scheduled_date.date() < today])
    receipts_operations = len([r for r in receipts if r.scheduled_date and r.scheduled_date.date() > today])

    # Delivery blocks
    deliveries = Operation.query.filter(
        Operation.operation_type == 'delivery',
        Operation.status.in_(['draft', 'waiting', 'ready'])
    ).all()

    deliveries_to_deliver = len([d for d in deliveries if d.status == 'ready'])
    deliveries_late = len([d for d in deliveries if d.scheduled_date and d.scheduled_date.date() < today])
    deliveries_waiting = len([d for d in deliveries if d.status == 'waiting'])
    deliveries_operations = len([d for d in deliveries if d.scheduled_date and d.scheduled_date.date() > today])

    return jsonify({
        'total_products': total_products,
        'low_stock': low_stock,
        'out_of_stock': out_of_stock,
        'pending_receipts': pending_receipts,
        'pending_deliveries': pending_deliveries,
        'internal_transfers': internal_transfers,
        'receipts': {
            'to_receive': receipts_to_receive,
            'late': receipts_late,
            'operations': receipts_operations,
            'total': len(receipts)
        },
        'deliveries': {
            'to_deliver': deliveries_to_deliver,
            'late': deliveries_late,
            'waiting': deliveries_waiting,
            'operations': deliveries_operations,
            'total': len(deliveries)
        }
    }), 200
