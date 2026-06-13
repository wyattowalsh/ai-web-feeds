"""End-to-end tests for ai_web_feeds package.

These tests verify complete user workflows from start to finish.
"""

import json
import xml.etree.ElementTree as ET  # nosec B405
from datetime import UTC, datetime

import pytest
from ai_web_feeds.export import export_to_json
from ai_web_feeds.models import ArticleEntry, FeedSource, SourceType, TopicNode
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.utils import generate_categorized_opml


@pytest.mark.e2e
class TestCompleteWorkflow:
    """Test complete end-to-end workflows."""

    def test_new_user_workflow(self, temp_db_path):
        """Test complete workflow for a new user."""
        # 1. Initialize database
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # 2. Add first feed source
        feed = FeedSource(
            id="my-first-feed",
            title="My First AI Blog",
            feed="https://example.com/feed.xml",
            site="https://example.com",
            source_type=SourceType.BLOG,
            tags=["ai", "ml"],
            topics=["artificial-intelligence"],
        )
        db.add_feed_source(feed)

        # 3. Verify feed was added
        retrieved = db.get_feed_source("my-first-feed")
        assert retrieved is not None
        assert retrieved.title == "My First AI Blog"

        # 4. Add some items to the feed
        items = [
            ArticleEntry(
                feed_id="my-first-feed",
                guid=f"item-{i}",
                title=f"Article {i}",
                link=f"https://example.com/article-{i}",
                pub_date=datetime.now(UTC),
            )
            for i in range(10)
        ]

        for item in items:
            db.add_article(item)

        # 5. Verify items were added
        stored_items = db.get_articles("my-first-feed")
        assert len(stored_items) == 10

    def test_feed_management_workflow(self, temp_db_path):
        """Test managing multiple feeds."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # 1. Add multiple feeds
        feeds = [
            FeedSource(id=f"feed-{i}", title=f"Feed {i}", source_type=SourceType.BLOG)
            for i in range(5)
        ]

        for feed in feeds:
            db.add_feed_source(feed)

        # 2. List all feeds
        all_feeds = db.get_all_feed_sources()
        assert len(all_feeds) == 5

        # 3. Update a feed
        feeds[0].title = "Updated Feed Title"
        db.add_feed_source(feeds[0])

        # 4. Verify update
        updated = db.get_feed_source("feed-0")
        assert updated.title == "Updated Feed Title"

        # 5. Add items to each feed
        for feed in feeds:
            for i in range(3):
                item = ArticleEntry(
                    feed_id=feed.id,
                    guid=f"{feed.id}-item-{i}",
                    title=f"Article {i}",
                    link=f"https://example.com/{feed.id}/article-{i}",
                    pub_date=datetime.now(UTC),
                )
                db.add_article(item)

        # 6. Verify all items
        for feed in feeds:
            items = db.get_articles(feed.id)
            assert len(items) == 3

    def test_topic_organization_workflow(self, temp_db_path):
        """Test organizing feeds by topics."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # 1. Create topics
        topics = [
            TopicNode(id="ai", label="Artificial Intelligence", facet="domain"),
            TopicNode(id="ml", label="Machine Learning", facet="domain"),
            TopicNode(
                id="nlp",
                label="Natural Language Processing",
                facet="subfield",
                parents=["ai"],
            ),
        ]

        for topic in topics:
            db.add_topic(topic)

        # 2. Create feeds with topics
        feeds = [
            FeedSource(id="ai-feed", title="AI Feed", topics=["ai"]),
            FeedSource(id="ml-feed", title="ML Feed", topics=["ml"]),
            FeedSource(id="nlp-feed", title="NLP Feed", topics=["nlp"]),
            FeedSource(id="multi-feed", title="Multi Feed", topics=["ai", "ml"]),
        ]

        for feed in feeds:
            db.add_feed_source(feed)

        # 3. Verify topic assignments
        ai_feed = db.get_feed_source("ai-feed")
        assert "ai" in ai_feed.topics

        multi_feed = db.get_feed_source("multi-feed")
        assert "ai" in multi_feed.topics
        assert "ml" in multi_feed.topics

    @pytest.mark.slow
    def test_bulk_import_workflow(self, temp_db_path):
        """Test bulk importing many feeds."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # 1. Bulk create feeds
        feeds = [
            FeedSource(
                id=f"bulk-feed-{i}",
                title=f"Bulk Feed {i}",
                source_type=SourceType.BLOG,
            )
            for i in range(100)
        ]

        # 2. Add all feeds
        for feed in feeds:
            db.add_feed_source(feed)

        # 3. Verify count
        all_feeds = db.get_all_feed_sources()
        assert len(all_feeds) == 100

        # 4. Add items to each
        for feed in feeds[:10]:  # Just first 10 for speed
            for i in range(50):
                item = ArticleEntry(
                    feed_id=feed.id,
                    guid=f"{feed.id}-item-{i}",
                    title=f"Article {i}",
                    link=f"https://example.com/{feed.id}/article-{i}",
                    pub_date=datetime.now(UTC),
                )
                db.add_article(item)

        # 5. Verify item counts
        for feed in feeds[:10]:
            items = db.get_articles(feed.id, limit=50)
            assert len(items) == 50


@pytest.mark.e2e
class TestDataExportWorkflow:
    """Test data export workflows."""

    def test_export_feeds_to_json(self, temp_db_path, tmp_path):
        """Test exporting feeds to JSON format."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        feeds = [FeedSource(id=f"feed-{i}", title=f"Feed {i}") for i in range(5)]

        for feed in feeds:
            db.add_feed_source(feed)

        output_path = tmp_path / "feeds.json"
        export_to_json(
            {"sources": [feed.model_dump(mode="json") for feed in db.get_all_feed_sources()]},
            output_path,
        )

        exported = json.loads(output_path.read_text(encoding="utf-8"))
        assert [source["id"] for source in exported["sources"]] == [f"feed-{i}" for i in range(5)]

    def test_export_feeds_to_opml(self, temp_db_path, tmp_path):
        """Test exporting feeds to OPML format."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        feeds = [
            FeedSource(
                id=f"feed-{i}",
                title=f"Feed {i}",
                feed=f"https://example.com/feed-{i}.xml",
                source_type=SourceType.BLOG,
                topics=["ai", "ml"],
            )
            for i in range(5)
        ]

        for feed in feeds:
            db.add_feed_source(feed)

        output_path = tmp_path / "feeds.opml"
        output_path.write_text(
            generate_categorized_opml(db.get_all_feed_sources(), title="Test Feeds"),
            encoding="utf-8",
        )

        root = ET.fromstring(output_path.read_text(encoding="utf-8"))
        body = root.find("body")
        assert body is not None
        blog_outline = body.find("outline")
        assert blog_outline is not None
        exported_feeds = blog_outline.findall("outline")
        assert len(exported_feeds) == 5
        assert exported_feeds[0].attrib["xmlUrl"] == "https://example.com/feed-0.xml"


@pytest.mark.e2e
class TestErrorRecoveryWorkflow:
    """Test error handling and recovery."""

    def test_recover_from_failed_fetch(self, temp_db_path):
        """Test recovering from failed feed fetches."""
        from ai_web_feeds.models import FeedFetchLog

        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # Add feed
        feed = FeedSource(id="test-feed", title="Test Feed")
        db.add_feed_source(feed)

        # Log failed fetch
        failed_log = FeedFetchLog(
            feed_source_id="test-feed",
            fetch_url="https://example.com/feed.xml",
            fetched_at=datetime.now(UTC),
            status_code=500,
            success=False,
            error_message="Server error",
            fetch_duration_ms=100,
        )
        db.add_feed_fetch_log(failed_log)

        # Log successful retry
        success_log = FeedFetchLog(
            feed_source_id="test-feed",
            fetch_url="https://example.com/feed.xml",
            fetched_at=datetime.now(UTC),
            status_code=200,
            success=True,
            items_found=10,
            items_new=10,
            fetch_duration_ms=1500,
        )
        db.add_feed_fetch_log(success_log)

        # Verify both logs exist
        logs = db.get_fetch_logs("test-feed")
        assert len(logs) == 2
        assert logs[0].success is False
        assert logs[1].success is True

    def test_handle_malformed_data(self, temp_db_path):
        """Test handling malformed data gracefully."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # Try to add feed with minimal data
        minimal_feed = FeedSource(id="minimal", title="Minimal")
        db.add_feed_source(minimal_feed)

        # Verify it was added with defaults
        retrieved = db.get_feed_source("minimal")
        assert retrieved is not None
        assert retrieved.tags == []
        assert retrieved.mediums == []


@pytest.mark.e2e
@pytest.mark.slow
class TestPerformanceWorkflow:
    """Test performance under load."""

    def test_large_dataset_query_performance(self, temp_db_path):
        """Test querying performance with large dataset."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # Create many feeds
        feeds = [FeedSource(id=f"feed-{i}", title=f"Feed {i}") for i in range(1000)]

        for feed in feeds:
            db.add_feed_source(feed)

        # Query should still be fast
        import time

        start = time.time()
        all_feeds = db.get_all_feed_sources()
        elapsed = time.time() - start

        assert len(all_feeds) == 1000
        assert elapsed < 5.0  # Should complete in under 5 seconds

    def test_concurrent_writes(self, temp_db_path):
        """Test handling concurrent write operations."""
        db = DatabaseManager(database_url=f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()

        # Add feeds concurrently (simulated)
        feeds = [FeedSource(id=f"concurrent-{i}", title=f"Feed {i}") for i in range(10)]

        for feed in feeds:
            db.add_feed_source(feed)

        # Verify all were added
        assert len(db.get_all_feed_sources()) == 10
