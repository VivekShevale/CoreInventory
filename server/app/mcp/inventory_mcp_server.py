# server/app/mcp/inventory_mcp_server.py
"""
CoreInventory MCP Server
========================
Implements the Model Context Protocol (MCP) over Server-Sent Events (SSE).
Tools exposed here mirror ONLY what the website already supports:
  READ  : products, locations, stock, pending ops, inventory value, move history
  WRITE : receipt, delivery, transfer, adjustment  (stage-only; user must confirm)

Access control:
  - Every tool call is scoped to the authenticated user's context.
  - Write tools return a `pending_action` payload — nothing touches the DB until
    the caller invokes `execute_confirmed_action` after explicit user approval.
  - All calls are audit-logged to `ChatAuditLog`.
"""

from __future__ import annotations
import json
from datetime import datetime, timedelta
from typing import Optional

from flask import current_app

# ─── MCP Tool registry ───────────────────────────────────────────────────────

MCP_TOOLS: list[dict] = []          # filled by @mcp_tool decorator
_TOOL_FUNCS: dict[str, callable] = {}


def mcp_tool(name: str, description: str, input_schema: dict):
    """Decorator — registers a function as an MCP tool."""
    def decorator(fn):
        MCP_TOOLS.append({
            "name": name,
            "description": description,
            "inputSchema": input_schema,
        })
        _TOOL_FUNCS[name] = fn
        return fn
    return decorator


def call_tool(name: str, arguments: dict, db, models: dict, user_id: int) -> dict:
    """
    Dispatch an MCP tool call.
    Returns MCP-style: {"content": [{"type": "text", "text": "..."}]}
    Raises ValueError for unknown tools.
    """
    if name not in _TOOL_FUNCS:
        raise ValueError(f"Unknown tool: {name}")
    fn = _TOOL_FUNCS[name]
    result = fn(arguments=arguments, db=db, models=models, user_id=user_id)
    return {"content": [{"type": "text", "text": result}]}


# ═══════════════════════════════════════════════════════════════════════════════
# READ TOOLS
# ═══════════════════════════════════════════════════════════════════════════════

@mcp_tool(
    name="get_all_products",
    description=(
        "Get all products with current stock levels, free-to-use stock, "
        "reorder status, cost price, and storage locations. "
        "Returns a comprehensive list with status indicators (OUT_OF_STOCK, BELOW_REORDER, LOW, HEALTHY). "
        "Use this to answer any inventory or stock question, including low-stock summaries."
    ),
    input_schema={"type": "object", "properties": {}, "required": []},
)
def _get_all_products(arguments, db, models, user_id):
    """
    Get all products with stock status.
    No parameters needed — returns everything.
    """
    Product = models["Product"]
    rows = []
    for p in Product.query.all():
        on_hand = round(p.total_stock(), 1)
        free    = round(p.free_to_use(), 1)
        if on_hand == 0:
            status = "OUT_OF_STOCK"
        elif p.reorder_point > 0 and on_hand < p.reorder_point:
            status = "BELOW_REORDER"
        elif p.reorder_point > 0 and on_hand < p.reorder_point * 1.5:
            status = "LOW"
        else:
            status = "HEALTHY"
        locs = [
            f"{sl.location.name} ({sl.location.warehouse.short_code}/{sl.location.short_code}): "
            f"{round(sl.quantity,1)} {p.unit_of_measure}"
            for sl in p.stock_levels if sl.quantity > 0
        ]
        rows.append({
            "id": p.id, "name": p.name, "sku": p.sku,
            "category": p.category.name if p.category else None,
            "unit": p.unit_of_measure, "cost_price": p.cost_price,
            "on_hand": on_hand, "free_to_use": free,
            "reorder_point": p.reorder_point, "status": status,
            "stock_value": round((p.cost_price or 0) * on_hand, 2),
            "locations": locs,
        })
    rows.sort(
        key=lambda r: ["OUT_OF_STOCK", "BELOW_REORDER", "LOW", "HEALTHY"].index(r["status"])
    )
    return json.dumps(rows)


@mcp_tool(
    name="get_low_stock_products",
    description=(
        "Get only products that are low on stock (OUT_OF_STOCK, BELOW_REORDER, or LOW status). "
        "Perfect for quick low-stock summaries and alerts."
    ),
    input_schema={"type": "object", "properties": {}, "required": []},
)
def _get_low_stock_products(arguments, db, models, user_id):
    """
    Get only low-stock products for quick summaries.
    """
    Product = models["Product"]
    rows = []
    for p in Product.query.all():
        on_hand = round(p.total_stock(), 1)
        free    = round(p.free_to_use(), 1)
        if on_hand == 0:
            status = "OUT_OF_STOCK"
        elif p.reorder_point > 0 and on_hand < p.reorder_point:
            status = "BELOW_REORDER"
        elif p.reorder_point > 0 and on_hand < p.reorder_point * 1.5:
            status = "LOW"
        else:
            status = "HEALTHY"
        
        # Only include non-healthy items
        if status != "HEALTHY":
            locs = [
                f"{sl.location.name}: {round(sl.quantity,1)} {p.unit_of_measure}"
                for sl in p.stock_levels if sl.quantity > 0
            ]
            rows.append({
                "id": p.id, "name": p.name, "sku": p.sku,
                "category": p.category.name if p.category else None,
                "unit": p.unit_of_measure, "cost_price": p.cost_price,
                "on_hand": on_hand, "free_to_use": free,
                "reorder_point": p.reorder_point, "status": status,
                "stock_value": round((p.cost_price or 0) * on_hand, 2),
                "locations": locs,
            })
    rows.sort(
        key=lambda r: ["OUT_OF_STOCK", "BELOW_REORDER", "LOW"].index(r["status"])
    )
    return json.dumps(rows)


@mcp_tool(
    name="get_product_by_name_or_sku",
    description="Find a specific product by name (partial match) or exact SKU. Returns full detail including stock levels, recent moves, and locations.",
    input_schema={
        "type": "object",
        "properties": {"query": {"type": "string", "description": "Product name or SKU"}},
        "required": ["query"],
    },
)
def _get_product_by_name_or_sku(arguments, db, models, user_id):
    Product  = models["Product"]
    StockMove = models["StockMove"]
    q = arguments.get("query", "").strip().lower()
    products = Product.query.all()
    p = next((x for x in products if q in x.name.lower() or q == x.sku.lower()), None)
    if not p:
        p = next((x for x in products if q in x.sku.lower()), None)
    if not p:
        return json.dumps({"error": f"No product found matching '{arguments.get('query')}'"})
    on_hand = round(p.total_stock(), 1)
    free    = round(p.free_to_use(), 1)
    locs    = [
        {"location": sl.location.name, "warehouse": sl.location.warehouse.name,
         "code": f"{sl.location.warehouse.short_code}/{sl.location.short_code}",
         "quantity": round(sl.quantity, 1)}
        for sl in p.stock_levels if sl.quantity > 0
    ]
    from sqlalchemy import desc
    moves = db.query(StockMove).filter(StockMove.product_id == p.id)\
               .order_by(desc(StockMove.date)).limit(8).all()
    recent = [
        {"reference": m.reference, "type": m.move_type,
         "quantity": round(abs(m.quantity or 0), 1),
         "contact": m.contact, "date": str(m.date.date())}
        for m in moves
    ]
    return json.dumps({
        "id": p.id, "name": p.name, "sku": p.sku,
        "category": p.category.name if p.category else None,
        "unit": p.unit_of_measure, "cost_price": p.cost_price,
        "on_hand": on_hand, "free_to_use": free,
        "reorder_point": p.reorder_point,
        "stock_value": round((p.cost_price or 0) * on_hand, 2),
        "locations": locs, "recent_moves": recent,
    })


@mcp_tool(
    name="get_all_locations",
    description="Get all warehouse locations with their IDs, names, codes and warehouses. Always call this before building a receipt, delivery, or transfer.",
    input_schema={"type": "object", "properties": {}, "required": []},
)
def _get_all_locations(arguments, db, models, user_id):
    Location = models["Location"]
    locs = Location.query.all()
    return json.dumps([
        {
            "id": l.id, "name": l.name,
            "short_code": l.short_code,
            "code": f"{l.warehouse.short_code}/{l.short_code}",
            "warehouse": l.warehouse.name,
            "warehouse_id": l.warehouse_id,
            "warehouse_code": l.warehouse.short_code,
        }
        for l in locs
    ])


@mcp_tool(
    name="get_pending_operations",
    description="Get all pending (draft/waiting/ready) operations. Optionally filter by type: 'receipt', 'delivery', 'transfer', or 'adjustment'.",
    input_schema={
        "type": "object",
        "properties": {
            "operation_type": {
                "type": "string",
                "enum": ["receipt", "delivery", "transfer", "adjustment"],
                "description": "Optional filter by operation type",
            }
        },
        "required": [],
    },
)
def _get_pending_operations(arguments, db, models, user_id):
    Operation = models["Operation"]
    today = datetime.utcnow().date()
    q = Operation.query.filter(Operation.status.in_(["draft", "waiting", "ready"]))
    op_type = arguments.get("operation_type")
    if op_type:
        q = q.filter(Operation.operation_type == op_type)
    ops = q.order_by(Operation.scheduled_date).all()
    result = []
    for op in ops:
        is_late = op.scheduled_date and op.scheduled_date.date() < today
        result.append({
            "id": op.id, "reference": op.reference,
            "type": op.operation_type, "status": op.status,
            "contact": op.contact,
            "scheduled": str(op.scheduled_date.date()) if op.scheduled_date else None,
            "is_late": bool(is_late),
            "from": op.from_location.name if op.from_location else "Vendor",
            "to": op.to_location.name if op.to_location else "Customer",
            "lines": [
                {"product": l.product.name if l.product else "?",
                 "sku": l.product.sku if l.product else "?",
                 "quantity": l.quantity, "done": l.done_quantity,
                 "unit": l.product.unit_of_measure if l.product else "unit"}
                for l in op.lines
            ],
        })
    return json.dumps(result)


@mcp_tool(
    name="get_inventory_value",
    description="Get total inventory value (cost_price × on_hand) with breakdown by category.",
    input_schema={"type": "object", "properties": {}, "required": []},
)
def _get_inventory_value(arguments, db, models, user_id):
    from collections import defaultdict
    Product = models["Product"]
    products = Product.query.all()
    total    = sum((p.cost_price or 0) * p.total_stock() for p in products)
    by_cat   = defaultdict(float)
    by_cat_qty = defaultdict(float)
    for p in products:
        cat = p.category.name if p.category else "Uncategorised"
        by_cat[cat]     += (p.cost_price or 0) * p.total_stock()
        by_cat_qty[cat] += p.total_stock()
    return json.dumps({
        "total_value_inr": round(total, 2),
        "currency": "INR",
        "by_category": sorted([
            {"category": k, "value": round(v, 2), "units": round(by_cat_qty[k], 1)}
            for k, v in by_cat.items()
        ], key=lambda x: -x["value"]),
    })


@mcp_tool(
    name="get_move_history",
    description="Get recent stock move history. Optionally filter by product name or SKU and number of days back (max 90).",
    input_schema={
        "type": "object",
        "properties": {
            "days": {"type": "integer", "description": "How many days back (default 14, max 90)"},
            "product_name": {"type": "string", "description": "Optional product name or SKU filter"},
        },
        "required": [],
    },
)
def _get_move_history(arguments, db, models, user_id):
    Product   = models["Product"]
    StockMove = models["StockMove"]
    days = int(arguments.get("days", 14))
    since = datetime.utcnow() - timedelta(days=max(1, min(days, 90)))
    q = db.query(StockMove).filter(StockMove.date >= since)
    product_name = arguments.get("product_name")
    if product_name:
        pname = product_name.lower()
        prods = [p for p in Product.query.all() if pname in p.name.lower() or pname in p.sku.lower()]
        if prods:
            from sqlalchemy import or_
            q = q.filter(StockMove.product_id.in_([p.id for p in prods]))
    moves = q.order_by(StockMove.date.desc()).limit(60).all()
    return json.dumps([
        {
            "reference": m.reference, "type": m.move_type,
            "product": m.product.name if m.product else "?",
            "sku": m.product.sku if m.product else "?",
            "quantity": round(abs(m.quantity or 0), 1),
            "unit": m.product.unit_of_measure if m.product else "unit",
            "from": m.from_location.name if m.from_location else "Vendor",
            "to": m.to_location.name if m.to_location else "Customer",
            "contact": m.contact,
            "date": str(m.date.date()),
        }
        for m in moves
    ])


@mcp_tool(
    name="get_operation_by_reference",
    description="Get full detail of a specific operation by its reference number (e.g. WH/IN/001).",
    input_schema={
        "type": "object",
        "properties": {"reference": {"type": "string", "description": "Operation reference number"}},
        "required": ["reference"],
    },
)
def _get_operation_by_reference(arguments, db, models, user_id):
    Operation = models["Operation"]
    ref = arguments.get("reference", "").strip()
    op = Operation.query.filter_by(reference=ref).first()
    if not op:
        return json.dumps({"error": f"Operation '{ref}' not found"})
    return json.dumps({
        "id": op.id, "reference": op.reference,
        "type": op.operation_type, "status": op.status,
        "contact": op.contact,
        "from": op.from_location.name if op.from_location else "Vendor",
        "to": op.to_location.name if op.to_location else "Customer",
        "scheduled": str(op.scheduled_date.date()) if op.scheduled_date else None,
        "validated": str(op.validated_at.date()) if op.validated_at else None,
        "responsible": op.responsible.full_name if op.responsible else None,
        "notes": op.notes,
        "lines": [
            {"product": l.product.name if l.product else "?",
             "sku": l.product.sku if l.product else "?",
             "quantity": l.quantity, "done": l.done_quantity,
             "unit": l.product.unit_of_measure if l.product else "unit"}
            for l in op.lines
        ],
    })


# ═══════════════════════════════════════════════════════════════════════════════
# WRITE TOOLS  —  stage only, returns pending_action for user confirmation
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_lines(product_lines) -> list | dict:
    """Parse product_lines from JSON string or list. Returns list or {"error": ...}."""
    if isinstance(product_lines, list):
        return product_lines
    if isinstance(product_lines, str):
        try:
            return json.loads(product_lines)
        except Exception:
            return {"error": f"product_lines must be valid JSON array. Got: {product_lines[:100]}"}
    return {"error": f"product_lines must be JSON string or list. Got type: {type(product_lines).__name__}"}


@mcp_tool(
    name="stage_receipt",
    description=(
        "Stage (but DO NOT save) a new receipt operation for vendor → warehouse. "
        "Call get_all_locations first to find the correct to_location_id. "
        "Returns a pending_action requiring user confirmation before DB write."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "contact":        {"type": "string",  "description": "Vendor/supplier name"},
            "to_location_id": {"type": "integer", "description": "Destination location ID (from get_all_locations)"},
            "product_lines":  {"type": "string",  "description": "JSON array [{product_id, quantity}]"},
            "scheduled_date": {"type": "string",  "description": "Optional YYYY-MM-DD"},
            "notes":          {"type": "string",  "description": "Optional notes"},
        },
        "required": ["contact", "to_location_id", "product_lines"],
    },
)
def _stage_receipt(arguments, db, models, user_id):
    Product  = models["Product"]
    Location = models["Location"]
    Operation = models["Operation"]

    contact        = (arguments.get("contact") or "").strip()
    to_location_id = arguments.get("to_location_id")
    scheduled_date = arguments.get("scheduled_date")
    notes          = arguments.get("notes")

    if not contact:
        return json.dumps({"error": "Missing vendor name."})
    if not to_location_id or int(to_location_id) <= 0:
        return json.dumps({"error": "Missing destination location. Call get_all_locations first."})

    lines_raw = _parse_lines(arguments.get("product_lines", "[]"))
    if isinstance(lines_raw, dict):
        return json.dumps(lines_raw)
    if not lines_raw:
        return json.dumps({"error": "product_lines cannot be empty"})

    loc = Location.query.get(int(to_location_id))
    if not loc:
        return json.dumps({"error": f"Location ID {to_location_id} not found."})

    enriched = []
    for line in lines_raw:
        try:
            prod_id = int(line["product_id"])
            qty     = float(line["quantity"])
        except (KeyError, ValueError, TypeError) as e:
            return json.dumps({"error": f"Invalid product line: {e}"})
        p = Product.query.get(prod_id)
        if not p:
            return json.dumps({"error": f"Product ID {prod_id} not found."})
        enriched.append({
            "product_id": p.id, "product_name": p.name, "sku": p.sku,
            "quantity": qty, "unit": p.unit_of_measure,
        })

    count = Operation.query.filter_by(operation_type="receipt").count()
    ref   = f"{loc.warehouse.short_code}/IN/{str(count + 1).zfill(3)}"

    pending = {
        "action": "create_receipt", "reference": ref,
        "operation_type": "receipt", "contact": contact,
        "to_location_id": int(to_location_id),
        "to_location_name": loc.name,
        "warehouse_id": loc.warehouse_id,
        "lines": enriched,
        "scheduled_date": scheduled_date,
        "notes": notes,
        "summary_lines": "\n".join(
            f"  • {l['product_name']} [{l['sku']}]: {l['quantity']} {l['unit']}" for l in enriched
        ),
    }
    return json.dumps({"pending_action": pending, "needs_confirmation": True})


@mcp_tool(
    name="stage_delivery",
    description=(
        "Stage (but DO NOT save) a new delivery operation for warehouse → customer. "
        "Validates free stock before staging. Returns pending_action requiring confirmation."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "contact":           {"type": "string",  "description": "Customer name"},
            "from_location_id":  {"type": "integer", "description": "Source location ID"},
            "product_lines":     {"type": "string",  "description": "JSON array [{product_id, quantity}]"},
            "scheduled_date":    {"type": "string",  "description": "Optional YYYY-MM-DD"},
            "notes":             {"type": "string",  "description": "Optional notes"},
        },
        "required": ["contact", "from_location_id", "product_lines"],
    },
)
def _stage_delivery(arguments, db, models, user_id):
    Product  = models["Product"]
    Location = models["Location"]
    Operation = models["Operation"]

    contact          = (arguments.get("contact") or "").strip()
    from_location_id = arguments.get("from_location_id")
    scheduled_date   = arguments.get("scheduled_date")
    notes            = arguments.get("notes")

    lines_raw = _parse_lines(arguments.get("product_lines", "[]"))
    if isinstance(lines_raw, dict):
        return json.dumps(lines_raw)
    if not lines_raw:
        return json.dumps({"error": "product_lines cannot be empty"})

    loc = Location.query.get(int(from_location_id))
    if not loc:
        return json.dumps({"error": f"Location ID {from_location_id} not found."})

    enriched = []
    for line in lines_raw:
        p    = Product.query.get(line.get("product_id"))
        if not p:
            return json.dumps({"error": f"Product ID {line.get('product_id')} not found."})
        free = round(p.free_to_use(), 1)
        qty  = float(line.get("quantity", 0))
        if qty > free:
            return json.dumps({
                "error": f"Insufficient free stock for {p.name} [{p.sku}]: "
                         f"requested {qty} {p.unit_of_measure}, only {free} available."
            })
        enriched.append({
            "product_id": p.id, "product_name": p.name, "sku": p.sku,
            "quantity": qty, "unit": p.unit_of_measure, "available": free,
        })

    count = Operation.query.filter_by(operation_type="delivery").count()
    ref   = f"{loc.warehouse.short_code}/OUT/{str(count + 1).zfill(3)}"

    pending = {
        "action": "create_delivery", "reference": ref,
        "operation_type": "delivery", "contact": contact,
        "from_location_id": int(from_location_id),
        "from_location_name": loc.name,
        "warehouse_id": loc.warehouse_id,
        "lines": enriched,
        "scheduled_date": scheduled_date, "notes": notes,
        "summary_lines": "\n".join(
            f"  • {l['product_name']} [{l['sku']}]: {l['quantity']} {l['unit']} (avail: {l['available']})"
            for l in enriched
        ),
    }
    return json.dumps({"pending_action": pending, "needs_confirmation": True})


@mcp_tool(
    name="stage_transfer",
    description=(
        "Stage (but DO NOT save) an internal stock transfer between two locations. "
        "Validates available stock. Returns pending_action requiring confirmation."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "from_location_id": {"type": "integer", "description": "Source location ID"},
            "to_location_id":   {"type": "integer", "description": "Destination location ID"},
            "product_lines":    {"type": "string",  "description": "JSON array [{product_id, quantity}]"},
            "scheduled_date":   {"type": "string",  "description": "Optional YYYY-MM-DD"},
            "notes":            {"type": "string",  "description": "Optional notes"},
        },
        "required": ["from_location_id", "to_location_id", "product_lines"],
    },
)
def _stage_transfer(arguments, db, models, user_id):
    Product  = models["Product"]
    Location = models["Location"]
    Operation = models["Operation"]

    from_id = int(arguments["from_location_id"])
    to_id   = int(arguments["to_location_id"])

    if from_id == to_id:
        return json.dumps({"error": "From and To locations must be different."})

    from_loc = Location.query.get(from_id)
    to_loc   = Location.query.get(to_id)
    if not from_loc:
        return json.dumps({"error": f"From-location ID {from_id} not found."})
    if not to_loc:
        return json.dumps({"error": f"To-location ID {to_id} not found."})

    lines_raw = _parse_lines(arguments.get("product_lines", "[]"))
    if isinstance(lines_raw, dict):
        return json.dumps(lines_raw)
    if not lines_raw:
        return json.dumps({"error": "product_lines cannot be empty"})

    enriched = []
    for line in lines_raw:
        p   = Product.query.get(line.get("product_id"))
        if not p:
            return json.dumps({"error": f"Product ID {line.get('product_id')} not found."})
        free = round(p.free_to_use(), 1)
        qty  = float(line.get("quantity", 0))
        if qty > free:
            return json.dumps({"error": f"Insufficient free stock for {p.name}: {free} available."})
        enriched.append({
            "product_id": p.id, "product_name": p.name, "sku": p.sku,
            "quantity": qty, "unit": p.unit_of_measure, "available": free,
        })

    count = Operation.query.filter_by(operation_type="transfer").count()
    ref   = f"{from_loc.warehouse.short_code}/TRF/{str(count + 1).zfill(3)}"

    pending = {
        "action": "create_transfer", "reference": ref,
        "operation_type": "transfer",
        "from_location_id": from_id, "from_location_name": from_loc.name,
        "to_location_id": to_id, "to_location_name": to_loc.name,
        "warehouse_id": from_loc.warehouse_id,
        "lines": enriched,
        "scheduled_date": arguments.get("scheduled_date"),
        "notes": arguments.get("notes"),
        "summary_lines": "\n".join(
            f"  • {l['product_name']} [{l['sku']}]: {l['quantity']} {l['unit']}" for l in enriched
        ),
    }
    return json.dumps({"pending_action": pending, "needs_confirmation": True})


@mcp_tool(
    name="stage_adjustment",
    description=(
        "Stage (but DO NOT save) a stock adjustment (damage write-off, count correction). "
        "Use negative quantities to remove stock. Returns pending_action requiring confirmation."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "location_id":   {"type": "integer", "description": "Location where adjustment occurs"},
            "product_lines": {"type": "string",  "description": "JSON array [{product_id, quantity}] — negative = remove"},
            "reason":        {"type": "string",  "description": "Reason for adjustment"},
        },
        "required": ["location_id", "product_lines"],
    },
)
def _stage_adjustment(arguments, db, models, user_id):
    Product  = models["Product"]
    Location = models["Location"]
    Operation = models["Operation"]

    location_id = int(arguments["location_id"])
    loc = Location.query.get(location_id)
    if not loc:
        return json.dumps({"error": f"Location ID {location_id} not found."})

    lines_raw = _parse_lines(arguments.get("product_lines", "[]"))
    if isinstance(lines_raw, dict):
        return json.dumps(lines_raw)

    enriched = []
    for line in lines_raw:
        p   = Product.query.get(line.get("product_id"))
        if not p:
            return json.dumps({"error": f"Product ID {line.get('product_id')} not found."})
        qty = float(line.get("quantity", 0))
        if qty < 0:
            on_hand = round(p.total_stock(), 1)
            if abs(qty) > on_hand:
                return json.dumps({"error": f"Cannot remove {abs(qty)} of {p.name}: only {on_hand} on hand."})
        enriched.append({
            "product_id": p.id, "product_name": p.name, "sku": p.sku,
            "quantity": qty, "unit": p.unit_of_measure,
            "direction": "remove" if qty < 0 else "add",
        })

    count = Operation.query.filter_by(operation_type="adjustment").count()
    ref   = f"{loc.warehouse.short_code}/ADJ/{str(count + 1).zfill(3)}"

    reason = arguments.get("reason") or "Stock adjustment via AI Agent"
    pending = {
        "action": "create_adjustment", "reference": ref,
        "operation_type": "adjustment",
        "from_location_id": location_id, "from_location_name": loc.name,
        "warehouse_id": loc.warehouse_id,
        "lines": enriched,
        "notes": reason,
        "summary_lines": "\n".join(
            f"  • {l['product_name']} [{l['sku']}]: "
            f"{'+' if l['quantity'] >= 0 else ''}{l['quantity']} {l['unit']} ({l['direction']})"
            for l in enriched
        ),
    }
    return json.dumps({"pending_action": pending, "needs_confirmation": True})


# ═══════════════════════════════════════════════════════════════════════════════
# EXECUTE — only after explicit user confirmation
# ═══════════════════════════════════════════════════════════════════════════════

def execute_confirmed_action(db_session, models: dict, pending: dict, user_id: int) -> dict:
    """
    Write the confirmed pending_action to PostgreSQL.
    Called only after the user has explicitly said 'yes' / 'confirm'.
    Returns {"success": True, "reference": ..., "id": ...} or {"success": False, "error": ...}.
    """
    Operation     = models["Operation"]
    OperationLine = models["OperationLine"]
    try:
        sched = None
        if pending.get("scheduled_date"):
            try:
                sched = datetime.fromisoformat(pending["scheduled_date"])
            except Exception:
                sched = datetime.utcnow() + timedelta(days=3)
        if not sched:
            sched = datetime.utcnow() + timedelta(days=3)

        op = Operation(
            reference        = pending["reference"],
            operation_type   = pending["operation_type"],
            status           = "draft",
            contact          = pending.get("contact"),
            warehouse_id     = pending.get("warehouse_id"),
            to_location_id   = pending.get("to_location_id"),
            from_location_id = pending.get("from_location_id"),
            scheduled_date   = sched,
            responsible_id   = user_id,
            notes            = pending.get("notes") or "Created via AI Agent",
        )
        db_session.add(op)
        db_session.flush()

        for line in pending.get("lines", []):
            db_session.add(OperationLine(
                operation_id  = op.id,
                product_id    = line["product_id"],
                quantity      = abs(line["quantity"]),
                done_quantity = 0,
            ))

        db_session.commit()
        return {"success": True, "reference": op.reference, "id": op.id}
    except Exception as e:
        db_session.rollback()
        return {"success": False, "error": str(e)}