# server/app/agent/agent_graph.py
"""
CoreInventory Agent — MCP-based, RAG-free, Ollama-powered.
==========================================
Architecture:
  1. All data access goes through the MCP tool registry (inventory_mcp_server.py).
  2. RAG / FAISS / HuggingFace embeddings are completely removed.
  3. Per-user persistent conversation history is stored in PostgreSQL (ChatMessage).
  4. Every tool call and state change is audit-logged to ChatAuditLog.
  5. Write tools stage a pending_action; nothing hits the DB until the user
     explicitly confirms with yes / confirm / haan / etc.
  6. Uses Ollama with Llama 3.1 model instead of Groq.

LangGraph node flow:
  START
    ├─ awaiting_confirm? ─► handle_confirm ─► execute / cancel
    └─ (new turn)        ─► agent ──tools?──► tools ──pending?──► confirm_check ──► END
                                         └──(no tools)──► confirm_check ──► END
"""

from __future__ import annotations
import os, json, uuid, time
from typing import TypedDict, Optional, Annotated

from langchain_core.messages import (
    HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage
)
from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, END, START
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver

from langchain_core.tools import tool as lc_tool

from ..mcp.inventory_mcp_server import (
    MCP_TOOLS, call_tool, execute_confirmed_action,
)

# ── Ollama Configuration ──────────────────────────────────────────────────────
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.environ.get("OLLAMA_MODEL", "llama2")

# Note: Ensure you have pulled the model first:
# ollama pull llama2:latest
# or for Llama 3.1:
# ollama pull llama2:latest (replace with actual Llama 3.1 model name when available)

SYSTEM_PROMPT = """You are the CoreInventory AI Agent — an intelligent inventory management assistant \
with real-time access to a live PostgreSQL warehouse database via MCP tools.

## What you can do
**Read (no confirmation needed):**
- get_all_products — all products with stock levels and status (OUT_OF_STOCK, BELOW_REORDER, LOW, HEALTHY)
- get_low_stock_products — only low/critical stock items for quick summaries
- get_product_by_name_or_sku — detailed product info
- get_all_locations — all warehouse locations with IDs
- get_pending_operations — draft/waiting/ready operations
- get_inventory_value — total and per-category value in ₹
- get_move_history — recent stock movements
- get_operation_by_reference — full detail of one operation

**Write (always stage first, user must confirm):**
- stage_receipt — vendor → warehouse
- stage_delivery — warehouse → customer
- stage_transfer — location → location (internal)
- stage_adjustment — damage write-off or count correction

## Creation workflow
1. Call get_all_locations to get location IDs
2. Call get_all_products to get product IDs
3. Call the appropriate stage_* tool
4. Tell the user the details and say: "Type **yes** to confirm or **no** to cancel."
5. NEVER skip the confirmation step.

## Rules
- Use ₹ for all Indian Rupee amounts
- Include SKUs in brackets: "Office Desk [DESK001]"
- Use ⚠️ to flag low stock or late operations
- Always fetch real data — never guess stock numbers or IDs
- If user says yes/confirm/ok/haan/proceed → it's a confirmation
- If user says no/cancel/nahi/stop → it's a cancellation
- For stock summaries, use get_all_products (returns everything) or get_low_stock_products (quick summary)
- Never try to filter get_all_products — it takes no parameters
"""

# ── Runtime context (injected per-request) ────────────────────────────────────
_CTX: dict = {}

def set_mcp_context(db_session, models: dict, user_id: int):
    _CTX["db"]      = db_session
    _CTX["models"]  = models
    _CTX["user_id"] = user_id


# ── Build LangChain tools from MCP registry ───────────────────────────────────

def _make_lc_tool(mcp_def: dict):
    """Wrap an MCP tool definition into a LangChain @tool callable."""
    tool_name = mcp_def["name"]
    tool_desc = mcp_def["description"]

    # We need a unique function name per tool for LangChain
    def _fn(**kwargs):
        return call_tool(
            name      = tool_name,
            arguments = kwargs,
            db        = _CTX["db"],
            models    = _CTX["models"],
            user_id   = _CTX["user_id"],
        )["content"] ["text"]

    _fn.__name__ = tool_name
    _fn.__doc__  = tool_desc
    return lc_tool(_fn)


ALL_LC_TOOLS = [_make_lc_tool(t) for t in MCP_TOOLS]
_TOOL_MAP    = {t.name: t for t in ALL_LC_TOOLS}


# ── State ─────────────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages:         Annotated[list[BaseMessage], add_messages]
    pending_action:   Optional[dict]
    awaiting_confirm: bool
    thread_id:        str
    user_id:          int


# ── Nodes ─────────────────────────────────────────────────────────────────────

def node_agent(state: AgentState) -> dict:
    """Main LLM node — calls the model with MCP tools bound."""
    # Use the last 30 messages (15 turns) to bound context
    recent = state["messages"] [-30:]

    messages = [SystemMessage(content=SYSTEM_PROMPT)] + recent

    llm = ChatOllama(
        base_url=OLLAMA_BASE_URL,
        model=OLLAMA_MODEL,
        temperature=0.1,
        num_predict=1024,  # equivalent to max_tokens in other models
    )
    llm_with_tools = llm.bind_tools(ALL_LC_TOOLS)

    try:
        response = llm_with_tools.invoke(messages)
    except Exception as e:
        if "too large" in str(e).lower():
            # Trim to last 2 messages on overflow
            response = llm_with_tools.invoke(
                [SystemMessage(content=SYSTEM_PROMPT), state["messages"] [-1]]
            )
        else:
            raise

    return {"messages": [response]}


def node_handle_tool_calls(state: AgentState) -> dict:
    """Execute all tool calls returned by the LLM; detect staged write ops."""
    last_msg = state["messages"] [-1]
    if not getattr(last_msg, "tool_calls", None):
        return {}

    tool_results  = []
    pending_found = None

    for tc in last_msg.tool_calls:
        tool_name = tc["name"]
        tool_args = tc["args"]
        t0 = time.time()

        tool_fn = _TOOL_MAP.get(tool_name)
        if not tool_fn:
            raw = json.dumps({"error": f"Tool '{tool_name}' not found"})
        else:
            try:
                raw = tool_fn.invoke(tool_args)
            except Exception as e:
                raw = json.dumps({"error": str(e)})

        latency = round((time.time() - t0) * 1000)

        # Audit log
        _audit(
            event_type  = "tool_call",
            tool_name   = tool_name,
            tool_args   = json.dumps(tool_args)[:500],
            tool_result = raw[:2000],
            latency_ms  = latency,
        )

        # Detect pending write
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and parsed.get("needs_confirmation"):
                pending_found = parsed["pending_action"]
                _audit(event_type="stage", tool_name=tool_name,
                       reference=pending_found.get("reference"))
        except Exception:
            pass

        tool_results.append(ToolMessage(content=raw, tool_call_id=tc["id"]))

    update = {"messages": tool_results}
    if pending_found:
        update["pending_action"]   = pending_found
        update["awaiting_confirm"] = True
    return update


def node_confirm_check(state: AgentState) -> dict:
    """
    If a pending write was staged, build a confirmation message and surface it.
    Otherwise extract the last AI text as the final answer.
    """
    pending = state.get("pending_action")
    if not pending:
        for msg in reversed(state["messages"]):
            if isinstance(msg, AIMessage) and msg.content:
                return {"final_response": msg.content, "response_type": "answer"}
        return {"final_response": "", "response_type": "answer"}

    op_type = pending.get("operation_type", "operation").capitalize()
    ref     = pending.get("reference", "")
    summary = pending.get("summary_lines", "")

    from_to = ""
    if pending.get("from_location_name"):
        from_to += f"**From:** {pending['from_location_name']}\n"
    if pending.get("to_location_name"):
        from_to += f"**To:** {pending['to_location_name']}\n"
    if pending.get("contact"):
        from_to += f"**Contact:** {pending['contact']}\n"

    confirm_text = (
        f"📋 **Please confirm this {op_type}**\n\n"
        f"**Reference:** {ref}\n"
        f"{from_to}"
        f"**Products:**\n{summary}\n"
        + (f"**Scheduled:** {pending['scheduled_date']}\n" if pending.get("scheduled_date") else "")
        + (f"**Notes:** {pending['notes']}\n" if pending.get("notes") else "")
        + "\nType **yes** to save to database or **no** to cancel."
    )
    return {
        "final_response":  confirm_text,
        "response_type":   "confirm",
        "awaiting_confirm": True,
    }


YES_WORDS    = {"yes","y","confirm","ok","okay","proceed","sure","do it",
                "haan","ha","done","go ahead","accept","yep","yup"}
NO_WORDS     = {"no","n","cancel","stop","abort","nahi","na","nope",
                "don't","dont","back","quit"}
MODIFY_WORDS = {"change","different","wrong","adjust","edit","modify",
                "update","fix","another","other","instead","wait","hold on"}


def node_handle_confirm(state: AgentState) -> dict:
    """Interpret the user's reply to a confirmation prompt."""
    user_text = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            user_text = msg.content.strip().lower()
            break

    is_yes    = any(w in user_text for w in YES_WORDS)
    is_no     = any(w in user_text for w in NO_WORDS)
    is_modify = any(w in user_text for w in MODIFY_WORDS)

    if is_yes and not is_no and not is_modify:
        _audit(event_type="confirmed",
               reference=state.get("pending_action", {}).get("reference"))
        return {"messages": [HumanMessage(content="__EXECUTE__")]}

    if is_no and not is_modify:
        _audit(event_type="cancelled",
               reference=state.get("pending_action", {}).get("reference"))
        return {"messages": [HumanMessage(content="__CANCEL__")]}

    if is_modify:
        pending  = state.get("pending_action", {})
        op_type  = pending.get("operation_type", "operation")
        restart  = (
            f"I need to modify this {op_type}. The user said: '{user_text}'\n"
            f"Please ask what needs to be changed and help create a new {op_type}."
        )
        return {
            "messages":        [HumanMessage(content=restart)],
            "pending_action":  None,
            "awaiting_confirm": False,
        }

    clarify = (
        "I need a clear answer:\n"
        "• Type **yes** to save\n"
        "• Type **no** to cancel\n"
        "• Or tell me what to change"
    )
    return {"final_response": clarify, "response_type": "confirm"}


def node_execute(state: AgentState) -> dict:
    """Write the confirmed pending_action to the DB."""
    pending = state.get("pending_action")
    if not pending:
        err = "⚠️ Nothing to execute — no pending action found."
        return {
            "messages": [AIMessage(content=err)],
            "final_response": err, "response_type": "error",
        }

    result = execute_confirmed_action(
        db_session = _CTX["db"],
        models     = _CTX["models"],
        pending    = pending,
        user_id    = _CTX["user_id"],
    )

    if result.get("success"):
        op_type  = pending.get("operation_type", "operation").capitalize()
        response = (
            f"✅ **{op_type} created successfully!**\n\n"
            f"**Reference:** {result['reference']}\n"
            f"**Status:** Draft\n\n"
            f"You can find it in the {op_type}s section to validate when ready."
        )
        _audit(event_type="executed", reference=result["reference"])
        return {
            "messages":        [AIMessage(content=response)],
            "final_response":  response,
            "response_type":   "executed",
            "pending_action":  None,
            "awaiting_confirm": False,
        }
    else:
        err = f"⚠️ Failed to save: {result.get('error', 'Unknown error')}"
        _audit(event_type="error", tool_result=result.get("error", ""))
        return {
            "messages":        [AIMessage(content=err)],
            "final_response":  err,
            "response_type":   "error",
            "pending_action":  None,
            "awaiting_confirm": False,
        }


def node_cancel(state: AgentState) -> dict:
    msg = "❌ Operation cancelled. Nothing was saved to the database."
    return {
        "messages":        [AIMessage(content=msg)],
        "final_response":  msg,
        "response_type":   "cancelled",
        "pending_action":  None,
        "awaiting_confirm": False,
    }


# ── Routing ───────────────────────────────────────────────────────────────────

def route_entry(state: AgentState) -> str:
    if state.get("awaiting_confirm") and state.get("pending_action"):
        return "handle_confirm"
    return "agent"

def route_after_agent(state: AgentState) -> str:
    last = state["messages"] [-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return "confirm_check"

def route_after_tools(state: AgentState) -> str:
    if state.get("awaiting_confirm") and state.get("pending_action"):
        return "confirm_check"
    return "agent"

def route_after_confirm_handler(state: AgentState) -> str:
    msgs = state["messages"]
    last_human = next((m for m in reversed(msgs) if isinstance(m, HumanMessage)), None)
    if last_human and last_human.content == "__EXECUTE__":
        return "execute"
    if last_human and last_human.content == "__CANCEL__":
        return "cancel"
    return END


# ── Graph assembly ────────────────────────────────────────────────────────────

def build_agent_graph():
    memory = MemorySaver()
    g = StateGraph(AgentState)

    g.add_node("agent",          node_agent)
    g.add_node("tools",          node_handle_tool_calls)
    g.add_node("confirm_check",  node_confirm_check)
    g.add_node("handle_confirm", node_handle_confirm)
    g.add_node("execute",        node_execute)
    g.add_node("cancel",         node_cancel)

    g.add_conditional_edges(START, route_entry, {
        "agent":          "agent",
        "handle_confirm": "handle_confirm",
    })
    g.add_conditional_edges("agent", route_after_agent, {
        "tools":         "tools",
        "confirm_check": "confirm_check",
    })
    g.add_conditional_edges("tools", route_after_tools, {
        "confirm_check": "confirm_check",
        "agent":         "agent",
    })
    g.add_edge("confirm_check", END)
    g.add_conditional_edges("handle_confirm", route_after_confirm_handler, {
        "execute": "execute",
        "cancel":  "cancel",
        END:       END,
    })
    g.add_edge("execute", END)
    g.add_edge("cancel",  END)

    return g.compile(checkpointer=memory), memory


_COMPILED_GRAPH = None
_GRAPH_MEMORY   = None

def get_graph():
    global _COMPILED_GRAPH, _GRAPH_MEMORY
    if _COMPILED_GRAPH is None:
        _COMPILED_GRAPH, _GRAPH_MEMORY = build_agent_graph()
    return _COMPILED_GRAPH


# ── Audit helper ──────────────────────────────────────────────────────────────

def _audit(**kwargs):
    """Write an audit log entry using the active Flask app context + DB session."""
    try:
        from ..chat_models import ChatAuditLog
        from flask import request as flask_request
        log = ChatAuditLog(
            user_id    = _CTX.get("user_id"),
            event_type = kwargs.get("event_type", "unknown"),
            tool_name  = kwargs.get("tool_name"),
            tool_args  = kwargs.get("tool_args"),
            tool_result= kwargs.get("tool_result"),
            reference  = kwargs.get("reference"),
            latency_ms = kwargs.get("latency_ms"),
            ip_address = flask_request.remote_addr if flask_request else None,
        )
        _CTX["db"].add(log)
        _CTX["db"].flush()   # don't commit yet — tied to request transaction
    except Exception:
        pass  # never break the request because of audit failure