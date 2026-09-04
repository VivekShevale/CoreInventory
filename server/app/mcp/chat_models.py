# server/app/chat_models.py
"""
Persistent chat history + audit log models.
Add to your existing models.py or import in __init__.py via db.create_all().
"""

from ..extensions import db
from datetime import datetime


class ChatSession(db.Model):
    """One per user — holds the lifelong thread_id used by the agent graph."""
    __tablename__ = "chat_sessions"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    thread_id  = db.Column(db.String(64), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user     = db.relationship("User", backref=db.backref("chat_session", uselist=False))
    messages = db.relationship(
        "ChatMessage", backref="session", lazy="dynamic",
        order_by="ChatMessage.created_at", cascade="all, delete-orphan",
    )

    def to_history(self, limit: int = 40) -> list[dict]:
        """Return the last `limit` messages as [{role, content}] for the agent."""
        msgs = self.messages.order_by(ChatMessage.created_at.desc()).limit(limit).all()
        return [{"role": m.role, "content": m.content} for m in reversed(msgs)]


class ChatMessage(db.Model):
    """Single turn — user or assistant message."""
    __tablename__ = "chat_messages"

    id          = db.Column(db.Integer, primary_key=True)
    session_id  = db.Column(db.Integer, db.ForeignKey("chat_sessions.id"), nullable=False)
    role        = db.Column(db.String(16), nullable=False)   # 'user' | 'assistant'
    content     = db.Column(db.Text, nullable=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":         self.id,
            "role":       self.role,
            "content":    self.content,
            "created_at": self.created_at.isoformat(),
        }


class ChatAuditLog(db.Model):
    """
    Immutable audit trail for every agent action.
    Covers reads, write-stagings, confirmations, executions, and cancellations.
    """
    __tablename__ = "chat_audit_logs"

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    session_id   = db.Column(db.Integer, db.ForeignKey("chat_sessions.id"))
    event_type   = db.Column(db.String(32), nullable=False)
    # event_type values:
    #   tool_call      — MCP tool invoked (read)
    #   stage          — write operation staged, awaiting confirmation
    #   confirmed      — user said yes; DB write will proceed
    #   executed       — DB write succeeded
    #   cancelled      — user said no
    #   error          — tool or execution error

    tool_name    = db.Column(db.String(64))
    tool_args    = db.Column(db.Text)          # JSON — sanitised (no passwords)
    tool_result  = db.Column(db.Text)          # JSON snippet (first 2 KB)
    reference    = db.Column(db.String(40))    # operation reference if applicable
    ip_address   = db.Column(db.String(45))
    latency_ms   = db.Column(db.Integer)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    user    = db.relationship("User", backref="audit_logs")
    session = db.relationship("ChatSession", backref="audit_logs")

    def to_dict(self):
        return {
            "id":          self.id,
            "user_id":     self.user_id,
            "event_type":  self.event_type,
            "tool_name":   self.tool_name,
            "reference":   self.reference,
            "ip_address":  self.ip_address,
            "latency_ms":  self.latency_ms,
            "created_at":  self.created_at.isoformat(),
        }