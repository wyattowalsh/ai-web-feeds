"""Regression tests for storage bootstrap/runtime contract alignment."""

from datetime import UTC, datetime, timedelta

import ai_web_feeds.config as config_module
import pytest
from ai_web_feeds.analytics import calculate_summary_metrics, calculate_trending_topics
from ai_web_feeds.config import DEFAULT_DATABASE_URL, Settings
from ai_web_feeds.models import (
    CurationStatus,
    EmailDigest,
    FeedEntry,
    FeedItem,
    FeedSource,
    UserProfile,
)
from ai_web_feeds.recommendations import track_recommendation_interaction
from ai_web_feeds.search import build_trie_index
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.trending import TrendingDetector
from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

SchemaForeignKey = tuple[tuple[str, ...], str, tuple[str, ...]]
SchemaForeignKeyMap = dict[str, set[SchemaForeignKey]]

pytestmark = pytest.mark.unit

CORE_RUNTIME_TABLES = {
    "analytics",
    "analytics_snapshots",
    "email_digests",
    "feed_embeddings",
    "feed_entries",
    "notification_preferences",
    "recommendation_interactions",
    "saved_searches",
    "search_queries",
    "sources",
    "topic_stats",
    "topics",
    "trending_topics",
    "user_feed_follows",
    "user_profiles",
    "validations",
}

CORE_RUNTIME_FKS = {
    "analytics": {(("feed_source_id",), "sources", ("id",))},
    "feed_embeddings": {(("feed_id",), "sources", ("id",))},
    "feed_entries": {(("feed_id",), "sources", ("id",))},
    "notification_preferences": {(("feed_id",), "sources", ("id",))},
    "recommendation_interactions": {(("feed_id",), "sources", ("id",))},
    "user_feed_follows": {(("feed_id",), "sources", ("id",))},
    "validations": {(("feed_source_id",), "sources", ("id",))},
}


def _schema_contract(engine) -> tuple[set[str], SchemaForeignKeyMap]:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    foreign_keys = {
        table: {
            (
                tuple(foreign_key["constrained_columns"]),
                foreign_key["referred_table"],
                tuple(foreign_key["referred_columns"]),
            )
            for foreign_key in inspector.get_foreign_keys(table)
        }
        for table in CORE_RUNTIME_FKS
        if table in tables
    }
    return tables, foreign_keys


def test_empty_bootstrap_matches_metadata_runtime_contract(temp_db_path):
    """File-backed bootstrap should match the core contract from SQLModel metadata."""
    db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
    db.create_db_and_tables()

    migration_tables, migration_foreign_keys = _schema_contract(db.engine)
    assert migration_tables >= CORE_RUNTIME_TABLES

    memory_engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(memory_engine)
    metadata_tables, metadata_foreign_keys = _schema_contract(memory_engine)

    assert metadata_tables >= CORE_RUNTIME_TABLES
    assert migration_tables & CORE_RUNTIME_TABLES == metadata_tables & CORE_RUNTIME_TABLES
    assert migration_foreign_keys == metadata_foreign_keys == CORE_RUNTIME_FKS

    with db.get_session() as session:
        version = session.execute(text("SELECT version_num FROM alembic_version")).scalar_one()

    assert version == "006_visualization"


def test_legacy_bootstrap_upgrades_legacy_filename_and_preserves_rows(tmp_path, monkeypatch):
    """Default bootstrap should adopt a legacy SQLite filename and stamp the schema."""
    monkeypatch.setattr(config_module, "repository_root", lambda: tmp_path)

    legacy_path = tmp_path / "data" / "aiwebfeeds.db"
    legacy_path.parent.mkdir(parents=True, exist_ok=True)
    legacy_engine = create_engine(f"sqlite:///{legacy_path.as_posix()}")
    SQLModel.metadata.create_all(
        legacy_engine,
        tables=[
            SQLModel.metadata.tables["sources"],
            SQLModel.metadata.tables["analytics_snapshots"],
            SQLModel.metadata.tables["saved_searches"],
            SQLModel.metadata.tables["search_queries"],
            SQLModel.metadata.tables["user_profiles"],
            SQLModel.metadata.tables["feed_entries"],
            SQLModel.metadata.tables["trending_topics"],
        ],
    )

    with Session(legacy_engine) as session:
        session.add(
            FeedSource(
                id="legacy-feed",
                title="Legacy Feed",
                curation_status=CurationStatus.VERIFIED,
                topics=["ai"],
            )
        )
        session.commit()

    db = DatabaseManager(database_url=DEFAULT_DATABASE_URL)
    assert db.database_url == f"sqlite:///{legacy_path.as_posix()}"

    db.create_db_and_tables()
    tables, _ = _schema_contract(db.engine)
    assert tables >= CORE_RUNTIME_TABLES
    assert db.get_feed_source("legacy-feed") is not None

    with db.get_session() as session:
        version = session.execute(text("SELECT version_num FROM alembic_version")).scalar_one()

    assert version == "006_visualization"


def test_managed_session_commit_failure_rolls_back_and_can_continue(temp_db_path):
    """Commit failures should rollback cleanly so the session can keep working."""
    db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
    db.create_db_and_tables()
    db.add_feed_source(FeedSource(id="feed-1", title="Feed 1"))

    with db.get_session() as session:
        session.add(FeedSource(id="feed-1", title="Duplicate Feed"))
        with pytest.raises(Exception):
            session.commit()

        session.add(FeedSource(id="feed-2", title="Recovered Feed"))
        session.commit()

    assert db.get_feed_source("feed-2") is not None


def test_storage_normalizes_aware_datetimes_for_persistence_and_queries(temp_db_path):
    """Aware datetimes should be stored/queryable using the naive-UTC policy."""
    db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
    db.create_db_and_tables()
    db.add_feed_source(FeedSource(id="feed-1", title="Feed 1"))

    aware_timestamp = datetime(2025, 1, 1, 12, 0, tzinfo=UTC)
    saved_item = db.add_feed_item(
        FeedItem(
            feed_source_id="feed-1",
            guid="item-1",
            title="Timestamped Item",
            published=aware_timestamp,
            updated=aware_timestamp,
        )
    )

    assert saved_item.published == aware_timestamp.replace(tzinfo=None)
    assert saved_item.updated == aware_timestamp.replace(tzinfo=None)
    assert saved_item.published.tzinfo is None

    digest = db.create_email_digest(
        EmailDigest(
            user_id="digest-user",
            email="digest@example.com",
            schedule_type="daily",
            schedule_cron="0 9 * * *",
            next_send_at=aware_timestamp,
        )
    )
    due = db.get_due_digests(aware_timestamp + timedelta(hours=1))
    assert [row.id for row in due] == [digest.id]


def test_create_email_digest_upserts_one_active_digest_per_user(temp_db_path):
    """Creating a new active digest should update the existing active row for the user."""
    db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
    db.create_db_and_tables()

    original = db.create_email_digest(
        EmailDigest(
            user_id="digest-user",
            email="first@example.com",
            schedule_type="daily",
            schedule_cron="0 9 * * *",
            timezone="UTC",
            next_send_at=datetime(2025, 1, 1, 12, 0, tzinfo=UTC),
        )
    )

    updated = db.create_email_digest(
        EmailDigest(
            user_id="digest-user",
            email="second@example.com",
            schedule_type="weekly",
            schedule_cron="0 9 * * 1",
            timezone="America/New_York",
            next_send_at=datetime(2024, 1, 1, 0, 0, tzinfo=UTC),
        )
    )

    digests = db.get_user_digests("digest-user")

    assert updated.id == original.id
    assert len(digests) == 1
    assert digests[0].email == "second@example.com"
    assert digests[0].timezone == "America/New_York"
    assert digests[0].schedule_type == "weekly"
    assert digests[0].next_send_at > datetime.now(UTC).replace(tzinfo=None)


def test_create_email_digest_validates_cron_and_timezone(temp_db_path):
    """Digest subscriptions should reject invalid cron expressions and timezones."""
    db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
    db.create_db_and_tables()

    with pytest.raises(ValueError, match="Invalid timezone"):
        db.create_email_digest(
            EmailDigest(
                user_id="digest-user",
                email="user@example.com",
                schedule_type="daily",
                schedule_cron="0 9 * * *",
                timezone="Mars/Olympus",
                next_send_at=datetime.now(UTC),
            )
        )

    with pytest.raises(ValueError, match="Invalid schedule_cron"):
        db.create_email_digest(
            EmailDigest(
                user_id="digest-user",
                email="user@example.com",
                schedule_type="custom",
                schedule_cron="bad cron",
                timezone="UTC",
                next_send_at=datetime.now(UTC),
            )
        )


def test_search_and_analytics_tolerate_nullable_legacy_topics():
    """Legacy NULL topic payloads should not break search or analytics helpers."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        session.add(
            FeedSource(
                id="nullable-topics",
                title="Nullable Topics",
                curation_status=CurationStatus.VERIFIED,
                topics=["ai"],
            )
        )
        session.commit()
        session.execute(text("UPDATE sources SET topics = NULL WHERE id = 'nullable-topics'"))
        session.commit()

        trie = build_trie_index(session)
        summary = calculate_summary_metrics(session, date_range="30d")
        trending = calculate_trending_topics(session, date_range_days=30, limit=5)

    assert trie is not None
    assert summary["total_topics"] == 0
    assert trending == []


def test_recommendation_tracking_recovers_nullable_legacy_follow_lists():
    """Legacy NULL follow lists should be repaired before recommendation tracking mutates them."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        session.add(FeedSource(id="feed-1", title="Feed 1"))
        session.commit()
        session.execute(
            text(
                """
                INSERT INTO user_profiles (
                    user_id,
                    followed_feeds,
                    preferred_topics,
                    blocked_topics,
                    interaction_history,
                    created_at,
                    updated_at
                ) VALUES (:user_id, NULL, NULL, NULL, NULL, :timestamp, :timestamp)
                """
            ),
            {
                "user_id": "legacy-user",
                "timestamp": datetime.now(UTC).replace(tzinfo=None),
            },
        )
        session.commit()

        track_recommendation_interaction(
            session,
            user_id="legacy-user",
            feed_id="feed-1",
            interaction_type="view",
            recommendation_reason="legacy-repair",
        )

        profile = session.get(UserProfile, "legacy-user")
        assert profile is not None
        assert profile.followed_feeds == ["feed-1"]


@pytest.mark.asyncio
async def test_trending_detector_ignores_nullable_legacy_categories(temp_db_path):
    """Legacy NULL categories should not break trending topic aggregation."""
    db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
    db.create_db_and_tables()
    db.add_feed_source(FeedSource(id="feed-1", title="Feed 1"))

    now = datetime.now(UTC)
    entry = db.add_feed_entry(
        FeedEntry(
            feed_id="feed-1",
            guid="entry-1",
            link="https://example.com/entry-1",
            title="Entry 1",
            pub_date=now,
            discovered_at=now,
            categories=["ai"],
        )
    )

    with db.get_session() as session:
        session.execute(
            text("UPDATE feed_entries SET categories = NULL WHERE id = :entry_id"),
            {"entry_id": entry.id},
        )
        session.commit()

    detector = TrendingDetector(db, Settings())
    counts = await detector._get_topic_counts(now - timedelta(hours=1), now + timedelta(hours=1))
    baseline = await detector._get_baseline_stats(now - timedelta(days=1), now + timedelta(hours=1))

    assert counts == {}
    assert baseline == {}
