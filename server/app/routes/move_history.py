from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import StockMove

move_history_bp = Blueprint('move_history', __name__)


@move_history_bp.route('/', methods=['GET'])
@jwt_required()
def get_move_history():
    search = request.args.get('search', '')
    move_type = request.args.get('move_type')
    status = request.args.get('status')
    query = StockMove.query
    if search:
        query = query.filter(
            (StockMove.reference.ilike(f'%{search}%')) |
            (StockMove.contact.ilike(f'%{search}%'))
        )
    if move_type:
        query = query.filter_by(move_type=move_type)
    if status:
        query = query.filter_by(status=status)
    moves = query.order_by(StockMove.date.desc()).all()
    return jsonify([m.to_dict() for m in moves]), 200
