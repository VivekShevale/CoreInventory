from .extensions import db
from datetime import datetime


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    login_id = db.Column(db.String(12), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(100))
    avatar_url = db.Column(db.String(512))
    otp_code = db.Column(db.String(6))
    otp_expires = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'login_id': self.login_id,
            'email': self.email,
            'full_name': self.full_name,
            'avatar_url': self.avatar_url,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Warehouse(db.Model):
    __tablename__ = 'warehouses'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    short_code = db.Column(db.String(10), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    locations = db.relationship('Location', backref='warehouse', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'short_code': self.short_code,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'location_count': len(self.locations)
        }


class Location(db.Model):
    __tablename__ = 'locations'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    short_code = db.Column(db.String(20), nullable=False)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'short_code': self.short_code,
            'warehouse_id': self.warehouse_id,
            'warehouse_name': self.warehouse.name if self.warehouse else None,
            'warehouse_code': self.warehouse.short_code if self.warehouse else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Category(db.Model):
    __tablename__ = 'categories'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'id': self.id, 'name': self.name}


class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    sku = db.Column(db.String(50), unique=True, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    unit_of_measure = db.Column(db.String(20), default='unit')
    cost_price = db.Column(db.Float, default=0.0)
    image_url = db.Column(db.String(512))
    reorder_point = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    category = db.relationship('Category', backref='products')
    stock_levels = db.relationship('StockLevel', backref='product', lazy=True)

    def total_stock(self):
        return sum(s.quantity for s in self.stock_levels)

    def free_to_use(self):
        # Free stock = total - reserved (pending deliveries)
        reserved = db.session.query(db.func.sum(OperationLine.quantity)).join(
            Operation, OperationLine.operation_id == Operation.id
        ).filter(
            OperationLine.product_id == self.id,
            Operation.operation_type == 'delivery',
            Operation.status.in_(['draft', 'waiting', 'ready'])
        ).scalar() or 0
        return max(0, self.total_stock() - reserved)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'sku': self.sku,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'unit_of_measure': self.unit_of_measure,
            'cost_price': self.cost_price,
            'image_url': self.image_url,
            'reorder_point': self.reorder_point,
            'on_hand': self.total_stock(),
            'free_to_use': self.free_to_use(),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class StockLevel(db.Model):
    __tablename__ = 'stock_levels'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    quantity = db.Column(db.Float, default=0.0)
    location = db.relationship('Location', backref='stock_levels')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'location_id': self.location_id,
            'location_name': self.location.name if self.location else None,
            'quantity': self.quantity
        }


class Operation(db.Model):
    """Unified model for Receipts, Deliveries, Transfers, Adjustments"""
    __tablename__ = 'operations'
    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(30), unique=True, nullable=False)
    operation_type = db.Column(db.String(20), nullable=False)  # receipt, delivery, transfer, adjustment
    status = db.Column(db.String(20), default='draft')  # draft, waiting, ready, done, canceled
    
    from_location_id = db.Column(db.Integer, db.ForeignKey('locations.id'))
    to_location_id = db.Column(db.Integer, db.ForeignKey('locations.id'))
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'))
    
    contact = db.Column(db.String(200))  # vendor/customer name
    scheduled_date = db.Column(db.DateTime)
    responsible_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    validated_at = db.Column(db.DateTime)

    from_location = db.relationship('Location', foreign_keys=[from_location_id])
    to_location = db.relationship('Location', foreign_keys=[to_location_id])
    warehouse = db.relationship('Warehouse', backref='operations')
    responsible = db.relationship('User', backref='operations')
    lines = db.relationship('OperationLine', backref='operation', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'reference': self.reference,
            'operation_type': self.operation_type,
            'status': self.status,
            'from_location_id': self.from_location_id,
            'from_location': self.from_location.name if self.from_location else 'Vendor',
            'from_code': f"{self.from_location.warehouse.short_code}/{self.from_location.short_code}" if self.from_location else 'Vendor',
            'to_location_id': self.to_location_id,
            'to_location': self.to_location.name if self.to_location else 'Vendor',
            'to_code': f"{self.to_location.warehouse.short_code}/{self.to_location.short_code}" if self.to_location else 'Vendor',
            'warehouse_id': self.warehouse_id,
            'contact': self.contact,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'responsible_id': self.responsible_id,
            'responsible_name': self.responsible.full_name or self.responsible.login_id if self.responsible else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'validated_at': self.validated_at.isoformat() if self.validated_at else None,
            'lines': [l.to_dict() for l in self.lines]
        }


class OperationLine(db.Model):
    __tablename__ = 'operation_lines'
    id = db.Column(db.Integer, primary_key=True)
    operation_id = db.Column(db.Integer, db.ForeignKey('operations.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Float, nullable=False, default=0)
    done_quantity = db.Column(db.Float, default=0)
    product = db.relationship('Product', backref='operation_lines')

    def to_dict(self):
        p = self.product
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': p.name if p else None,
            'product_sku': p.sku if p else None,
            'display': f"[{p.sku}] {p.name}" if p else None,
            'quantity': self.quantity,
            'done_quantity': self.done_quantity,
            'on_hand': p.total_stock() if p else 0,
            'unit_of_measure': p.unit_of_measure if p else 'unit'
        }


class StockMove(db.Model):
    """Ledger of all stock movements"""
    __tablename__ = 'stock_moves'
    id = db.Column(db.Integer, primary_key=True)
    operation_id = db.Column(db.Integer, db.ForeignKey('operations.id'))
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    from_location_id = db.Column(db.Integer, db.ForeignKey('locations.id'))
    to_location_id = db.Column(db.Integer, db.ForeignKey('locations.id'))
    quantity = db.Column(db.Float, nullable=False)
    move_type = db.Column(db.String(20))  # in, out, transfer, adjustment
    reference = db.Column(db.String(30))
    contact = db.Column(db.String(200))
    date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='done')

    operation = db.relationship('Operation', backref='stock_moves')
    product = db.relationship('Product', backref='stock_moves')
    from_location = db.relationship('Location', foreign_keys=[from_location_id])
    to_location = db.relationship('Location', foreign_keys=[to_location_id])

    def to_dict(self):
        return {
            'id': self.id,
            'operation_id': self.operation_id,
            'reference': self.reference,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'product_sku': self.product.sku if self.product else None,
            'from_location': self.from_location.name if self.from_location else 'Vendor',
            'from_code': f"{self.from_location.warehouse.short_code}/{self.from_location.short_code}" if self.from_location else 'Vendor',
            'to_location': self.to_location.name if self.to_location else 'Vendor',
            'to_code': f"{self.to_location.warehouse.short_code}/{self.to_location.short_code}" if self.to_location else 'Vendor',
            'quantity': self.quantity,
            'move_type': self.move_type,
            'contact': self.contact,
            'date': self.date.isoformat() if self.date else None,
            'status': self.status
        }
