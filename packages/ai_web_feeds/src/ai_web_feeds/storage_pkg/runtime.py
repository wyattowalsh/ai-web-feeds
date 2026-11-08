"""Process-wide database manager access.

The singleton is stored on ``ai_web_feeds.storage`` so patches of ``_db_manager``
and ``DatabaseManager`` still observe the public module.
"""

from sqlmodel import Session

from ai_web_feeds.storage_pkg.manager import DatabaseManager


def get_database_manager() -> DatabaseManager:
    """Return a process-wide database manager singleton."""
    from ai_web_feeds import storage

    if storage._db_manager is None:
        storage._db_manager = storage.DatabaseManager()
    return storage._db_manager


def get_session() -> Session:
    """Return a database session from the shared manager."""
    return get_database_manager().get_session()
