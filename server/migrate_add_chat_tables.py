"""
Migration: Add MCP chat history + audit log tables
===================================================
Run once after deploying the MCP refactor:

    cd server
    python migrate_add_chat_tables.py

Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS semantics via
SQLAlchemy's db.create_all() (which is a no-op for tables that already exist).
"""

import os
import sys

# Add server root to path so imports resolve
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db

# Import the new models so SQLAlchemy knows about them
from app.chat_models import ChatSession, ChatMessage, ChatAuditLog  # noqa: F401

def run():
    app = create_app()
    with app.app_context():
        print("Creating new tables if they don't exist…")
        db.create_all()
        print("✅  Tables ready:")
        print("    • chat_sessions  — one lifetime session per user")
        print("    • chat_messages  — all conversation turns, stored in PostgreSQL")
        print("    • chat_audit_logs — immutable audit trail for every agent action")
        print()
        print("Migration complete.")

if __name__ == "__main__":
    run()