"""
CoreInventory — Seed Script
============================
Inserts realistic dummy data for development/testing.

Usage:
    cd server
    python seed.py

What gets created:
    • 1 admin user          (login: admin123 / password: Admin@123)
    • 1 staff user          (login: staff01  / password: Staff@123)
    • 2 warehouses          (Main Warehouse, Secondary Warehouse)
    • 6 locations           (spread across both warehouses)
    • 6 product categories
    • 20 products           (with stock levels)
    • 5 receipts            (mix of draft / ready / done)
    • 5 deliveries          (mix of statuses)
    • 3 stock adjustments
    • Full move history     (auto-generated from validated ops)
"""

import sys
import os
from datetime import datetime, timedelta
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db
from app.models import (
    User, Warehouse, Location, Category, Product,
    StockLevel, Operation, OperationLine, StockMove
)
from app.utils.reference import generate_reference
from app.utils.stock_utils import update_stock, record_move
from werkzeug.security import generate_password_hash

app = create_app()


def seed():
    with app.app_context():
        print("\n🌱  CoreInventory Seed Script")
        print("=" * 45)

        # ── Wipe existing data ──────────────────────────
        print("🗑   Clearing existing data...")
        StockMove.query.delete()
        OperationLine.query.delete()
        Operation.query.delete()
        StockLevel.query.delete()
        Product.query.delete()
        Category.query.delete()
        Location.query.delete()
        Warehouse.query.delete()
        User.query.delete()
        db.session.commit()

        # ── Users ───────────────────────────────────────
        print("👤  Creating users...")
        admin = User(
            login_id="admin123",
            email="admin@coreinventory.com",
            password_hash=generate_password_hash("Admin@123"),
            full_name="Alex Morgan",
        )
        staff = User(
            login_id="staff01",
            email="staff@coreinventory.com",
            password_hash=generate_password_hash("Staff@123"),
            full_name="Sam Taylor",
        )
        db.session.add_all([admin, staff])
        db.session.flush()

        # ── Warehouses ──────────────────────────────────
        print("🏭  Creating warehouses...")
        wh_main = Warehouse(name="Main Warehouse", short_code="WH")
        wh_sec  = Warehouse(name="Secondary Warehouse", short_code="WH2")
        db.session.add_all([wh_main, wh_sec])
        db.session.flush()

        # ── Locations ───────────────────────────────────
        print("📍  Creating locations...")
        locs_data = [
            # Main Warehouse
            dict(name="Stock Room A",      short_code="STK-A",  warehouse_id=wh_main.id),
            dict(name="Stock Room B",      short_code="STK-B",  warehouse_id=wh_main.id),
            dict(name="Production Floor",  short_code="PROD",   warehouse_id=wh_main.id),
            dict(name="Receiving Bay",     short_code="RCV",    warehouse_id=wh_main.id),
            # Secondary Warehouse
            dict(name="Rack Section 1",    short_code="RCK-1",  warehouse_id=wh_sec.id),
            dict(name="Cold Storage",      short_code="COLD",   warehouse_id=wh_sec.id),
        ]
        locs = []
        for d in locs_data:
            loc = Location(**d)
            db.session.add(loc)
            locs.append(loc)
        db.session.flush()

        loc_stk_a, loc_stk_b, loc_prod, loc_rcv, loc_rck1, loc_cold = locs

        # ── Categories ──────────────────────────────────
        print("🏷   Creating categories...")
        cat_names = ["Furniture", "Electronics", "Raw Materials", "Office Supplies", "Packaging", "Spare Parts"]
        cats = {}
        for name in cat_names:
            c = Category(name=name)
            db.session.add(c)
            cats[name] = c
        db.session.flush()

        # ── Products ────────────────────────────────────
        print("📦  Creating products...")
        products_data = [
            # Furniture
            dict(name="Office Desk",        sku="DESK001", category="Furniture",       uom="unit",  cost=4500,  reorder=5),
            dict(name="Executive Chair",    sku="CHR001",  category="Furniture",       uom="unit",  cost=3200,  reorder=5),
            dict(name="Filing Cabinet",     sku="CAB001",  category="Furniture",       uom="unit",  cost=2800,  reorder=3),
            dict(name="Bookshelf",          sku="BSH001",  category="Furniture",       uom="unit",  cost=1800,  reorder=3),
            # Electronics
            dict(name="Laptop Stand",       sku="LST001",  category="Electronics",     uom="unit",  cost=1200,  reorder=10),
            dict(name="Wireless Keyboard",  sku="KBD001",  category="Electronics",     uom="unit",  cost=950,   reorder=10),
            dict(name="USB-C Hub",          sku="USB001",  category="Electronics",     uom="unit",  cost=750,   reorder=15),
            dict(name="Monitor 24\"",       sku="MON001",  category="Electronics",     uom="unit",  cost=12000, reorder=3),
            # Raw Materials
            dict(name="Steel Rods",         sku="STL001",  category="Raw Materials",   uom="kg",    cost=85,    reorder=100),
            dict(name="Aluminum Sheet",     sku="ALM001",  category="Raw Materials",   uom="kg",    cost=120,   reorder=50),
            dict(name="Plywood 18mm",       sku="PLY001",  category="Raw Materials",   uom="unit",  cost=680,   reorder=20),
            dict(name="PVC Pipe 1\"",       sku="PVC001",  category="Raw Materials",   uom="m",     cost=45,    reorder=200),
            # Office Supplies
            dict(name="A4 Paper Ream",      sku="PPR001",  category="Office Supplies", uom="box",   cost=280,   reorder=20),
            dict(name="Whiteboard Marker",  sku="MKR001",  category="Office Supplies", uom="pcs",   cost=35,    reorder=50),
            dict(name="Stapler",            sku="STP001",  category="Office Supplies", uom="unit",  cost=180,   reorder=5),
            # Packaging
            dict(name="Bubble Wrap Roll",   sku="BWR001",  category="Packaging",       uom="m",     cost=12,    reorder=500),
            dict(name="Cardboard Box L",    sku="CBL001",  category="Packaging",       uom="unit",  cost=55,    reorder=100),
            dict(name="Packing Tape",       sku="TAP001",  category="Packaging",       uom="unit",  cost=40,    reorder=50),
            # Spare Parts
            dict(name="Bearing 6205",       sku="BRG001",  category="Spare Parts",     uom="unit",  cost=320,   reorder=20),
            dict(name="Drive Belt B40",     sku="BLT001",  category="Spare Parts",     uom="unit",  cost=180,   reorder=10),
        ]

        products = {}
        for d in products_data:
            p = Product(
                name=d["name"],
                sku=d["sku"],
                category_id=cats[d["category"]].id,
                unit_of_measure=d["uom"],
                cost_price=d["cost"],
                reorder_point=d["reorder"],
            )
            db.session.add(p)
            products[d["sku"]] = p
        db.session.flush()

        # ── Initial Stock Levels ─────────────────────────
        print("📊  Setting initial stock levels...")
        stock_data = [
            # (product_sku, location, quantity)
            ("DESK001", loc_stk_a, 25),
            ("CHR001",  loc_stk_a, 40),
            ("CAB001",  loc_stk_a, 12),
            ("BSH001",  loc_stk_b, 18),
            ("LST001",  loc_stk_b, 60),
            ("KBD001",  loc_stk_b, 75),
            ("USB001",  loc_stk_b, 120),
            ("MON001",  loc_stk_a, 8),
            ("STL001",  loc_prod,  450),
            ("ALM001",  loc_prod,  230),
            ("PLY001",  loc_stk_a, 35),
            ("PVC001",  loc_prod,  800),
            ("PPR001",  loc_stk_b, 60),
            ("MKR001",  loc_stk_b, 200),
            ("STP001",  loc_stk_b, 15),
            ("BWR001",  loc_rck1,  1200),
            ("CBL001",  loc_rck1,  350),
            ("TAP001",  loc_rck1,  180),
            ("BRG001",  loc_stk_a, 45),
            ("BLT001",  loc_stk_a, 22),
            # Secondary stock in second location
            ("DESK001", loc_rck1,  10),
            ("CHR001",  loc_rck1,  15),
            ("STL001",  loc_cold,  100),
        ]
        for sku, loc, qty in stock_data:
            sl = StockLevel(product_id=products[sku].id, location_id=loc.id, quantity=qty)
            db.session.add(sl)
        db.session.flush()

        # ── Helper: create validated receipt ────────────────
        def make_receipt(contact, lines, location, warehouse, days_ago, status="done"):
            sched = datetime.utcnow() - timedelta(days=days_ago)
            ref = generate_reference(warehouse.short_code, "receipt")
            op = Operation(
                reference=ref,
                operation_type="receipt",
                status=status,
                to_location_id=location.id,
                warehouse_id=warehouse.id,
                contact=contact,
                scheduled_date=sched,
                responsible_id=admin.id,
            )
            db.session.add(op)
            db.session.flush()
            for sku, qty in lines:
                ol = OperationLine(operation_id=op.id, product_id=products[sku].id, quantity=qty)
                db.session.add(ol)
            if status == "done":
                op.validated_at = sched + timedelta(hours=2)
                for sku, qty in lines:
                    update_stock(products[sku].id, location.id, qty)
                    record_move(op.id, products[sku].id, None, location.id, qty, "in", ref, contact)
            db.session.flush()
            return op

        # ── Helper: create validated delivery ───────────────
        def make_delivery(contact, lines, location, warehouse, days_ago, status="done"):
            sched = datetime.utcnow() - timedelta(days=days_ago)
            ref = generate_reference(warehouse.short_code, "delivery")
            op = Operation(
                reference=ref,
                operation_type="delivery",
                status=status,
                from_location_id=location.id,
                warehouse_id=warehouse.id,
                contact=contact,
                scheduled_date=sched,
                responsible_id=staff.id,
            )
            db.session.add(op)
            db.session.flush()
            for sku, qty in lines:
                ol = OperationLine(operation_id=op.id, product_id=products[sku].id, quantity=qty)
                db.session.add(ol)
            if status == "done":
                op.validated_at = sched + timedelta(hours=3)
                for sku, qty in lines:
                    update_stock(products[sku].id, location.id, -qty)
                    record_move(op.id, products[sku].id, location.id, None, qty, "out", ref, contact)
            db.session.flush()
            return op

        # ── Receipts ─────────────────────────────────────
        print("📥  Creating receipts...")

        # Done receipts
        make_receipt(
            contact="Reliance Industries Ltd",
            lines=[("STL001", 200), ("ALM001", 100)],
            location=loc_prod, warehouse=wh_main, days_ago=20, status="done"
        )
        make_receipt(
            contact="Godrej Interiors",
            lines=[("DESK001", 15), ("CHR001", 20), ("CAB001", 8)],
            location=loc_stk_a, warehouse=wh_main, days_ago=14, status="done"
        )
        make_receipt(
            contact="Staples India",
            lines=[("PPR001", 30), ("MKR001", 100), ("STP001", 10)],
            location=loc_stk_b, warehouse=wh_main, days_ago=7, status="done"
        )

        # Ready (scheduled for today / tomorrow)
        r_ready = make_receipt(
            contact="TATA Steel",
            lines=[("STL001", 150), ("PVC001", 300)],
            location=loc_prod, warehouse=wh_main, days_ago=-1, status="ready"
        )

        # Draft (future)
        r_draft = make_receipt(
            contact="Amazon Business",
            lines=[("LST001", 50), ("KBD001", 40), ("USB001", 80), ("MON001", 5)],
            location=loc_stk_b, warehouse=wh_main, days_ago=-5, status="draft"
        )

        # ── Deliveries ───────────────────────────────────
        print("🚚  Creating deliveries...")

        # Done deliveries
        make_delivery(
            contact="Azure Interiors",
            lines=[("DESK001", 5), ("CHR001", 8)],
            location=loc_stk_a, warehouse=wh_main, days_ago=15, status="done"
        )
        make_delivery(
            contact="Blue Star Pvt Ltd",
            lines=[("KBD001", 20), ("USB001", 30)],
            location=loc_stk_b, warehouse=wh_main, days_ago=10, status="done"
        )
        make_delivery(
            contact="Sharma Constructions",
            lines=[("STL001", 80), ("PLY001", 10)],
            location=loc_prod, warehouse=wh_main, days_ago=5, status="done"
        )

        # Ready delivery
        make_delivery(
            contact="National Packaging Co",
            lines=[("BWR001", 200), ("CBL001", 50), ("TAP001", 30)],
            location=loc_rck1, warehouse=wh_sec, days_ago=-1, status="ready"
        )

        # Waiting delivery (product has low stock)
        make_delivery(
            contact="Prestige Engineering",
            lines=[("BRG001", 30), ("BLT001", 15)],
            location=loc_stk_a, warehouse=wh_main, days_ago=-3, status="waiting"
        )

        # ── Stock Adjustments ────────────────────────────
        print("⚖️   Creating stock adjustments...")

        adj_items = [
            # Adjust after physical count - minor discrepancy in PLY001
            ("PLY001", loc_stk_a, 32),   # was 35, counted 32 → delta -3 (damaged)
            # Adjust BRG001 - found extra units
            ("BRG001", loc_stk_a, 48),   # was 45, found 48 → delta +3
        ]

        for sku, loc, new_qty in adj_items:
            prod = products[sku]
            sl = StockLevel.query.filter_by(product_id=prod.id, location_id=loc.id).first()
            old_qty = sl.quantity if sl else 0
            delta = new_qty - old_qty

            ref = generate_reference(wh_main.short_code, "adjustment")
            op = Operation(
                reference=ref,
                operation_type="adjustment",
                status="done",
                to_location_id=loc.id if delta >= 0 else None,
                from_location_id=loc.id if delta < 0 else None,
                warehouse_id=wh_main.id,
                responsible_id=admin.id,
                notes=f"Physical count adjustment — counted {new_qty}, system had {old_qty}",
                validated_at=datetime.utcnow() - timedelta(days=3),
                scheduled_date=datetime.utcnow() - timedelta(days=3),
            )
            db.session.add(op)
            db.session.flush()

            ol = OperationLine(operation_id=op.id, product_id=prod.id, quantity=abs(delta))
            db.session.add(ol)

            # Update stock
            if sl:
                sl.quantity = new_qty
            else:
                sl = StockLevel(product_id=prod.id, location_id=loc.id, quantity=new_qty)
                db.session.add(sl)

            # Record move
            record_move(
                operation_id=op.id,
                product_id=prod.id,
                from_location_id=loc.id if delta < 0 else None,
                to_location_id=loc.id if delta >= 0 else None,
                quantity=abs(delta),
                move_type="adjustment",
                reference=ref,
                contact="Physical Count"
            )

        db.session.commit()

        # ── Summary ──────────────────────────────────────
        print("\n✅  Seed complete!")
        print("=" * 45)
        print(f"   Users       : {User.query.count()}")
        print(f"   Warehouses  : {Warehouse.query.count()}")
        print(f"   Locations   : {Location.query.count()}")
        print(f"   Categories  : {Category.query.count()}")
        print(f"   Products    : {Product.query.count()}")
        print(f"   Stock rows  : {StockLevel.query.count()}")
        print(f"   Operations  : {Operation.query.count()}")
        print(f"   Op Lines    : {OperationLine.query.count()}")
        print(f"   Move History: {StockMove.query.count()}")
        print()
        print("   🔑  Login Credentials")
        print("   ─────────────────────────────────────")
        print("   Admin  → login: admin123 / Admin@123")
        print("   Staff  → login: staff01  / Staff@123")
        print()
        print("   📋  Sample References Created")
        print("   ─────────────────────────────────────")
        for op in Operation.query.order_by(Operation.id).all():
            status_icon = {"done": "✓", "ready": "→", "draft": "○", "waiting": "⏳"}.get(op.status, "?")
            print(f"   {status_icon}  {op.reference:<18} {op.status:<10} {op.contact or ''}")
        print()


if __name__ == "__main__":
    seed()
