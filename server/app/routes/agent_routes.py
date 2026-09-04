# server/app/routes/agent_routes.py
"""
Inventory Agent API endpoints — MCP-based, persistent chat history.

Endpoints:
  POST /api/agent/chat          — send a message; get agent reply
  GET  /api/agent/history       — retrieve this user's full message history
  DELETE /api/agent/history     — clear this user's history (keeps session)
  GET  /api/agent/context       — live DB snapshot for the chat sidebar

All endpoints are JWT-protected. History is stored per-user in PostgreSQL.
"""

import uuid, json, time
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import (
    Product, Operation, OperationLine,
    StockMove, Location, Warehouse, Category,
)
from app.mcp.chat_models import ChatSession, ChatMessage, ChatAuditLog
from ..agent.agent_graph import get_graph, set_mcp_context
from langchain_core.messages import HumanMessage, AIMessage

agent_bp = Blueprint("agent", __name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_session(user_id: int) -> ChatSession:
    """Return the user's lifelong ChatSession, creating it on first use."""
    session = ChatSession.query.filter_by(user_id=user_id).first()
    if not session:
        session = ChatSession(
            user_id   = user_id,
            thread_id = str(uuid.uuid4()),
        )
        db.session.add(session)
        db.session.commit()
    return session


def _persist_turn(session: ChatSession, user_msg: str, assistant_msg: str):
    """Append one user+assistant turn to the persistent history."""
    db.session.add(ChatMessage(session_id=session.id, role="user",      content=user_msg))
    db.session.add(ChatMessage(session_id=session.id, role="assistant", content=assistant_msg))
    session.updated_at = __import__("datetime").datetime.utcnow()
    db.session.commit()


def _setup_mcp_context(user_id: int):
    """Inject Flask DB session + models into the MCP tool context."""
    set_mcp_context(
        db_session = db.session,
        models     = {
            "Product":       Product,
            "Operation":     Operation,
            "OperationLine": OperationLine,
            "StockMove":     StockMove,
            "Location":      Location,
            "Warehouse":     Warehouse,
            "Category":      Category,
        },
        user_id = user_id,
    )


def _history_to_lc(history: list[dict]) -> list:
    """Convert [{role, content}] → LangChain message objects."""
    msgs = []
    for h in history:
        role    = h.get("role", "user")
        content = (h.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            msgs.append(HumanMessage(content=content))
        elif role == "assistant":
            msgs.append(AIMessage(content=content))
    return msgs


# ── POST /api/agent/chat ──────────────────────────────────────────────────────

@agent_bp.route("/chat", methods=["POST"])
@jwt_required()
def agent_chat():
    """
    Request body:
      {
        "message":          "Show me all low-stock products",
        "pending_action":   {...}  | null,   // echo back when awaiting confirm
        "awaiting_confirm": false
      }

    Response:
      {
        "response":         "...",
        "response_type":    "answer" | "confirm" | "executed" | "cancelled" | "error",
        "pending_action":   {...} | null,
        "awaiting_confirm": false,
        "thread_id":        "uuid",
        "latency_ms":       123
      }
    """
    user_id = int(get_jwt_identity())
    data    = request.get_json(force=True) or {}

    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400
    if len(message) > 2000:
        return jsonify({"error": "Message too long (max 2000 chars)"}), 400

    frontend_pending = data.get("pending_action") or None
    awaiting_confirm = bool(data.get("awaiting_confirm", False))

    t0 = time.time()

    try:
        # 1. Set up MCP context for this request
        _setup_mcp_context(user_id)

        # 2. Load (or create) the user's persistent session
        chat_session = _get_or_create_session(user_id)

        # Attach audit log's session_id now that we have it
        # (the graph's _audit helper uses the db session; session_id set separately below)

        # 3. Build message history from DB (last 40 messages = 20 turns)
        history = chat_session.to_history(limit=40)

        # 4. Build LangGraph initial state
        init_messages = _history_to_lc(history)
        init_messages.append(HumanMessage(content=message))

        init_state = {
            "messages":        init_messages,
            "pending_action":  frontend_pending,
            "awaiting_confirm": awaiting_confirm,
            "thread_id":       chat_session.thread_id,
            "user_id":         user_id,
        }

        # 5. Run graph
        graph  = get_graph()
        config = {"configurable": {"thread_id": chat_session.thread_id}}
        final  = graph.invoke(init_state, config=config)

        # 6. Extract response text
        response_text = final.get("final_response") or ""
        if not response_text:
            for msg in reversed(final.get("messages", [])):
                if isinstance(msg, AIMessage) and msg.content:
                    response_text = msg.content
                    break

        # 7. Persist the turn (only if we have a real assistant reply)
        if response_text:
            _persist_turn(chat_session, message, response_text)

        # 8. Update audit logs with session_id
        try:
            ChatAuditLog.query.filter_by(
                user_id    = user_id,
                session_id = None,
            ).update({"session_id": chat_session.id})
            db.session.commit()
        except Exception:
            db.session.rollback()

        latency_ms = round((time.time() - t0) * 1000)

        return jsonify({
            "response":         response_text,
            "response_type":    final.get("response_type", "answer"),
            "pending_action":   final.get("pending_action"),
            "awaiting_confirm": final.get("awaiting_confirm", False),
            "thread_id":        chat_session.thread_id,
            "latency_ms":       latency_ms,
        }), 200

    except ValueError as e:
        error_msg = str(e)
        if "connection" in error_msg.lower() or "refused" in error_msg.lower():
            msg = "⚠️ Cannot connect to Ollama server. Ensure Ollama is running on the configured OLLAMA_BASE_URL."
        elif "model" in error_msg.lower():
            msg = "⚠️ Ollama model not found. Please pull the model first: ollama pull llama2"
        else:
            msg = f"⚠️ Agent error: {error_msg[:300]}"
        return jsonify({
            "response": msg, "response_type": "error",
            "pending_action": None, "awaiting_confirm": False,
            "thread_id": None, "latency_ms": 0,
        }), 200
    except Exception as e:
        return jsonify({
            "response":        f"⚠️ Agent error: {str(e)[:300]}",
            "response_type":   "error",
            "pending_action":  None,
            "awaiting_confirm": False,
            "thread_id":       None,
            "latency_ms":      0,
        }), 200


# ── GET /api/agent/history ────────────────────────────────────────────────────

@agent_bp.route("/history", methods=["GET"])
@jwt_required()
def get_history():
    """Return the authenticated user's full persistent chat history."""
    user_id = int(get_jwt_identity())
    chat_session = ChatSession.query.filter_by(user_id=user_id).first()
    if not chat_session:
        return jsonify({"messages": [], "thread_id": None}), 200

    limit  = min(int(request.args.get("limit", 100)), 500)
    offset = int(request.args.get("offset", 0))

    msgs = (
        ChatMessage.query
        .filter_by(session_id=chat_session.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit).offset(offset)
        .all()
    )
    total = ChatMessage.query.filter_by(session_id=chat_session.id).count()

    return jsonify({
        "messages":  [m.to_dict() for m in msgs],
        "thread_id": chat_session.thread_id,
        "total":     total,
        "limit":     limit,
        "offset":    offset,
    }), 200


# ── DELETE /api/agent/history ─────────────────────────────────────────────────

@agent_bp.route("/history", methods=["DELETE"])
@jwt_required()
def clear_history():
    """
    Clear the user's chat history.
    The session (thread_id) is preserved so the LangGraph checkpointer
    can still track conversation state if needed.
    """
    user_id = int(get_jwt_identity())
    chat_session = ChatSession.query.filter_by(user_id=user_id).first()
    if not chat_session:
        return jsonify({"deleted": 0}), 200

    deleted = ChatMessage.query.filter_by(session_id=chat_session.id).delete()
    db.session.commit()

    # Audit log the clear
    db.session.add(ChatAuditLog(
        user_id    = user_id,
        session_id = chat_session.id,
        event_type = "history_cleared",
        ip_address = request.remote_addr,
    ))
    db.session.commit()

    return jsonify({"deleted": deleted}), 200


# ── GET /api/agent/context ────────────────────────────────────────────────────

@agent_bp.route("/context", methods=["GET"])
@jwt_required()
def agent_context():
    """Live DB snapshot for the chat sidebar panel (product list, pending counts, locations)."""
    user_id = int(get_jwt_identity())
    _setup_mcp_context(user_id)

    from datetime import datetime
    today = datetime.utcnow().date()

    try:
        products = Product.query.all()
        prod_summary = []
        for p in products:
            on_hand = round(p.total_stock(), 1)
            status  = (
                "out"  if on_hand == 0
                else "low" if p.reorder_point > 0 and on_hand < p.reorder_point
                else "ok"
            )
            prod_summary.append({
                "id": p.id, "name": p.name, "sku": p.sku,
                "on_hand": on_hand, "unit": p.unit_of_measure, "status": status,
            })

        pending_ops = Operation.query.filter(
            Operation.status.in_(["draft", "waiting", "ready"])
        ).all()
        late = sum(1 for o in pending_ops if o.scheduled_date and o.scheduled_date.date() < today)

        locations = Location.query.all()
        loc_list  = [
            {"id": l.id, "name": l.name,
             "code": f"{l.warehouse.short_code}/{l.short_code}",
             "warehouse": l.warehouse.name}
            for l in locations
        ]

        return jsonify({
            "products":  prod_summary,
            "locations": loc_list,
            "pending": {
                "receipts":    sum(1 for o in pending_ops if o.operation_type == "receipt"),
                "deliveries":  sum(1 for o in pending_ops if o.operation_type == "delivery"),
                "transfers":   sum(1 for o in pending_ops if o.operation_type == "transfer"),
                "adjustments": sum(1 for o in pending_ops if o.operation_type == "adjustment"),
                "late":        late,
            },
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500