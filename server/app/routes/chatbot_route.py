"""
chatbot_route.py — Flask bridge between frontend Claude calls and MCP tool implementations.

The frontend calls Claude's API directly (via the Anthropic API in the artifact),
but tool calls need to be routed THROUGH the Flask backend so we can:
  1. Authenticate the user (JWT required)
  2. Execute database operations securely
  3. Keep DATABASE_URL on the server side only

Add this blueprint to your Flask app/__init__.py:
    from .routes.chatbot import chatbot_bp
    app.register_blueprint(chatbot_bp, url_prefix='/api/chatbot')
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import (
    Product, Category, Warehouse, Location, StockLevel,
    Operation, OperationLine, StockMove, User
)
from ..utils.reference import generate_reference
from ..utils.stock_utils import update_stock, record_move
from datetime import datetime
import json

chatbot_bp = Blueprint('chatbot', __name__)


def _stock_at(product_id, location_id):
    sl = StockLevel.query.filter_by(product_id=product_id, location_id=location_id).first()
    return sl.quantity if sl else 0


def _auto_promote(product_ids):
    waiting = Operation.query.filter(
        Operation.operation_type == 'delivery',
        Operation.status == 'waiting'
    ).all()
    for op in waiting:
        op_pids = {l.product_id for l in op.lines}
        if op_pids.intersection(set(product_ids)):
            all_ok = all(_stock_at(l.product_id, op.from_location_id) >= l.quantity for l in op.lines)
            if all_ok:
                op.status = 'ready'


def _run_tool(tool_name: str, tool_input: dict, user_id: int):
    """Dispatch tool call to appropriate handler."""

    # ── Dashboard ─────────────────────────────────────────────────────────
    if tool_name == "get_dashboard_stats":
        from datetime import date
        today = date.today()
        total_products = Product.query.count()
        products = Product.query.all()
        low_stock = sum(1 for p in products if 0 < p.total_stock() <= p.reorder_point and p.reorder_point > 0)
        out_of_stock = sum(1 for p in products if p.total_stock() == 0)
        pending_receipts = Operation.query.filter(Operation.operation_type == 'receipt', Operation.status.in_(['draft', 'ready'])).count()
        pending_deliveries = Operation.query.filter(Operation.operation_type == 'delivery', Operation.status.in_(['draft', 'waiting', 'ready'])).count()
        transfers = Operation.query.filter(Operation.operation_type == 'transfer', Operation.status.in_(['draft', 'ready'])).count()

        receipts = Operation.query.filter(Operation.operation_type == 'receipt', Operation.status.in_(['draft', 'ready'])).all()
        deliveries = Operation.query.filter(Operation.operation_type == 'delivery', Operation.status.in_(['draft', 'waiting', 'ready'])).all()

        return {
            "total_products": total_products, "low_stock": low_stock, "out_of_stock": out_of_stock,
            "pending_receipts": pending_receipts, "pending_deliveries": pending_deliveries,
            "internal_transfers_scheduled": transfers,
            "receipts_breakdown": {
                "to_receive": sum(1 for r in receipts if r.status == 'ready'),
                "late": sum(1 for r in receipts if r.scheduled_date and r.scheduled_date.date() < today),
            },
            "deliveries_breakdown": {
                "to_deliver": sum(1 for d in deliveries if d.status == 'ready'),
                "waiting": sum(1 for d in deliveries if d.status == 'waiting'),
                "late": sum(1 for d in deliveries if d.scheduled_date and d.scheduled_date.date() < today),
            },
        }

    # ── Products ──────────────────────────────────────────────────────────
    elif tool_name == "list_products":
        query = Product.query
        if tool_input.get("category_id"):
            query = query.filter_by(category_id=tool_input["category_id"])
        if tool_input.get("search"):
            s = f"%{tool_input['search']}%"
            query = query.filter((Product.name.ilike(s)) | (Product.sku.ilike(s)))
        products = query.order_by(Product.name).all()
        result = []
        for p in products:
            on_hand = p.total_stock()
            if tool_input.get("location_id"):
                sl = StockLevel.query.filter_by(product_id=p.id, location_id=tool_input["location_id"]).first()
                on_hand = sl.quantity if sl else 0
            status = "out_of_stock" if on_hand == 0 else ("low_stock" if on_hand <= p.reorder_point and p.reorder_point > 0 else "in_stock")
            if tool_input.get("low_stock_only") and status == "in_stock":
                continue
            result.append({"id": p.id, "name": p.name, "sku": p.sku, "category": p.category.name if p.category else None,
                           "unit_of_measure": p.unit_of_measure, "cost_price": p.cost_price, "on_hand": on_hand,
                           "total_value": round(on_hand * p.cost_price, 2), "reorder_point": p.reorder_point, "status": status})
        return result

    elif tool_name == "get_product":
        pid = tool_input.get("product_id")
        if tool_input.get("sku"):
            p = Product.query.filter_by(sku=tool_input["sku"]).first()
            pid = p.id if p else None
        p = Product.query.get(pid) if pid else None
        if not p: return {"error": "Product not found"}
        dist = []
        for sl in p.stock_levels:
            loc = sl.location
            if loc:
                dist.append({"location": loc.name, "short_code": loc.short_code,
                             "warehouse": loc.warehouse.name if loc.warehouse else None, "quantity": sl.quantity})
        return {**p.to_dict(), "distribution": dist}

    elif tool_name == "create_product":
        args = tool_input
        if Product.query.filter_by(sku=args["sku"]).first():
            return {"error": f"SKU '{args['sku']}' already exists"}
        p = Product(name=args["name"], sku=args["sku"],
                    category_id=args.get("category_id"),
                    unit_of_measure=args.get("unit_of_measure", "unit"),
                    cost_price=float(args.get("cost_price", 0)),
                    reorder_point=float(args.get("reorder_point", 0)))
        db.session.add(p)
        db.session.flush()
        if args.get("initial_stock") and args.get("location_id"):
            sl = StockLevel(product_id=p.id, location_id=args["location_id"], quantity=float(args["initial_stock"]))
            db.session.add(sl)
        db.session.commit()
        return {"success": True, "product": p.to_dict()}

    elif tool_name == "update_product":
        p = Product.query.get(tool_input["product_id"])
        if not p: return {"error": "Product not found"}
        for f in ["name", "category_id", "unit_of_measure"]:
            if f in tool_input: setattr(p, f, tool_input[f])
        if "cost_price" in tool_input: p.cost_price = float(tool_input["cost_price"])
        if "reorder_point" in tool_input: p.reorder_point = float(tool_input["reorder_point"])
        db.session.commit()
        return {"success": True, "product": p.to_dict()}

    elif tool_name == "get_product_timeline":
        pid = tool_input["product_id"]
        limit = tool_input.get("limit", 50)
        moves = StockMove.query.filter_by(product_id=pid).order_by(StockMove.date.desc()).limit(limit).all()
        p = Product.query.get(pid)
        return {
            "product": p.to_dict() if p else None,
            "timeline": [m.to_dict() for m in moves],
            "current_stock": p.total_stock() if p else 0,
        }

    # ── Categories ────────────────────────────────────────────────────────
    elif tool_name == "list_categories":
        cats = Category.query.order_by(Category.name).all()
        return [{"id": c.id, "name": c.name, "product_count": len(c.products)} for c in cats]

    elif tool_name == "create_category":
        if Category.query.filter_by(name=tool_input["name"]).first():
            return {"error": f"Category '{tool_input['name']}' already exists"}
        c = Category(name=tool_input["name"])
        db.session.add(c); db.session.commit()
        return {"success": True, "category": c.to_dict()}

    # ── Warehouses & Locations ─────────────────────────────────────────────
    elif tool_name == "list_warehouses":
        return [w.to_dict() for w in Warehouse.query.order_by(Warehouse.name).all()]

    elif tool_name == "list_locations":
        query = Location.query
        if tool_input.get("warehouse_id"):
            query = query.filter_by(warehouse_id=tool_input["warehouse_id"])
        return [l.to_dict() for l in query.order_by(Location.name).all()]

    elif tool_name == "get_location_stock":
        lid = tool_input["location_id"]
        loc = Location.query.get(lid)
        if not loc: return {"error": "Location not found"}
        stocks = StockLevel.query.filter(StockLevel.location_id == lid, StockLevel.quantity > 0).all()
        products = []
        for sl in stocks:
            p = sl.product
            if p:
                products.append({"product_id": p.id, "name": p.name, "sku": p.sku,
                                  "unit_of_measure": p.unit_of_measure, "on_hand": sl.quantity,
                                  "value": round(sl.quantity * p.cost_price, 2)})
        return {"location": loc.to_dict(), "products": products, "total_products": len(products)}

    elif tool_name == "create_warehouse":
        if Warehouse.query.filter_by(short_code=tool_input["short_code"].upper()).first():
            return {"error": "Short code already exists"}
        w = Warehouse(name=tool_input["name"], short_code=tool_input["short_code"].upper())
        db.session.add(w); db.session.commit()
        return {"success": True, "warehouse": w.to_dict()}

    elif tool_name == "create_location":
        l = Location(name=tool_input["name"], short_code=tool_input["short_code"].upper(),
                     warehouse_id=tool_input["warehouse_id"])
        db.session.add(l); db.session.commit()
        return {"success": True, "location": l.to_dict()}

    # ── Stock ──────────────────────────────────────────────────────────────
    elif tool_name == "get_stock_levels":
        products = Product.query
        if tool_input.get("search"):
            s = f"%{tool_input['search']}%"
            products = products.filter((Product.name.ilike(s)) | (Product.sku.ilike(s)))
        products = products.order_by(Product.name).all()
        result = []
        for p in products:
            on_hand = p.total_stock()
            if tool_input.get("location_id"):
                sl = StockLevel.query.filter_by(product_id=p.id, location_id=tool_input["location_id"]).first()
                on_hand = sl.quantity if sl else 0
            status = "out_of_stock" if on_hand == 0 else ("low_stock" if on_hand <= p.reorder_point and p.reorder_point > 0 else "in_stock")
            if tool_input.get("low_stock_only") and status == "in_stock": continue
            result.append({"name": p.name, "sku": p.sku, "on_hand": on_hand,
                           "free_to_use": p.free_to_use(), "cost_price": p.cost_price,
                           "total_value": round(on_hand * p.cost_price, 2), "status": status})
        return result

    elif tool_name == "get_stock_alerts":
        products = Product.query.all()
        alerts = []
        for p in products:
            total = p.total_stock()
            if total == 0:
                alerts.append({"id": p.id, "name": p.name, "sku": p.sku, "on_hand": 0, "reorder_point": p.reorder_point, "alert_type": "out_of_stock"})
            elif total <= p.reorder_point and p.reorder_point > 0:
                alerts.append({"id": p.id, "name": p.name, "sku": p.sku, "on_hand": total, "reorder_point": p.reorder_point, "alert_type": "low_stock"})
        return alerts

    elif tool_name == "adjust_stock":
        args = tool_input
        p = Product.query.get(args["product_id"])
        loc = Location.query.get(args["location_id"])
        if not p: return {"error": "Product not found"}
        if not loc: return {"error": "Location not found"}
        sl = StockLevel.query.filter_by(product_id=p.id, location_id=loc.id).first()
        old_qty = sl.quantity if sl else 0
        if sl: sl.quantity = float(args["quantity"])
        else:
            sl = StockLevel(product_id=p.id, location_id=loc.id, quantity=float(args["quantity"]))
            db.session.add(sl)
        delta = float(args["quantity"]) - old_qty
        record_move(None, p.id, loc.id if delta < 0 else None, loc.id if delta >= 0 else None,
                    abs(delta), "adjustment", "CHATBOT-ADJ", args.get("notes", "Chatbot adjustment"))
        db.session.commit()
        return {"success": True, "product": p.name, "location": loc.name, "old_quantity": old_qty, "new_quantity": float(args["quantity"])}

    # ── Receipts ───────────────────────────────────────────────────────────
    elif tool_name == "list_receipts":
        query = Operation.query.filter_by(operation_type='receipt')
        if tool_input.get("status"): query = query.filter_by(status=tool_input["status"])
        if tool_input.get("warehouse_id"): query = query.filter_by(warehouse_id=tool_input["warehouse_id"])
        if tool_input.get("search"):
            s = f"%{tool_input['search']}%"
            query = query.filter((Operation.reference.ilike(s)) | (Operation.contact.ilike(s)))
        ops = query.order_by(Operation.created_at.desc()).limit(tool_input.get("limit", 20)).all()
        return [o.to_dict() for o in ops]

    elif tool_name == "get_receipt":
        op = Operation.query.filter_by(id=tool_input["receipt_id"], operation_type='receipt').first()
        if not op: return {"error": "Receipt not found"}
        return op.to_dict()

    elif tool_name == "create_receipt":
        args = tool_input
        wh = Warehouse.query.get(args["warehouse_id"])
        if not wh: return {"error": "Warehouse not found"}
        ref = generate_reference(wh.short_code, "receipt")
        op = Operation(reference=ref, operation_type='receipt', status='draft',
                       to_location_id=args.get("to_location_id"),
                       warehouse_id=args["warehouse_id"], contact=args.get("contact"),
                       scheduled_date=datetime.fromisoformat(args["scheduled_date"]) if args.get("scheduled_date") else None,
                       notes=args.get("notes"), responsible_id=user_id)
        db.session.add(op); db.session.flush()
        for line in args["lines"]:
            ol = OperationLine(operation_id=op.id, product_id=line["product_id"], quantity=float(line["quantity"]))
            db.session.add(ol)
        db.session.commit()
        return {"success": True, "receipt": op.to_dict()}

    elif tool_name == "validate_receipt":
        op = Operation.query.filter_by(id=tool_input["receipt_id"], operation_type='receipt').first()
        if not op: return {"error": "Receipt not found"}
        if op.status not in ('draft', 'ready'): return {"error": f"Cannot validate: status is '{op.status}'"}
        product_ids = []
        for line in op.lines:
            update_stock(line.product_id, op.to_location_id, line.quantity)
            record_move(op.id, line.product_id, None, op.to_location_id, line.quantity, 'in', op.reference, op.contact)
            product_ids.append(line.product_id)
        op.status = 'done'; op.validated_at = datetime.utcnow()
        _auto_promote(product_ids)
        db.session.commit()
        return {"success": True, "reference": op.reference, "status": "done"}

    elif tool_name == "cancel_receipt":
        op = Operation.query.filter_by(id=tool_input["receipt_id"], operation_type='receipt').first()
        if not op: return {"error": "Receipt not found"}
        if op.status == 'done': return {"error": "Cannot cancel a validated receipt"}
        op.status = 'canceled'; db.session.commit()
        return {"success": True, "reference": op.reference, "status": "canceled"}

    # ── Deliveries ─────────────────────────────────────────────────────────
    elif tool_name == "list_deliveries":
        query = Operation.query.filter_by(operation_type='delivery')
        if tool_input.get("status"): query = query.filter_by(status=tool_input["status"])
        if tool_input.get("warehouse_id"): query = query.filter_by(warehouse_id=tool_input["warehouse_id"])
        if tool_input.get("search"):
            s = f"%{tool_input['search']}%"
            query = query.filter((Operation.reference.ilike(s)) | (Operation.contact.ilike(s)))
        ops = query.order_by(Operation.created_at.desc()).limit(tool_input.get("limit", 20)).all()
        return [o.to_dict() for o in ops]

    elif tool_name == "get_delivery":
        op = Operation.query.filter_by(id=tool_input["delivery_id"], operation_type='delivery').first()
        if not op: return {"error": "Delivery not found"}
        return op.to_dict()

    elif tool_name == "create_delivery":
        args = tool_input
        wh = Warehouse.query.get(args["warehouse_id"])
        if not wh: return {"error": "Warehouse not found"}
        ref = generate_reference(wh.short_code, "delivery")
        has_waiting = any(
            _stock_at(l["product_id"], args["from_location_id"]) < float(l["quantity"])
            for l in args["lines"]
        )
        op = Operation(reference=ref, operation_type='delivery', status='waiting' if has_waiting else 'ready',
                       from_location_id=args["from_location_id"], warehouse_id=args["warehouse_id"],
                       contact=args.get("contact"),
                       scheduled_date=datetime.fromisoformat(args["scheduled_date"]) if args.get("scheduled_date") else None,
                       notes=args.get("notes"), responsible_id=user_id)
        db.session.add(op); db.session.flush()
        for line in args["lines"]:
            ol = OperationLine(operation_id=op.id, product_id=line["product_id"], quantity=float(line["quantity"]))
            db.session.add(ol)
        db.session.commit()
        return {"success": True, "delivery": op.to_dict()}

    elif tool_name == "validate_delivery":
        op = Operation.query.filter_by(id=tool_input["delivery_id"], operation_type='delivery').first()
        if not op: return {"error": "Delivery not found"}
        if op.status != 'ready': return {"error": f"Delivery must be ready (current: '{op.status}')"}
        for line in op.lines:
            avail = _stock_at(line.product_id, op.from_location_id)
            if avail < line.quantity:
                p = Product.query.get(line.product_id)
                return {"error": f"Insufficient stock for {p.name if p else line.product_id}"}
        for line in op.lines:
            update_stock(line.product_id, op.from_location_id, -line.quantity)
            record_move(op.id, line.product_id, op.from_location_id, None, line.quantity, 'out', op.reference, op.contact)
        op.status = 'done'; op.validated_at = datetime.utcnow()
        db.session.commit()
        return {"success": True, "reference": op.reference, "status": "done"}

    elif tool_name == "cancel_delivery":
        op = Operation.query.filter_by(id=tool_input["delivery_id"], operation_type='delivery').first()
        if not op: return {"error": "Delivery not found"}
        if op.status == 'done': return {"error": "Cannot cancel a validated delivery"}
        op.status = 'canceled'; db.session.commit()
        return {"success": True, "reference": op.reference, "status": "canceled"}

    # ── Transfers ──────────────────────────────────────────────────────────
    elif tool_name == "list_transfers":
        query = Operation.query.filter_by(operation_type='transfer')
        if tool_input.get("status"): query = query.filter_by(status=tool_input["status"])
        if tool_input.get("search"):
            query = query.filter(Operation.reference.ilike(f"%{tool_input['search']}%"))
        ops = query.order_by(Operation.created_at.desc()).limit(tool_input.get("limit", 20)).all()
        return [o.to_dict() for o in ops]

    elif tool_name == "get_transfer":
        op = Operation.query.filter_by(id=tool_input["transfer_id"], operation_type='transfer').first()
        if not op: return {"error": "Transfer not found"}
        return op.to_dict()

    elif tool_name == "create_transfer":
        args = tool_input
        from_loc = Location.query.get(args["from_location_id"])
        if not from_loc: return {"error": "Source location not found"}
        wh = from_loc.warehouse
        ref = generate_reference(wh.short_code if wh else "WH", "transfer")
        has_waiting = any(
            _stock_at(l["product_id"], args["from_location_id"]) < float(l["quantity"])
            for l in args["lines"]
        )
        op = Operation(reference=ref, operation_type='transfer', status='waiting' if has_waiting else 'ready',
                       from_location_id=args["from_location_id"], to_location_id=args["to_location_id"],
                       warehouse_id=args.get("warehouse_id", wh.id if wh else None),
                       scheduled_date=datetime.fromisoformat(args["scheduled_date"]) if args.get("scheduled_date") else None,
                       notes=args.get("notes"), responsible_id=user_id)
        db.session.add(op); db.session.flush()
        for line in args["lines"]:
            ol = OperationLine(operation_id=op.id, product_id=line["product_id"], quantity=float(line["quantity"]))
            db.session.add(ol)
        db.session.commit()
        return {"success": True, "transfer": op.to_dict()}

    elif tool_name == "validate_transfer":
        op = Operation.query.filter_by(id=tool_input["transfer_id"], operation_type='transfer').first()
        if not op: return {"error": "Transfer not found"}
        if op.status != 'ready': return {"error": f"Transfer must be ready (current: '{op.status}')"}
        for line in op.lines:
            avail = _stock_at(line.product_id, op.from_location_id)
            if avail < line.quantity:
                p = Product.query.get(line.product_id)
                return {"error": f"Insufficient stock for {p.name if p else line.product_id}"}
        for line in op.lines:
            update_stock(line.product_id, op.from_location_id, -line.quantity)
            update_stock(line.product_id, op.to_location_id, line.quantity)
            contact = f"{op.from_location.name if op.from_location else ''} → {op.to_location.name if op.to_location else ''}"
            record_move(op.id, line.product_id, op.from_location_id, op.to_location_id, line.quantity, 'transfer', op.reference, contact)
        op.status = 'done'; op.validated_at = datetime.utcnow()
        db.session.commit()
        return {"success": True, "reference": op.reference, "status": "done"}

    # ── Move History ───────────────────────────────────────────────────────
    elif tool_name == "get_move_history":
        query = StockMove.query
        if tool_input.get("product_id"): query = query.filter_by(product_id=tool_input["product_id"])
        if tool_input.get("move_type"): query = query.filter_by(move_type=tool_input["move_type"])
        if tool_input.get("search"):
            s = f"%{tool_input['search']}%"
            query = query.filter((StockMove.reference.ilike(s)) | (StockMove.contact.ilike(s)))
        if tool_input.get("date_from"):
            query = query.filter(StockMove.date >= datetime.fromisoformat(tool_input["date_from"]))
        if tool_input.get("date_to"):
            query = query.filter(StockMove.date <= datetime.fromisoformat(tool_input["date_to"] + "T23:59:59"))
        moves = query.order_by(StockMove.date.desc()).limit(tool_input.get("limit", 50)).all()
        return [m.to_dict() for m in moves]

    # ── SQL ────────────────────────────────────────────────────────────────
    elif tool_name == "run_sql_query":
        sql = tool_input["sql"].strip()
        if not sql.upper().startswith("SELECT"):
            return {"error": "Only SELECT queries are allowed"}
        try:
            from sqlalchemy import text
            result = db.session.execute(text(sql))
            rows = [dict(row._mapping) for row in result]
            return {"rows": rows, "count": len(rows)}
        except Exception as e:
            return {"error": str(e)}

    else:
        return {"error": f"Unknown tool: {tool_name}"}


@chatbot_bp.route('/tool', methods=['POST'])
@jwt_required()
def execute_tool():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    tool_name = data.get('tool')
    tool_input = data.get('input', {})

    if not tool_name:
        return jsonify({'error': 'tool name required'}), 400

    try:
        result = _run_tool(tool_name, tool_input, user_id)
        return jsonify(result), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500