from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Product, StockLevel, Location, Warehouse

stock_bp = Blueprint('stock', __name__)


@stock_bp.route('/', methods=['GET'])
@jwt_required()
def get_stock():
    search = request.args.get('search', '')
    location_id = request.args.get('location_id')
    warehouse_id = request.args.get('warehouse_id')

    query = Product.query

    if search:
        query = query.filter(
            (Product.name.ilike(f'%{search}%')) | (Product.sku.ilike(f'%{search}%'))
        )

    products = query.order_by(Product.name).all()
    result = []

    for p in products:
        if location_id:
            sl = StockLevel.query.filter_by(product_id=p.id, location_id=int(location_id)).first()
            on_hand = sl.quantity if sl else 0
        elif warehouse_id:
            wh = Warehouse.query.get(int(warehouse_id))
            if wh:
                loc_ids = [l.id for l in wh.locations]
                on_hand = sum(
                    sl.quantity for sl in StockLevel.query.filter(
                        StockLevel.product_id == p.id,
                        StockLevel.location_id.in_(loc_ids)
                    ).all()
                )
            else:
                on_hand = p.total_stock()
        else:
            on_hand = p.total_stock()

        total_value = round(on_hand * p.cost_price, 2)

        result.append({
            'product_id': p.id,
            'product_name': p.name,
            'sku': p.sku,
            'unit_of_measure': p.unit_of_measure,
            'cost_price': p.cost_price,
            'on_hand': on_hand,
            'free_to_use': p.free_to_use(),
            'total_value': total_value,
            'reorder_point': p.reorder_point,
            'is_low_stock': on_hand <= p.reorder_point and p.reorder_point > 0,
            'is_out_of_stock': on_hand == 0,
            'category': p.category.name if p.category else None,
            'image_url': p.image_url,
        })

    return jsonify(result), 200


@stock_bp.route('/alerts', methods=['GET'])
@jwt_required()
def get_stock_alerts():
    """Return all products that are low stock or out of stock."""
    products = Product.query.all()
    alerts = []
    for p in products:
        total = p.total_stock()
        if total == 0:
            alerts.append({
                'product_id': p.id,
                'product_name': p.name,
                'sku': p.sku,
                'on_hand': total,
                'reorder_point': p.reorder_point,
                'alert_type': 'out_of_stock',
                'message': f'{p.name} is out of stock',
            })
        elif total <= p.reorder_point and p.reorder_point > 0:
            alerts.append({
                'product_id': p.id,
                'product_name': p.name,
                'sku': p.sku,
                'on_hand': total,
                'reorder_point': p.reorder_point,
                'alert_type': 'low_stock',
                'message': f'{p.name} is low on stock ({total} left, reorder point: {p.reorder_point})',
            })
    return jsonify(alerts), 200


@stock_bp.route('/update', methods=['POST'])
@jwt_required()
def manual_update_stock():
    data = request.get_json()
    product_id = data.get('product_id')
    location_id = data.get('location_id')
    quantity = data.get('quantity', 0)

    sl = StockLevel.query.filter_by(product_id=product_id, location_id=location_id).first()
    if sl:
        sl.quantity = quantity
    else:
        sl = StockLevel(product_id=product_id, location_id=location_id, quantity=quantity)
        db.session.add(sl)

    db.session.commit()
    return jsonify({'message': 'Stock updated', 'quantity': quantity}), 200
