"""ai_web_feeds.storage -- Database and storage management."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect
from sqlmodel import SQLModel

from ai_web_feeds.config import DEFAULT_DATABASE_URL
from ai_web_feeds.storage_pkg.manager import DatabaseManager
from ai_web_feeds.storage_pkg.migrations import upgrade_database_to_head
from ai_web_feeds.storage_pkg.runtime import get_database_manager, get_session
from ai_web_feeds.storage_pkg.topics import (
    _sync_legacy_topic_name,
    _topics_table_columns,
    replace_source_topics,
    upsert_topic,
)

# Implementation resolves these names on this module at call time so existing
# patches of Path, Config, create_engine, inspect, command, and SQLModel apply.
_db_manager: DatabaseManager | None = None

__all__ = [
    "DEFAULT_DATABASE_URL",
    "Config",
    "DatabaseManager",
    "Path",
    "SQLModel",
    "ScriptDirectory",
    "_sync_legacy_topic_name",
    "_topics_table_columns",
    "command",
    "create_engine",
    "get_database_manager",
    "get_session",
    "inspect",
    "replace_source_topics",
    "upgrade_database_to_head",
    "upsert_topic",
]
