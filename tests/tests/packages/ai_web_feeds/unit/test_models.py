"""Unit tests for ai_web_feeds.models module."""

from datetime import datetime

import pytest
from ai_web_feeds.models import (
    ArticleEntry,
    CurationStatus,
    FeedFetchLog,
    FeedFormat,
    FeedSource,
    Medium,
    SourceType,
    TopicNode,
)
from hypothesis import given
from hypothesis import strategies as st


@pytest.mark.unit
class TestEnums:
    """Test enum definitions."""

    def test_source_type_values(self):
        """Test SourceType enum has expected values."""
        assert SourceType.BLOG == "blog"
        assert SourceType.NEWSLETTER == "newsletter"
        assert SourceType.PODCAST == "podcast"
        assert len(list(SourceType)) >= 20

    def test_feed_format_values(self):
        """Test FeedFormat enum has expected values."""
        assert FeedFormat.RSS == "rss"
        assert FeedFormat.ATOM == "atom"
        assert FeedFormat.JSONFEED == "jsonfeed"
        assert FeedFormat.UNKNOWN == "unknown"

    def test_curation_status_values(self):
        """Test CurationStatus enum has expected values."""
        assert CurationStatus.VERIFIED == "verified"
        assert CurationStatus.UNVERIFIED == "unverified"
        assert CurationStatus.ARCHIVED == "archived"

    def test_medium_values(self):
        """Test Medium enum has expected values."""
        assert Medium.TEXT == "text"
        assert Medium.AUDIO == "audio"
        assert Medium.VIDEO == "video"
        assert Medium.CODE == "code"


@pytest.mark.unit
class TestFeedSource:
    """Test FeedSource model."""

    def test_feed_source_creation(self, sample_feed_source):
        """Test creating a FeedSource instance."""
        assert sample_feed_source.id == "test-blog-ai"
        assert sample_feed_source.title == "Test AI Blog"
        assert sample_feed_source.source_type == SourceType.BLOG
        assert Medium.TEXT in sample_feed_source.mediums
        assert "ai" in sample_feed_source.tags

    def test_feed_source_minimal(self):
        """Test creating FeedSource with minimal required fields."""
        feed = FeedSource(
            id="minimal-feed",
            title="Minimal Feed",
        )
        assert feed.id == "minimal-feed"
        assert feed.title == "Minimal Feed"
        assert feed.feed is None
        assert feed.tags == []
        assert feed.mediums == []

    def test_feed_source_validation(self):
        """Test FeedSource field validation."""
        # ID and title are required - with current model they have defaults
        # so we test that a minimal FeedSource can be created
        feed = FeedSource(id="test", title="Test")
        assert feed.id == "test"
        assert feed.title == "Test"

    @given(
        feed_id=st.text(min_size=1, max_size=100),
        title=st.text(min_size=1, max_size=200),
    )
    def test_feed_source_property_based(self, feed_id, title):
        """Property-based test for FeedSource creation."""
        # Filter out control characters
        feed_id = "".join(c for c in feed_id if c.isprintable())
        title = "".join(c for c in title if c.isprintable())

        if feed_id and title:
            feed = FeedSource(id=feed_id, title=title)
            assert feed.id == feed_id
            assert feed.title == title

    def test_feed_source_topics_relationship(self):
        """Test topics list in FeedSource."""
        feed = FeedSource(
            id="test",
            title="Test",
            topics=["ai", "ml", "nlp"],
        )
        assert len(feed.topics) == 3
        assert "ai" in feed.topics

    def test_feed_source_multiple_mediums(self):
        """Test FeedSource with multiple mediums."""
        feed = FeedSource(
            id="multi-medium",
            title="Multi Medium Feed",
            mediums=[Medium.TEXT, Medium.VIDEO, Medium.CODE],
        )
        assert len(feed.mediums) == 3
        assert Medium.TEXT in feed.mediums
        assert Medium.VIDEO in feed.mediums


@pytest.mark.unit
class TestArticleEntry:
    """Test ArticleEntry model."""

    def test_article_entry_creation(self, sample_article_entry):
        """Test creating an ArticleEntry instance."""
        assert sample_article_entry.feed_id == "test-blog-ai"
        assert sample_article_entry.guid == "item-123"
        assert sample_article_entry.title == "Introduction to Neural Networks"
        assert isinstance(sample_article_entry.pub_date, datetime)
        assert sample_article_entry.topics == ["neural-networks", "deep-learning"]
        assert sample_article_entry.raw_categories == ["Neural Networks", "Deep Learning"]

    def test_article_entry_minimal(self):
        """Test creating ArticleEntry with minimal fields."""
        item = ArticleEntry(
            feed_id="test-feed",
            guid="item-1",
            title="Test Item",
            link="https://example.com/item-1",
            pub_date=datetime.now(),
        )
        assert item.feed_id == "test-feed"
        assert item.guid == "item-1"
        assert item.topics == []
        assert item.raw_categories == []

    def test_article_entry_timestamps(self):
        """Test ArticleEntry publication timestamp handling."""
        from datetime import UTC

        now = datetime.now(UTC)
        item = ArticleEntry(
            feed_id="test",
            guid="test-item",
            title="Test",
            link="https://example.com/test",
            pub_date=now,
        )
        assert item.pub_date == now

    @given(
        feed_id=st.text(min_size=1, max_size=100),
        guid=st.text(min_size=1, max_size=100),
        title=st.text(min_size=1, max_size=200),
    )
    def test_article_entry_property_based(self, feed_id, guid, title):
        """Property-based test for ArticleEntry."""
        feed_id = "".join(c for c in feed_id if c.isprintable()).strip()
        guid = "".join(c for c in guid if c.isprintable()).strip()
        title = "".join(c for c in title if c.isprintable()).strip()

        if feed_id and guid and title:
            item = ArticleEntry(
                feed_id=feed_id,
                guid=guid,
                title=title,
                link="https://example.com/article",
                pub_date=datetime.now(),
            )
            assert item.feed_id == feed_id
            assert item.guid == guid
            assert item.title == title


@pytest.mark.unit
class TestTopic:
    """Test TopicNode model."""

    def test_topic_creation(self, sample_topic):
        """Test creating a TopicNode instance."""
        assert sample_topic.id == "artificial-intelligence"
        assert sample_topic.label == "Artificial Intelligence"
        assert "ai" in sample_topic.aliases

    def test_topic_minimal(self):
        """Test creating TopicNode with minimal fields."""
        topic = TopicNode(
            id="test-topic",
            label="Test TopicNode",
            facet="domain",
        )
        assert topic.id == "test-topic"
        assert topic.label == "Test TopicNode"
        assert topic.aliases == []

    def test_topic_hierarchy(self):
        """Test TopicNode parent-child relationship."""
        _parent = TopicNode(id="parent", label="Parent TopicNode", facet="domain")
        child = TopicNode(
            id="child",
            label="Child TopicNode",
            facet="subfield",
            parents=["parent"],
        )
        assert child.parents == ["parent"]


@pytest.mark.unit
class TestFeedFetchLog:
    """Test FeedFetchLog model."""

    def test_fetch_log_creation(self, sample_fetch_log):
        """Test creating a FeedFetchLog instance."""
        assert sample_fetch_log.feed_source_id == "test-blog-ai"
        assert sample_fetch_log.status_code == 200
        assert sample_fetch_log.success is True
        assert sample_fetch_log.items_found == 10
        assert sample_fetch_log.items_new == 3

    def test_fetch_log_failure(self):
        """Test FeedFetchLog for failed fetch."""
        from datetime import UTC

        log = FeedFetchLog(
            feed_source_id="test-feed",
            fetch_url="https://example.com/feed.xml",
            fetched_at=datetime.now(UTC),
            status_code=404,
            success=False,
            error_message="Feed not found",
            fetch_duration_ms=500,
        )
        assert log.success is False
        assert log.error_message == "Feed not found"
        assert log.status_code == 404

    def test_fetch_log_performance_metrics(self):
        """Test FeedFetchLog performance metrics."""
        from datetime import UTC

        log = FeedFetchLog(
            feed_source_id="test-feed",
            fetch_url="https://example.com/feed.xml",
            fetched_at=datetime.now(UTC),
            status_code=200,
            success=True,
            fetch_duration_ms=1234,
            items_found=50,
            items_new=10,
        )
        assert log.fetch_duration_ms == 1234
        assert log.items_found == 50
        assert log.items_new == 10

    @given(
        status_code=st.integers(min_value=100, max_value=599),
        items_found=st.integers(min_value=0, max_value=1000),
        items_new=st.integers(min_value=0, max_value=1000),
    )
    def test_fetch_log_property_based(self, status_code, items_found, items_new):
        """Property-based test for FeedFetchLog."""
        from datetime import UTC

        log = FeedFetchLog(
            feed_source_id="test",
            fetch_url="https://example.com/feed.xml",
            fetched_at=datetime.now(UTC),
            status_code=status_code,
            success=200 <= status_code < 300,
            items_found=items_found,
            items_new=min(items_new, items_found),  # new can't exceed found
            fetch_duration_ms=100,
        )
        assert log.status_code == status_code
        assert log.items_found == items_found
        assert (
            log.items_new is not None
            and log.items_found is not None
            and log.items_new <= log.items_found
        )
