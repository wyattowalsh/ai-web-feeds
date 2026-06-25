"""Unit tests for catalog_sync staged pipeline."""

from __future__ import annotations

import textwrap

import pytest
from ai_web_feeds.catalog_sync.stages import (
    sync_edges,
    sync_junctions,
    sync_sources,
    sync_topics,
)
from ai_web_feeds.catalog_sync.sync import sync_catalog_to_db
from ai_web_feeds.catalog_sync.types import CatalogSyncStage, QuarantineReason
from ai_web_feeds.models import FeedSource, SourceTopic, TopicEdge, TopicNode
from ai_web_feeds.storage import DatabaseManager, replace_source_topics, upsert_topic
from sqlmodel import select


@pytest.fixture
def catalog_db(tmp_path):
    db = DatabaseManager(f"sqlite:///{tmp_path / 'catalog-sync.db'}")
    db.create_db_and_tables()
    yield db
    db.close()


@pytest.fixture
def topics_doc() -> dict:
    return {
        "version": "test",
        "topics": [
            {
                "id": "ai",
                "label": "Artificial Intelligence",
                "facet": "domain",
                "parents": [],
                "relations": {"related_to": ["ml"]},
            },
            {
                "id": "ml",
                "label": "Machine Learning",
                "facet": "domain",
                "parents": ["ai"],
            },
        ],
    }


@pytest.fixture
def enriched_doc() -> dict:
    return {
        "schema_version": "feeds.enriched-3.0.0",
        "sources": [
            {
                "id": "feed-a",
                "url": "https://example.com/a.xml",
                "feed": "https://example.com/a.xml",
                "title": "Feed A",
                "topics": ["ai", "ml"],
                "tags": ["ai", "ml"],
                "source_type": "blog",
            },
            {
                "id": "feed-b",
                "url": "https://example.com/b.xml",
                "feed": "https://example.com/b.xml",
                "title": "Feed B",
                "topics": ["ai", "missing-topic"],
                "tags": ["ai"],
                "source_type": "blog",
            },
        ],
    }


@pytest.mark.unit
class TestStorageHelpers:
    def test_upsert_topic_inserts_then_updates(self, catalog_db) -> None:
        topic = TopicNode(id="ai", label="AI", facet="domain")
        with catalog_db.get_session() as session:
            _, inserted = upsert_topic(session, topic)
            session.commit()
            assert inserted is True

            topic.label = "Artificial Intelligence"
            persisted, inserted = upsert_topic(session, topic)
            session.commit()
            assert inserted is False
            assert persisted.label == "Artificial Intelligence"

    def test_replace_source_topics_replaces_catalog_origin_rows(self, catalog_db) -> None:
        with catalog_db.get_session() as session:
            session.add(TopicNode(id="ai", label="AI", facet="domain"))
            session.add(
                FeedSource(
                    id="feed-a",
                    title="Feed A",
                    feed="https://example.com/a.xml",
                    topics=["ai"],
                )
            )
            session.commit()

            replace_source_topics(session, source_id="feed-a", topic_ids=["ai"])
            session.commit()
            rows = list(session.exec(select(SourceTopic)).all())
            assert len(rows) == 1
            assert rows[0].topic_id == "ai"
            assert rows[0].origin == "catalog"

            replace_source_topics(session, source_id="feed-a", topic_ids=[])
            session.commit()
            assert list(session.exec(select(SourceTopic)).all()) == []


@pytest.mark.unit
class TestCatalogSyncStages:
    def test_sync_topics_materializes_topic_nodes(self, catalog_db, topics_doc) -> None:
        with catalog_db.get_session() as session:
            result, known_ids = sync_topics(session, topics_doc)
            session.commit()

        assert result.stage == CatalogSyncStage.TOPICS
        assert result.inserted == 2
        assert known_ids == {"ai", "ml"}

        with catalog_db.get_session() as session:
            topics = list(session.exec(select(TopicNode)).all())
        assert {topic.id for topic in topics} == {"ai", "ml"}

    def test_sync_edges_materializes_parent_and_relation_edges(
        self, catalog_db, topics_doc
    ) -> None:
        with catalog_db.get_session() as session:
            _, known_ids = sync_topics(session, topics_doc)
            edges_result = sync_edges(session, topics_doc, known_ids)
            session.commit()

        assert edges_result.stage == CatalogSyncStage.EDGES
        assert edges_result.inserted >= 2

        with catalog_db.get_session() as session:
            edges = list(session.exec(select(TopicEdge)).all())
        relation_types = {
            (edge.topic_id, edge.related_topic_id, edge.relation_type) for edge in edges
        }
        assert ("ml", "ai", "parent") in relation_types

    def test_sync_sources_is_non_destructive_upsert(
        self, catalog_db, topics_doc, enriched_doc
    ) -> None:
        stale = FeedSource(
            id="legacy-feed",
            title="Legacy",
            feed="https://legacy.example/feed.xml",
            topics=["ai"],
        )
        with catalog_db.get_session() as session:
            session.add(stale)
            session.commit()

        with catalog_db.get_session() as session:
            _, known_ids = sync_topics(session, topics_doc)
            sources_result, synced_sources = sync_sources(session, enriched_doc, known_ids)
            session.commit()

        assert sources_result.inserted == 2
        assert len(synced_sources) == 2

        with catalog_db.get_session() as session:
            feed_ids = {feed.id for feed in session.exec(select(FeedSource)).all()}
        assert "legacy-feed" in feed_ids
        assert {"feed-a", "feed-b"}.issubset(feed_ids)

    def test_sync_sources_quarantines_orphan_topics(
        self, catalog_db, topics_doc, enriched_doc
    ) -> None:
        with catalog_db.get_session() as session:
            _, known_ids = sync_topics(session, topics_doc)
            sources_result, _ = sync_sources(session, enriched_doc, known_ids)
            session.commit()

        assert sources_result.quarantined >= 1
        assert any(QuarantineReason.ORPHAN_TOPICS.value in error for error in sources_result.errors)

    def test_sync_junctions_writes_source_topics(
        self, catalog_db, topics_doc, enriched_doc
    ) -> None:
        with catalog_db.get_session() as session:
            _, known_ids = sync_topics(session, topics_doc)
            _, synced_sources = sync_sources(session, enriched_doc, known_ids)
            junctions_result = sync_junctions(session, synced_sources, known_ids)
            session.commit()

        assert junctions_result.stage == CatalogSyncStage.JUNCTIONS
        assert junctions_result.inserted >= 2

        with catalog_db.get_session() as session:
            rows = list(session.exec(select(SourceTopic)).all())
        assert any(row.source_id == "feed-a" and row.topic_id == "ai" for row in rows)


@pytest.mark.unit
class TestCatalogSyncOrchestrator:
    def test_sync_catalog_to_db_runs_all_stages(self, catalog_db, tmp_path) -> None:
        topics_path = tmp_path / "topics.yaml"
        enriched_path = tmp_path / "feeds.enriched.yaml"
        feeds_path = tmp_path / "feeds.yaml"

        topics_path.write_text(
            textwrap.dedent(
                """
                version: test
                topics:
                  - id: ai
                    label: Artificial Intelligence
                    facet: domain
                    parents: []
                """
            ).strip(),
            encoding="utf-8",
        )
        enriched_path.write_text(
            textwrap.dedent(
                """
                schema_version: feeds.enriched-3.0.0
                sources:
                  - id: feed-a
                    url: https://example.com/a.xml
                    feed: https://example.com/a.xml
                    title: Feed A
                    topics: [ai]
                    tags: [ai]
                    source_type: blog
                """
            ).strip(),
            encoding="utf-8",
        )
        feeds_path.write_text(
            textwrap.dedent(
                """
                schema_version: feeds-3.0.0
                sources:
                  - id: feed-a
                    url: https://example.com/a.xml
                    title: Feed A
                    topics: [ai]
                """
            ).strip(),
            encoding="utf-8",
        )

        result = sync_catalog_to_db(
            feeds_path=feeds_path,
            topics_path=topics_path,
            enriched_path=enriched_path,
            database_url=catalog_db.database_url,
        )

        assert result.succeeded is True
        assert result.catalog_hash
        assert result.topics_count == 1
        assert result.sources_count == 1
        assert result.junction_count == 1
        stage_names = {stage.stage for stage in result.stages}
        assert CatalogSyncStage.TOPICS in stage_names
        assert CatalogSyncStage.EDGES in stage_names
        assert CatalogSyncStage.SOURCES in stage_names
        assert CatalogSyncStage.JUNCTIONS in stage_names
