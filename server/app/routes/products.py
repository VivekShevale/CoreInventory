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


@products_bp.route('/<int:pid>/timeline', methods=['GET'])
@jwt_required()
def get_product_timeline(pid):
    """Full lifetime movement history for a product — receipts, deliveries, transfers, adjustments."""
    from ..models import StockMove, Operation
    from datetime import datetime

    p = Product.query.get_or_404(pid)
    moves = StockMove.query.filter_by(product_id=pid).order_by(StockMove.date.asc()).all()

    # Build running balance
    events = []
    running_balance = 0
    for m in moves:
        if m.move_type in ['in', 'transfer'] and m.to_location_id:
            running_balance += m.quantity
        elif m.move_type == 'out':
            running_balance -= m.quantity
        elif m.move_type == 'adjustment':
            if m.to_location_id:
                running_balance += m.quantity
            else:
                running_balance -= m.quantity
        elif m.move_type == 'transfer' and m.from_location_id and not m.to_location_id:
            running_balance -= m.quantity

        events.append({
            'id': m.id,
            'date': m.date.isoformat() if m.date else None,
            'reference': m.reference,
            'move_type': m.move_type,
            'from_location': m.from_location.name if m.from_location else None,
            'from_code': f"{m.from_location.warehouse.short_code}/{m.from_location.short_code}" if m.from_location else None,
            'to_location': m.to_location.name if m.to_location else None,
            'to_code': f"{m.to_location.warehouse.short_code}/{m.to_location.short_code}" if m.to_location else None,
            'quantity': m.quantity,
            'contact': m.contact,
            'running_balance': max(0, running_balance),
            'direction': 'in' if m.move_type in ['in', 'adjustment'] and m.to_location_id else 'out',
        })

    # Summary stats
    total_received = sum(e['quantity'] for e in events if e['move_type'] == 'in')
    total_delivered = sum(e['quantity'] for e in events if e['move_type'] == 'out')
    total_transferred = sum(e['quantity'] for e in events if e['move_type'] == 'transfer')
    total_adjusted = sum(e['quantity'] for e in events if e['move_type'] == 'adjustment')

    return jsonify({
        'product': p.to_dict(),
        'events': list(reversed(events)),  # newest first for display
        'summary': {
            'total_received': total_received,
            'total_delivered': total_delivered,
            'total_transferred': total_transferred,
            'total_adjusted': total_adjusted,
            'current_stock': p.total_stock(),
            'total_moves': len(events),
        },
    }), 200

@products_bp.route('/', methods=['GET'])
@jwt_required()
def get_products():
    category_id = request.args.get('category_id')
    location_id = request.args.get('location_id')
    warehouse_id = request.args.get('warehouse_id')
    search = request.args.get('search', '')
    in_stock_only = request.args.get('in_stock_only', 'false').lower() == 'true'

    if location_id:
        # Return only products that have stock > 0 at this location
        stock_rows = StockLevel.query.filter(
            StockLevel.location_id == int(location_id),
            StockLevel.quantity > 0
        ).all()
        product_ids = [sl.product_id for sl in stock_rows]
        query = Product.query.filter(Product.id.in_(product_ids))
    elif warehouse_id:
        # Return products with stock > 0 in any location of this warehouse
        from ..models import Warehouse as WH
        wh = WH.query.get(warehouse_id)
        if wh:
            loc_ids = [l.id for l in wh.locations]
            stock_rows = StockLevel.query.filter(
                StockLevel.location_id.in_(loc_ids),
                StockLevel.quantity > 0
            ).all()
            product_ids = list({sl.product_id for sl in stock_rows})
            query = Product.query.filter(Product.id.in_(product_ids))
        else:
            query = Product.query
    else:
        query = Product.query

    if category_id:
        query = query.filter_by(category_id=int(category_id))
    if search:
        query = query.filter(
            (Product.name.ilike(f'%{search}%')) | (Product.sku.ilike(f'%{search}%'))
        )
    products = query.order_by(Product.name).all()

    # Attach location-specific stock if location_id provided
    if location_id:
        lid = int(location_id)
        result = []
        for p in products:
            sl = StockLevel.query.filter_by(product_id=p.id, location_id=lid).first()
            d = p.to_dict()
            d['location_stock'] = sl.quantity if sl else 0
            result.append(d)
        return jsonify(result), 200

    return jsonify([p.to_dict() for p in products]), 200



@products_bp.route('/<int:pid>/stock-distribution', methods=['GET'])
@jwt_required()
def get_product_stock_distribution(pid):
    """Get stock levels broken down by location and warehouse for a product."""
    p = Product.query.get_or_404(pid)
    distribution = []
    total = 0
    for sl in p.stock_levels:
        loc = sl.location
        if loc:
            distribution.append({
                'location_id': loc.id,
                'location_name': loc.name,
                'location_code': loc.short_code,
                'warehouse_id': loc.warehouse_id,
                'warehouse_name': loc.warehouse.name if loc.warehouse else None,
                'warehouse_code': loc.warehouse.short_code if loc.warehouse else None,
                'quantity': sl.quantity,
                'value': round(sl.quantity * p.cost_price, 2),
            })
            total += sl.quantity
    return jsonify({
        'product': p.to_dict(),
        'distribution': distribution,
        'total_stock': total,
        'total_value': round(total * p.cost_price, 2),
    }), 200

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
