from flask import Blueprint, request, jsonify, Response, stream_with_context
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from ..extensions import db
from ..models import Product, Operation, OperationLine, StockMove, Location, Category
from ..ml.forecasting import forecast_product, forecast_all_products
from ..ml.anomaly import run_all_anomaly_checks
from ..ml.categorizer import suggest_category

ai_bp = Blueprint('ai', __name__)

_MODELS_MAP = {
    'Product':   Product,
    'Operation': Operation,
    'StockMove': StockMove,
    'Location':  Location,
}


def _rag_engine():
    return RAGEngine(db_session=db.session, models=_MODELS_MAP)


def _parse_chat_body(data):
    """Validate and clean chat request body. Returns (parsed, error)."""
    message = (data.get('message') or '').strip()
    if not message:
        return None, ('message is required', 400)
    if len(message) > 800:
        return None, ('Message too long (max 800 chars)', 400)
    history = [
        h for h in (data.get('history') or [])[-20:]
        if isinstance(h, dict)
        and h.get('role') in ('user', 'assistant')
        and isinstance(h.get('content'), str)
        and h['content'].strip()
    ]
    return {
        'message':   message,
        'history':   history,
        'model':     data.get('model') or None,
        'thread_id': data.get('thread_id') or None,
    }, None


# ── 1. Demand Forecasting ─────────────────────────────────────────────────────

@ai_bp.route('/forecast', methods=['GET'])
@jwt_required()
def forecast_all():
    """GET /api/ai/forecast?horizon=30"""
    horizon = max(7, min(90, int(request.args.get('horizon', 30))))
    results = forecast_all_products(db.session, StockMove, Product, horizon_days=horizon)
    return jsonify({'forecasts': results, 'horizon_days': horizon}), 200


@ai_bp.route('/forecast/<int:product_id>', methods=['GET'])
@jwt_required()
def forecast_one(product_id):
    """GET /api/ai/forecast/5?horizon=30"""
    p       = Product.query.get_or_404(product_id)
    horizon = max(7, min(90, int(request.args.get('horizon', 30))))
    out_moves = db.session.query(StockMove).filter(
        StockMove.product_id == product_id,
        StockMove.move_type  == 'out'
    ).all()
    fc = forecast_product(out_moves, horizon_days=horizon)
    return jsonify({
        'product_id': product_id, 'sku': p.sku, 'name': p.name,
        'on_hand': round(p.total_stock(), 1), 'free': round(p.free_to_use(), 1),
        'reorder': p.reorder_point, 'unit': p.unit_of_measure, **fc,
    }), 200


# ── 2. Anomaly Detection ──────────────────────────────────────────────────────

@ai_bp.route('/anomalies', methods=['GET'])
@jwt_required()
def anomalies():
    """GET /api/ai/anomalies?days=60"""
    days   = max(7, min(180, int(request.args.get('days', 60))))
    result = run_all_anomaly_checks(db.session, StockMove, Product, days_back=days)
    return jsonify(result), 200


# ── 3. Smart Reorder Agent ────────────────────────────────────────────────────

@ai_bp.route('/reorder/recommendations', methods=['GET'])
@jwt_required()
def reorder_recommendations():
    """GET /api/ai/reorder/recommendations"""
    lead_time = int(request.args.get('lead_time', 7))
    threshold = float(request.args.get('threshold', 0.4))
    products  = Product.query.all()

    forecasts_by_id, moves_by_id = {}, {}
    for p in products:
        out_moves = db.session.query(StockMove).filter(
            StockMove.product_id == p.id, StockMove.move_type == 'out'
        ).all()
        moves_by_id[p.id]     = out_moves
        forecasts_by_id[p.id] = forecast_product(out_moves, horizon_days=30)

    recs       = run_reorder_agent(products, forecasts_by_id, moves_by_id,
                                   lead_time_days=lead_time, urgency_threshold=threshold)
    total_cost = sum(r['cost_estimate'] for r in recs)
    return jsonify({
        'recommendations': recs, 'count': len(recs),
        'total_cost_estimate': round(total_cost, 2),
        'lead_time_days': lead_time,
    }), 200


@ai_bp.route('/reorder/auto-create', methods=['POST'])
@jwt_required()
def auto_create_reorders():
    """POST /api/ai/reorder/auto-create"""
    user_id = get_jwt_identity()
    data    = request.get_json() or {}
    warehouse_id   = data.get('warehouse_id')
    to_location_id = data.get('to_location_id')
    if not warehouse_id or not to_location_id:
        return jsonify({'error': 'warehouse_id and to_location_id required'}), 400

    products = Product.query.all()
    forecasts_by_id, moves_by_id = {}, {}
    for p in products:
        out_moves = db.session.query(StockMove).filter(
            StockMove.product_id == p.id, StockMove.move_type == 'out'
        ).all()
        moves_by_id[p.id]     = out_moves
        forecasts_by_id[p.id] = forecast_product(out_moves, horizon_days=30)

    recs    = run_reorder_agent(products, forecasts_by_id, moves_by_id)
    created = auto_create_draft_receipts(
        recs, db.session, Operation, OperationLine,
        warehouse_id=warehouse_id, to_location_id=to_location_id,
        responsible_id=int(user_id),
    )
    return jsonify({
        'created': created, 'count': len(created),
        'message': f"Created {len(created)} draft receipt(s).",
    }), 201


# ── 4. Smart Search ───────────────────────────────────────────────────────────

@ai_bp.route('/search', methods=['GET'])
@jwt_required()
def smart_search_endpoint():
    """GET /api/ai/search?q=low+stock+chair"""
    q     = request.args.get('q', '').strip()
    top_k = int(request.args.get('top_k', 15))
    if not q:
        return jsonify({'results': [], 'total_found': 0, 'intent': {}, 'query_time_ms': 0}), 200

    products   = Product.query.all()
    operations = Operation.query.order_by(Operation.created_at.desc()).limit(200).all()
    prod_idx   = build_product_index(products)
    op_idx     = build_operation_index(operations)
    result     = smart_search(q, prod_idx, op_idx, top_k=top_k)
    return jsonify(result), 200


# ── 5. Auto-Categoriser ───────────────────────────────────────────────────────

@ai_bp.route('/suggest-category', methods=['POST'])
@jwt_required()
def suggest_category_endpoint():
    """POST /api/ai/suggest-category  body: {name, sku}"""
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    sku  = data.get('sku', '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    products    = Product.query.all()
    suggestions = suggest_category(name, sku, products)
    return jsonify({'name': name, 'sku': sku, 'suggestions': suggestions}), 200


# ── 6. AI Assistant (LangGraph RAG + Groq) ───────────────────────────────────

@ai_bp.route('/assistant/models', methods=['GET'])
@jwt_required()
def list_models():
    """GET /api/ai/assistant/models"""
    return jsonify({
        'models':     AVAILABLE_MODELS,
        'configured': bool(GROQ_API_KEY),
    }), 200


@ai_bp.route('/assistant/chat', methods=['POST'])
@jwt_required()
def rag_chat():
    """POST /api/ai/assistant/chat — non-streaming RAG response."""
    data   = request.get_json() or {}
    parsed, err = _parse_chat_body(data)
    if err:
        return jsonify({'error': err[0]}), err[1]

    try:
        result = _rag_engine().chat(
            message   = parsed['message'],
            history   = parsed['history'],
            model     = parsed['model'],
            thread_id = parsed['thread_id'],
        )
    except ValueError as e:
        msg = '⚠️ GROQ_API_KEY is not configured. Add it to your .env file.'
        return jsonify({
            'answer': msg, 'text': msg,
            'sources': [], 'doc_count': 0, 'retrieved': 0,
            'latency_ms': 0, 'model': 'none', 'thread_id': None,
        }), 200
    except Exception as e:
        msg = f'Server error: {str(e)[:300]}'
        return jsonify({
            'answer': msg, 'text': msg,
            'sources': [], 'doc_count': 0, 'retrieved': 0,
            'latency_ms': 0, 'model': parsed.get('model', ''),
        }), 200

    return jsonify({
        'answer':          result['answer'],
        'text':            result['answer'],        # legacy compat
        'sources':         result['sources'],
        'doc_count':       result['doc_count'],
        'retrieved':       result['retrieved'],
        'latency_ms':      result['latency_ms'],
        'model':           result['model'],
        'thread_id':       result['thread_id'],
        'rewritten_query': result.get('rewritten_query'),
        'retry_count':     result.get('retry_count', 0),
        'intent':          'langgraph_rag',
        'confidence':      1.0,
        'suggestions':     [],
        'data':            {},
    }), 200


@ai_bp.route('/assistant/chat/stream', methods=['POST'])
@jwt_required()
def rag_chat_stream():
    """
    POST /api/ai/assistant/chat/stream — streaming SSE response.

    SSE events:
        data: {"type":"meta",  "sources":[...], "doc_count":N, "retrieved":N, "thread_id":"..."}
        data: {"type":"token", "content":"chunk"}
        data: {"type":"done",  "latency_ms":N, "thread_id":"...", "model":"..."}
        data: {"type":"error", "content":"message"}
    """
    import json

    data   = request.get_json() or {}
    parsed, err = _parse_chat_body(data)
    if err:
        return jsonify({'error': err[0]}), err[1]

    def generate():
        try:
            engine = _rag_engine()
            yield from engine.chat_stream(
                message   = parsed['message'],
                history   = parsed['history'],
                model     = parsed['model'],
                thread_id = parsed['thread_id'],
            )
        except ValueError:
            msg = '⚠️ GROQ_API_KEY is not configured. Add GROQ_API_KEY=gsk_... to your .env file.'
            yield f"data: {json.dumps({'type': 'token', 'content': msg})}\n\n"
            yield f"data: {json.dumps({'type': 'done',  'latency_ms': 0, 'thread_id': None, 'model': 'none'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)[:300]})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control':     'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection':        'keep-alive',
        },
    )


# ── 7. AI Dashboard Insights ──────────────────────────────────────────────────

@ai_bp.route('/insights', methods=['GET'])
@jwt_required()
def ai_insights():
    """GET /api/ai/insights — combined AI snapshot for the dashboard panel."""
    products = Product.query.all()

    forecast_risks = []
    for p in products:
        out_moves = db.session.query(StockMove).filter(
            StockMove.product_id == p.id, StockMove.move_type == 'out'
        ).all()
        fc   = forecast_product(out_moves, horizon_days=30)
        free = p.free_to_use()
        if fc['daily_avg'] > 0:
            days_left = days_of_stock(free, fc['daily_avg'])
            if days_left < 21:
                forecast_risks.append({
                    'product_id': p.id, 'name': p.name, 'sku': p.sku,
                    'days_left':  round(days_left, 1),
                    'free_stock': round(free, 1),
                    'daily_avg':  fc['daily_avg'],
                    'trend':      fc['trend'],
                    'unit':       p.unit_of_measure,
                })
    forecast_risks.sort(key=lambda x: x['days_left'])

    anomaly_result  = run_all_anomaly_checks(db.session, StockMove, Product, days_back=30)
    forecasts_by_id, moves_by_id = {}, {}
    for p in products:
        out_moves = db.session.query(StockMove).filter(
            StockMove.product_id == p.id, StockMove.move_type == 'out'
        ).all()
        moves_by_id[p.id]     = out_moves
        forecasts_by_id[p.id] = forecast_product(out_moves, horizon_days=30)
    recs = run_reorder_agent(products, forecasts_by_id, moves_by_id, urgency_threshold=0.5)

    return jsonify({
        'forecast_risks':    forecast_risks[:5],
        'anomaly_summary':   anomaly_result['summary'],
        'reorder_count':     len(recs),
        'critical_reorders': [r for r in recs if r['priority'] == 'critical'][:3],
        'generated_at':      datetime.utcnow().isoformat(),
    }), 200