"""Characterization tests for current ai_web_feeds.storage branches.

Filesystem, database, and network edges are either tmp_path SQLite or mocks.
No public port is opened and no project data file is used.
"""

import hashlib
import json
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import ANY, MagicMock, patch

import pytest
from ai_web_feeds.models import (
    AnalyticsSnapshot,
    ArticleEntry,
    CurationStatus,
    EmailDigest,
    FeedAnalytics,
    FeedEnrichmentData,
    FeedSource,
    FeedValidationResult,
    Notification,
    NotificationType,
    ScheduleType,
    SourceTopic,
    SourceType,
    TopicNode,
    TopicStats,
    UserProfile,
)
from ai_web_feeds.storage import (
    DatabaseManager,
    _sync_legacy_topic_name,
    _topics_table_columns,
    get_database_manager,
    get_session,
    replace_source_topics,
    upgrade_database_to_head,
    upsert_topic,
)
from sqlalchemy import create_engine, inspect, text
from sqlmodel import Session, select


def _sqlite_url(path: Path) -> str:
    return f"sqlite:///{path}"


def _topic_name(manager: DatabaseManager, topic_id: str) -> str | None:
    with manager.engine.connect() as connection:
        value = connection.execute(
            text("SELECT name FROM topics WHERE id = :id"),
            {"id": topic_id},
        ).scalar()
    if value is None:
        return None
    return str(value)


def _source(source_id: str, **overrides: Any) -> FeedSource:
    payload: dict[str, Any] = {
        "id": source_id,
        "title": source_id,
        "feed": f"https://example.com/{source_id}.xml",
    }
    payload.update(overrides)
    return FeedSource.model_validate(payload)


def _article(
    feed_id: str,
    guid: str,
    link: str,
    published_at: datetime,
    **overrides: Any,
) -> ArticleEntry:
    payload: dict[str, Any] = {
        "feed_id": feed_id,
        "guid": guid,
        "link": link,
        "title": guid,
        "pub_date": published_at,
    }
    payload.update(overrides)
    return ArticleEntry.model_validate(payload)


@contextmanager
def _upgrade_stubs(
    *,
    config_exists: bool = True,
    head: str | None = "rev_head",
    has_sources: bool = False,
    has_alembic: bool = False,
    current_revision: str | None = None,
    known_revisions: list[str] | None = None,
    upgrade_error: Exception | None = None,
) -> Iterator[SimpleNamespace]:
    """Stub Alembic and the engine so upgrade branches do not touch a real database."""
    script = MagicMock()
    script.get_current_head.return_value = head
    revisions = known_revisions
    if revisions is None:
        revisions = [head] if head is not None else []
    script.walk_revisions.return_value = [
        SimpleNamespace(revision=revision) for revision in revisions
    ]

    inspector = MagicMock()

    def _has_table(name: str) -> bool:
        if name == "sources":
            return has_sources
        if name == "alembic_version":
            return has_alembic
        return False

    inspector.has_table.side_effect = _has_table

    connection = MagicMock()
    connection.execute.return_value.scalar.return_value = current_revision
    engine = MagicMock()

    def _begin() -> MagicMock:
        ctx = MagicMock()
        ctx.__enter__.return_value = connection
        ctx.__exit__.return_value = False
        return ctx

    engine.begin.side_effect = _begin
    upgrade = MagicMock()
    if upgrade_error is not None:
        upgrade.side_effect = upgrade_error

    with (
        patch("ai_web_feeds.storage.Path.exists", return_value=config_exists),
        patch("ai_web_feeds.storage.Config") as config_cls,
        patch("ai_web_feeds.storage.ScriptDirectory.from_config", return_value=script),
        patch("ai_web_feeds.storage.create_engine", return_value=engine),
        patch("ai_web_feeds.storage.inspect", return_value=inspector),
        patch("ai_web_feeds.storage.command.stamp") as stamp,
        patch("ai_web_feeds.storage.command.upgrade", upgrade),
    ):
        yield SimpleNamespace(
            config=config_cls.return_value,
            config_cls=config_cls,
            stamp=stamp,
            upgrade=upgrade,
            connection=connection,
        )


@pytest.fixture
def branch_db(tmp_path: Path) -> Iterator[DatabaseManager]:
    """SQLite file under tmp_path, never the project database."""
    manager = DatabaseManager(database_url=_sqlite_url(tmp_path / "branches.db"))
    manager.create_db_and_tables()
    try:
        yield manager
    finally:
        manager.close()


@pytest.mark.unit
class TestUpgradeDatabaseBranches:
    """upgrade_database_to_head control flow with the engine and Alembic mocked."""

    def test_missing_config_creates_sqlite_parent_then_fails(self, tmp_path: Path) -> None:
        database_url = _sqlite_url(tmp_path / "nested" / "feeds.db")
        with (
            patch("ai_web_feeds.storage.Path.exists", return_value=False),
            pytest.raises(FileNotFoundError, match="Alembic config not found"),
        ):
            upgrade_database_to_head(database_url)

        assert (tmp_path / "nested").is_dir()

    def test_memory_and_non_sqlite_urls_skip_directory_creation(self) -> None:
        with (
            patch("ai_web_feeds.storage.Path.exists", return_value=False),
            patch("ai_web_feeds.storage.Path.mkdir") as mkdir,
            pytest.raises(FileNotFoundError, match="Alembic config not found"),
        ):
            upgrade_database_to_head("sqlite:///:memory:")
        mkdir.assert_not_called()

        with (
            patch("ai_web_feeds.storage.Path.exists", return_value=False),
            patch("ai_web_feeds.storage.Path.mkdir") as mkdir,
            pytest.raises(FileNotFoundError, match="Alembic config not found"),
        ):
            upgrade_database_to_head("postgresql+psycopg://localhost/unused")
        mkdir.assert_not_called()

    def test_stamps_existing_schema_without_alembic_version(self, tmp_path: Path) -> None:
        database_url = _sqlite_url(tmp_path / "existing.db")
        with _upgrade_stubs(has_sources=True, has_alembic=False, head="rev_head") as stubs:
            upgrade_database_to_head(database_url)

        stubs.stamp.assert_called_once_with(stubs.config, "rev_head")
        stubs.upgrade.assert_not_called()
        stubs.config.set_main_option.assert_called_once_with("sqlalchemy.url", database_url)
        assert str(stubs.config_cls.call_args.args[0]).endswith("alembic.ini")

    def test_rewrites_unknown_alembic_revision(self, tmp_path: Path) -> None:
        with _upgrade_stubs(
            has_sources=True,
            has_alembic=True,
            head="rev_head",
            current_revision="ghost",
            known_revisions=["rev_head"],
        ) as stubs:
            upgrade_database_to_head(_sqlite_url(tmp_path / "unknown.db"))

        stubs.upgrade.assert_not_called()
        stubs.stamp.assert_not_called()
        update_call = stubs.connection.execute.call_args_list[1]
        assert "UPDATE alembic_version" in str(update_call.args[0])
        assert update_call.args[1] == {"head": "rev_head"}

    def test_known_or_empty_revision_upgrades_to_head(self, tmp_path: Path) -> None:
        database_url = _sqlite_url(tmp_path / "known.db")
        with _upgrade_stubs(
            has_alembic=True,
            has_sources=True,
            current_revision="rev_head",
        ) as stubs:
            upgrade_database_to_head(database_url)
        stubs.upgrade.assert_called_once_with(stubs.config, "head")
        stubs.stamp.assert_not_called()

        with _upgrade_stubs(
            has_alembic=True,
            has_sources=False,
            current_revision=None,
        ) as stubs:
            upgrade_database_to_head(database_url)
        stubs.upgrade.assert_called_once_with(stubs.config, "head")
        stubs.stamp.assert_not_called()

    def test_upgrade_conflict_stamps_only_when_sources_and_head_exist(self, tmp_path: Path) -> None:
        database_url = _sqlite_url(tmp_path / "conflict.db")
        with _upgrade_stubs(
            has_sources=True,
            has_alembic=True,
            current_revision="rev_head",
            head="rev_head",
            upgrade_error=RuntimeError("Table already exists"),
        ) as stubs:
            upgrade_database_to_head(database_url)
        stubs.upgrade.assert_called_once_with(stubs.config, "head")
        stubs.stamp.assert_called_once_with(stubs.config, "rev_head")

        with (
            _upgrade_stubs(
                has_sources=False,
                has_alembic=True,
                current_revision="rev_head",
                head="rev_head",
                upgrade_error=RuntimeError("Table already exists"),
            ) as stubs,
            pytest.raises(RuntimeError, match="already exists"),
        ):
            upgrade_database_to_head(database_url)
        stubs.stamp.assert_not_called()

    def test_unrelated_upgrade_failure_is_reraised(self, tmp_path: Path) -> None:
        with (
            _upgrade_stubs(
                has_sources=True,
                has_alembic=True,
                current_revision="rev_head",
                head="rev_head",
                upgrade_error=RuntimeError("connection refused"),
            ) as stubs,
            pytest.raises(RuntimeError, match="connection refused"),
        ):
            upgrade_database_to_head(_sqlite_url(tmp_path / "down.db"))
        stubs.upgrade.assert_called_once()
        stubs.stamp.assert_not_called()

    def test_missing_head_falls_through_to_upgrade(self, tmp_path: Path) -> None:
        with _upgrade_stubs(has_sources=True, has_alembic=False, head=None) as stubs:
            upgrade_database_to_head(_sqlite_url(tmp_path / "no-head.db"))
        stubs.stamp.assert_not_called()
        stubs.upgrade.assert_called_once_with(stubs.config, "head")


@pytest.mark.unit
class TestTopicStorageBranches:
    """Topic column inspection, upsert, and source-topic replacement."""

    def test_topics_columns_empty_without_table_or_on_inspector_failure(
        self, tmp_path: Path, branch_db: DatabaseManager
    ) -> None:
        engine = create_engine(_sqlite_url(tmp_path / "empty.db"))
        with Session(engine) as session:
            assert _topics_table_columns(session) == set()
        engine.dispose()

        failed = MagicMock()
        failed.get_bind.side_effect = RuntimeError("bind down")
        assert _topics_table_columns(failed) == set()

        with branch_db.get_session() as session:
            columns = _topics_table_columns(session)
        assert {"id", "label", "facet"}.issubset(columns)
        assert "name" not in columns

    def test_upsert_inserts_then_updates_without_legacy_name(
        self, branch_db: DatabaseManager
    ) -> None:
        topic = TopicNode(id="plain", label="Plain", facet="domain", description="kept")
        with branch_db.get_session() as session:
            stored, created = upsert_topic(session, topic)
            assert created is True
            assert stored.id == "plain"
            session.commit()

            topic.label = "Plain 2"
            topic.facet = "task"
            stored, created = upsert_topic(session, topic)
            assert created is False
            assert stored.label == "Plain 2"
            assert stored.facet == "task"
            session.commit()

            reloaded = session.get(TopicNode, "plain")
            assert reloaded is not None
            assert reloaded.description == "kept"
            assert reloaded.facet == "task"

    def test_upsert_uses_legacy_name_column_and_syncs_it_on_update(
        self, branch_db: DatabaseManager
    ) -> None:
        with branch_db.engine.begin() as connection:
            connection.execute(text("ALTER TABLE topics ADD COLUMN name VARCHAR"))
        inspect(branch_db.engine).clear_cache()

        topic = TopicNode(
            id="legacy",
            label="Legacy",
            facet="domain",
            description="desc",
            aliases=["a"],
        )
        with branch_db.get_session() as session:
            stored, created = upsert_topic(session, topic)
            assert created is True
            assert stored.description == "desc"
            session.commit()
            assert _topic_name(branch_db, "legacy") == "Legacy"

            topic.label = "Renamed"
            topic.description = "next"
            stored, created = upsert_topic(session, topic)
            assert created is False
            assert stored.label == "Renamed"
            session.commit()
            assert _topic_name(branch_db, "legacy") == "Renamed"
            reloaded = session.get(TopicNode, "legacy")
            assert reloaded is not None
            assert reloaded.description == "next"

    def test_legacy_insert_falls_back_when_row_is_not_visible(self) -> None:
        session = MagicMock()
        session.get.side_effect = [None, None]
        topic = TopicNode(id="missing", label="Missing", facet="domain")
        with patch("ai_web_feeds.storage._topics_table_columns", return_value={"name"}):
            stored, created = upsert_topic(session, topic)

        assert created is True
        assert stored is topic
        session.add.assert_called_with(topic)
        session.flush.assert_called_once()
        assert session.execute.call_count == 2

    def test_inspector_failure_still_adds_topic(self) -> None:
        session = MagicMock()
        session.get.return_value = None
        topic = TopicNode(id="fallback", label="Fallback", facet="domain")
        with patch("ai_web_feeds.storage.inspect", side_effect=RuntimeError("down")):
            stored, created = upsert_topic(session, topic)

        assert created is True
        assert stored is topic
        session.add.assert_called_once_with(topic)
        session.execute.assert_not_called()

    def test_sync_legacy_name_is_noop_without_name_column(self, branch_db: DatabaseManager) -> None:
        topic = TopicNode(id="noop", label="Noop", facet="domain")
        with branch_db.get_session() as session:
            session.add(topic)
            session.commit()
            _sync_legacy_topic_name(session, topic)
            session.commit()

    def test_update_branch_refreshes_fields_when_name_column_absent(self) -> None:
        existing = TopicNode(id="t", label="old", facet="domain")
        existing.updated_at = datetime(2020, 1, 1, tzinfo=UTC)
        incoming = TopicNode(id="t", label="new", facet="task", description="d", aliases=["x"])
        session = MagicMock()
        session.get.return_value = existing
        with patch("ai_web_feeds.storage._topics_table_columns", return_value=set()):
            stored, created = upsert_topic(session, incoming)

        assert created is False
        assert stored is existing
        assert existing.label == "new"
        assert existing.facet == "task"
        assert existing.description == "d"
        assert existing.aliases == ["x"]
        assert existing.updated_at != datetime(2020, 1, 1, tzinfo=UTC)
        session.add.assert_called_with(existing)
        session.flush.assert_called_once()

    def test_replace_source_topics_empty_then_replaces_only_matching_origin(
        self, branch_db: DatabaseManager
    ) -> None:
        with branch_db.get_session() as session:
            session.add(_source("src"))
            session.add(TopicNode(id="ai", label="AI", facet="domain"))
            session.add(TopicNode(id="ml", label="ML", facet="domain"))
            session.commit()

            assert replace_source_topics(session, source_id="src", topic_ids=[]) == 0
            assert replace_source_topics(session, source_id="src", topic_ids=["ai", "ml"]) == 2
            session.add(
                SourceTopic(
                    source_id="src",
                    topic_id="ai",
                    origin="manual",
                    weight=0.5,
                    confidence=0.5,
                )
            )
            session.commit()

            assert (
                replace_source_topics(
                    session,
                    source_id="src",
                    topic_ids=["ml"],
                    origin="catalog",
                )
                == 1
            )
            session.commit()
            rows = list(session.exec(select(SourceTopic)).all())
            origins = sorted((row.origin, row.topic_id, row.weight) for row in rows)

        assert origins == [("catalog", "ml", 1.0), ("manual", "ai", 0.5)]


@pytest.mark.unit
class TestDatabaseManagerBranches:
    """Engine setup, empty summaries, and delegated search/recommendation calls."""

    def test_sqlite_create_makes_parent_and_postgres_skips_mkdir(self, tmp_path: Path) -> None:
        db_path = tmp_path / "deep" / "dir" / "app.db"
        manager = DatabaseManager(database_url=_sqlite_url(db_path))
        try:
            manager.create_db_and_tables()
            assert db_path.is_file()
            with manager as entered:
                assert entered is manager
                session = manager.get_session()
                assert session.connection().exec_driver_sql("SELECT 1").scalar() == 1
                session.close()
        finally:
            manager.close()

        engine = MagicMock()
        with (
            patch("ai_web_feeds.storage.create_engine", return_value=engine) as create_engine,
            patch("ai_web_feeds.storage.SQLModel.metadata.create_all") as create_all,
            patch("ai_web_feeds.storage.Path.mkdir") as mkdir,
        ):
            postgres = DatabaseManager(database_url="postgresql+psycopg://localhost/unused")
            postgres.create_db_and_tables()

        create_engine.assert_called_once_with(
            "postgresql+psycopg://localhost/unused",
            echo=False,
            connect_args={},
        )
        create_all.assert_called_once_with(engine)
        mkdir.assert_not_called()

    def test_destructor_swallows_close_errors(self, tmp_path: Path) -> None:
        manager = DatabaseManager(database_url=_sqlite_url(tmp_path / "del.db"))
        try:
            with patch.object(manager, "close", side_effect=RuntimeError("closed")):
                manager.__del__()
        finally:
            manager.engine.dispose()

    def test_singleton_builds_once_without_opening_project_database(self) -> None:
        import ai_web_feeds.storage as storage_module

        sentinel = MagicMock()
        sentinel.get_session.return_value = "session"
        with (
            patch.object(storage_module, "_db_manager", None),
            patch.object(storage_module, "DatabaseManager", return_value=sentinel) as manager_cls,
        ):
            first = get_database_manager()
            second = get_database_manager()
            session = get_session()

        assert first is sentinel
        assert second is sentinel
        assert session == "session"
        manager_cls.assert_called_once_with()
        sentinel.get_session.assert_called_once_with()

    def test_health_summary_empty_and_scored(self, branch_db: DatabaseManager) -> None:
        empty = branch_db.get_health_summary()
        assert empty["total_feeds"] == 0
        assert empty["feeds_with_health_data"] == 0
        assert empty["avg_health_score"] is None
        assert empty["avg_quality_score"] is None
        assert empty["feeds_healthy"] == 0
        assert empty["feeds_warning"] == 0
        assert empty["feeds_critical"] == 0

        scored = {
            "healthy": (0.7, 0.5),
            "warning": (0.4, None),
            "critical": (0.39, 1.0),
            "unscored": (None, None),
        }
        for source_id, (health, quality) in scored.items():
            branch_db.add_feed_source(_source(source_id))
            branch_db.add_enrichment_data(
                FeedEnrichmentData(
                    feed_source_id=source_id,
                    health_score=health,
                    quality_score=quality,
                )
            )

        summary = branch_db.get_health_summary()
        assert summary["total_feeds"] == 4
        assert summary["feeds_with_health_data"] == 3
        assert summary["avg_health_score"] == pytest.approx((0.7 + 0.4 + 0.39) / 3)
        assert summary["avg_quality_score"] == pytest.approx(0.75)
        assert summary["feeds_healthy"] == 1
        assert summary["feeds_warning"] == 1
        assert summary["feeds_critical"] == 1

    def test_feed_topics_missing_source_and_null_topics(self, branch_db: DatabaseManager) -> None:
        assert branch_db.get_feed_topics("missing") == []
        branch_db.add_feed_source(_source("src", topics=["ai", "ml"]))
        assert branch_db.get_feed_topics("src") == ["ai", "ml"]

        with branch_db.engine.begin() as connection:
            connection.execute(
                text("UPDATE sources SET topics = NULL WHERE id = :id"),
                {"id": "src"},
            )
        assert branch_db.get_feed_topics("src") == []

    def test_complete_data_for_unknown_feed_is_empty(self, branch_db: DatabaseManager) -> None:
        payload = branch_db.get_feed_complete_data("missing")
        assert payload["source"] is None
        assert payload["enrichment"] is None
        assert payload["validation"] is None
        assert payload["analytics"] == []
        assert payload["recent_articles"] == []

    def test_failed_validations_keep_only_latest_invalid(self, branch_db: DatabaseManager) -> None:
        assert branch_db.get_failed_validations() == []
        branch_db.add_feed_source(_source("recovered"))
        branch_db.add_feed_source(_source("broken"))
        branch_db.add_feed_source(_source("unchecked"))
        branch_db.add_validation_result(
            FeedValidationResult(
                feed_source_id="recovered",
                is_valid=False,
                validated_at=datetime(2024, 1, 1, tzinfo=UTC),
            )
        )
        branch_db.add_validation_result(
            FeedValidationResult(
                feed_source_id="recovered",
                is_valid=True,
                validated_at=datetime(2024, 2, 1, tzinfo=UTC),
            )
        )
        branch_db.add_validation_result(
            FeedValidationResult(
                feed_source_id="broken",
                is_valid=False,
                validated_at=datetime(2024, 3, 1, tzinfo=UTC),
            )
        )

        failed = branch_db.get_failed_validations()
        assert [row.feed_source_id for row in failed] == ["broken"]
        assert failed[0].is_valid is False
        history = branch_db.get_feed_validation_history("recovered", limit=1)
        assert len(history) == 1
        assert history[0].is_valid is True

    def test_validation_history_filters_feed_and_age(self, branch_db: DatabaseManager) -> None:
        branch_db.add_feed_source(_source("recent"))
        branch_db.add_feed_source(_source("other"))
        branch_db.add_validation_result(
            FeedValidationResult(
                feed_source_id="recent",
                is_valid=True,
                validated_at=datetime.now(UTC) - timedelta(days=1),
            )
        )
        branch_db.add_validation_result(
            FeedValidationResult(
                feed_source_id="recent",
                is_valid=False,
                validated_at=datetime.now(UTC) - timedelta(days=40),
            )
        )
        branch_db.add_validation_result(
            FeedValidationResult(
                feed_source_id="other",
                is_valid=True,
                validated_at=datetime.now(UTC) - timedelta(days=1),
            )
        )

        recent_only = branch_db.get_validation_history("recent", days=30)
        assert len(recent_only) == 1
        assert recent_only[0].feed_source_id == "recent"
        assert recent_only[0].is_valid is True
        assert len(branch_db.get_validation_history(days=30)) == 2
        assert branch_db.get_validation_history("missing", days=30) == []

    def test_analytics_period_filter_and_snapshot_update(self, branch_db: DatabaseManager) -> None:
        assert branch_db.get_latest_analytics_snapshot() is None
        branch_db.add_feed_source(_source("src"))
        branch_db.add_analytics(
            FeedAnalytics(
                feed_source_id="src",
                period_start=datetime(2024, 1, 1, tzinfo=UTC),
                period_end=datetime(2024, 1, 2, tzinfo=UTC),
                period_type="daily",
            )
        )
        branch_db.add_analytics(
            FeedAnalytics(
                feed_source_id="src",
                period_start=datetime(2024, 1, 1, tzinfo=UTC),
                period_end=datetime(2024, 1, 8, tzinfo=UTC),
                period_type="weekly",
            )
        )
        assert len(branch_db.get_analytics("src")) == 2
        assert len(branch_db.get_analytics("src", period_type="weekly")) == 1
        assert branch_db.get_analytics("missing") == []
        assert len(branch_db.get_all_analytics(period_type="daily")) == 1
        assert branch_db.get_all_analytics(period_type="yearly") == []

        created = branch_db.save_analytics_snapshot(
            AnalyticsSnapshot(
                snapshot_date="2024-03-01",
                total_feeds=1,
                active_feeds=1,
                validation_success_rate=0.5,
                avg_response_time=10.0,
                trending_topics=[],
                health_distribution={"healthy": 1},
            )
        )
        assert created.total_feeds == 1
        updated = branch_db.save_analytics_snapshot(
            AnalyticsSnapshot(
                snapshot_date="2024-03-01",
                total_feeds=4,
                active_feeds=2,
                validation_success_rate=0.25,
                avg_response_time=20.0,
                trending_topics=[{"id": "ai"}],
                health_distribution={"healthy": 0},
            )
        )
        assert updated.snapshot_date == "2024-03-01"
        assert updated.total_feeds == 4
        assert updated.trending_topics == [{"id": "ai"}]
        branch_db.save_analytics_snapshot(
            AnalyticsSnapshot(
                snapshot_date="2024-04-01",
                total_feeds=5,
                active_feeds=5,
                validation_success_rate=1.0,
                avg_response_time=1.0,
                trending_topics=[],
                health_distribution={},
            )
        )
        latest = branch_db.get_latest_analytics_snapshot()
        assert latest is not None
        assert latest.snapshot_date == "2024-04-01"

    def test_topic_stats_empty_and_limited_to_snapshot(self, branch_db: DatabaseManager) -> None:
        assert branch_db.get_topic_stats() == []
        with branch_db.get_session() as session:
            session.add(
                TopicStats(
                    topic="ai",
                    feed_count=3,
                    validation_frequency=0.2,
                    avg_health_score=0.5,
                    snapshot_date="2024-01-01",
                )
            )
            session.add(
                TopicStats(
                    topic="ml",
                    feed_count=1,
                    validation_frequency=0.9,
                    avg_health_score=0.8,
                    snapshot_date="2024-01-01",
                )
            )
            session.add(
                TopicStats(
                    topic="old",
                    feed_count=9,
                    validation_frequency=1.0,
                    avg_health_score=0.1,
                    snapshot_date="2023-01-01",
                )
            )
            session.commit()

        top = branch_db.get_topic_stats(snapshot_date="2024-01-01", limit=1)
        assert [row.topic for row in top] == ["ml"]
        assert branch_db.get_topic_stats(snapshot_date="1999-01-01") == []
        latest = branch_db.get_topic_stats()
        assert [row.topic for row in latest] == ["ml", "ai"]

    def test_empty_bulk_inserts_and_enrichment_keep(self, branch_db: DatabaseManager) -> None:
        branch_db.bulk_insert_feed_sources([])
        branch_db.bulk_insert_topics([])
        assert branch_db.get_all_feed_sources() == []
        assert branch_db.get_all_topics() == []
        branch_db.bulk_insert_feed_sources([_source("bulk")])
        branch_db.bulk_insert_topics([TopicNode(id="bulk", label="Bulk", facet="domain")])
        assert len(branch_db.get_all_feed_sources()) == 1
        assert len(branch_db.get_all_topics()) == 1

        assert branch_db.delete_old_enrichments("missing") == 0
        branch_db.add_enrichment_data(FeedEnrichmentData(feed_source_id="bulk"))
        assert branch_db.delete_old_enrichments("bulk", keep_count=5) == 0
        assert branch_db.get_enrichment_data("missing") is None
        assert branch_db.get_all_enrichment_data("missing") == []

    def test_notification_digest_and_follow_empty_paths(self, branch_db: DatabaseManager) -> None:
        assert branch_db.delete_notifications_before(datetime(2024, 1, 1, tzinfo=UTC)) == 0
        branch_db.mark_notification_read(999)
        branch_db.dismiss_notification(999)
        assert branch_db.get_user_notifications("nobody") == []
        assert branch_db.get_email_digest(999) is None
        assert branch_db.get_due_digests(datetime(2024, 5, 1, tzinfo=UTC)) == []
        assert branch_db.get_user_profile("nobody") is None
        assert branch_db.get_active_user_ids() == []
        branch_db.unfollow_source("nobody", "missing")
        assert branch_db.get_source_followers("missing") == []
        assert branch_db.get_user_followed_sources("nobody") == []
        assert branch_db.get_poll_jobs("missing") == []

        kept = branch_db.create_notification(
            Notification(
                user_id="user",
                type=NotificationType.SYSTEM_ALERT,
                title="kept",
                message="new",
                created_at=datetime(2024, 1, 1, tzinfo=UTC),
            )
        )
        removed = branch_db.create_notification(
            Notification(
                user_id="user",
                type=NotificationType.SYSTEM_ALERT,
                title="old",
                message="old",
                created_at=datetime(2020, 1, 1, tzinfo=UTC),
            )
        )
        unread = branch_db.create_notification(
            Notification(
                user_id="user",
                type=NotificationType.NEW_ARTICLE,
                title="unread",
                message="unread",
                created_at=datetime(2024, 6, 1, tzinfo=UTC),
            )
        )
        kept_id = kept.id
        assert isinstance(kept_id, int)
        branch_db.mark_notification_read(kept_id)
        branch_db.dismiss_notification(kept_id)
        assert branch_db.delete_notifications_before(datetime(2022, 1, 1, tzinfo=UTC)) == 1
        remaining = branch_db.get_user_notifications("user")
        assert removed.id not in [row.id for row in remaining]
        unread_only = branch_db.get_user_notifications("user", unread_only=True)
        assert [row.id for row in unread_only] == [unread.id]
        reread = branch_db.get_user_notifications("user")
        kept_row = next(row for row in reread if row.id == kept.id)
        assert kept_row.read_at is not None
        assert kept_row.dismissed_at is not None

        now = datetime(2024, 5, 1, tzinfo=UTC)
        due = branch_db.create_email_digest(
            EmailDigest(
                user_id="due",
                email="due@example.com",
                schedule_type=ScheduleType.DAILY,
                schedule_cron="0 9 * * *",
                next_send_at=datetime(2024, 4, 1, tzinfo=UTC),
            )
        )
        branch_db.create_email_digest(
            EmailDigest(
                user_id="future",
                email="future@example.com",
                schedule_type=ScheduleType.WEEKLY,
                schedule_cron="0 9 * * 1",
                next_send_at=datetime(2024, 6, 1, tzinfo=UTC),
            )
        )
        branch_db.create_email_digest(
            EmailDigest(
                user_id="unsub",
                email="unsub@example.com",
                schedule_type=ScheduleType.DAILY,
                schedule_cron="0 9 * * *",
                next_send_at=datetime(2024, 4, 1, tzinfo=UTC),
                unsubscribed_at=datetime(2024, 4, 2, tzinfo=UTC),
            )
        )
        due_rows = branch_db.get_due_digests(now)
        assert [row.id for row in due_rows] == [due.id]
        assert branch_db.get_user_digests("due")[0].email == "due@example.com"

        branch_db.add_feed_source(_source("s1"))
        branch_db.add_feed_source(_source("s2"))
        branch_db.follow_source("user-1", "s1")
        branch_db.follow_source("user-1", "s2")
        branch_db.follow_source("user-2", "s1")
        assert sorted(branch_db.get_active_user_ids()) == ["user-1", "user-2"]
        branch_db.unfollow_source("user-2", "s1")
        branch_db.unfollow_source("user-2", "s1")
        assert branch_db.get_active_user_ids() == ["user-1"]
        assert sorted(branch_db.get_user_followed_sources("user-1")) == ["s1", "s2"]

        with branch_db.get_session() as session:
            session.add(UserProfile(user_id="user-1", preferred_topics=["ai"]))
            session.commit()
        profile = branch_db.get_user_profile("user-1")
        assert profile is not None
        assert profile.preferred_topics == ["ai"]

    def test_search_and_recommendation_delegates_are_mocked(
        self, branch_db: DatabaseManager
    ) -> None:
        with (
            patch("ai_web_feeds.search.semantic_search", return_value=[("src", 0.9)]) as semantic,
            patch("ai_web_feeds.search.full_text_search", return_value=["src"]) as full_text,
        ):
            semantic_result = branch_db.search_feeds(
                "query",
                search_type="semantic",
                filters={"threshold": 0.4},
            )
            default_semantic = branch_db.search_feeds("query", search_type="semantic")
            text_result = branch_db.search_feeds("query", filters={"active": True})

        assert semantic_result == [("src", 0.9)]
        assert default_semantic == [("src", 0.9)]
        assert text_result == ["src"]
        semantic.assert_any_call(
            ANY,
            "query",
            threshold=0.4,
            limit=20,
            filters={"threshold": 0.4},
        )
        semantic.assert_any_call(ANY, "query", threshold=0.7, limit=20, filters=None)
        full_text.assert_called_once_with(
            ANY,
            "query",
            limit=20,
            filters={"active": True},
        )

        with patch(
            "ai_web_feeds.search.autocomplete",
            return_value={"feeds": [], "topics": []},
        ) as autocomplete:
            suggestions = branch_db.autocomplete_search("pre", limit=3)
        assert suggestions == {"feeds": [], "topics": []}
        assert autocomplete.call_args.args[1] == "pre"
        assert autocomplete.call_args.kwargs == {"limit": 3}

        with patch("ai_web_feeds.search.log_search_query") as log_search:
            branch_db.log_search(None, "query", "full_text", {}, 0)
        assert log_search.call_args.args[1:] == (None, "query", "full_text", {}, 0, None)

        sentinel = object()
        with patch("ai_web_feeds.search.save_search", return_value=sentinel) as save_search:
            assert branch_db.save_user_search("user", "name", "query", {"active": True}) is sentinel
        save_search.assert_called_once_with(
            ANY,
            "user",
            "name",
            "query",
            {"active": True},
        )
        with patch("ai_web_feeds.search.get_saved_searches", return_value=[]) as saved:
            assert branch_db.get_user_saved_searches("user") == []
        saved.assert_called_once_with(ANY, "user")

        with (
            patch("ai_web_feeds.search.create_fts_table") as create_fts,
            patch("ai_web_feeds.search.build_trie_index") as build_trie,
        ):
            branch_db.initialize_search_tables()
        create_fts.assert_called_once()
        build_trie.assert_called_once()

        with patch(
            "ai_web_feeds.analytics.calculate_summary_metrics",
            return_value={"total": 0},
        ) as summary:
            assert branch_db.get_analytics_summary(date_range_days=7, topic="ai") == {"total": 0}
        assert summary.call_args.kwargs == {"date_range": "7d", "topic": "ai"}

        with (
            patch(
                "ai_web_feeds.recommendations.generate_recommendations",
                return_value=[],
            ) as generate,
            patch(
                "ai_web_feeds.recommendations.get_user_recommendations",
                return_value=[],
            ) as user_recs,
            patch(
                "ai_web_feeds.recommendations.track_recommendation_interaction",
            ) as track,
        ):
            assert branch_db.get_recommendations(seed_feed_ids=[], seed_topics=[]) == []
            assert branch_db.get_user_recommendations("user", limit=5) == []
            branch_db.track_recommendation_click("user", "src", "click", "because")
        generate.assert_called_once_with(
            ANY,
            user_id=None,
            seed_feed_ids=[],
            seed_topics=[],
            limit=20,
        )
        user_recs.assert_called_once_with(ANY, "user", 5)
        track.assert_called_once_with(ANY, "user", "src", "click", "because")


@pytest.mark.unit
class TestArticleCorpusBranches:
    """Article identity, dedupe, and corpus export branches."""

    def test_identity_hash_and_empty_feed_lookup(self, branch_db: DatabaseManager) -> None:
        assert DatabaseManager._identity_hash(None) is None
        assert DatabaseManager._identity_hash("   ") is None
        assert DatabaseManager._identity_hash(cast(Any, 123)) is None
        expected = hashlib.sha256(b"abc").hexdigest()
        assert DatabaseManager._identity_hash(" AbC ") == expected
        assert branch_db.get_article_by_identity("guid", "https://example.com/a", "") is None
        assert branch_db.get_articles("missing") == []
        assert branch_db.get_recent_articles(datetime(2099, 1, 1, tzinfo=UTC)) == []
        assert branch_db.get_all_articles() == []

    def test_add_article_dedupes_guid_before_link(self, branch_db: DatabaseManager) -> None:
        branch_db.add_feed_source(_source("src"))
        published = datetime(2024, 1, 15, tzinfo=UTC)
        first = branch_db.add_article(
            _article("src", "guid-1", "https://example.com/one", published, title="One")
        )
        by_guid = branch_db.add_article(
            _article("src", "guid-1", "https://example.com/other", published, title="Other")
        )
        by_link = branch_db.add_article(
            _article("src", "guid-2", "https://example.com/one", published, title="Link")
        )
        assert by_guid.id == first.id
        assert by_link.id == first.id
        assert len(branch_db.get_articles("src")) == 1
        found = branch_db.get_article_by_identity(
            "guid-1",
            "https://example.com/missing",
            "src",
        )
        assert found is not None
        assert found.id == first.id
        assert found.canonical_url == "https://example.com/one"
        assert found.guid_hash == DatabaseManager._identity_hash("guid-1")

    def test_corpus_payload_skips_duplicates_and_inactive_sources(
        self, branch_db: DatabaseManager
    ) -> None:
        active = _source(
            "active",
            title="Active",
            topics=["source-topic"],
            source_type=SourceType.BLOG,
            verified=True,
            curation_status=CurationStatus.VERIFIED,
        )
        archived = _source(
            "archived",
            title="Archived",
            topics=["old"],
            source_type=SourceType.PODCAST,
            verified=False,
            curation_status=CurationStatus.ARCHIVED,
        )
        inactive = _source(
            "inactive",
            title="Inactive",
            source_type=SourceType.NEWSLETTER,
            curation_status=CurationStatus.INACTIVE,
        )
        branch_db.add_feed_source(active)
        branch_db.add_feed_source(archived)
        branch_db.add_feed_source(inactive)
        newer = datetime(2024, 6, 1, 12, 0, tzinfo=UTC)
        older = datetime(2024, 1, 1, 12, 0, tzinfo=UTC)
        middle = datetime(2024, 3, 1, 12, 0, tzinfo=UTC)
        with branch_db.get_session() as session:
            session.add(
                _article(
                    "active",
                    "shared-guid",
                    "https://example.com/newer",
                    newer,
                    title="Café",
                    topics=[],
                )
            )
            session.add(
                _article(
                    "archived",
                    "shared-guid",
                    "https://example.com/older-guid",
                    older,
                    title="Skipped guid",
                )
            )
            session.add(
                _article(
                    "inactive",
                    "other-guid",
                    "https://example.com/newer",
                    middle,
                    title="Skipped link",
                    topics=["article-topic"],
                )
            )
            session.add(
                _article(
                    "missing-feed",
                    "orphan",
                    "https://example.com/orphan",
                    middle,
                    title="Orphan",
                    topics=["kept"],
                )
            )
            session.commit()

        payload = branch_db.build_articles_corpus_payload(
            partial_coverage={"feeds_skipped": 1},
            source_db="sqlite:///:memory:",
        )
        by_id = {article["id"]: article for article in payload["articles"]}
        assert set(by_id) == {"shared-guid", "orphan"}
        kept = by_id["shared-guid"]
        assert kept["title"] == "Café"
        assert kept["feed_title"] == "Active"
        assert kept["topics"] == ["source-topic"]
        assert kept["source_type"] == "blog"
        assert kept["verified"] is True
        assert kept["is_active"] is True
        # SQLite round-trip drops tzinfo, so the stored value is naive.
        assert kept["published_at"] == "2024-06-01T12:00:00"
        orphan = by_id["orphan"]
        assert orphan["feed_title"] == "missing-feed"
        assert orphan["source_type"] is None
        assert orphan["verified"] is False
        assert orphan["is_active"] is True
        assert orphan["topics"] == ["kept"]
        assert payload["metadata"]["article_count"] == 2
        assert payload["metadata"]["feed_count"] == 2
        assert payload["metadata"]["latest_published_at"] == kept["published_at"]
        assert payload["metadata"]["partial_coverage"] == {"feeds_skipped": 1}
        assert payload["metadata"]["source_db"] == "sqlite:///:memory:"
        assert isinstance(payload["metadata"]["generated_at"], str)

    def test_export_empty_corpus_writes_json(
        self, branch_db: DatabaseManager, tmp_path: Path
    ) -> None:
        output = tmp_path / "corpus" / "articles.json"
        payload = branch_db.export_articles_corpus(output)
        loaded = json.loads(output.read_text(encoding="utf-8"))
        assert loaded["articles"] == []
        assert loaded["metadata"]["article_count"] == 0
        assert loaded["metadata"]["feed_count"] == 0
        assert loaded["metadata"]["latest_published_at"] is None
        assert loaded["metadata"]["freshness_watermark"] is None
        assert "partial_coverage" not in loaded["metadata"]
        assert loaded["metadata"]["source_db"] == branch_db.database_url
        assert payload["metadata"]["article_count"] == 0

    def test_get_all_articles_applies_offset_and_limit(self, branch_db: DatabaseManager) -> None:
        branch_db.add_feed_source(_source("src"))
        published = [
            datetime(2024, 1, 1, tzinfo=UTC),
            datetime(2024, 2, 1, tzinfo=UTC),
            datetime(2024, 3, 1, tzinfo=UTC),
        ]
        for index, moment in enumerate(published):
            branch_db.add_article(
                _article("src", f"guid-{index}", f"https://example.com/{index}", moment)
            )

        newest = branch_db.get_all_articles(limit=1)
        assert [row.guid for row in newest] == ["guid-2"]
        second = branch_db.get_all_articles(limit=1, offset=1)
        assert [row.guid for row in second] == ["guid-1"]
        assert len(branch_db.get_all_articles(limit=None)) == 3
        paged = branch_db.get_articles("src", limit=1, offset=2)
        assert [row.guid for row in paged] == ["guid-0"]
