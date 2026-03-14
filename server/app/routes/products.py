from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Product, Category, StockLevel, Location

products_bp = Blueprint('products', __name__)


# Categories (before /<int:pid> to avoid route shadowing)

@products_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    cats = Category.query.order_by(Category.name).all()
    return jsonify([c.to_dict() for c in cats]), 200


@products_bp.route('/categories', methods=['POST'])
@jwt_required()
def create_category():
    data = request.get_json()
    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    if Category.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Category already exists'}), 400
    cat = Category(name=data['name'])
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict()), 201


@products_bp.route('/categories/<int:cid>', methods=['DELETE'])
@jwt_required()
def delete_category(cid):
    cat = Category.query.get_or_404(cid)
    db.session.delete(cat)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


# Products

@products_bp.route('/', methods=['GET'])
@jwt_required()
def get_products():
    category_id = request.args.get('category_id')
    search = request.args.get('search', '')
    query = Product.query
    if category_id:
        query = query.filter_by(category_id=category_id)
    if search:
        query = query.filter(
            (Product.name.ilike(f'%{search}%')) | (Product.sku.ilike(f'%{search}%'))
        )
    products = query.order_by(Product.name).all()
    return jsonify([p.to_dict() for p in products]), 200


@products_bp.route('/<int:pid>', methods=['GET'])
@jwt_required()
def get_product(pid):
    p = Product.query.get_or_404(pid)
    data = p.to_dict()
    data['stock_by_location'] = [s.to_dict() for s in p.stock_levels]
    return jsonify(data), 200


@products_bp.route('/', methods=['POST'])
@jwt_required()
def create_product():
    data = request.get_json()
    if not data.get('name') or not data.get('sku'):
        return jsonify({'error': 'Name and SKU are required'}), 400
    if Product.query.filter_by(sku=data['sku']).first():
        return jsonify({'error': 'SKU already exists'}), 400

    product = Product(
        name=data['name'],
        sku=data['sku'],
        category_id=data.get('category_id') or None,
        unit_of_measure=data.get('unit_of_measure', 'unit'),
        cost_price=float(data.get('cost_price') or 0),
        image_url=data.get('image_url'),
        reorder_point=float(data.get('reorder_point') or 0)
    )
    db.session.add(product)
    db.session.flush()

    initial_qty = float(data.get('initial_stock') or 0)
    location_id = data.get('location_id')
    if initial_qty > 0 and location_id:
        sl = StockLevel(product_id=product.id, location_id=int(location_id), quantity=initial_qty)
        db.session.add(sl)

    db.session.commit()
    return jsonify(product.to_dict()), 201


@products_bp.route('/<int:pid>', methods=['PUT'])
@jwt_required()
def update_product(pid):
    p = Product.query.get_or_404(pid)
    data = request.get_json()
    for field in ['name', 'unit_of_measure', 'image_url']:
        if field in data:
            setattr(p, field, data[field])
    if 'category_id' in data:
        p.category_id = data['category_id'] or None
    if 'cost_price' in data:
        p.cost_price = float(data['cost_price'] or 0)
    if 'reorder_point' in data:
        p.reorder_point = float(data['reorder_point'] or 0)
    db.session.commit()
    return jsonify(p.to_dict()), 200


@products_bp.route('/<int:pid>', methods=['DELETE'])
@jwt_required()
def delete_product(pid):
    p = Product.query.get_or_404(pid)
    StockLevel.query.filter_by(product_id=pid).delete()
    db.session.delete(p)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200
