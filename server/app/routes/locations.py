from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Location, StockLevel, Product

locations_bp = Blueprint('locations', __name__)


@locations_bp.route('/', methods=['GET'])
@jwt_required()
def get_locations():
    warehouse_id = request.args.get('warehouse_id')
    query = Location.query
    if warehouse_id:
        query = query.filter_by(warehouse_id=warehouse_id)
    locations = query.order_by(Location.name).all()
    return jsonify([l.to_dict() for l in locations]), 200


@locations_bp.route('/<int:lid>', methods=['GET'])
@jwt_required()
def get_location(lid):
    l = Location.query.get_or_404(lid)
    return jsonify(l.to_dict()), 200


@locations_bp.route('/', methods=['POST'])
@jwt_required()
def create_location():
    data = request.get_json()
    loc = Location(
        name=data['name'],
        short_code=data['short_code'].upper(),
        warehouse_id=data['warehouse_id']
    )
    db.session.add(loc)
    db.session.commit()
    return jsonify(loc.to_dict()), 201


@locations_bp.route('/<int:lid>', methods=['PUT'])
@jwt_required()
def update_location(lid):
    loc = Location.query.get_or_404(lid)
    data = request.get_json()
    for field in ['name', 'short_code', 'warehouse_id']:
        if field in data:
            setattr(loc, field, data[field])
    db.session.commit()
    return jsonify(loc.to_dict()), 200


@locations_bp.route('/<int:lid>', methods=['DELETE'])
@jwt_required()
def delete_location(lid):
    loc = Location.query.get_or_404(lid)
    db.session.delete(loc)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


@locations_bp.route('/<int:lid>/stock', methods=['GET'])
@jwt_required()
def get_location_stock(lid):
    """Get all products with stock at a specific location."""
    loc = Location.query.get_or_404(lid)
    stock_rows = StockLevel.query.filter(
        StockLevel.location_id == lid,
        StockLevel.quantity > 0
    ).all()
    products = []
    for sl in stock_rows:
        p = sl.product
        if p:
            products.append({
                'product_id': p.id,
                'product_name': p.name,
                'sku': p.sku,
                'unit_of_measure': p.unit_of_measure,
                'cost_price': p.cost_price,
                'category': p.category.name if p.category else None,
                'on_hand': sl.quantity,
                'free_to_use': p.free_to_use(),
                'reorder_point': p.reorder_point,
                'is_low_stock': sl.quantity <= p.reorder_point and p.reorder_point > 0,
                'is_out_of_stock': sl.quantity == 0,
            })
    return jsonify({
        'location': loc.to_dict(),
        'products': products,
        'total_products': len(products),
        'total_stock_value': sum(s['on_hand'] * s['cost_price'] for s in products),
    }), 200
