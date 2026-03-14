from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Warehouse, Location, StockLevel

warehouse_bp = Blueprint('warehouse', __name__)


@warehouse_bp.route('/', methods=['GET'])
@jwt_required()
def get_warehouses():
    warehouses = Warehouse.query.order_by(Warehouse.name).all()
    return jsonify([w.to_dict() for w in warehouses]), 200


@warehouse_bp.route('/<int:wid>', methods=['GET'])
@jwt_required()
def get_warehouse(wid):
    w = Warehouse.query.get_or_404(wid)
    data = w.to_dict()
    locs = []
    for l in w.locations:
        loc_data = l.to_dict()
        stock_rows = StockLevel.query.filter(
            StockLevel.location_id == l.id,
            StockLevel.quantity > 0
        ).all()
        loc_data['product_count'] = len(stock_rows)
        loc_data['total_stock'] = sum(sl.quantity for sl in stock_rows)
        locs.append(loc_data)
    data['locations'] = locs
    return jsonify(data), 200


@warehouse_bp.route('/', methods=['POST'])
@jwt_required()
def create_warehouse():
    data = request.get_json()
    if Warehouse.query.filter_by(short_code=data.get('short_code')).first():
        return jsonify({'error': 'Short code already exists'}), 400
    w = Warehouse(name=data['name'], short_code=data['short_code'].upper())
    db.session.add(w)
    db.session.commit()
    return jsonify(w.to_dict()), 201


@warehouse_bp.route('/<int:wid>', methods=['PUT'])
@jwt_required()
def update_warehouse(wid):
    w = Warehouse.query.get_or_404(wid)
    data = request.get_json()
    if 'name' in data:
        w.name = data['name']
    if 'short_code' in data:
        w.short_code = data['short_code'].upper()
    db.session.commit()
    return jsonify(w.to_dict()), 200


@warehouse_bp.route('/<int:wid>', methods=['DELETE'])
@jwt_required()
def delete_warehouse(wid):
    w = Warehouse.query.get_or_404(wid)
    db.session.delete(w)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200
