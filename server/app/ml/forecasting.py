# server/app/ml/forecasting.py
# ─────────────────────────────────────────────────────────────────────────────
# Demand forecasting — built from scratch with numpy + scipy.
#
# Algorithm:
#   1. Aggregate daily stock-out quantities per product from StockMove ledger.
#   2. Apply Double Exponential Smoothing (Holt's method) to capture both
#      level and trend — no external stats library needed.
#   3. Return point forecasts + simple confidence bands for the next N days.
#
# Why from scratch?
#   Prophet / statsmodels are large deps and overkill for inventory time series
#   that are mostly sparse daily counts.  Holt's method is accurate, fast, and
#   interpretable.
# ─────────────────────────────────────────────────────────────────────────────

import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict


# ── core algorithm: double exponential smoothing (Holt's linear trend) ────────

def _holt_smooth(series: np.ndarray, alpha: float = 0.3, beta: float = 0.1):
    """
    Holt's double exponential smoothing.
    Returns (level, trend, fitted_values).
    alpha = smoothing for level, beta = smoothing for trend.
    """
    n = len(series)
    if n == 0:
        return 0.0, 0.0, np.array([])
    if n == 1:
        return float(series[0]), 0.0, series.copy()

    # Initialise
    level = series[0]
    trend = series[1] - series[0]
    fitted = np.zeros(n)
    fitted[0] = level

    for t in range(1, n):
        prev_level = level
        level = alpha * series[t] + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
        fitted[t] = level + trend

    return level, trend, fitted


def _forecast(level: float, trend: float, steps: int) -> np.ndarray:
    """Project forward `steps` periods."""
    return np.array([max(0.0, level + (i + 1) * trend) for i in range(steps)])


def _build_daily_series(move_rows, days_back: int = 90):
    """
    Convert StockMove query results → numpy array of daily demand.
    Returns (date_labels, demand_array).
    """
    end   = datetime.utcnow().date()
    start = end - timedelta(days=days_back - 1)

    bucket = defaultdict(float)
    for m in move_rows:
        day = m.date.date() if hasattr(m.date, 'date') else m.date
        if start <= day <= end:
            bucket[day] += abs(m.quantity or 0)

    labels = [start + timedelta(days=i) for i in range(days_back)]
    series = np.array([bucket.get(d, 0.0) for d in labels])
    return labels, series


# ── auto-tune alpha/beta via minimising MAE on a walk-forward validation ──────

def _tune_params(series: np.ndarray, grid_size: int = 5):
    """Grid-search best (alpha, beta) pair by walk-forward MAE."""
    if len(series) < 10:
        return 0.3, 0.1  # not enough data, use defaults

    best_mae   = float('inf')
    best_alpha = 0.3
    best_beta  = 0.1
    grid = np.linspace(0.05, 0.6, grid_size)

    val_start = max(5, len(series) // 3)

    for alpha in grid:
        for beta in grid:
            errors = []
            for t in range(val_start, len(series)):
                lvl, trd, _ = _holt_smooth(series[:t], alpha, beta)
                pred = max(0.0, lvl + trd)
                errors.append(abs(pred - series[t]))
            mae = np.mean(errors)
            if mae < best_mae:
                best_mae   = mae
                best_alpha = alpha
                best_beta  = beta

    return best_alpha, best_beta


# ── public API ────────────────────────────────────────────────────────────────

def forecast_product(move_rows, horizon_days: int = 30, days_back: int = 90):
    """
    Forecast demand for one product.

    Args:
        move_rows   — SQLAlchemy StockMove rows for this product (move_type='out')
        horizon_days — how many future days to forecast
        days_back    — how many past days to train on

    Returns dict:
        {
          'history':    [{'date': 'Mar 1', 'actual': 5.0}, ...],
          'forecast':   [{'date': 'Apr 1', 'value': 7.2, 'lower': 4.1, 'upper': 10.3}, ...],
          'total_forecast': 218.5,     # sum of forecast period
          'daily_avg':   7.28,
          'trend':       'rising' | 'falling' | 'stable',
          'confidence':  0.82,         # 0-1 model fit score
          'params':      {'alpha': 0.3, 'beta': 0.1},
        }
    """
    labels, series = _build_daily_series(move_rows, days_back)

    if series.sum() == 0:
        # No history — return zero forecast
        future_dates = [datetime.utcnow().date() + timedelta(days=i+1) for i in range(horizon_days)]
        return {
            'history':         [{'date': str(d), 'actual': 0.0} for d in labels[-30:]],
            'forecast':        [{'date': str(d), 'value': 0.0, 'lower': 0.0, 'upper': 0.0} for d in future_dates],
            'total_forecast':  0.0,
            'daily_avg':       0.0,
            'trend':           'stable',
            'confidence':      0.0,
            'params':          {'alpha': 0.3, 'beta': 0.1},
        }

    alpha, beta = _tune_params(series)
    level, trend, fitted = _holt_smooth(series, alpha, beta)
    future_vals = _forecast(level, trend, horizon_days)

    # Residuals → std dev → confidence bands
    residuals = series - fitted
    std        = float(np.std(residuals)) if len(residuals) > 1 else 1.0
    z          = 1.645  # 90% interval

    # Confidence score: 1 - normalised MAE (capped 0-1)
    mae      = float(np.mean(np.abs(residuals)))
    mean_dem = float(np.mean(series)) if np.mean(series) > 0 else 1.0
    confidence = max(0.0, min(1.0, 1.0 - mae / mean_dem))

    # Trend classification
    if trend > 0.1 * mean_dem:
        trend_label = 'rising'
    elif trend < -0.1 * mean_dem:
        trend_label = 'falling'
    else:
        trend_label = 'stable'

    # Build output
    future_dates = [datetime.utcnow().date() + timedelta(days=i+1) for i in range(horizon_days)]
    forecast_out = [
        {
            'date':  str(fd),
            'value': round(float(fv), 2),
            'lower': round(max(0.0, float(fv) - z * std), 2),
            'upper': round(float(fv) + z * std, 2),
        }
        for fd, fv in zip(future_dates, future_vals)
    ]

    # Return last 30 days of history for the chart
    history_out = [
        {'date': str(d), 'actual': round(float(v), 2)}
        for d, v in zip(labels[-30:], series[-30:])
    ]

    return {
        'history':        history_out,
        'forecast':       forecast_out,
        'total_forecast': round(float(future_vals.sum()), 1),
        'daily_avg':      round(float(future_vals.mean()), 2),
        'trend':          trend_label,
        'confidence':     round(confidence, 2),
        'params':         {'alpha': round(alpha, 3), 'beta': round(beta, 3)},
    }


def forecast_all_products(db_session, StockMove, Product, horizon_days: int = 30):
    """
    Forecast all products in one call.
    Returns list of { product_id, sku, name, ...forecast_result }.
    """
    results = []
    for p in Product.query.all():
        out_moves = (
            db_session.query(StockMove)
            .filter(StockMove.product_id == p.id, StockMove.move_type == 'out')
            .all()
        )
        fc = forecast_product(out_moves, horizon_days=horizon_days)
        results.append({
            'product_id': p.id,
            'sku':        p.sku,
            'name':       p.name,
            'on_hand':    round(p.total_stock(), 1),
            'free':       round(p.free_to_use(), 1),
            'reorder':    p.reorder_point,
            **fc,
        })

    # Sort: most urgent first (on_hand < total_forecast)
    results.sort(key=lambda r: r['on_hand'] - r['total_forecast'])
    return results