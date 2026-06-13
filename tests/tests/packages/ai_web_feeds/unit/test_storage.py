"""Unit tests for ai_web_feeds.storage module."""

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from ai_web_feeds.models import FeedEntry, FeedSource, Topic
from ai_web_feeds.storage import DatabaseManager
from sqlalchemy import text


@pytest.mark.unit
class TestDatabaseManager:
    """Test DatabaseManager class."""

    def test_init(self, temp_db_path):
        """Test DatabaseManager initialization."""
        db_url = f"sqlite:///{temp_db_path}"
        db = DatabaseManager(database_url=db_url)
        assert db.database_url == db_url
        assert db.engine is not None

    def test_create_db_and_tables(self, temp_db_path):
        """Test database and table creation."""
        db_url = f"sqlite:///{temp_db_path}"
        db = DatabaseManager(database_url=db_url)
        db.create_db_and_tables()

        # Verify tables exist by attempting to query
        with db.get_session() as session:
            # Should not raise an error
            session.execute(text("SELECT 1"))

    def test_get_session(self, temp_db_path):
        """Test getting a database session."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        session = db.get_session()
        assert session is not None
        session.close()


@pytest.mark.unit
class TestFeedSourceOperations:
    """Test FeedSource CRUD operations."""

    def test_add_feed_source(self, temp_db_path, sample_feed_source):
        """Test adding a feed source."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        result = db.add_feed_source(sample_feed_source)
        assert result.id == sample_feed_source.id
        assert result.title == sample_feed_source.title

    def test_get_feed_source(self, temp_db_path, sample_feed_source):
        """Test retrieving a feed source by ID."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        db.add_feed_source(sample_feed_source)
        retrieved = db.get_feed_source(sample_feed_source.id)

        assert retrieved is not None
        assert retrieved.id == sample_feed_source.id
        assert retrieved.title == sample_feed_source.title

    def test_get_feed_source_not_found(self, temp_db_path):
        """Test retrieving non-existent feed source."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        result = db.get_feed_source("non-existent")
        assert result is None

    def test_get_all_feed_sources(self, temp_db_path, sample_feed_sources):
        """Test retrieving all feed sources."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        for feed in sample_feed_sources:
            db.add_feed_source(feed)

        all_feeds = db.get_all_feed_sources()
        assert len(all_feeds) == len(sample_feed_sources)

    def test_update_feed_source(self, temp_db_path, sample_feed_source):
        """Test updating an existing feed source."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # Add initial feed
        db.add_feed_source(sample_feed_source)

        # Update the feed
        sample_feed_source.title = "Updated Title"
        updated = db.add_feed_source(sample_feed_source)

        assert updated.title == "Updated Title"

        # Verify the update persisted
        retrieved = db.get_feed_source(sample_feed_source.id)
        assert retrieved.title == "Updated Title"

    def test_add_feed_source_upserts_detached_source_with_same_id(self, temp_db_path):
        """Test adding a fresh object with an existing ID updates the source."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        db.add_feed_source(
            FeedSource(
                id="feed-1",
                feed="https://example.com/feed.xml",
                title="Original Title",
            )
        )

        updated = db.add_feed_source(
            FeedSource(
                id="feed-1",
                feed="https://example.com/feed.xml",
                title="Updated Title",
            )
        )

        assert updated.title == "Updated Title"
        assert len(db.get_all_feed_sources()) == 1


@pytest.mark.unit
class TestFeedItemOperations:
    """Test FeedItem CRUD operations."""

    def test_add_feed_item(self, temp_db_path, sample_feed_source, sample_feed_item):
        """Test adding a feed item."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # Add feed source first
        db.add_feed_source(sample_feed_source)

        result = db.add_feed_item(sample_feed_item)
        assert result.guid == sample_feed_item.guid
        assert result.title == sample_feed_item.title

    def test_get_feed_items(self, temp_db_path, sample_feed_source, sample_feed_items):
        """Test retrieving feed items for a feed."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # Add feed source first
        db.add_feed_source(sample_feed_source)

        # Add items
        for item in sample_feed_items:
            item.feed_source_id = sample_feed_source.id
            db.add_feed_item(item)

        items = db.get_feed_items(sample_feed_source.id)
        assert len(items) == len(sample_feed_items)

    def test_get_feed_items_empty(self, temp_db_path, sample_feed_source):
        """Test retrieving items from feed with no items."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        db.add_feed_source(sample_feed_source)
        items = db.get_feed_items(sample_feed_source.id)
        assert items == []


@pytest.mark.unit
class TestTopicOperations:
    """Test Topic CRUD operations."""

    def test_add_topic(self, temp_db_path, sample_topic):
        """Test adding a topic."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        result = db.add_topic(sample_topic)
        assert result.id == sample_topic.id
        assert result.name == sample_topic.name

    def test_get_topic(self, temp_db_path, sample_topic):
        """Test retrieving a topic."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        db.add_topic(sample_topic)
        retrieved = db.get_topic(sample_topic.id)

        assert retrieved is not None
        assert retrieved.id == sample_topic.id

    def test_get_all_topics(self, temp_db_path):
        """Test retrieving all topics."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        topics = [
            Topic(id="topic1", name="Topic 1"),
            Topic(id="topic2", name="Topic 2"),
            Topic(id="topic3", name="Topic 3"),
        ]

        for topic in topics:
            db.add_topic(topic)

        all_topics = db.get_all_topics()
        assert len(all_topics) == 3


@pytest.mark.unit
class TestFetchLogOperations:
    """Test FeedFetchLog operations."""

    def test_add_fetch_log(self, temp_db_path, sample_fetch_log):
        """Test adding a fetch log entry."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        result = db.add_fetch_log(sample_fetch_log)
        assert result.feed_source_id == sample_fetch_log.feed_source_id
        assert result.status_code == sample_fetch_log.status_code

    def test_get_fetch_logs(self, temp_db_path, sample_feed_source):
        """Test retrieving fetch logs for a feed."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        db.add_feed_source(sample_feed_source)

        # Add multiple logs
        from datetime import UTC

        from ai_web_feeds.models import FeedFetchLog

        for i in range(3):
            log = FeedFetchLog(
                feed_source_id=sample_feed_source.id,
                fetch_url="https://example.com/feed.xml",
                fetched_at=datetime.now(UTC),
                status_code=200,
                success=True,
                items_found=10 + i,
                items_new=i,
                fetch_duration_ms=1000 + i * 100,
            )
            db.add_fetch_log(log)

        logs = db.get_fetch_logs(sample_feed_source.id)
        assert len(logs) == 3


@pytest.mark.unit
class TestDatabaseManagerEdgeCases:
    """Test edge cases and error handling."""

    def test_database_path_creation(self, tmp_path):
        """Test that database directory is created if it doesn't exist."""
        nested_path = tmp_path / "nested" / "path" / "db.sqlite"
        db = DatabaseManager(database_url=f"sqlite:///{nested_path}")
        db.create_db_and_tables()

        assert nested_path.parent.exists()

    def test_concurrent_sessions(self, temp_db_path):
        """Test multiple concurrent database sessions."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        session1 = db.get_session()
        session2 = db.get_session()

        assert session1 is not None
        assert session2 is not None
        assert session1 is not session2

        session1.close()
        session2.close()

    def test_rollback_on_error(self, temp_db_path, sample_feed_source):
        """Test transaction rollback on error."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        with db.get_session() as session:
            session.add(sample_feed_source)
            session.commit()

        # Attempt to add duplicate (should fail)
        with pytest.raises(Exception):
            with db.get_session() as session:
                duplicate = FeedSource(
                    id=sample_feed_source.id,  # Same ID
                    title="Duplicate",
                )
                session.add(duplicate)
                session.commit()


@pytest.mark.unit
class TestFeedEntryCorpusOperations:
    """Test feed entry dedupe and corpus export helpers."""

    def test_add_feed_entry_dedupes_by_link_fallback(self, temp_db_path, sample_feed_source):
        """Feed entry writes should skip duplicates by link when GUIDs differ."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        db.add_feed_source(sample_feed_source)

        first_entry = FeedEntry(
            feed_id=sample_feed_source.id,
            guid="guid-1",
            link="https://example.com/article",
            title="First Title",
            pub_date=datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
        )
        duplicate_entry = FeedEntry(
            feed_id=sample_feed_source.id,
            guid="guid-2",
            link="https://example.com/article",
            title="Second Title",
            pub_date=datetime(2024, 1, 2, 12, 0, tzinfo=UTC),
        )

        stored_first = db.add_feed_entry(first_entry)
        stored_duplicate = db.add_feed_entry(duplicate_entry)

        assert stored_first.guid == "guid-1"
        assert stored_duplicate.guid == "guid-1"
        assert len(db.get_all_feed_entries()) == 1

    def test_build_articles_corpus_payload_includes_truthful_metadata(
        self, temp_db_path, sample_feed_source
    ):
        """Corpus payloads should expose normalized metadata and source fields."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        sample_feed_source.verified = True
        db.add_feed_source(sample_feed_source)

        entry = FeedEntry(
            feed_id=sample_feed_source.id,
            guid="article-1",
            link="https://example.com/article-1",
            title="Corpus Article",
            summary="Summary text",
            content_html="<p>Content</p>",
            pub_date=datetime(2024, 1, 3, 12, 0, tzinfo=UTC),
            author="Test Author",
            categories=["ai", "corpus"],
        )
        db.add_feed_entry(entry)

        payload = db.build_articles_corpus_payload(
            partial_coverage={
                "status": "partial",
                "attempted_feeds": 3,
                "successful_feeds": 2,
                "failed_feeds": 1,
                "failed_feed_ids": ["feed-3"],
                "coverage_ratio": 0.6667,
            }
        )

        metadata = payload["metadata"]
        article = payload["articles"][0]

        assert metadata["source_db"] == f"sqlite:///{temp_db_path}"
        assert metadata["article_count"] == 1
        assert metadata["feed_count"] == 1
        assert metadata["latest_published_at"] == entry.pub_date.isoformat()
        assert metadata["partial_coverage"]["status"] == "partial"
        assert article["id"] == "article-1"
        assert article["feed_title"] == sample_feed_source.title
        assert article["topics"] == sample_feed_source.topics
        assert article["source_type"] == sample_feed_source.source_type.value
        assert article["verified"] is True
        assert article["is_active"] is True
        assert article["published_at"] == entry.pub_date.isoformat()

    def test_export_articles_corpus_dedupes_duplicate_links(self, temp_db_path, sample_feed_source):
        """The exported corpus should collapse duplicate article identities."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        db.add_feed_source(sample_feed_source)

        first_entry = FeedEntry(
            feed_id=sample_feed_source.id,
            guid="guid-1",
            link="https://example.com/article",
            title="First Title",
            pub_date=datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
        )
        duplicate_entry = FeedEntry(
            feed_id=sample_feed_source.id,
            guid="guid-2",
            link="https://example.com/article",
            title="Duplicate Title",
            pub_date=datetime(2024, 1, 2, 12, 0, tzinfo=UTC),
        )

        with db.get_session() as session:
            session.add(first_entry)
            session.add(duplicate_entry)
            session.commit()

        output_path = Path(temp_db_path.parent) / "articles.generated.json"
        payload = db.export_articles_corpus(output_path)

        assert payload["metadata"]["article_count"] == 1
        assert output_path.exists()

        exported = json.loads(output_path.read_text(encoding="utf-8"))
        assert exported["metadata"]["article_count"] == 1
        assert exported["articles"][0]["id"] == "guid-2"
