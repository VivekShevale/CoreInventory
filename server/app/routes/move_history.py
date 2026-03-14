from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import StockMove, Product

move_history_bp = Blueprint('move_history', __name__)


@move_history_bp.route('/', methods=['GET'])
@jwt_required()
def get_move_history():
    search = request.args.get('search', '')
    move_type = request.args.get('move_type')
    product_id = request.args.get('product_id')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    query = StockMove.query

    if search:
        query = query.filter(
            (StockMove.reference.ilike(f'%{search}%')) |
            (StockMove.contact.ilike(f'%{search}%'))
        )
    if move_type:
        query = query.filter_by(move_type=move_type)
    if product_id:
        query = query.filter_by(product_id=int(product_id))
    if date_from:
        from datetime import datetime
        query = query.filter(StockMove.date >= datetime.fromisoformat(date_from))
    if date_to:
        from datetime import datetime
        query = query.filter(StockMove.date <= datetime.fromisoformat(date_to + 'T23:59:59'))

    moves = query.order_by(StockMove.date.desc()).all()
    return jsonify([m.to_dict() for m in moves]), 200


@move_history_bp.route('/products', methods=['GET'])
@jwt_required()
def list_products_for_filter():
    """Return minimal product list for the filter dropdown."""
    products = Product.query.order_by(Product.name).all()
    return jsonify([{'id': p.id, 'name': p.name, 'sku': p.sku} for p in products]), 200
