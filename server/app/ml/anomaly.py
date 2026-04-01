# server/app/ml/anomaly.py
# ─────────────────────────────────────────────────────────────────────────────
# Anomaly Detection for CoreInventory.
#
# Detects THREE kinds of anomalies:
#   1. Quantity spike/drop   — a single movement is abnormally large/small
#   2. Velocity change       — daily throughput suddenly changes
#   3. Shrinkage             — on-hand stock drops without a matching delivery/adj
#
# Algorithms (scratch-built):
#   • Robust Z-score  (Median Absolute Deviation) — for quantity spikes
#   • EWMA control chart                          — for velocity anomalies
#   • Simple ledger balance check                 — for shrinkage
# ─────────────────────────────────────────────────────────────────────────────

import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict


# ── 1. Robust Z-score (MAD-based) ─────────────────────────────────────────────

def _mad_zscore(values: np.ndarray, threshold: float = 3.5):
    """
    Returns boolean mask of outliers using Median Absolute Deviation.
    More robust than standard Z-score for skewed inventory data.
    """
    if len(values) < 3:
        return np.zeros(len(values), dtype=bool)
    median = np.median(values)
    mad    = np.median(np.abs(values - median))
    if mad == 0:
        return np.zeros(len(values), dtype=bool)
    modified_z = 0.6745 * (values - median) / mad
    return np.abs(modified_z) > threshold


# ── 2. EWMA control chart ──────────────────────────────────────────────────────

def _ewma_anomalies(series: np.ndarray, alpha: float = 0.2, k: float = 3.0):
    """
    Exponentially-Weighted Moving Average control chart.
    Flags points outside  ewma ± k * ewma_std.
    Returns boolean mask.
    """
    n = len(series)
    if n < 5:
        return np.zeros(n, dtype=bool)

    ewma      = np.zeros(n)
    ewma_sq   = np.zeros(n)
    ewma[0]   = series[0]
    ewma_sq[0] = series[0] ** 2
    flags = np.zeros(n, dtype=bool)

    for t in range(1, n):
        ewma[t]    = alpha * series[t]    + (1 - alpha) * ewma[t-1]
        ewma_sq[t] = alpha * series[t]**2 + (1 - alpha) * ewma_sq[t-1]
        var = max(0, ewma_sq[t] - ewma[t]**2)
        std = np.sqrt(var)
        if std > 0 and abs(series[t] - ewma[t]) > k * std:
            flags[t] = True

    return flags


# ── public API ─────────────────────────────────────────────────────────────────

def detect_quantity_anomalies(move_rows, days_back: int = 90):
    """
    Detect abnormally large or small individual stock movements.
    Returns list of anomaly dicts.
    """
    if not move_rows:
        return []

    quantities = np.array([abs(m.quantity or 0) for m in move_rows], dtype=float)
    flags      = _mad_zscore(quantities)

    anomalies = []
    for flag, m in zip(flags, move_rows):
        if flag:
            median = float(np.median(quantities))
            anomalies.append({
                'type':      'quantity_spike',
                'severity':  'high' if abs(m.quantity) > 5 * median else 'medium',
                'reference': m.reference or '—',
                'product_id': m.product_id,
                'date':      str(m.date.date()),
                'quantity':  round(abs(m.quantity or 0), 1),
                'expected':  round(median, 1),
                'message':   f"Movement of {round(abs(m.quantity),1)} units is abnormally {'large' if m.quantity > median else 'small'} (typical: {round(median,1)})",
                'move_type': m.move_type,
            })

    return anomalies


def detect_velocity_anomalies(move_rows, days_back: int = 60):
    """
    Detect days where throughput (total units moved) is abnormal.
    Returns list of anomaly dicts.
    """
    end   = datetime.utcnow().date()
    start = end - timedelta(days=days_back - 1)

    daily = defaultdict(float)
    for m in move_rows:
        d = m.date.date() if hasattr(m.date, 'date') else m.date
        if start <= d <= end:
            daily[d] += abs(m.quantity or 0)

    if len(daily) < 5:
        return []

    dates  = sorted(daily.keys())
    series = np.array([daily[d] for d in dates], dtype=float)
    flags  = _ewma_anomalies(series)

    anomalies = []
    for flag, d, v in zip(flags, dates, series):
        if flag and v > 0:
            anomalies.append({
                'type':     'velocity_spike',
                'severity': 'medium',
                'date':     str(d),
                'quantity': round(v, 1),
                'message':  f"Abnormal throughput of {round(v,1)} units on {d}",
            })

    return anomalies


def detect_shrinkage(product_rows, move_rows):
    """
    Detects products where recorded on-hand stock is lower than what
    the ledger implies — indicates potential theft, damage, or data error.

    Returns list of shrinkage anomaly dicts.
    """
    # Build ledger balance per product
    ledger = defaultdict(float)
    for m in move_rows:
        if m.move_type == 'in':
            ledger[m.product_id] += m.quantity or 0
        elif m.move_type == 'out':
            ledger[m.product_id] -= abs(m.quantity or 0)
        elif m.move_type == 'transfer':
            # transfers are internal, net zero for total stock
            pass
        elif m.move_type == 'adjustment':
            ledger[m.product_id] -= abs(m.quantity or 0)

    anomalies = []
    for p in product_rows:
        actual   = p.total_stock()
        expected = max(0, ledger.get(p.id, 0))
        diff     = expected - actual
        if diff > max(1.0, expected * 0.05):   # >5% or >1 unit discrepancy
            anomalies.append({
                'type':       'shrinkage',
                'severity':   'high' if diff > expected * 0.15 else 'medium',
                'product_id': p.id,
                'sku':        p.sku,
                'name':       p.name,
                'actual':     round(actual, 1),
                'expected':   round(expected, 1),
                'discrepancy': round(diff, 1),
                'pct':        round(diff / expected * 100, 1) if expected > 0 else 0,
                'message':    f"Stock {round(diff,1)} units below ledger ({round(diff/expected*100,1)}% shrinkage)",
            })

    anomalies.sort(key=lambda x: -x['discrepancy'])
    return anomalies


def run_all_anomaly_checks(db_session, StockMove, Product, days_back: int = 60):
    """
    Run all three anomaly detectors across the full dataset.
    Returns { quantity_anomalies, velocity_anomalies, shrinkage_anomalies, summary }
    """
    cutoff    = datetime.utcnow() - timedelta(days=days_back)
    all_moves = db_session.query(StockMove).filter(StockMove.date >= cutoff).all()
    products  = Product.query.all()

    qty_anoms = detect_quantity_anomalies(all_moves, days_back)
    vel_anoms = detect_velocity_anomalies(all_moves, days_back)
    shr_anoms = detect_shrinkage(products, all_moves)

    total = len(qty_anoms) + len(vel_anoms) + len(shr_anoms)
    high  = sum(1 for a in qty_anoms + vel_anoms + shr_anoms if a.get('severity') == 'high')

    return {
        'quantity_anomalies':  qty_anoms,
        'velocity_anomalies':  vel_anoms,
        'shrinkage_anomalies': shr_anoms,
        'summary': {
            'total':    total,
            'high':     high,
            'medium':   total - high,
            'checked_days': days_back,
        },
    }