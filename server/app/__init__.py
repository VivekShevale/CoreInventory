from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from .extensions import db, jwt, mail
import os

def create_app():
    app = Flask(__name__)
    
    # Config
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-prod')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'jwt-secret-change-in-prod')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 86400  # 24 hours
    
    # DB
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/coreinventory')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Mail (Brevo SMTP)
    app.config['MAIL_SERVER'] = 'smtp-relay.brevo.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USERNAME'] = os.getenv('BREVO_SMTP_USER')
    app.config['MAIL_PASSWORD'] = os.getenv('BREVO_SMTP_KEY')
    app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_SENDER', 'noreply@coreinventory.com')

    # Cloudinary
    app.config['CLOUDINARY_CLOUD_NAME'] = os.getenv('CLOUDINARY_CLOUD_NAME')
    app.config['CLOUDINARY_API_KEY'] = os.getenv('CLOUDINARY_API_KEY')
    app.config['CLOUDINARY_API_SECRET'] = os.getenv('CLOUDINARY_API_SECRET')

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.products import products_bp
    from .routes.receipts import receipts_bp
    from .routes.delivery import delivery_bp
    from .routes.warehouse import warehouse_bp
    from .routes.locations import locations_bp
    from .routes.stock import stock_bp
    from .routes.move_history import move_history_bp
    from .routes.dashboard import dashboard_bp
    from .routes.adjustments import adjustments_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(receipts_bp, url_prefix='/api/receipts')
    app.register_blueprint(delivery_bp, url_prefix='/api/delivery')
    app.register_blueprint(warehouse_bp, url_prefix='/api/warehouses')
    app.register_blueprint(locations_bp, url_prefix='/api/locations')
    app.register_blueprint(stock_bp, url_prefix='/api/stock')
    app.register_blueprint(move_history_bp, url_prefix='/api/move-history')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(adjustments_bp, url_prefix='/api/adjustments')

    with app.app_context():
        db.create_all()

    return app
