"""
routes/tour.py
--------------
Register this blueprint in your app factory:

    from .routes.tour import tour_bp
    app.register_blueprint(tour_bp)
"""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User

tour_bp = Blueprint('tour', __name__, url_prefix='/api')


@tour_bp.route('/tour/complete', methods=['POST'])
@jwt_required()
def complete_tour():
    """Mark the current user's tour as seen. Called once from the frontend."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    user.has_seen_tour = True
    db.session.commit()

    return jsonify({'message': 'Tour marked as complete', 'has_seen_tour': True}), 200


@tour_bp.route('/tour/reset', methods=['POST'])
@jwt_required()
def reset_tour():
    """
    DEV ONLY — reset tour flag so you can replay it.
    Remove or guard this endpoint in production.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    user.has_seen_tour = False
    db.session.commit()

    return jsonify({'message': 'Tour reset', 'has_seen_tour': False}), 200