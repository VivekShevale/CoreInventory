from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from datetime import datetime, timedelta
from sqlalchemy import func
from ..extensions import db
from ..models import (
    Operation, Product, StockLevel,
    StockMove, Location, Category
)

dashboard_bp = Blueprint('dashboard', __name__)


def _fmt_day(dt):
    """Cross-platform short date  e.g. 'Mar 7'  (%-d fails on Windows)."""
    return dt.strftime('%b') + ' ' + str(dt.day)


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    today = datetime.utcnow().date()
    now   = datetime.utcnow()

    # ── existing KPI fields (all keys unchanged) ──────────────────────────────
    total_products = Product.query.count()

    products     = Product.query.all()
    low_stock    = 0
    out_of_stock = 0
    for p in products:
        total = p.total_stock()
        if total == 0:
            out_of_stock += 1
        elif p.reorder_point > 0 and total <= p.reorder_point:
            low_stock += 1

    pending_receipts = Operation.query.filter(
        Operation.operation_type == 'receipt',
        Operation.status.in_(['draft', 'ready'])
    ).count()

    pending_deliveries = Operation.query.filter(
        Operation.operation_type == 'delivery',
        Operation.status.in_(['draft', 'waiting', 'ready'])
    ).count()

    internal_transfers = Operation.query.filter(
        Operation.operation_type == 'transfer',
        Operation.status.in_(['draft', 'ready'])
    ).count()

    receipts = Operation.query.filter(
        Operation.operation_type == 'receipt',
        Operation.status.in_(['draft', 'ready'])
    ).all()
    receipts_to_receive = sum(1 for r in receipts if r.status == 'ready')
    receipts_late       = sum(1 for r in receipts if r.scheduled_date and r.scheduled_date.date() < today)
    receipts_operations = sum(1 for r in receipts if r.scheduled_date and r.scheduled_date.date() > today)

    deliveries = Operation.query.filter(
        Operation.operation_type == 'delivery',
        Operation.status.in_(['draft', 'waiting', 'ready'])
    ).all()
    deliveries_to_deliver = sum(1 for d in deliveries if d.status == 'ready')
    deliveries_late       = sum(1 for d in deliveries if d.scheduled_date and d.scheduled_date.date() < today)
    deliveries_waiting    = sum(1 for d in deliveries if d.status == 'waiting')
    deliveries_operations = sum(1 for d in deliveries if d.scheduled_date and d.scheduled_date.date() > today)

    # ── chart 1: stock movements — last 14 days ───────────────────────────────
    fourteen_days_ago = now - timedelta(days=13)
    moves_raw = StockMove.query.filter(StockMove.date >= fourteen_days_ago).all()

    day_keys    = [_fmt_day(fourteen_days_ago + timedelta(days=i)) for i in range(14)]
    day_buckets = {k: {'in': 0.0, 'out': 0.0} for k in day_keys}

    for m in moves_raw:
        key = _fmt_day(m.date)
        if key not in day_buckets:
            continue
        if m.move_type in ('in', 'transfer'):
            day_buckets[key]['in']  += abs(m.quantity or 0)
        else:
            day_buckets[key]['out'] += abs(m.quantity or 0)

    movements = [
        {'date': k, 'in': round(day_buckets[k]['in']), 'out': round(day_buckets[k]['out'])}
        for k in day_keys
    ]

    # ── chart 2: stock by category ────────────────────────────────────────────
    categories_data = []
    for cat in Category.query.all():
        qty = sum(p.total_stock() for p in cat.products)
        if qty > 0:
            categories_data.append({'name': cat.name, 'qty': round(qty)})
    categories_data.sort(key=lambda x: -x['qty'])

    # ── chart 3: per-product stock levels ─────────────────────────────────────
    products_data = [
        {
            'shortName': (p.name[:11] + '…') if len(p.name) > 12 else p.name,
            'onHand':    round(p.total_stock()),
            'freeToUse': round(p.free_to_use()),
            'reorder':   p.reorder_point,
        }
        for p in products
    ]

    # ── chart 4: operations by status (stacked bar) ───────────────────────────
    op_types = ['receipt', 'delivery', 'transfer', 'adjustment']
    op_status = {}
    for status in ['draft', 'waiting', 'ready', 'done']:
        op_status[status] = [
            Operation.query.filter(
                Operation.operation_type == ot,
                Operation.status == status
            ).count()
            for ot in op_types
        ]

    # ── chart 5: stock by location ────────────────────────────────────────────
    loc_rows = (
        db.session.query(
            Location.name,
            func.coalesce(func.sum(StockLevel.quantity), 0).label('qty')
        )
        .outerjoin(StockLevel, StockLevel.location_id == Location.id)
        .group_by(Location.id, Location.name)
        .order_by(func.coalesce(func.sum(StockLevel.quantity), 0).desc())
        .all()
    )
    locations_data = [
        {'name': r.name, 'qty': round(float(r.qty))}
        for r in loc_rows if float(r.qty) > 0
    ]

    # ── chart 6: low-stock alerts ─────────────────────────────────────────────
    alerts = []
    for p in products:
        on_hand = p.total_stock()
        free    = p.free_to_use()
        if p.reorder_point > 0 and on_hand < p.reorder_point:
            alerts.append({
                'sku':       p.sku,
                'name':      p.name,
                'detail':    f"On hand: {round(on_hand)} {p.unit_of_measure} · Reorder: {p.reorder_point} · Free: {round(free)}",
                'badgeText': 'Below reorder',
                'severity':  'critical',
            })
        elif p.reorder_point > 0 and free < p.reorder_point * 0.5:
            alerts.append({
                'sku':       p.sku,
                'name':      p.name,
                'detail':    f"On hand: {round(on_hand)} · {round(on_hand - free)} reserved · Reorder: {p.reorder_point}",
                'badgeText': 'Reserved low',
                'severity':  'warning',
            })

    # ── chart 7: top contacts by volume ───────────────────────────────────────
    contact_rows = (
        db.session.query(
            StockMove.contact,
            StockMove.move_type,
            func.sum(func.abs(StockMove.quantity)).label('vol')
        )
        .filter(
            StockMove.contact.isnot(None),
            StockMove.contact != '',
            StockMove.date >= fourteen_days_ago
        )
        .group_by(StockMove.contact, StockMove.move_type)
        .order_by(func.sum(func.abs(StockMove.quantity)).desc())
        .limit(6)
        .all()
    )
    contacts_data = [
        {
            'name': r.contact,
            'vol':  round(float(r.vol or 0)),
            'type': 'in' if r.move_type in ('in', 'transfer') else 'out',
        }
        for r in contact_rows
    ]

    # ── chart 8: stock value by category ──────────────────────────────────────
    stock_value = []
    for cat in Category.query.all():
        value = sum((p.cost_price or 0) * p.total_stock() for p in cat.products)
        if value > 0:
            short = (cat.name[:9] + '…') if len(cat.name) > 10 else cat.name
            stock_value.append({'name': short, 'value': round(value)})
    stock_value.sort(key=lambda x: -x['value'])

    total_stock_value = round(sum((p.cost_price or 0) * p.total_stock() for p in products))

    # ── recent 8 stock moves ──────────────────────────────────────────────────
    recent_moves_raw = StockMove.query.order_by(StockMove.date.desc()).limit(8).all()
    recent_moves = []
    for m in recent_moves_raw:
        try:
            from_label = (
                f"{m.from_location.warehouse.short_code}/{m.from_location.short_code}"
                if m.from_location else 'Vendor'
            )
            to_label = (
                f"{m.to_location.warehouse.short_code}/{m.to_location.short_code}"
                if m.to_location else 'Vendor'
            )
        except Exception:
            from_label, to_label = '—', '—'

        recent_moves.append({
            'ref':     m.reference or '—',
            'date':    _fmt_day(m.date),
            'contact': m.contact or '',
            'from':    from_label,
            'to':      to_label,
            'qty':     round(abs(m.quantity or 0)),
            'type':    m.move_type or 'in',
        })

    # ── final response ────────────────────────────────────────────────────────
    return jsonify({
        # existing top-level keys — DashboardPage reads these directly
        'total_products':     total_products,
        'low_stock':          low_stock,
        'out_of_stock':       out_of_stock,
        'pending_receipts':   pending_receipts,
        'pending_deliveries': pending_deliveries,
        'internal_transfers': internal_transfers,
        'receipts': {
            'to_receive':  receipts_to_receive,
            'late':        receipts_late,
            'operations':  receipts_operations,
            'total':       len(receipts),
        },
        'deliveries': {
            'to_deliver':  deliveries_to_deliver,
            'late':        deliveries_late,
            'waiting':     deliveries_waiting,
            'operations':  deliveries_operations,
            'total':       len(deliveries),
        },

        # charts sub-object — DashboardCharts reads this
        'charts': {
            'kpis': {
                'totalProducts':     total_products,
                'lowStock':          low_stock + out_of_stock,
                'pendingReceipts':   pending_receipts,
                'lateReceipts':      receipts_late,
                'pendingDeliveries': pending_deliveries,
                'lateDeliveries':    deliveries_late,
                'waitingDeliveries': deliveries_waiting,
                'totalStockValue':   total_stock_value,
            },
            'movements':   movements,
            'categories':  categories_data,
            'products':    products_data,
            'opStatus':    op_status,
            'locations':   locations_data,
            'alerts':      alerts,
            'contacts':    contacts_data,
            'stockValue':  stock_value,
            'recentMoves': recent_moves,
        },
    }), 200