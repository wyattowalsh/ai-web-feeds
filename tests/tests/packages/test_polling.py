"""Unit tests for ai_web_feeds.polling module"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from ai_web_feeds.config import Settings
from ai_web_feeds.models import ArticleEntry, FeedPollJob, FeedSource, PollStatus
from ai_web_feeds.polling import FeedPoller
from ai_web_feeds.storage import DatabaseManager


@pytest.fixture
def mock_db():
    """Mock database manager"""
    db = MagicMock(spec=DatabaseManager)
    now = datetime.now(UTC)
    db.create_poll_job = MagicMock(
        return_value=FeedPollJob(
            id=1,
            feed_id="test-feed",
            scheduled_at=now,
            started_at=now,
            status=PollStatus.RUNNING,
        )
    )
    db.update_poll_job = MagicMock()
    db.add_article = MagicMock()
    db.get_article_by_identity = MagicMock(return_value=None)
    db.get_all_feed_sources = MagicMock(return_value=[])
    return db


@pytest.fixture
def mock_settings():
    """Mock settings"""
    settings = Settings()
    settings.phase3b.feed_poll_timeout = 30
    settings.phase3b.feed_poll_max_concurrent = 10
    return settings


@pytest.fixture
def poller(mock_db, mock_settings):
    """Create FeedPoller instance"""
    return FeedPoller(mock_db, mock_settings)


class TestFeedPoller:
    """Test FeedPoller class"""

    @pytest.mark.asyncio
    async def test_fetch_feed_success(self, poller):
        """Test successful feed fetching"""
        mock_response = MagicMock()
        mock_response.text = """<?xml version="1.0"?>
        <rss version="2.0">
            <channel>
                <title>Test Feed</title>
                <item>
                    <title>Test Article</title>
                    <link>http://example.com/article</link>
                    <guid>article-1</guid>
                    <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
                </item>
            </channel>
        </rss>"""
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            result = await poller.fetch_feed("http://example.com/feed.xml")

            assert result is not None
            assert len(result.entries) > 0
            assert result.entries[0].title == "Test Article"

    @pytest.mark.asyncio
    async def test_fetch_feed_http_error(self, poller):
        """Test feed fetching with HTTP error"""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock(side_effect=Exception("HTTP 404"))

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(Exception, match="HTTP 404"):
                await poller.fetch_feed("http://example.com/feed.xml")

    @pytest.mark.asyncio
    async def test_poll_feed_success(self, poller, mock_db):
        """Test successful feed polling"""
        mock_feed = MagicMock()
        mock_feed.entries = [
            {
                "id": "article-1",
                "link": "http://example.com/article",
                "title": "Test Article",
                "summary": "Test summary",
                "published": "Mon, 01 Jan 2024 12:00:00 GMT",
                "author": "Test Author",
                "tags": [{"term": "AI"}],
            }
        ]

        with patch.object(poller, "fetch_feed", return_value=mock_feed):
            with patch.object(poller, "_is_new_entry", return_value=True):
                job = await poller.poll_feed("test-feed", "http://example.com/feed.xml")

                assert job.status == PollStatus.SUCCESS
                assert job.articles_discovered == 1
                assert mock_db.add_article.called

    @pytest.mark.asyncio
    async def test_poll_feed_failure(self, poller, mock_db):
        """Test feed polling with error"""
        with patch.object(poller, "fetch_feed", side_effect=Exception("Network error")):
            with pytest.raises(Exception, match="Network error"):
                await poller.poll_feed("test-feed", "http://example.com/feed.xml")

            # Verify job was marked as failed
            assert mock_db.update_poll_job.called
            job = mock_db.update_poll_job.call_args[0][0]
            assert job.status == PollStatus.FAILURE
            assert "Network error" in job.error_message

    def test_parse_entry(self, poller):
        """Test entry parsing"""
        entry_data = {
            "id": "article-1",
            "link": "http://example.com/article",
            "title": "Test Article",
            "summary": "Test summary",
            "published": "Mon, 01 Jan 2024 12:00:00 GMT",
            "author": "Test Author",
            "tags": [{"term": "AI"}, {"term": "ML"}],
            "content": [{"value": "<p>Test content</p>"}],
        }

        entry = poller._parse_entry(entry_data, "test-feed")

        assert isinstance(entry, ArticleEntry)
        assert entry.feed_id == "test-feed"
        assert entry.guid == "article-1"
        assert entry.link == "http://example.com/article"
        assert entry.title == "Test Article"
        assert entry.summary == "Test summary"
        assert entry.author == "Test Author"
        assert entry.raw_categories == ["AI", "ML"]
        assert entry.content_html == "<p>Test content</p>"

    def test_parse_entry_minimal(self, poller):
        """Test entry parsing with minimal data"""
        entry_data = {
            "link": "http://example.com/article",
        }

        entry = poller._parse_entry(entry_data, "test-feed")

        assert entry.guid == "http://example.com/article"
        assert entry.title == "Untitled"
        assert entry.summary is None
        assert entry.author is None
        assert entry.raw_categories == []

    def test_parse_date_valid(self, poller):
        """Test date parsing with valid date"""
        date_str = "Mon, 01 Jan 2024 12:00:00 GMT"
        result = poller._parse_date(date_str)

        assert isinstance(result, datetime)
        assert result.tzinfo is not None

    def test_parse_date_invalid(self, poller):
        """Test date parsing with invalid date falls back to now"""
        result = poller._parse_date("invalid-date")

        assert isinstance(result, datetime)
        assert result.tzinfo is not None
        # Should be close to current time (within 1 second)
        assert (datetime.now(UTC) - result).total_seconds() < 1

    def test_parse_date_none(self, poller):
        """Test date parsing with None falls back to now"""
        result = poller._parse_date(None)

        assert isinstance(result, datetime)
        assert result.tzinfo is not None

    @pytest.mark.asyncio
    async def test_is_new_entry_queries_existing_guid(self, poller, mock_db):
        """Test GUID lookup skips entries already present in storage."""
        mock_db.get_article_by_identity.return_value = object()

        assert (
            await poller._is_new_entry(
                "article-1",
                "https://example.com/article",
                "test-feed",
            )
            is False
        )
        mock_db.get_article_by_identity.assert_called_once_with(
            "article-1",
            "https://example.com/article",
            "test-feed",
        )

    @pytest.mark.asyncio
    async def test_is_new_entry_rejects_missing_guid(self, poller):
        """Test entries without a stable identifier are not treated as new."""
        assert await poller._is_new_entry(None) is False

    @pytest.mark.asyncio
    async def test_is_new_entry_uses_link_identity_without_guid(self, poller, mock_db):
        """Test link identity is used when GUID is absent."""
        mock_db.get_article_by_identity.return_value = object()

        assert await poller._is_new_entry(None, "https://example.com/article", "test-feed") is False
        mock_db.get_article_by_identity.assert_called_once_with(
            None,
            "https://example.com/article",
            "test-feed",
        )

    @pytest.mark.asyncio
    async def test_refresh_corpus_returns_partial_coverage_summary(self, poller, mock_db):
        """Corpus refresh summaries should report partial failures truthfully."""
        feed_sources = [
            FeedSource(id="feed-a", title="Feed A", feed="https://example.com/a.xml"),
            FeedSource(id="feed-b", title="Feed B", feed="https://example.com/b.xml"),
        ]
        mock_db.get_all_feed_sources.return_value = feed_sources

        success_job = FeedPollJob(
            id=2,
            feed_id="feed-a",
            scheduled_at=datetime.now(UTC),
            started_at=datetime.now(UTC),
            status=PollStatus.SUCCESS,
            articles_discovered=3,
        )

        with patch.object(poller, "poll_feed", side_effect=[success_job, Exception("boom")]):
            summary = await poller.refresh_corpus()

        assert summary["attempted_feeds"] == 2
        assert summary["successful_feeds"] == 1
        assert summary["failed_feeds"] == 1
        assert summary["failed_feed_ids"] == ["feed-b"]
        assert summary["status"] == "partial"
        assert summary["partial_coverage"]["status"] == "partial"
        assert summary["partial_coverage"]["coverage_ratio"] == 0.5
