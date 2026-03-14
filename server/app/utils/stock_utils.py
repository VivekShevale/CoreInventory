from ..extensions import db
from ..models import StockLevel, StockMove
from datetime import datetime


def update_stock(product_id, location_id, delta):
    """Add delta (positive or negative) to stock at location"""
    if not location_id:
        return
    sl = StockLevel.query.filter_by(product_id=product_id, location_id=location_id).first()
    if sl:
        sl.quantity = max(0, sl.quantity + delta)
    else:
        sl = StockLevel(product_id=product_id, location_id=location_id, quantity=max(0, delta))
        db.session.add(sl)


def record_move(operation_id, product_id, from_location_id, to_location_id, quantity, move_type, reference, contact=None):
    move = StockMove(
        operation_id=operation_id,
        product_id=product_id,
        from_location_id=from_location_id,
        to_location_id=to_location_id,
        quantity=quantity,
        move_type=move_type,
        reference=reference,
        contact=contact,
        date=datetime.utcnow(),
        status='done'
    )
    db.session.add(move)
