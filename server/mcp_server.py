"""
CoreInventory MCP Server
========================
Exposes all CoreInventory database operations as MCP tools
so Claude can interact with the PostgreSQL database directly.

Run:
    pip install mcp psycopg2-binary python-dotenv
    python mcp_server.py

Or with the MCP CLI:
    mcp dev mcp_server.py
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Any, Optional
from dotenv import load_dotenv

load_dotenv()

import psycopg2
import psycopg2.extras
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

# ── Database connection ─────────────────────────────────────────────────────

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/coreinventory"
)


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def query(sql: str, params=None, fetch: str = "all"):
    """Execute a SQL query and return results as dicts."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            if fetch == "all":
                return [dict(r) for r in cur.fetchall()]
            elif fetch == "one":
                row = cur.fetchone()
                return dict(row) if row else None
            else:
                return None


def execute(sql: str, params=None):
    """Execute a write SQL statement."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            conn.commit()
            try:
                row = cur.fetchone()
                return dict(row) if row else {"affected": cur.rowcount}
            except Exception:
                return {"affected": cur.rowcount}


def fmt(data) -> str:
    """Format data as pretty JSON string for MCP response."""
    if isinstance(data, list):
        return json.dumps(data, default=str, indent=2)
    return json.dumps(data, default=str, indent=2)


# ── MCP Server ──────────────────────────────────────────────────────────────

server = Server("coreinventory-mcp")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [

        # ── Dashboard ────────────────────────────────────────────────────────
        types.Tool(
            name="get_dashboard_stats",
            description="Get real-time dashboard KPIs: total products, low stock count, out-of-stock count, pending receipts/deliveries, internal transfers scheduled, and operation block summaries.",
            inputSchema={"type": "object", "properties": {}}
        ),

        # ── Products ─────────────────────────────────────────────────────────
        types.Tool(
            name="list_products",
            description="List all products with stock levels. Filter by category, warehouse, or search text.",
            inputSchema={
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Search by product name or SKU"},
                    "category_id": {"type": "integer", "description": "Filter by category ID"},
                    "warehouse_id": {"type": "integer", "description": "Filter by warehouse ID"},
                    "location_id": {"type": "integer", "description": "Filter by location ID"},
                    "low_stock_only": {"type": "boolean", "description": "Return only low/out-of-stock products"},
                }
            }
        ),

        types.Tool(
            name="get_product",
            description="Get full details of a single product including stock distribution across all locations.",
            inputSchema={
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer", "description": "Product ID"},
                    "sku": {"type": "string", "description": "Product SKU (alternative to ID)"},
                },
            }
        ),

        types.Tool(
            name="create_product",
            description="Create a new product in the inventory.",
            inputSchema={
                "type": "object",
                "required": ["name", "sku"],
                "properties": {
                    "name": {"type": "string"},
                    "sku": {"type": "string", "description": "Unique SKU / product code"},
                    "category_id": {"type": "integer"},
                    "unit_of_measure": {"type": "string", "enum": ["unit", "kg", "g", "L", "m", "box", "pcs", "dozen"], "default": "unit"},
                    "cost_price": {"type": "number"},
                    "reorder_point": {"type": "number", "description": "Alert when stock falls at or below this quantity"},
                    "initial_stock": {"type": "number", "description": "Starting stock quantity"},
                    "location_id": {"type": "integer", "description": "Location for initial stock"},
                }
            }
        ),

        types.Tool(
            name="update_product",
            description="Update an existing product's details.",
            inputSchema={
                "type": "object",
                "required": ["product_id"],
                "properties": {
                    "product_id": {"type": "integer"},
                    "name": {"type": "string"},
                    "category_id": {"type": "integer"},
                    "unit_of_measure": {"type": "string"},
                    "cost_price": {"type": "number"},
                    "reorder_point": {"type": "number"},
                }
            }
        ),

        types.Tool(
            name="get_product_timeline",
            description="Get the full movement history (receipts, deliveries, transfers, adjustments) for a product with running balance.",
            inputSchema={
                "type": "object",
                "required": ["product_id"],
                "properties": {
                    "product_id": {"type": "integer"},
                    "limit": {"type": "integer", "description": "Max number of events to return", "default": 50},
                }
            }
        ),

        # ── Categories ───────────────────────────────────────────────────────
        types.Tool(
            name="list_categories",
            description="List all product categories.",
            inputSchema={"type": "object", "properties": {}}
        ),

        types.Tool(
            name="create_category",
            description="Create a new product category.",
            inputSchema={
                "type": "object",
                "required": ["name"],
                "properties": {"name": {"type": "string"}}
            }
        ),

        # ── Warehouses & Locations ───────────────────────────────────────────
        types.Tool(
            name="list_warehouses",
            description="List all warehouses with location counts.",
            inputSchema={"type": "object", "properties": {}}
        ),

        types.Tool(
            name="list_locations",
            description="List locations, optionally filtered by warehouse.",
            inputSchema={
                "type": "object",
                "properties": {
                    "warehouse_id": {"type": "integer", "description": "Filter by warehouse"}
                }
            }
        ),

        types.Tool(
            name="get_location_stock",
            description="Get all products and their quantities at a specific location.",
            inputSchema={
                "type": "object",
                "required": ["location_id"],
                "properties": {"location_id": {"type": "integer"}}
            }
        ),

        types.Tool(
            name="create_warehouse",
            description="Create a new warehouse.",
            inputSchema={
                "type": "object",
                "required": ["name", "short_code"],
                "properties": {
                    "name": {"type": "string"},
                    "short_code": {"type": "string", "description": "Unique short code e.g. WH2"},
                }
            }
        ),

        types.Tool(
            name="create_location",
            description="Create a new location inside a warehouse.",
            inputSchema={
                "type": "object",
                "required": ["name", "short_code", "warehouse_id"],
                "properties": {
                    "name": {"type": "string"},
                    "short_code": {"type": "string"},
                    "warehouse_id": {"type": "integer"},
                }
            }
        ),

        # ── Stock ────────────────────────────────────────────────────────────
        types.Tool(
            name="get_stock_levels",
            description="Get current stock levels. Returns on_hand, free_to_use, total_value for each product. Filter by warehouse or location.",
            inputSchema={
                "type": "object",
                "properties": {
                    "search": {"type": "string"},
                    "warehouse_id": {"type": "integer"},
                    "location_id": {"type": "integer"},
                    "low_stock_only": {"type": "boolean"},
                }
            }
        ),

        types.Tool(
            name="get_stock_alerts",
            description="Get all products that are out of stock or below their reorder point.",
            inputSchema={"type": "object", "properties": {}}
        ),

        types.Tool(
            name="adjust_stock",
            description="Manually adjust stock quantity for a product at a specific location (sets the absolute quantity, not delta).",
            inputSchema={
                "type": "object",
                "required": ["product_id", "location_id", "quantity"],
                "properties": {
                    "product_id": {"type": "integer"},
                    "location_id": {"type": "integer"},
                    "quantity": {"type": "number", "description": "New absolute quantity"},
                    "notes": {"type": "string", "description": "Reason for adjustment"},
                }
            }
        ),

        # ── Receipts ─────────────────────────────────────────────────────────
        types.Tool(
            name="list_receipts",
            description="List receipt operations (incoming goods). Filter by status, warehouse, or search.",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["draft", "ready", "done", "canceled"]},
                    "search": {"type": "string"},
                    "warehouse_id": {"type": "integer"},
                    "limit": {"type": "integer", "default": 20},
                }
            }
        ),

        types.Tool(
            name="get_receipt",
            description="Get full details of a receipt including all product lines.",
            inputSchema={
                "type": "object",
                "required": ["receipt_id"],
                "properties": {"receipt_id": {"type": "integer"}}
            }
        ),

        types.Tool(
            name="create_receipt",
            description="Create a new receipt (incoming goods from vendor). Status starts as draft.",
            inputSchema={
                "type": "object",
                "required": ["warehouse_id", "to_location_id", "lines"],
                "properties": {
                    "warehouse_id": {"type": "integer"},
                    "to_location_id": {"type": "integer", "description": "Destination location"},
                    "contact": {"type": "string", "description": "Vendor/supplier name"},
                    "scheduled_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "notes": {"type": "string"},
                    "lines": {
                        "type": "array",
                        "description": "Products to receive",
                        "items": {
                            "type": "object",
                            "required": ["product_id", "quantity"],
                            "properties": {
                                "product_id": {"type": "integer"},
                                "quantity": {"type": "number"}
                            }
                        }
                    }
                }
            }
        ),

        types.Tool(
            name="validate_receipt",
            description="Validate a receipt (mark as done). This increases stock at the destination location for all product lines.",
            inputSchema={
                "type": "object",
                "required": ["receipt_id"],
                "properties": {
                    "receipt_id": {"type": "integer"},
                }
            }
        ),

        types.Tool(
            name="cancel_receipt",
            description="Cancel a receipt that has not been validated yet.",
            inputSchema={
                "type": "object",
                "required": ["receipt_id"],
                "properties": {"receipt_id": {"type": "integer"}}
            }
        ),

        # ── Deliveries ───────────────────────────────────────────────────────
        types.Tool(
            name="list_deliveries",
            description="List delivery orders (outgoing goods). Filter by status or search.",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["draft", "waiting", "ready", "done", "canceled"]},
                    "search": {"type": "string"},
                    "warehouse_id": {"type": "integer"},
                    "limit": {"type": "integer", "default": 20},
                }
            }
        ),

        types.Tool(
            name="get_delivery",
            description="Get full details of a delivery order including all product lines and stock availability.",
            inputSchema={
                "type": "object",
                "required": ["delivery_id"],
                "properties": {"delivery_id": {"type": "integer"}}
            }
        ),

        types.Tool(
            name="create_delivery",
            description="Create a new delivery order (outgoing goods to customer). Status is automatically set to ready or waiting based on stock availability.",
            inputSchema={
                "type": "object",
                "required": ["warehouse_id", "from_location_id", "lines"],
                "properties": {
                    "warehouse_id": {"type": "integer"},
                    "from_location_id": {"type": "integer", "description": "Source location"},
                    "contact": {"type": "string", "description": "Customer name"},
                    "scheduled_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "notes": {"type": "string"},
                    "lines": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["product_id", "quantity"],
                            "properties": {
                                "product_id": {"type": "integer"},
                                "quantity": {"type": "number"}
                            }
                        }
                    }
                }
            }
        ),

        types.Tool(
            name="validate_delivery",
            description="Validate a delivery order (mark as done). This decreases stock at the source location. Only works when status is 'ready'.",
            inputSchema={
                "type": "object",
                "required": ["delivery_id"],
                "properties": {"delivery_id": {"type": "integer"}}
            }
        ),

        types.Tool(
            name="cancel_delivery",
            description="Cancel a delivery order.",
            inputSchema={
                "type": "object",
                "required": ["delivery_id"],
                "properties": {"delivery_id": {"type": "integer"}}
            }
        ),

        # ── Transfers ────────────────────────────────────────────────────────
        types.Tool(
            name="list_transfers",
            description="List internal transfer operations between locations.",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["draft", "waiting", "ready", "done", "canceled"]},
                    "search": {"type": "string"},
                    "limit": {"type": "integer", "default": 20},
                }
            }
        ),

        types.Tool(
            name="get_transfer",
            description="Get full details of an internal transfer.",
            inputSchema={
                "type": "object",
                "required": ["transfer_id"],
                "properties": {"transfer_id": {"type": "integer"}}
            }
        ),

        types.Tool(
            name="create_transfer",
            description="Create an internal transfer to move stock from one location to another (within same or different warehouse).",
            inputSchema={
                "type": "object",
                "required": ["from_location_id", "to_location_id", "lines"],
                "properties": {
                    "from_location_id": {"type": "integer"},
                    "to_location_id": {"type": "integer"},
                    "warehouse_id": {"type": "integer"},
                    "scheduled_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "notes": {"type": "string"},
                    "lines": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["product_id", "quantity"],
                            "properties": {
                                "product_id": {"type": "integer"},
                                "quantity": {"type": "number"}
                            }
                        }
                    }
                }
            }
        ),

        types.Tool(
            name="validate_transfer",
            description="Validate (execute) an internal transfer. Moves stock from source to destination location.",
            inputSchema={
                "type": "object",
                "required": ["transfer_id"],
                "properties": {"transfer_id": {"type": "integer"}}
            }
        ),

        # ── Move History ─────────────────────────────────────────────────────
        types.Tool(
            name="get_move_history",
            description="Get stock movement history with optional filters by product, type, or date range.",
            inputSchema={
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "move_type": {"type": "string", "enum": ["in", "out", "transfer", "adjustment"]},
                    "date_from": {"type": "string", "description": "YYYY-MM-DD"},
                    "date_to": {"type": "string", "description": "YYYY-MM-DD"},
                    "search": {"type": "string"},
                    "limit": {"type": "integer", "default": 50},
                }
            }
        ),

        # ── Raw SQL (read-only) ──────────────────────────────────────────────
        types.Tool(
            name="run_sql_query",
            description="Run a read-only SQL SELECT query directly against the PostgreSQL database. Only SELECT statements are allowed. Use this for custom reporting or complex queries not covered by other tools.",
            inputSchema={
                "type": "object",
                "required": ["sql"],
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "A SELECT SQL query. Must start with SELECT. No INSERT/UPDATE/DELETE allowed."
                    }
                }
            }
        ),
    ]


# ── Tool Handlers ────────────────────────────────────────────────────────────

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:

    def ok(data) -> list[types.TextContent]:
        return [types.TextContent(type="text", text=fmt(data))]

    def err(msg: str) -> list[types.TextContent]:
        return [types.TextContent(type="text", text=json.dumps({"error": msg}))]

    # ── Dashboard ──────────────────────────────────────────────────────────
    if name == "get_dashboard_stats":
        from datetime import date
        today = date.today()

        total_products = query("SELECT COUNT(*) as cnt FROM products", fetch="one")["cnt"]

        products = query("""
            SELECT p.id, p.reorder_point,
                   COALESCE(SUM(sl.quantity),0) as total_stock
            FROM products p
            LEFT JOIN stock_levels sl ON sl.product_id = p.id
            GROUP BY p.id, p.reorder_point
        """)
        low_stock = sum(1 for p in products if 0 < p["total_stock"] <= p["reorder_point"] and p["reorder_point"] > 0)
        out_of_stock = sum(1 for p in products if p["total_stock"] == 0)

        pending_receipts = query("SELECT COUNT(*) as cnt FROM operations WHERE operation_type='receipt' AND status IN ('draft','ready')", fetch="one")["cnt"]
        pending_deliveries = query("SELECT COUNT(*) as cnt FROM operations WHERE operation_type='delivery' AND status IN ('draft','waiting','ready')", fetch="one")["cnt"]
        transfers_scheduled = query("SELECT COUNT(*) as cnt FROM operations WHERE operation_type='transfer' AND status IN ('draft','ready')", fetch="one")["cnt"]

        receipts = query(f"SELECT status, scheduled_date FROM operations WHERE operation_type='receipt' AND status IN ('draft','ready')")
        deliveries = query(f"SELECT status, scheduled_date FROM operations WHERE operation_type='delivery' AND status IN ('draft','waiting','ready')")

        def is_late(d):
            if not d: return False
            return d.date() < today if hasattr(d, 'date') else False

        return ok({
            "total_products": total_products,
            "low_stock": low_stock,
            "out_of_stock": out_of_stock,
            "pending_receipts": pending_receipts,
            "pending_deliveries": pending_deliveries,
            "internal_transfers_scheduled": transfers_scheduled,
            "receipts_breakdown": {
                "to_receive": sum(1 for r in receipts if r["status"] == "ready"),
                "late": sum(1 for r in receipts if is_late(r["scheduled_date"])),
                "scheduled": sum(1 for r in receipts if r["scheduled_date"] and not is_late(r["scheduled_date"])),
            },
            "deliveries_breakdown": {
                "to_deliver": sum(1 for d in deliveries if d["status"] == "ready"),
                "waiting": sum(1 for d in deliveries if d["status"] == "waiting"),
                "late": sum(1 for d in deliveries if is_late(d["scheduled_date"])),
            },
        })

    # ── Products ───────────────────────────────────────────────────────────
    elif name == "list_products":
        where, params = ["1=1"], []
        if arguments.get("search"):
            where.append("(p.name ILIKE %s OR p.sku ILIKE %s)")
            params += [f"%{arguments['search']}%", f"%{arguments['search']}%"]
        if arguments.get("category_id"):
            where.append("p.category_id = %s"); params.append(arguments["category_id"])
        if arguments.get("location_id"):
            where.append("sl.location_id = %s"); params.append(arguments["location_id"])

        rows = query(f"""
            SELECT p.id, p.name, p.sku, p.unit_of_measure, p.cost_price, p.reorder_point,
                   c.name as category,
                   COALESCE(SUM(sl.quantity),0) as on_hand
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN stock_levels sl ON sl.product_id = p.id
            WHERE {' AND '.join(where)}
            GROUP BY p.id, p.name, p.sku, p.unit_of_measure, p.cost_price, p.reorder_point, c.name
            ORDER BY p.name
        """, params)

        for r in rows:
            r["total_value"] = round(r["on_hand"] * r["cost_price"], 2)
            r["status"] = "out_of_stock" if r["on_hand"] == 0 else (
                "low_stock" if r["on_hand"] <= r["reorder_point"] and r["reorder_point"] > 0 else "in_stock"
            )

        if arguments.get("low_stock_only"):
            rows = [r for r in rows if r["status"] in ("out_of_stock", "low_stock")]

        if arguments.get("warehouse_id"):
            wh_locs = query("SELECT id FROM locations WHERE warehouse_id = %s", [arguments["warehouse_id"]])
            loc_ids = [l["id"] for l in wh_locs]
            wh_stock = query(f"""
                SELECT product_id, SUM(quantity) as qty FROM stock_levels
                WHERE location_id = ANY(%s) GROUP BY product_id
            """, [loc_ids])
            wh_map = {r["product_id"]: r["qty"] for r in wh_stock}
            for r in rows:
                r["on_hand"] = wh_map.get(r["id"], 0)

        return ok(rows)

    elif name == "get_product":
        if arguments.get("sku"):
            p = query("SELECT id FROM products WHERE sku = %s", [arguments["sku"]], fetch="one")
            if not p: return err(f"Product with SKU '{arguments['sku']}' not found")
            pid = p["id"]
        else:
            pid = arguments["product_id"]

        product = query("""
            SELECT p.*, c.name as category_name
            FROM products p LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.id = %s
        """, [pid], fetch="one")

        if not product: return err("Product not found")

        distribution = query("""
            SELECT sl.quantity, l.name as location_name, l.short_code,
                   w.name as warehouse_name, w.short_code as warehouse_code
            FROM stock_levels sl
            JOIN locations l ON l.id = sl.location_id
            JOIN warehouses w ON w.id = l.warehouse_id
            WHERE sl.product_id = %s AND sl.quantity > 0
            ORDER BY w.name, l.name
        """, [pid])

        total_stock = sum(r["quantity"] for r in distribution)
        product["total_stock"] = total_stock
        product["total_value"] = round(total_stock * product["cost_price"], 2)
        product["distribution"] = distribution
        product.pop("password_hash", None)
        return ok(product)

    elif name == "create_product":
        args = arguments
        existing = query("SELECT id FROM products WHERE sku = %s", [args["sku"]], fetch="one")
        if existing: return err(f"SKU '{args['sku']}' already exists")

        row = execute("""
            INSERT INTO products (name, sku, category_id, unit_of_measure, cost_price, reorder_point, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            RETURNING id, name, sku, category_id, unit_of_measure, cost_price, reorder_point
        """, [
            args["name"], args["sku"],
            args.get("category_id"), args.get("unit_of_measure", "unit"),
            args.get("cost_price", 0), args.get("reorder_point", 0)
        ])

        if args.get("initial_stock") and args.get("location_id"):
            execute("""
                INSERT INTO stock_levels (product_id, location_id, quantity)
                VALUES (%s, %s, %s)
                ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = EXCLUDED.quantity
            """, [row["id"], args["location_id"], args["initial_stock"]])

        return ok({"success": True, "product": row})

    elif name == "update_product":
        args = arguments
        pid = args["product_id"]
        sets, params = [], []
        for col in ["name", "category_id", "unit_of_measure", "cost_price", "reorder_point"]:
            if col in args:
                sets.append(f"{col} = %s"); params.append(args[col])
        if not sets: return err("No fields to update")
        params.append(pid)
        row = execute(f"UPDATE products SET {', '.join(sets)} WHERE id = %s RETURNING id, name, sku", params)
        return ok({"success": True, "product": row})

    elif name == "get_product_timeline":
        pid = arguments["product_id"]
        limit = arguments.get("limit", 50)
        moves = query("""
            SELECT sm.id, sm.date, sm.reference, sm.move_type, sm.quantity, sm.contact,
                   fl.name as from_location, tl.name as to_location
            FROM stock_moves sm
            LEFT JOIN locations fl ON fl.id = sm.from_location_id
            LEFT JOIN locations tl ON tl.id = sm.to_location_id
            WHERE sm.product_id = %s
            ORDER BY sm.date DESC
            LIMIT %s
        """, [pid, limit])

        stats = query("""
            SELECT
                SUM(CASE WHEN move_type='in' THEN quantity ELSE 0 END) as total_received,
                SUM(CASE WHEN move_type='out' THEN quantity ELSE 0 END) as total_delivered,
                SUM(CASE WHEN move_type='transfer' THEN quantity ELSE 0 END) as total_transferred,
                SUM(CASE WHEN move_type='adjustment' THEN quantity ELSE 0 END) as total_adjusted,
                COUNT(*) as total_moves
            FROM stock_moves WHERE product_id = %s
        """, [pid], fetch="one")

        current = query("""
            SELECT COALESCE(SUM(quantity),0) as current_stock FROM stock_levels WHERE product_id = %s
        """, [pid], fetch="one")

        return ok({"timeline": moves, "summary": {**stats, "current_stock": current["current_stock"]}})

    # ── Categories ─────────────────────────────────────────────────────────
    elif name == "list_categories":
        cats = query("""
            SELECT c.id, c.name, COUNT(p.id) as product_count
            FROM categories c LEFT JOIN products p ON p.category_id = c.id
            GROUP BY c.id, c.name ORDER BY c.name
        """)
        return ok(cats)

    elif name == "create_category":
        existing = query("SELECT id FROM categories WHERE name = %s", [arguments["name"]], fetch="one")
        if existing: return err(f"Category '{arguments['name']}' already exists")
        row = execute("INSERT INTO categories (name) VALUES (%s) RETURNING id, name", [arguments["name"]])
        return ok({"success": True, "category": row})

    # ── Warehouses & Locations ─────────────────────────────────────────────
    elif name == "list_warehouses":
        wh = query("""
            SELECT w.id, w.name, w.short_code, w.created_at,
                   COUNT(DISTINCT l.id) as location_count,
                   COALESCE(SUM(sl.quantity),0) as total_units
            FROM warehouses w
            LEFT JOIN locations l ON l.warehouse_id = w.id
            LEFT JOIN stock_levels sl ON sl.location_id = l.id
            GROUP BY w.id, w.name, w.short_code, w.created_at
            ORDER BY w.name
        """)
        return ok(wh)

    elif name == "list_locations":
        where, params = [], []
        if arguments.get("warehouse_id"):
            where.append("l.warehouse_id = %s"); params.append(arguments["warehouse_id"])
        sql = f"""
            SELECT l.id, l.name, l.short_code, l.warehouse_id,
                   w.name as warehouse_name, w.short_code as warehouse_code,
                   COUNT(DISTINCT sl.product_id) as product_count,
                   COALESCE(SUM(sl.quantity),0) as total_units
            FROM locations l
            JOIN warehouses w ON w.id = l.warehouse_id
            LEFT JOIN stock_levels sl ON sl.location_id = l.id AND sl.quantity > 0
            {'WHERE ' + ' AND '.join(where) if where else ''}
            GROUP BY l.id, l.name, l.short_code, l.warehouse_id, w.name, w.short_code
            ORDER BY w.name, l.name
        """
        return ok(query(sql, params))

    elif name == "get_location_stock":
        lid = arguments["location_id"]
        loc = query("SELECT l.*, w.name as warehouse_name FROM locations l JOIN warehouses w ON w.id=l.warehouse_id WHERE l.id=%s", [lid], fetch="one")
        if not loc: return err("Location not found")
        stock = query("""
            SELECT p.id as product_id, p.name, p.sku, p.unit_of_measure, p.cost_price,
                   sl.quantity as on_hand,
                   sl.quantity * p.cost_price as value
            FROM stock_levels sl
            JOIN products p ON p.id = sl.product_id
            WHERE sl.location_id = %s AND sl.quantity > 0
            ORDER BY p.name
        """, [lid])
        return ok({"location": loc, "products": stock, "total_products": len(stock),
                   "total_value": round(sum(r["value"] for r in stock), 2)})

    elif name == "create_warehouse":
        existing = query("SELECT id FROM warehouses WHERE short_code = %s", [arguments["short_code"].upper()], fetch="one")
        if existing: return err(f"Short code '{arguments['short_code']}' already exists")
        row = execute("""
            INSERT INTO warehouses (name, short_code, created_at)
            VALUES (%s, %s, NOW()) RETURNING id, name, short_code
        """, [arguments["name"], arguments["short_code"].upper()])
        return ok({"success": True, "warehouse": row})

    elif name == "create_location":
        row = execute("""
            INSERT INTO locations (name, short_code, warehouse_id, created_at)
            VALUES (%s, %s, %s, NOW()) RETURNING id, name, short_code, warehouse_id
        """, [arguments["name"], arguments["short_code"].upper(), arguments["warehouse_id"]])
        return ok({"success": True, "location": row})

    # ── Stock ──────────────────────────────────────────────────────────────
    elif name == "get_stock_levels":
        where, params = ["1=1"], []
        if arguments.get("search"):
            where.append("(p.name ILIKE %s OR p.sku ILIKE %s)")
            params += [f"%{arguments['search']}%", f"%{arguments['search']}%"]

        loc_filter = ""
        if arguments.get("location_id"):
            loc_filter = "AND sl.location_id = %s"
            params_extra = [arguments["location_id"]]
        elif arguments.get("warehouse_id"):
            loc_filter = "AND l.warehouse_id = %s"
            params_extra = [arguments["warehouse_id"]]
        else:
            params_extra = []

        rows = query(f"""
            SELECT p.id, p.name, p.sku, p.unit_of_measure, p.cost_price, p.reorder_point,
                   c.name as category,
                   COALESCE(SUM(sl.quantity),0) as on_hand,
                   COALESCE(SUM(sl.quantity),0) * p.cost_price as total_value
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN stock_levels sl ON sl.product_id = p.id
            LEFT JOIN locations l ON l.id = sl.location_id
            WHERE {' AND '.join(where)} {loc_filter}
            GROUP BY p.id, p.name, p.sku, p.unit_of_measure, p.cost_price, p.reorder_point, c.name
            ORDER BY p.name
        """, params + params_extra)

        for r in rows:
            r["total_value"] = round(float(r["total_value"] or 0), 2)
            r["status"] = "out_of_stock" if r["on_hand"] == 0 else (
                "low_stock" if r["on_hand"] <= r["reorder_point"] and r["reorder_point"] > 0 else "in_stock"
            )

        if arguments.get("low_stock_only"):
            rows = [r for r in rows if r["status"] in ("out_of_stock", "low_stock")]

        return ok(rows)

    elif name == "get_stock_alerts":
        rows = query("""
            SELECT p.id, p.name, p.sku, p.reorder_point, p.unit_of_measure,
                   COALESCE(SUM(sl.quantity),0) as on_hand
            FROM products p
            LEFT JOIN stock_levels sl ON sl.product_id = p.id
            GROUP BY p.id, p.name, p.sku, p.reorder_point, p.unit_of_measure
            HAVING COALESCE(SUM(sl.quantity),0) = 0
                OR (COALESCE(SUM(sl.quantity),0) <= p.reorder_point AND p.reorder_point > 0)
            ORDER BY COALESCE(SUM(sl.quantity),0) ASC
        """)
        for r in rows:
            r["alert_type"] = "out_of_stock" if r["on_hand"] == 0 else "low_stock"
        return ok(rows)

    elif name == "adjust_stock":
        args = arguments
        product = query("SELECT id, name FROM products WHERE id = %s", [args["product_id"]], fetch="one")
        if not product: return err("Product not found")
        location = query("SELECT id, name FROM locations WHERE id = %s", [args["location_id"]], fetch="one")
        if not location: return err("Location not found")

        old = query("SELECT quantity FROM stock_levels WHERE product_id=%s AND location_id=%s",
                    [args["product_id"], args["location_id"]], fetch="one")
        old_qty = old["quantity"] if old else 0

        execute("""
            INSERT INTO stock_levels (product_id, location_id, quantity)
            VALUES (%s, %s, %s)
            ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = EXCLUDED.quantity
        """, [args["product_id"], args["location_id"], args["quantity"]])

        # Log the adjustment in stock_moves
        execute("""
            INSERT INTO stock_moves (product_id, from_location_id, to_location_id, quantity, move_type, reference, contact, date, status)
            VALUES (%s, %s, %s, %s, 'adjustment', %s, %s, NOW(), 'done')
        """, [
            args["product_id"],
            args["location_id"] if args["quantity"] < old_qty else None,
            args["location_id"] if args["quantity"] >= old_qty else None,
            abs(args["quantity"] - old_qty),
            f"MANUAL-ADJ",
            args.get("notes", "Manual adjustment via chatbot")
        ])

        return ok({
            "success": True,
            "product": product["name"],
            "location": location["name"],
            "old_quantity": old_qty,
            "new_quantity": args["quantity"],
            "delta": args["quantity"] - old_qty,
        })

    # ── Receipts ───────────────────────────────────────────────────────────
    elif name == "list_receipts":
        where, params = ["o.operation_type = 'receipt'"], []
        if arguments.get("status"):
            where.append("o.status = %s"); params.append(arguments["status"])
        if arguments.get("warehouse_id"):
            where.append("o.warehouse_id = %s"); params.append(arguments["warehouse_id"])
        if arguments.get("search"):
            where.append("(o.reference ILIKE %s OR o.contact ILIKE %s)")
            params += [f"%{arguments['search']}%", f"%{arguments['search']}%"]
        limit = arguments.get("limit", 20)
        rows = query(f"""
            SELECT o.id, o.reference, o.status, o.contact, o.scheduled_date, o.validated_at,
                   l.name as to_location, w.name as warehouse,
                   COUNT(ol.id) as line_count
            FROM operations o
            LEFT JOIN locations l ON l.id = o.to_location_id
            LEFT JOIN warehouses w ON w.id = o.warehouse_id
            LEFT JOIN operation_lines ol ON ol.operation_id = o.id
            WHERE {' AND '.join(where)}
            GROUP BY o.id, o.reference, o.status, o.contact, o.scheduled_date, o.validated_at, l.name, w.name
            ORDER BY o.created_at DESC LIMIT %s
        """, params + [limit])
        return ok(rows)

    elif name == "get_receipt":
        oid = arguments["receipt_id"]
        op = query("""
            SELECT o.*, l.name as to_location_name, w.name as warehouse_name, u.full_name as responsible
            FROM operations o
            LEFT JOIN locations l ON l.id = o.to_location_id
            LEFT JOIN warehouses w ON w.id = o.warehouse_id
            LEFT JOIN users u ON u.id = o.responsible_id
            WHERE o.id = %s AND o.operation_type = 'receipt'
        """, [oid], fetch="one")
        if not op: return err("Receipt not found")
        lines = query("""
            SELECT ol.id, ol.quantity, p.id as product_id, p.name, p.sku,
                   COALESCE(SUM(sl.quantity),0) as current_stock
            FROM operation_lines ol
            JOIN products p ON p.id = ol.product_id
            LEFT JOIN stock_levels sl ON sl.product_id = p.id
            WHERE ol.operation_id = %s
            GROUP BY ol.id, ol.quantity, p.id, p.name, p.sku
        """, [oid])
        op["lines"] = lines
        return ok(op)

    elif name == "create_receipt":
        args = arguments
        wh = query("SELECT short_code FROM warehouses WHERE id = %s", [args["warehouse_id"]], fetch="one")
        if not wh: return err("Warehouse not found")
        wh_code = wh["short_code"]
        count = query("SELECT COUNT(*) as cnt FROM operations WHERE reference LIKE %s",
                      [f"{wh_code}/IN/%"], fetch="one")["cnt"]
        ref = f"{wh_code}/IN/{str(count+1).zfill(4)}"
        sched = args.get("scheduled_date")

        op = execute("""
            INSERT INTO operations
            (reference, operation_type, status, to_location_id, warehouse_id, contact, scheduled_date, notes, created_at, updated_at)
            VALUES (%s, 'receipt', 'draft', %s, %s, %s, %s, %s, NOW(), NOW())
            RETURNING id, reference, status
        """, [ref, args.get("to_location_id"), args["warehouse_id"],
              args.get("contact"), sched, args.get("notes")])

        for line in args["lines"]:
            execute("INSERT INTO operation_lines (operation_id, product_id, quantity) VALUES (%s, %s, %s)",
                    [op["id"], line["product_id"], line["quantity"]])

        return ok({"success": True, "receipt": op})

    elif name == "validate_receipt":
        oid = arguments["receipt_id"]
        op = query("SELECT * FROM operations WHERE id=%s AND operation_type='receipt'", [oid], fetch="one")
        if not op: return err("Receipt not found")
        if op["status"] not in ("draft", "ready"): return err(f"Cannot validate receipt in '{op['status']}' status")

        lines = query("SELECT * FROM operation_lines WHERE operation_id = %s", [oid])
        for line in lines:
            execute("""
                INSERT INTO stock_levels (product_id, location_id, quantity)
                VALUES (%s, %s, %s)
                ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = stock_levels.quantity + EXCLUDED.quantity
            """, [line["product_id"], op["to_location_id"], line["quantity"]])
            execute("""
                INSERT INTO stock_moves (operation_id, product_id, to_location_id, quantity, move_type, reference, contact, date, status)
                VALUES (%s, %s, %s, %s, 'in', %s, %s, NOW(), 'done')
            """, [oid, line["product_id"], op["to_location_id"], line["quantity"], op["reference"], op["contact"]])

        execute("UPDATE operations SET status='done', validated_at=NOW() WHERE id=%s", [oid])
        _auto_promote_waiting_deliveries([l["product_id"] for l in lines])
        return ok({"success": True, "reference": op["reference"], "status": "done"})

    elif name == "cancel_receipt":
        op = query("SELECT status, reference FROM operations WHERE id=%s AND operation_type='receipt'",
                   [arguments["receipt_id"]], fetch="one")
        if not op: return err("Receipt not found")
        if op["status"] == "done": return err("Cannot cancel a validated receipt")
        execute("UPDATE operations SET status='canceled' WHERE id=%s", [arguments["receipt_id"]])
        return ok({"success": True, "reference": op["reference"], "status": "canceled"})

    # ── Deliveries ─────────────────────────────────────────────────────────
    elif name == "list_deliveries":
        where, params = ["o.operation_type = 'delivery'"], []
        if arguments.get("status"):
            where.append("o.status = %s"); params.append(arguments["status"])
        if arguments.get("warehouse_id"):
            where.append("o.warehouse_id = %s"); params.append(arguments["warehouse_id"])
        if arguments.get("search"):
            where.append("(o.reference ILIKE %s OR o.contact ILIKE %s)")
            params += [f"%{arguments['search']}%", f"%{arguments['search']}%"]
        limit = arguments.get("limit", 20)
        rows = query(f"""
            SELECT o.id, o.reference, o.status, o.contact, o.scheduled_date,
                   l.name as from_location, w.name as warehouse,
                   COUNT(ol.id) as line_count
            FROM operations o
            LEFT JOIN locations l ON l.id = o.from_location_id
            LEFT JOIN warehouses w ON w.id = o.warehouse_id
            LEFT JOIN operation_lines ol ON ol.operation_id = o.id
            WHERE {' AND '.join(where)}
            GROUP BY o.id, o.reference, o.status, o.contact, o.scheduled_date, l.name, w.name
            ORDER BY o.created_at DESC LIMIT %s
        """, params + [limit])
        return ok(rows)

    elif name == "get_delivery":
        oid = arguments["delivery_id"]
        op = query("""
            SELECT o.*, l.name as from_location_name, w.name as warehouse_name, u.full_name as responsible
            FROM operations o
            LEFT JOIN locations l ON l.id = o.from_location_id
            LEFT JOIN warehouses w ON w.id = o.warehouse_id
            LEFT JOIN users u ON u.id = o.responsible_id
            WHERE o.id = %s AND o.operation_type = 'delivery'
        """, [oid], fetch="one")
        if not op: return err("Delivery not found")
        lines = query("""
            SELECT ol.id, ol.quantity, p.id as product_id, p.name, p.sku,
                   COALESCE(SUM(sl.quantity),0) as current_stock
            FROM operation_lines ol
            JOIN products p ON p.id = ol.product_id
            LEFT JOIN stock_levels sl ON sl.product_id = p.id
            WHERE ol.operation_id = %s
            GROUP BY ol.id, ol.quantity, p.id, p.name, p.sku
        """, [oid])
        for line in lines:
            line["stock_ok"] = line["current_stock"] >= line["quantity"]
        op["lines"] = lines
        return ok(op)

    elif name == "create_delivery":
        args = arguments
        wh = query("SELECT short_code FROM warehouses WHERE id = %s", [args["warehouse_id"]], fetch="one")
        if not wh: return err("Warehouse not found")
        wh_code = wh["short_code"]
        count = query("SELECT COUNT(*) as cnt FROM operations WHERE reference LIKE %s",
                      [f"{wh_code}/OUT/%"], fetch="one")["cnt"]
        ref = f"{wh_code}/OUT/{str(count+1).zfill(4)}"

        # Check stock availability
        has_waiting = False
        for line in args["lines"]:
            stock = query("""
                SELECT COALESCE(SUM(sl.quantity),0) as qty FROM stock_levels sl
                WHERE sl.product_id = %s AND sl.location_id = %s
            """, [line["product_id"], args["from_location_id"]], fetch="one")
            if not stock or stock["qty"] < line["quantity"]:
                has_waiting = True
                break

        status = "waiting" if has_waiting else "ready"
        op = execute("""
            INSERT INTO operations
            (reference, operation_type, status, from_location_id, warehouse_id, contact, scheduled_date, notes, created_at, updated_at)
            VALUES (%s, 'delivery', %s, %s, %s, %s, %s, %s, NOW(), NOW())
            RETURNING id, reference, status
        """, [ref, status, args["from_location_id"], args["warehouse_id"],
              args.get("contact"), args.get("scheduled_date"), args.get("notes")])

        for line in args["lines"]:
            execute("INSERT INTO operation_lines (operation_id, product_id, quantity) VALUES (%s, %s, %s)",
                    [op["id"], line["product_id"], line["quantity"]])

        return ok({"success": True, "delivery": op})

    elif name == "validate_delivery":
        oid = arguments["delivery_id"]
        op = query("SELECT * FROM operations WHERE id=%s AND operation_type='delivery'", [oid], fetch="one")
        if not op: return err("Delivery not found")
        if op["status"] != "ready": return err(f"Delivery must be 'ready' to validate (current: '{op['status']}')")

        lines = query("SELECT * FROM operation_lines WHERE operation_id = %s", [oid])
        for line in lines:
            stock = query("SELECT quantity FROM stock_levels WHERE product_id=%s AND location_id=%s",
                          [line["product_id"], op["from_location_id"]], fetch="one")
            if not stock or stock["quantity"] < line["quantity"]:
                p = query("SELECT name FROM products WHERE id=%s", [line["product_id"]], fetch="one")
                return err(f"Insufficient stock for {p['name'] if p else line['product_id']}")

        for line in lines:
            execute("""
                UPDATE stock_levels SET quantity = quantity - %s
                WHERE product_id = %s AND location_id = %s
            """, [line["quantity"], line["product_id"], op["from_location_id"]])
            execute("""
                INSERT INTO stock_moves (operation_id, product_id, from_location_id, quantity, move_type, reference, contact, date, status)
                VALUES (%s, %s, %s, %s, 'out', %s, %s, NOW(), 'done')
            """, [oid, line["product_id"], op["from_location_id"], line["quantity"], op["reference"], op["contact"]])

        execute("UPDATE operations SET status='done', validated_at=NOW() WHERE id=%s", [oid])
        return ok({"success": True, "reference": op["reference"], "status": "done"})

    elif name == "cancel_delivery":
        op = query("SELECT status, reference FROM operations WHERE id=%s AND operation_type='delivery'",
                   [arguments["delivery_id"]], fetch="one")
        if not op: return err("Delivery not found")
        if op["status"] == "done": return err("Cannot cancel a validated delivery")
        execute("UPDATE operations SET status='canceled' WHERE id=%s", [arguments["delivery_id"]])
        return ok({"success": True, "reference": op["reference"], "status": "canceled"})

    # ── Transfers ──────────────────────────────────────────────────────────
    elif name == "list_transfers":
        where, params = ["o.operation_type = 'transfer'"], []
        if arguments.get("status"):
            where.append("o.status = %s"); params.append(arguments["status"])
        if arguments.get("search"):
            where.append("o.reference ILIKE %s"); params.append(f"%{arguments['search']}%")
        limit = arguments.get("limit", 20)
        rows = query(f"""
            SELECT o.id, o.reference, o.status, o.notes, o.scheduled_date,
                   fl.name as from_location, tl.name as to_location,
                   COUNT(ol.id) as line_count
            FROM operations o
            LEFT JOIN locations fl ON fl.id = o.from_location_id
            LEFT JOIN locations tl ON tl.id = o.to_location_id
            LEFT JOIN operation_lines ol ON ol.operation_id = o.id
            WHERE {' AND '.join(where)}
            GROUP BY o.id, o.reference, o.status, o.notes, o.scheduled_date, fl.name, tl.name
            ORDER BY o.created_at DESC LIMIT %s
        """, params + [limit])
        return ok(rows)

    elif name == "get_transfer":
        oid = arguments["transfer_id"]
        op = query("""
            SELECT o.*, fl.name as from_location_name, tl.name as to_location_name
            FROM operations o
            LEFT JOIN locations fl ON fl.id = o.from_location_id
            LEFT JOIN locations tl ON tl.id = o.to_location_id
            WHERE o.id = %s AND o.operation_type = 'transfer'
        """, [oid], fetch="one")
        if not op: return err("Transfer not found")
        lines = query("""
            SELECT ol.quantity, p.name, p.sku,
                   COALESCE(SUM(sl.quantity),0) as available_at_source
            FROM operation_lines ol
            JOIN products p ON p.id = ol.product_id
            LEFT JOIN stock_levels sl ON sl.product_id = p.id AND sl.location_id = %s
            WHERE ol.operation_id = %s
            GROUP BY ol.quantity, p.name, p.sku
        """, [op["from_location_id"], oid])
        op["lines"] = lines
        return ok(op)

    elif name == "create_transfer":
        args = arguments
        from_loc = query("SELECT l.*, w.short_code FROM locations l JOIN warehouses w ON w.id=l.warehouse_id WHERE l.id=%s",
                         [args["from_location_id"]], fetch="one")
        if not from_loc: return err("Source location not found")
        wh_code = from_loc["short_code"]
        count = query("SELECT COUNT(*) as cnt FROM operations WHERE reference LIKE %s",
                      [f"{wh_code}/INT/%"], fetch="one")["cnt"]
        ref = f"{wh_code}/INT/{str(count+1).zfill(4)}"

        has_waiting = False
        for line in args["lines"]:
            stock = query("SELECT COALESCE(quantity,0) as qty FROM stock_levels WHERE product_id=%s AND location_id=%s",
                          [line["product_id"], args["from_location_id"]], fetch="one")
            if not stock or stock["qty"] < line["quantity"]:
                has_waiting = True; break

        status = "waiting" if has_waiting else "ready"
        op = execute("""
            INSERT INTO operations
            (reference, operation_type, status, from_location_id, to_location_id, warehouse_id, scheduled_date, notes, created_at, updated_at)
            VALUES (%s, 'transfer', %s, %s, %s, %s, %s, %s, NOW(), NOW())
            RETURNING id, reference, status
        """, [ref, status, args["from_location_id"], args["to_location_id"],
              args.get("warehouse_id"), args.get("scheduled_date"), args.get("notes")])

        for line in args["lines"]:
            execute("INSERT INTO operation_lines (operation_id, product_id, quantity) VALUES (%s, %s, %s)",
                    [op["id"], line["product_id"], line["quantity"]])

        return ok({"success": True, "transfer": op})

    elif name == "validate_transfer":
        oid = arguments["transfer_id"]
        op = query("SELECT * FROM operations WHERE id=%s AND operation_type='transfer'", [oid], fetch="one")
        if not op: return err("Transfer not found")
        if op["status"] != "ready": return err(f"Transfer must be 'ready' to validate (current: '{op['status']}')")

        lines = query("SELECT * FROM operation_lines WHERE operation_id = %s", [oid])
        for line in lines:
            stock = query("SELECT COALESCE(quantity,0) as qty FROM stock_levels WHERE product_id=%s AND location_id=%s",
                          [line["product_id"], op["from_location_id"]], fetch="one")
            if not stock or stock["qty"] < line["quantity"]:
                p = query("SELECT name FROM products WHERE id=%s", [line["product_id"]], fetch="one")
                return err(f"Insufficient stock for {p['name'] if p else line['product_id']}")

        for line in lines:
            execute("UPDATE stock_levels SET quantity = quantity - %s WHERE product_id=%s AND location_id=%s",
                    [line["quantity"], line["product_id"], op["from_location_id"]])
            execute("""
                INSERT INTO stock_levels (product_id, location_id, quantity)
                VALUES (%s, %s, %s)
                ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = stock_levels.quantity + EXCLUDED.quantity
            """, [line["product_id"], op["to_location_id"], line["quantity"]])
            execute("""
                INSERT INTO stock_moves (operation_id, product_id, from_location_id, to_location_id, quantity, move_type, reference, contact, date, status)
                VALUES (%s, %s, %s, %s, %s, 'transfer', %s, %s, NOW(), 'done')
            """, [oid, line["product_id"], op["from_location_id"], op["to_location_id"],
                  line["quantity"], op["reference"], op.get("notes", "")])

        execute("UPDATE operations SET status='done', validated_at=NOW() WHERE id=%s", [oid])
        return ok({"success": True, "reference": op["reference"], "status": "done"})

    # ── Move History ───────────────────────────────────────────────────────
    elif name == "get_move_history":
        where, params = ["1=1"], []
        if arguments.get("product_id"):
            where.append("sm.product_id = %s"); params.append(arguments["product_id"])
        if arguments.get("move_type"):
            where.append("sm.move_type = %s"); params.append(arguments["move_type"])
        if arguments.get("search"):
            where.append("(sm.reference ILIKE %s OR sm.contact ILIKE %s)")
            params += [f"%{arguments['search']}%", f"%{arguments['search']}%"]
        if arguments.get("date_from"):
            where.append("sm.date >= %s"); params.append(arguments["date_from"])
        if arguments.get("date_to"):
            where.append("sm.date <= %s"); params.append(arguments["date_to"] + "T23:59:59")
        limit = arguments.get("limit", 50)

        rows = query(f"""
            SELECT sm.id, sm.date, sm.reference, sm.move_type, sm.quantity, sm.contact, sm.status,
                   p.name as product_name, p.sku,
                   fl.name as from_location, tl.name as to_location
            FROM stock_moves sm
            JOIN products p ON p.id = sm.product_id
            LEFT JOIN locations fl ON fl.id = sm.from_location_id
            LEFT JOIN locations tl ON tl.id = sm.to_location_id
            WHERE {' AND '.join(where)}
            ORDER BY sm.date DESC LIMIT %s
        """, params + [limit])
        return ok(rows)

    # ── Raw SQL ────────────────────────────────────────────────────────────
    elif name == "run_sql_query":
        sql = arguments["sql"].strip()
        if not sql.upper().startswith("SELECT"):
            return err("Only SELECT queries are allowed for safety. Use specific tools for write operations.")
        try:
            rows = query(sql)
            return ok({"rows": rows, "count": len(rows)})
        except Exception as e:
            return err(f"SQL error: {str(e)}")

    else:
        return err(f"Unknown tool: {name}")


def _auto_promote_waiting_deliveries(product_ids: list):
    """After a receipt, re-check waiting deliveries and promote to ready if stock sufficient."""
    if not product_ids: return
    waiting = query("""
        SELECT DISTINCT o.id, o.from_location_id FROM operations o
        JOIN operation_lines ol ON ol.operation_id = o.id
        WHERE o.operation_type = 'delivery' AND o.status = 'waiting'
        AND ol.product_id = ANY(%s)
    """, [product_ids])

    for delivery in waiting:
        oid = delivery["id"]
        from_loc = delivery["from_location_id"]
        lines = query("SELECT product_id, quantity FROM operation_lines WHERE operation_id = %s", [oid])
        all_ok = True
        for line in lines:
            stock = query("SELECT COALESCE(quantity,0) as qty FROM stock_levels WHERE product_id=%s AND location_id=%s",
                          [line["product_id"], from_loc], fetch="one")
            if not stock or stock["qty"] < line["quantity"]:
                all_ok = False; break
        if all_ok:
            execute("UPDATE operations SET status='ready' WHERE id=%s", [oid])


# ── Entry point ──────────────────────────────────────────────────────────────

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())