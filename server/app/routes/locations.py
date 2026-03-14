from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Location

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
