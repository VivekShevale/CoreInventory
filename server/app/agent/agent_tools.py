"""
Backward-compatibility shim.
All real tool logic has moved to server/app/mcp/inventory_mcp_server.py.
This file is kept so any stale import doesn't crash the app.

UPDATED: Now works with Ollama - no API key required.
"""

from ..mcp.inventory_mcp_server import (
    MCP_TOOLS,
    call_tool,
    execute_confirmed_action,
)

# Re-export so agent_routes.py imports keep working
ALL_TOOLS = MCP_TOOLS   # list of MCP tool dicts (not LangChain tools)

# The runtime context is managed by agent_graph.set_mcp_context()
# kept here for any legacy callers
_CTX: dict = {}

def set_context(db_session, models: dict):
    """Legacy shim — delegates to agent_graph.set_mcp_context()."""
    from .agent_graph import set_mcp_context
    user_id = models.pop("user_id", 1)
    set_mcp_context(db_session, models, user_id)
    models["user_id"] = user_id   # restore
    _CTX.update({"db": db_session, "models": models, "user_id": user_id})