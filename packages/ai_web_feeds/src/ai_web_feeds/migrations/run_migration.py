"""Compatibility wrapper for the historical Phase 5 migration entrypoint."""

from ai_web_feeds.config import runtime_database_url
from ai_web_feeds.storage import DatabaseManager


def run_migration_005():
    """Apply the canonical Alembic-managed schema instead of stale ad-hoc SQL."""
    database_url = runtime_database_url()
    print(
        "Phase 5 ad-hoc SQL migration is deprecated; delegating to "
        f"DatabaseManager.create_db_and_tables() for {database_url}"
    )
    DatabaseManager(database_url=database_url).create_db_and_tables()
    print("✅ Canonical storage bootstrap completed")


if __name__ == "__main__":
    run_migration_005()
