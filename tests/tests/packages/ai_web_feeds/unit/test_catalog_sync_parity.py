"""Characterize catalog sync parity for the current staged pipeline.

Fixtures are tmp_path YAML only. These tests do not read ``data/`` and do not
perform HTTP. They record today's ``sync_catalog_to_db`` behavior, including
gaps (topics and edges are not purged; orphan-only sources skip junction
replacement; the catalog hash ignores the enriched document).
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
import yaml
from ai_web_feeds.catalog_sync.mapper import catalog_hash
from ai_web_feeds.catalog_sync.stages import load_yaml_document
from ai_web_feeds.catalog_sync.sync import sync_catalog_to_db
from ai_web_feeds.catalog_sync.types import CatalogSyncResult, CatalogSyncStage, StageResult
from ai_web_feeds.models import FeedSource, SourceTopic, TopicEdge, TopicNode
from ai_web_feeds.storage import DatabaseManager
from sqlmodel import select

JunctionKey = tuple[str, str, str]
EdgeKey = tuple[str, str, str]


@pytest.fixture
def catalog_db(tmp_path: Path) -> Iterator[DatabaseManager]:
    """SQLite database created under tmp_path and closed after the test."""
    database = DatabaseManager(f"sqlite:///{tmp_path / 'catalog-sync-parity.db'}")
    database.create_db_and_tables()
    try:
        yield database
    finally:
        database.close()


def _topics_doc(topics: list[Any]) -> dict[str, Any]:
    return {"version": "test", "topics": topics}


def _enriched_doc(sources: list[Any]) -> dict[str, Any]:
    return {"schema_version": "feeds.enriched-3.0.0", "sources": sources}


def _feeds_doc(sources: list[Any]) -> dict[str, Any]:
    return {"schema_version": "feeds-3.0.0", "sources": sources}


def _topic(
    topic_id: str,
    label: str,
    *,
    facet: str = "domain",
    parents: list[str] | None = None,
    relations: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "id": topic_id,
        "label": label,
        "facet": facet,
        "parents": [] if parents is None else parents,
    }
    if relations is not None:
        entry["relations"] = relations
    return entry


def _write_catalog(
    directory: Path,
    *,
    topics: dict[str, Any],
    enriched: dict[str, Any],
    feeds: dict[str, Any],
) -> tuple[Path, Path, Path]:
    feeds_path = directory / "feeds.yaml"
    topics_path = directory / "topics.yaml"
    enriched_path = directory / "feeds.enriched.yaml"
    for path, document in (
        (feeds_path, feeds),
        (topics_path, topics),
        (enriched_path, enriched),
    ):
        path.write_text(yaml.safe_dump(document, sort_keys=False), encoding="utf-8")
    return feeds_path, topics_path, enriched_path


def _sync(database: DatabaseManager, paths: tuple[Path, Path, Path]) -> CatalogSyncResult:
    feeds_path, topics_path, enriched_path = paths
    return sync_catalog_to_db(
        feeds_path=feeds_path,
        topics_path=topics_path,
        enriched_path=enriched_path,
        database_url=database.database_url,
    )


def _stage(result: CatalogSyncResult, stage: CatalogSyncStage) -> StageResult:
    matched = [item for item in result.stages if item.stage == stage]
    assert len(matched) == 1
    return matched[0]


def _assert_stage_order(result: CatalogSyncResult) -> None:
    assert [item.stage for item in result.stages] == [
        CatalogSyncStage.TOPICS,
        CatalogSyncStage.EDGES,
        CatalogSyncStage.SOURCES,
        CatalogSyncStage.JUNCTIONS,
    ]


def _plain(value: object) -> object:
    enum_value = getattr(value, "value", None)
    if isinstance(enum_value, str):
        return enum_value
    return value


def _source_ids(database: DatabaseManager) -> set[str]:
    with database.get_session() as session:
        return {row.id for row in session.exec(select(FeedSource)).all()}


def _topic_ids(database: DatabaseManager) -> set[str]:
    with database.get_session() as session:
        return {row.id for row in session.exec(select(TopicNode)).all()}


def _junctions(database: DatabaseManager) -> set[JunctionKey]:
    with database.get_session() as session:
        return {
            (row.source_id, row.topic_id, row.origin)
            for row in session.exec(select(SourceTopic)).all()
        }


def _junction_weights(
    database: DatabaseManager,
) -> dict[JunctionKey, tuple[float | None, float | None]]:
    with database.get_session() as session:
        return {
            (row.source_id, row.topic_id, row.origin): (row.weight, row.confidence)
            for row in session.exec(select(SourceTopic)).all()
        }


def _edges(database: DatabaseManager) -> set[EdgeKey]:
    with database.get_session() as session:
        return {
            (row.topic_id, row.related_topic_id, row.relation_type)
            for row in session.exec(select(TopicEdge)).all()
        }


def _source_row(database: DatabaseManager, source_id: str) -> dict[str, Any]:
    with database.get_session() as session:
        row = session.get(FeedSource, source_id)
        assert row is not None
        return {
            "title": row.title,
            "url": row.url,
            "feed": row.feed,
            "site": row.site,
            "topics": list(row.topics),
            "tags": list(row.tags),
            "topic_weights": dict(row.topic_weights or {}),
            "source_type": _plain(row.source_type),
            "format": _plain(row.format),
            "mediums": [_plain(item) for item in row.mediums],
            "language": row.language,
            "verified": row.verified,
            "curation_status": _plain(row.curation_status),
            "quality_score": row.quality_score,
            "provenance_source": row.provenance_source,
            "provenance_license": row.provenance_license,
            "notes": row.notes,
        }


def _topic_row(database: DatabaseManager, topic_id: str) -> dict[str, Any]:
    with database.get_session() as session:
        row = session.get(TopicNode, topic_id)
        assert row is not None
        return {
            "label": row.label,
            "facet": row.facet,
            "parents": list(row.parents or []),
            "relations": dict(row.relations or {}),
        }


def _seed_stale_rows(database: DatabaseManager) -> None:
    with database.get_session() as session:
        session.add(TopicNode(id="legacy-topic", label="Legacy", facet="domain"))
        session.add(TopicNode(id="ai", label="OLD", facet="domain"))
        session.add(
            FeedSource(
                id="legacy-feed",
                title="Legacy",
                url="https://legacy.example/feed.xml",
                feed="https://legacy.example/feed.xml",
                topics=["legacy-topic"],
            )
        )
        session.add(
            FeedSource(
                id="feed-a",
                title="Old A",
                url="https://example.com/feed-a.xml",
                feed="https://example.com/feed-a.xml",
                topics=["ai"],
            )
        )
        session.commit()
        session.add(
            SourceTopic(
                source_id="legacy-feed",
                topic_id="legacy-topic",
                origin="catalog",
                weight=1.0,
                confidence=1.0,
            )
        )
        session.add(
            SourceTopic(
                source_id="legacy-feed",
                topic_id="legacy-topic",
                origin="manual",
                weight=0.25,
                confidence=0.5,
            )
        )
        session.add(
            SourceTopic(
                source_id="feed-a",
                topic_id="ai",
                origin="manual",
                weight=0.25,
                confidence=0.5,
            )
        )
        session.add(
            TopicEdge(
                topic_id="legacy-topic",
                related_topic_id="ai",
                relation_type="related",
            )
        )
        session.commit()


def _seed_orphan_source(database: DatabaseManager) -> None:
    with database.get_session() as session:
        session.add(TopicNode(id="ai", label="AI", facet="domain"))
        session.add(
            FeedSource(
                id="feed-orphan",
                title="Old orphan",
                url="https://example.com/feed-orphan.xml",
                feed="https://example.com/feed-orphan.xml",
                topics=["ai"],
            )
        )
        session.commit()
        session.add(
            SourceTopic(
                source_id="feed-orphan",
                topic_id="ai",
                origin="catalog",
                weight=0.25,
                confidence=0.5,
            )
        )
        session.commit()


@pytest.mark.unit
class TestCatalogSyncParity:
    """YAML ↔ database parity of ``sync_catalog_to_db`` as implemented today."""

    def test_valid_enriched_sources_match_db_and_feeds_yaml_does_not(
        self,
        catalog_db: DatabaseManager,
        tmp_path: Path,
    ) -> None:
        topics = _topics_doc(
            [
                _topic("ai", "Artificial Intelligence"),
                _topic("ml", "Machine Learning", parents=["ai"], relations={"related_to": ["ai"]}),
            ]
        )
        enriched = _enriched_doc(
            [
                {
                    "id": " feed-a ",
                    "url": "https://example.com/a.xml",
                    "title": "Enriched A",
                    "topics": ["ai", "ml"],
                    "tags": ["custom"],
                    "topic_weights": {"ai": 0.25, "ml": 0.5},
                    "source_type": "blog",
                    "mediums": ["text"],
                    "meta": {"language": "en", "format": "rss", "verified": True},
                    "curation": {"status": "verified", "quality_score": 0.5},
                    "provenance": {"source": "manual", "license": "Public"},
                    "notes": "note a",
                },
                "not-a-mapping",
                {
                    "id": "feed-a",
                    "url": "https://example.com/duplicate.xml",
                    "title": "Duplicate",
                    "topics": ["ai"],
                },
                {
                    "id": "bad-url",
                    "url": "not-a-url",
                    "title": "Bad URL",
                    "topics": ["ai"],
                },
                {
                    "url": "https://example.com/noid.xml",
                    "title": "No Id",
                    "topics": ["ai"],
                },
                {
                    "id": "feed-b",
                    "feed": "https://example.com/b.xml",
                    "title": "Enriched B",
                    "topics": ["ai"],
                    "source_type": "blog",
                },
            ]
        )
        feeds = _feeds_doc(
            [
                {
                    "id": "feed-a",
                    "url": "https://feeds.example/a.xml",
                    "title": "Feeds Title A",
                    "topics": ["ai"],
                },
                {
                    "id": "feeds-only",
                    "url": "https://feeds.example/only.xml",
                    "title": "Feeds Only",
                    "topics": ["ai"],
                },
            ]
        )
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)

        result = _sync(catalog_db, paths)

        _assert_stage_order(result)
        assert result.pipeline_run_id is None
        assert result.duration_ms is not None
        assert result.duration_ms >= 0
        assert result.succeeded is False
        assert result.topics_count == 2
        assert result.sources_count == 2
        assert result.junction_count == 3
        assert result.quarantine_count == 3
        assert result.catalog_hash == catalog_hash(
            load_yaml_document(paths[0]),
            load_yaml_document(paths[1]),
        )
        # Enriched YAML is the source-row document; it is not the hash input.
        assert result.catalog_hash != catalog_hash(
            load_yaml_document(paths[2]),
            load_yaml_document(paths[1]),
        )

        sources_stage = _stage(result, CatalogSyncStage.SOURCES)
        assert sources_stage.inserted == 2
        assert sources_stage.updated == 0
        assert sources_stage.deleted == 0
        assert sources_stage.quarantined == 3
        assert sources_stage.errors == [
            "source entry must be a mapping",
            "duplicate_id: feed-a",
            "invalid_url: bad-url",
            "schema_mismatch: source id is required",
        ]
        assert _stage(result, CatalogSyncStage.TOPICS).errors == []
        assert _stage(result, CatalogSyncStage.EDGES).inserted == 2
        assert _stage(result, CatalogSyncStage.JUNCTIONS).inserted == 3

        assert _source_ids(catalog_db) == {"feed-a", "feed-b"}
        assert "feeds-only" not in _source_ids(catalog_db)
        assert _topic_ids(catalog_db) == {"ai", "ml"}
        assert _junctions(catalog_db) == {
            ("feed-a", "ai", "catalog"),
            ("feed-a", "ml", "catalog"),
            ("feed-b", "ai", "catalog"),
        }
        assert _junction_weights(catalog_db)[("feed-a", "ai", "catalog")] == (1.0, 1.0)
        assert _edges(catalog_db) == {("ml", "ai", "parent"), ("ml", "ai", "related_to")}

        feed_a = _source_row(catalog_db, "feed-a")
        assert feed_a["title"] == "Enriched A"
        assert feed_a["url"] == "https://example.com/a.xml"
        assert feed_a["feed"] == "https://example.com/a.xml"
        assert feed_a["site"] is None
        assert feed_a["topics"] == ["ai", "ml"]
        assert feed_a["tags"] == ["custom"]
        assert feed_a["topic_weights"] == {"ai": 0.25, "ml": 0.5}
        assert feed_a["source_type"] == "blog"
        assert feed_a["format"] == "rss"
        assert feed_a["mediums"] == ["text"]
        assert feed_a["language"] == "en"
        assert feed_a["verified"] is True
        assert feed_a["curation_status"] == "verified"
        assert feed_a["quality_score"] == 0.5
        assert feed_a["provenance_source"] == "manual"
        assert feed_a["provenance_license"] == "Public"
        assert feed_a["notes"] == "note a"

        feed_b = _source_row(catalog_db, "feed-b")
        assert feed_b["url"] == "https://example.com/b.xml"
        assert feed_b["feed"] == "https://example.com/b.xml"
        assert feed_b["tags"] == ["ai"]
        assert feed_b["format"] == "unknown"
        assert feed_b["curation_status"] == "unverified"
        assert feed_b["language"] == "en"
        assert feed_b["verified"] is False

        assert _topic_row(catalog_db, "ml") == {
            "label": "Machine Learning",
            "facet": "domain",
            "parents": ["ai"],
            "relations": {"related_to": ["ai"]},
        }

    def test_stale_sources_are_purged_but_topics_edges_and_manual_junctions_remain(
        self,
        catalog_db: DatabaseManager,
        tmp_path: Path,
    ) -> None:
        _seed_stale_rows(catalog_db)
        topics = _topics_doc(
            [
                _topic("ai", "Artificial Intelligence"),
                _topic("ml", "Machine Learning", parents=["ai"]),
            ]
        )
        enriched = _enriched_doc(
            [
                {
                    "id": "feed-a",
                    "url": "https://example.com/a.xml",
                    "title": "Feed A",
                    "topics": ["ai"],
                    "source_type": "blog",
                }
            ]
        )
        feeds = _feeds_doc(
            [
                {
                    "id": "feed-a",
                    "url": "https://feeds.example/a.xml",
                    "title": "Feeds A",
                }
            ]
        )
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)

        result = _sync(catalog_db, paths)

        _assert_stage_order(result)
        assert result.succeeded is True
        assert result.quarantine_count == 0
        # topics_count counts this pass, not rows left behind from earlier syncs.
        assert result.topics_count == 2
        assert result.sources_count == 1
        assert result.junction_count == 2
        assert _stage(result, CatalogSyncStage.TOPICS).inserted == 1
        assert _stage(result, CatalogSyncStage.TOPICS).updated == 1
        assert _stage(result, CatalogSyncStage.SOURCES).inserted == 0
        assert _stage(result, CatalogSyncStage.SOURCES).updated == 1
        assert _stage(result, CatalogSyncStage.SOURCES).deleted == 1
        assert _stage(result, CatalogSyncStage.EDGES).inserted == 1
        assert _stage(result, CatalogSyncStage.JUNCTIONS).inserted == 1

        assert _source_ids(catalog_db) == {"feed-a"}
        assert _topic_ids(catalog_db) == {"legacy-topic", "ai", "ml"}
        assert _junctions(catalog_db) == {
            ("feed-a", "ai", "catalog"),
            ("feed-a", "ai", "manual"),
        }
        assert _junction_weights(catalog_db) == {
            ("feed-a", "ai", "catalog"): (1.0, 1.0),
            ("feed-a", "ai", "manual"): (0.25, 0.5),
        }
        assert _edges(catalog_db) == {
            ("legacy-topic", "ai", "related"),
            ("ml", "ai", "parent"),
        }
        assert _topic_row(catalog_db, "ai")["label"] == "Artificial Intelligence"
        assert _source_row(catalog_db, "feed-a")["title"] == "Feed A"
        assert _source_row(catalog_db, "feed-a")["url"] == "https://example.com/a.xml"

    def test_orphan_topics_stay_on_source_rows_and_skip_junction_replace(
        self,
        catalog_db: DatabaseManager,
        tmp_path: Path,
    ) -> None:
        _seed_orphan_source(catalog_db)
        topics = _topics_doc([_topic("ai", "Artificial Intelligence")])
        enriched = _enriched_doc(
            [
                {
                    "id": "feed-mixed",
                    "url": "https://example.com/mixed.xml",
                    "title": "Mixed",
                    "topics": ["ai", "missing-topic"],
                    "source_type": "blog",
                },
                {
                    "id": "feed-orphan",
                    "url": "https://example.com/feed-orphan.xml",
                    "title": "Orphan",
                    "topics": ["missing-only"],
                    "source_type": "blog",
                },
            ]
        )
        feeds = _feeds_doc([])
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)

        result = _sync(catalog_db, paths)

        _assert_stage_order(result)
        assert result.succeeded is False
        assert result.sources_count == 2
        assert result.quarantine_count == 2
        assert result.junction_count == 2
        sources_stage = _stage(result, CatalogSyncStage.SOURCES)
        assert sources_stage.inserted == 1
        assert sources_stage.updated == 1
        assert sources_stage.deleted == 0
        assert sources_stage.quarantined == 2
        assert sources_stage.errors == [
            "orphan_topics: feed-mixed -> missing-topic",
            "orphan_topics: feed-orphan -> missing-only",
        ]
        # No known topics means replace_source_topics is not called.
        assert _stage(result, CatalogSyncStage.JUNCTIONS).inserted == 1

        assert _source_ids(catalog_db) == {"feed-mixed", "feed-orphan"}
        assert _source_row(catalog_db, "feed-mixed")["topics"] == ["ai", "missing-topic"]
        assert _source_row(catalog_db, "feed-orphan")["topics"] == ["missing-only"]
        assert _junctions(catalog_db) == {
            ("feed-mixed", "ai", "catalog"),
            ("feed-orphan", "ai", "catalog"),
        }
        assert _junction_weights(catalog_db)[("feed-orphan", "ai", "catalog")] == (0.25, 0.5)
        assert _junction_weights(catalog_db)[("feed-mixed", "ai", "catalog")] == (1.0, 1.0)

    def test_second_sync_preserves_row_sets(
        self,
        catalog_db: DatabaseManager,
        tmp_path: Path,
    ) -> None:
        topics = _topics_doc(
            [
                _topic("ai", "Artificial Intelligence"),
                _topic("ml", "Machine Learning", parents=["ai"]),
            ]
        )
        enriched = _enriched_doc(
            [
                {
                    "id": "feed-a",
                    "url": "https://example.com/a.xml",
                    "title": "Feed A",
                    "topics": ["ai", "ml"],
                    "source_type": "blog",
                },
                {
                    "id": "feed-b",
                    "url": "https://example.com/b.xml",
                    "title": "Feed B",
                    "topics": ["ai"],
                    "source_type": "blog",
                },
            ]
        )
        feeds = _feeds_doc(
            [
                {"id": "feed-a", "url": "https://feeds.example/a.xml", "title": "Feeds A"},
                {"id": "feed-b", "url": "https://feeds.example/b.xml", "title": "Feeds B"},
            ]
        )
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)

        first = _sync(catalog_db, paths)
        before = (
            _source_ids(catalog_db),
            _topic_ids(catalog_db),
            _junctions(catalog_db),
            _edges(catalog_db),
        )
        second = _sync(catalog_db, paths)

        _assert_stage_order(second)
        assert first.succeeded is True
        assert second.succeeded is True
        assert second.catalog_hash == first.catalog_hash
        assert second.topics_count == 2
        assert second.sources_count == 2
        assert second.junction_count == 3
        assert second.quarantine_count == 0
        assert _stage(second, CatalogSyncStage.TOPICS).inserted == 0
        assert _stage(second, CatalogSyncStage.TOPICS).updated == 2
        assert _stage(second, CatalogSyncStage.EDGES).inserted == 0
        assert _stage(second, CatalogSyncStage.EDGES).updated == 1
        assert _stage(second, CatalogSyncStage.SOURCES).inserted == 0
        assert _stage(second, CatalogSyncStage.SOURCES).updated == 2
        assert _stage(second, CatalogSyncStage.SOURCES).deleted == 0
        assert _stage(second, CatalogSyncStage.JUNCTIONS).inserted == 3
        assert _stage(second, CatalogSyncStage.JUNCTIONS).deleted == 0
        assert (
            _source_ids(catalog_db),
            _topic_ids(catalog_db),
            _junctions(catalog_db),
            _edges(catalog_db),
        ) == before

    def test_dropping_topic_assignment_removes_catalog_junction_only(
        self,
        catalog_db: DatabaseManager,
        tmp_path: Path,
    ) -> None:
        topics = _topics_doc(
            [
                _topic("ai", "Artificial Intelligence"),
                _topic("ml", "Machine Learning", parents=["ai"]),
            ]
        )
        enriched = _enriched_doc(
            [
                {
                    "id": "feed-a",
                    "url": "https://example.com/a.xml",
                    "title": "Feed A",
                    "topics": ["ai", "ml"],
                    "source_type": "blog",
                },
                {
                    "id": "feed-b",
                    "url": "https://example.com/b.xml",
                    "title": "Feed B",
                    "topics": ["ai"],
                    "source_type": "blog",
                },
            ]
        )
        feeds = _feeds_doc([])
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)
        _sync(catalog_db, paths)

        enriched["sources"][0]["topics"] = ["ai"]
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)
        result = _sync(catalog_db, paths)

        assert result.succeeded is True
        assert _stage(result, CatalogSyncStage.SOURCES).deleted == 0
        assert _stage(result, CatalogSyncStage.SOURCES).updated == 2
        assert _junctions(catalog_db) == {
            ("feed-a", "ai", "catalog"),
            ("feed-b", "ai", "catalog"),
        }
        assert _source_row(catalog_db, "feed-a")["topics"] == ["ai"]
        assert _source_row(catalog_db, "feed-a")["tags"] == ["ai"]
        assert "ml" in _topic_ids(catalog_db)
        assert ("ml", "ai", "parent") in _edges(catalog_db)

    def test_invalid_url_on_resync_purges_previously_synced_source(
        self,
        catalog_db: DatabaseManager,
        tmp_path: Path,
    ) -> None:
        topics = _topics_doc([_topic("ai", "Artificial Intelligence")])
        enriched = _enriched_doc(
            [
                {
                    "id": "feed-a",
                    "url": "https://example.com/a.xml",
                    "title": "Feed A",
                    "topics": ["ai"],
                    "source_type": "blog",
                },
                {
                    "id": "feed-bad",
                    "url": "https://example.com/bad.xml",
                    "title": "Feed Bad",
                    "topics": ["ai"],
                    "source_type": "blog",
                },
            ]
        )
        feeds = _feeds_doc([])
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)
        first = _sync(catalog_db, paths)
        assert first.succeeded is True
        assert _source_ids(catalog_db) == {"feed-a", "feed-bad"}

        enriched["sources"][1]["url"] = "not-a-url"
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)
        second = _sync(catalog_db, paths)

        assert second.succeeded is False
        assert second.sources_count == 1
        assert second.quarantine_count == 1
        assert _stage(second, CatalogSyncStage.SOURCES).deleted == 1
        assert _stage(second, CatalogSyncStage.SOURCES).updated == 1
        assert _stage(second, CatalogSyncStage.SOURCES).inserted == 0
        assert _stage(second, CatalogSyncStage.SOURCES).errors == ["invalid_url: feed-bad"]
        assert _source_ids(catalog_db) == {"feed-a"}
        assert _junctions(catalog_db) == {("feed-a", "ai", "catalog")}

    def test_catalog_hash_tracks_feeds_yaml_not_database_rows(
        self,
        catalog_db: DatabaseManager,
        tmp_path: Path,
    ) -> None:
        topics = _topics_doc([_topic("ai", "Artificial Intelligence")])
        enriched = _enriched_doc(
            [
                {
                    "id": "feed-a",
                    "url": "https://enriched.example/a.xml",
                    "title": "Enriched A",
                    "topics": ["ai"],
                    "source_type": "blog",
                }
            ]
        )
        feeds = _feeds_doc(
            [
                {
                    "id": "feed-a",
                    "url": "https://feeds.example/a.xml",
                    "title": "Feeds A",
                }
            ]
        )
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)
        first = _sync(catalog_db, paths)
        assert _source_row(catalog_db, "feed-a")["title"] == "Enriched A"
        assert _source_row(catalog_db, "feed-a")["url"] == "https://enriched.example/a.xml"
        assert first.catalog_hash == catalog_hash(
            load_yaml_document(paths[0]),
            load_yaml_document(paths[1]),
        )

        enriched["sources"][0]["title"] = "Enriched A2"
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)
        second = _sync(catalog_db, paths)
        assert second.catalog_hash == first.catalog_hash
        assert _source_row(catalog_db, "feed-a")["title"] == "Enriched A2"
        assert _source_row(catalog_db, "feed-a")["url"] == "https://enriched.example/a.xml"

        feeds["sources"][0]["url"] = "https://feeds.example/changed.xml"
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)
        third = _sync(catalog_db, paths)
        assert third.catalog_hash != first.catalog_hash
        assert third.catalog_hash == catalog_hash(
            load_yaml_document(paths[0]),
            load_yaml_document(paths[1]),
        )
        assert _source_row(catalog_db, "feed-a")["title"] == "Enriched A2"
        assert _source_row(catalog_db, "feed-a")["url"] == "https://enriched.example/a.xml"

    def test_empty_enriched_sources_purge_db_sources_without_changing_hash(
        self,
        catalog_db: DatabaseManager,
        tmp_path: Path,
    ) -> None:
        topics = _topics_doc(
            [
                _topic("ai", "Artificial Intelligence"),
                _topic("ml", "Machine Learning", parents=["ai"]),
            ]
        )
        enriched = _enriched_doc(
            [
                {
                    "id": "feed-a",
                    "url": "https://example.com/a.xml",
                    "title": "Feed A",
                    "topics": ["ai"],
                    "source_type": "blog",
                }
            ]
        )
        feeds = _feeds_doc(
            [
                {
                    "id": "feed-a",
                    "url": "https://feeds.example/a.xml",
                    "title": "Feeds A",
                }
            ]
        )
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)
        first = _sync(catalog_db, paths)
        assert _source_ids(catalog_db) == {"feed-a"}

        enriched["sources"] = []
        paths = _write_catalog(tmp_path, topics=topics, enriched=enriched, feeds=feeds)
        second = _sync(catalog_db, paths)

        assert second.succeeded is True
        assert second.catalog_hash == first.catalog_hash
        assert second.sources_count == 0
        assert second.junction_count == 0
        assert second.topics_count == 2
        assert _stage(second, CatalogSyncStage.SOURCES).deleted == 1
        assert _stage(second, CatalogSyncStage.SOURCES).inserted == 0
        assert _source_ids(catalog_db) == set()
        assert _junctions(catalog_db) == set()
        assert _topic_ids(catalog_db) == {"ai", "ml"}
        assert _edges(catalog_db) == {("ml", "ai", "parent")}

    def test_rejected_topics_are_omitted_from_nodes_and_edges(
        self,
        catalog_db: DatabaseManager,
        tmp_path: Path,
    ) -> None:
        topics = _topics_doc(
            [
                {"id": "bad"},
                "nope",
                {"id": "child", "label": "Child", "parents": ["bad"]},
            ]
        )
        paths = _write_catalog(
            tmp_path,
            topics=topics,
            enriched=_enriched_doc([]),
            feeds=_feeds_doc([]),
        )

        result = _sync(catalog_db, paths)

        _assert_stage_order(result)
        assert result.succeeded is False
        assert result.topics_count == 1
        assert result.sources_count == 0
        assert result.junction_count == 0
        topics_stage = _stage(result, CatalogSyncStage.TOPICS)
        assert topics_stage.inserted == 1
        assert topics_stage.updated == 0
        assert topics_stage.errors == [
            "topic label is required for bad",
            "topic entry must be a mapping",
        ]
        assert _stage(result, CatalogSyncStage.EDGES).inserted == 0
        assert _topic_ids(catalog_db) == {"child"}
        assert _topic_row(catalog_db, "child") == {
            "label": "Child",
            "facet": "domain",
            "parents": ["bad"],
            "relations": {},
        }
        assert _edges(catalog_db) == set()

    def test_duplicate_topic_ids_last_write_wins(
        self,
        catalog_db: DatabaseManager,
        tmp_path: Path,
    ) -> None:
        topics = _topics_doc(
            [
                _topic("ai", "First", facet="domain"),
                _topic("ai", "Second", facet="method"),
            ]
        )
        paths = _write_catalog(
            tmp_path,
            topics=topics,
            enriched=_enriched_doc([]),
            feeds=_feeds_doc([]),
        )

        result = _sync(catalog_db, paths)

        assert result.succeeded is True
        assert result.topics_count == 2
        assert _stage(result, CatalogSyncStage.TOPICS).inserted == 1
        assert _stage(result, CatalogSyncStage.TOPICS).updated == 1
        assert _stage(result, CatalogSyncStage.TOPICS).errors == []
        assert _topic_ids(catalog_db) == {"ai"}
        assert _topic_row(catalog_db, "ai")["label"] == "Second"
        assert _topic_row(catalog_db, "ai")["facet"] == "method"
