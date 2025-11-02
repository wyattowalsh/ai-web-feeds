"""Database migration runner for Phase 5"""

import sqlite3
from pathlib import Path

from ai_web_feeds.config import Settings


def run_migration_005():
    """Run Phase 5 migration: Add NLP tables"""
    settings = Settings()

    # Extract database path from URL
    db_path = settings.database_url.replace("sqlite:///", "")

    # Ensure parent directory exists
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    # Read migration SQL
    migration_sql = Path(__file__).parent / "005_add_nlp_tables.sql"

    print(f"Running migration 005 on database: {db_path}")

    with sqlite3.connect(db_path) as conn:
        # Check if feed_entries table exists
        cursor = conn.cursor()
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='feed_entries'
        """)

        if not cursor.fetchone():
            print("⚠️  Warning: feed_entries table doesn't exist")
            print("   Creating a minimal feed_entries table for testing...")

            # Create minimal feed_entries table
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS feed_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT,
                    summary TEXT,
                    author TEXT,
                    feed_id TEXT,
                    link TEXT,
                    published_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    topics TEXT  -- JSON array
                );
            """)
            print("✅ Created minimal feed_entries table")

        # Add NLP columns to feed_entries if they don't exist
        cursor.execute("PRAGMA table_info(feed_entries)")
        existing_columns = {row[1] for row in cursor.fetchall()}

        nlp_columns = [
            ("quality_processed", "BOOLEAN DEFAULT FALSE"),
            ("entities_processed", "BOOLEAN DEFAULT FALSE"),
            ("sentiment_processed", "BOOLEAN DEFAULT FALSE"),
            ("topics_processed", "BOOLEAN DEFAULT FALSE"),
            ("quality_processed_at", "DATETIME"),
            ("entities_processed_at", "DATETIME"),
            ("sentiment_processed_at", "DATETIME"),
            ("nlp_failures", "TEXT"),
            ("last_failure_reason", "TEXT"),
        ]

        for col_name, col_type in nlp_columns:
            if col_name not in existing_columns:
                cursor.execute(f"ALTER TABLE feed_entries ADD COLUMN {col_name} {col_type}")
                print(f"   Added column: {col_name}")

        conn.commit()

        # Run the main migration SQL (execute entire script, but catch errors gracefully)
        migration_statements = migration_sql.read_text()

        try:
            conn.executescript(migration_statements)
        except sqlite3.OperationalError as e:
            error_msg = str(e).lower()
            # Ignore "already exists" errors, fail on others
            if "already exists" not in error_msg and "duplicate" not in error_msg:
                print(f"❌ Migration error: {e}")
                raise
            print("⚠️  Skipped already existing objects")
        print("✅ Migration 005 completed: NLP tables added")

        # Verify tables were created
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table'
            AND name IN (
                'article_quality_scores',
                'entities',
                'entity_mentions',
                'article_sentiment',
                'topic_sentiment_daily',
                'subtopics',
                'topic_evolution_events'
            )
            ORDER BY name
        """)

        tables = [row[0] for row in cursor.fetchall()]
        print(f"\n✅ Created {len(tables)} NLP tables:")
        for table in tables:
            print(f"   - {table}")


if __name__ == "__main__":
    run_migration_005()
