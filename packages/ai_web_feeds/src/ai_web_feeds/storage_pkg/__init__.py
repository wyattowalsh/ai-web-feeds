"""Storage implementation modules.

Import the public API from ``ai_web_feeds.storage``. This package is the
implementation behind that facade.
"""

from ai_web_feeds.storage_pkg.manager import DatabaseManager
from ai_web_feeds.storage_pkg.migrations import upgrade_database_to_head
from ai_web_feeds.storage_pkg.runtime import get_database_manager, get_session
from ai_web_feeds.storage_pkg.topics import replace_source_topics, upsert_topic

__all__ = [
    "DatabaseManager",
    "get_database_manager",
    "get_session",
    "replace_source_topics",
    "upgrade_database_to_head",
    "upsert_topic",
]
