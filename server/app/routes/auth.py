from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import random
import re

from ..extensions import db, mail
from ..models import User
from flask_mail import Message

auth_bp = Blueprint('auth', __name__)


def validate_password(password):
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain a lowercase letter"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain an uppercase letter"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain a special character"
    return True, ""


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    login_id = data.get('login_id', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')
    full_name = data.get('full_name', '').strip()

    if not login_id or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400

    if len(login_id) < 6 or len(login_id) > 12:
        return jsonify({'error': 'Login ID must be 6-12 characters'}), 400

    if password != confirm_password:
        return jsonify({'error': 'Passwords do not match'}), 400

    valid, msg = validate_password(password)
    if not valid:
        return jsonify({'error': msg}), 400

    if User.query.filter_by(login_id=login_id).first():
        return jsonify({'error': 'Login ID already taken'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400

    user = User(
        login_id=login_id,
        email=email,
        password_hash=generate_password_hash(password),
        full_name=full_name
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    login_id = data.get('login_id', '').strip()
    password = data.get('password', '')

    user = User.query.filter_by(login_id=login_id).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid login ID or password'}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict()), 200


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'message': 'If this email exists, an OTP has been sent'}), 200

    otp = str(random.randint(100000, 999999))
    user.otp_code = otp
    user.otp_expires = datetime.utcnow() + timedelta(minutes=10)
    db.session.commit()

    try:
        msg = Message(
            subject='CoreInventory - Password Reset OTP',
            recipients=[email],
            html=f"""
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px;">
              <h2 style="color:#1e293b;">CoreInventory Password Reset</h2>
              <p>Your OTP code is:</p>
              <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#6366f1;padding:16px 0;">{otp}</div>
              <p style="color:#64748b;">This OTP expires in 10 minutes.</p>
            </div>
            """
        )
        mail.send(msg)
    except Exception as e:
        print(f"Mail error: {e}")

    return jsonify({'message': 'OTP sent to email'}), 200


@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    otp = data.get('otp', '').strip()
    new_password = data.get('new_password', '')

    user = User.query.filter_by(email=email).first()
    if not user or user.otp_code != otp:
        return jsonify({'error': 'Invalid OTP'}), 400

    if datetime.utcnow() > user.otp_expires:
        return jsonify({'error': 'OTP expired'}), 400

    valid, msg = validate_password(new_password)
    if not valid:
        return jsonify({'error': msg}), 400

    user.password_hash = generate_password_hash(new_password)
    user.otp_code = None
    user.otp_expires = None
    db.session.commit()

    return jsonify({'message': 'Password reset successfully'}), 200


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    if 'full_name' in data:
        user.full_name = data['full_name']
    if 'avatar_url' in data:
        user.avatar_url = data['avatar_url']
    if 'email' in data:
        existing = User.query.filter_by(email=data['email']).first()
        if existing and existing.id != user.id:
            return jsonify({'error': 'Email already in use'}), 400
        user.email = data['email']

    db.session.commit()
    return jsonify(user.to_dict()), 200
