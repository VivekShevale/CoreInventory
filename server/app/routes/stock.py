from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Product, StockLevel, Location

stock_bp = Blueprint('stock', __name__)


@stock_bp.route('/', methods=['GET'])
@jwt_required()
def get_stock():
    search = request.args.get('search', '')
    location_id = request.args.get('location_id')
    query = Product.query
    if search:
        query = query.filter(
            (Product.name.ilike(f'%{search}%')) | (Product.sku.ilike(f'%{search}%'))
        )
    products = query.order_by(Product.name).all()
    result = []
    for p in products:
        if location_id:
            sl = StockLevel.query.filter_by(product_id=p.id, location_id=location_id).first()
            on_hand = sl.quantity if sl else 0
        else:
            on_hand = p.total_stock()
        result.append({
            'product_id': p.id,
            'product_name': p.name,
            'sku': p.sku,
            'unit_of_measure': p.unit_of_measure,
            'cost_price': p.cost_price,
            'on_hand': on_hand,
            'free_to_use': p.free_to_use(),
            'reorder_point': p.reorder_point,
            'is_low_stock': on_hand <= p.reorder_point and p.reorder_point > 0,
            'is_out_of_stock': on_hand == 0,
            'category': p.category.name if p.category else None
        })
    return jsonify(result), 200


@stock_bp.route('/update', methods=['POST'])
@jwt_required()
def manual_update_stock():
    """Manual stock adjustment from Stock page"""
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
