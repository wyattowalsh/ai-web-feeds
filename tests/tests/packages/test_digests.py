"""Unit tests for ai_web_feeds.digests module"""

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from ai_web_feeds.config import Settings
from ai_web_feeds.digests import DigestManager
from ai_web_feeds.models import EmailDigest, FeedEntry
from ai_web_feeds.storage import DatabaseManager


@pytest.fixture
def mock_db():
    """Mock database manager"""
    db = MagicMock(spec=DatabaseManager)
    db.get_due_digests = MagicMock(return_value=[])
    db.get_user_follows = MagicMock(return_value=[])
    db.get_feed_entries = MagicMock(return_value=[])
    db.update_email_digest = MagicMock()
    return db


@pytest.fixture
def mock_settings():
    """Mock settings"""
    settings = Settings()
    settings.phase3b.smtp_host = "localhost"
    settings.phase3b.smtp_port = 25
    settings.phase3b.smtp_user = ""
    settings.phase3b.smtp_password = ""
    settings.phase3b.smtp_from = "noreply@aiwebfeeds.com"
    settings.phase3b.digest_max_articles = 20
    return settings


@pytest.fixture
def digest_manager(mock_db, mock_settings):
    """Create DigestManager instance"""
    return DigestManager(mock_db, mock_settings)


@pytest.fixture
def sample_digest():
    """Sample email digest"""
    return EmailDigest(
        id=1,
        user_id="user-123",
        email="user@example.com",
        schedule_type="daily",
        schedule_cron="0 9 * * *",
        timezone="UTC",
        last_sent_at=datetime.utcnow() - timedelta(days=1),
        next_send_at=datetime.utcnow() - timedelta(minutes=5),  # Due now
        article_count=0,
        is_active=True,
        created_at=datetime.utcnow(),
    )


@pytest.fixture
def sample_articles():
    """Sample feed entries"""
    base_time = datetime.utcnow()
    articles = []

    for i in range(5):
        article = FeedEntry(
            id=i + 1,
            feed_id="test-feed",
            guid=f"article-{i+1}",
            link=f"http://example.com/article-{i+1}",
            title=f"Article {i+1}",
            summary=f"Summary for article {i+1}",
            author=f"Author {i+1}",
            pub_date=base_time - timedelta(hours=i),
            discovered_at=base_time - timedelta(hours=i),
            categories=["AI", "Tech"],
        )
        articles.append(article)

    return articles


class TestDigestManager:
    """Test DigestManager class"""

    def test_initialization(self, digest_manager, mock_db, mock_settings):
        """Test manager initialization"""
        assert digest_manager.db == mock_db
        assert digest_manager.settings == mock_settings
        assert digest_manager.smtp_host == "localhost"
        assert digest_manager.smtp_port == 25
        assert digest_manager.max_articles == 20

    @pytest.mark.asyncio
    async def test_send_due_digests_empty(self, digest_manager, mock_db):
        """Test sending digests when none are due"""
        mock_db.get_due_digests.return_value = []

        sent_count = await digest_manager.send_due_digests()

        assert sent_count == 0

    @pytest.mark.asyncio
    async def test_send_due_digests_success(
        self, digest_manager, mock_db, sample_digest, sample_articles
    ):
        """Test successful digest sending"""
        mock_db.get_due_digests.return_value = [sample_digest]
        mock_db.get_user_follows.return_value = ["feed-1"]
        mock_db.get_feed_entries.return_value = sample_articles

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            sent_count = await digest_manager.send_due_digests()

        assert sent_count == 1
        assert mock_db.update_email_digest.called
        assert mock_server.send_message.called

    @pytest.mark.asyncio
    async def test_send_due_digests_failure(
        self, digest_manager, mock_db, sample_digest, sample_articles
    ):
        """Test digest sending with SMTP error"""
        mock_db.get_due_digests.return_value = [sample_digest]
        mock_db.get_user_follows.return_value = ["feed-1"]
        mock_db.get_feed_entries.return_value = (
            sample_articles  # Must have articles to trigger SMTP
        )

        with patch("smtplib.SMTP", side_effect=Exception("SMTP Error")):
            # Should not raise, just log error
            sent_count = await digest_manager.send_due_digests()

        # Should return 0 since digest sending failed
        assert sent_count == 0

    @pytest.mark.asyncio
    async def test_send_digest_no_articles(self, digest_manager, mock_db, sample_digest):
        """Test sending digest when no articles are available"""
        mock_db.get_user_follows.return_value = ["feed-1"]
        mock_db.get_feed_entries.return_value = []

        # Should return without sending
        await digest_manager._send_digest(sample_digest)

        # No SMTP call should be made
        # (verified by no exception)

    @pytest.mark.asyncio
    async def test_send_digest_with_articles(
        self, digest_manager, mock_db, sample_digest, sample_articles
    ):
        """Test sending digest with articles"""
        mock_db.get_user_follows.return_value = ["feed-1"]
        mock_db.get_feed_entries.return_value = sample_articles

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await digest_manager._send_digest(sample_digest)

        # Verify SMTP was called
        assert mock_server.send_message.called

        # Verify digest was updated with article count
        assert sample_digest.article_count == len(sample_articles)

    @pytest.mark.asyncio
    async def test_send_digest_multiple_feeds(
        self, digest_manager, mock_db, sample_digest, sample_articles
    ):
        """Test digest with articles from multiple feeds"""
        mock_db.get_user_follows.return_value = ["feed-1", "feed-2", "feed-3"]

        # Return different articles for each feed
        def mock_get_entries(feed_id, limit):
            if feed_id == "feed-1":
                return sample_articles[:2]
            if feed_id == "feed-2":
                return sample_articles[2:4]
            return sample_articles[4:]

        mock_db.get_feed_entries.side_effect = mock_get_entries

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await digest_manager._send_digest(sample_digest)

        # Should have sent all articles
        assert sample_digest.article_count == len(sample_articles)

    @pytest.mark.asyncio
    async def test_send_digest_max_articles_limit(self, digest_manager, mock_db, sample_digest):
        """Test digest respects max articles limit"""
        # Create more articles than max_articles
        many_articles = []
        for i in range(30):  # More than max_articles (20)
            article = FeedEntry(
                id=i + 1,
                feed_id="test-feed",
                guid=f"article-{i+1}",
                link=f"http://example.com/article-{i+1}",
                title=f"Article {i+1}",
                pub_date=datetime.utcnow() - timedelta(hours=i),
                discovered_at=datetime.utcnow() - timedelta(hours=i),
            )
            many_articles.append(article)

        mock_db.get_user_follows.return_value = ["feed-1"]
        mock_db.get_feed_entries.return_value = many_articles

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await digest_manager._send_digest(sample_digest)

        # Should be capped at max_articles
        assert sample_digest.article_count == digest_manager.max_articles

    @pytest.mark.asyncio
    async def test_send_digest_smtp_auth(
        self, digest_manager, mock_db, sample_digest, sample_articles
    ):
        """Test digest sending with SMTP authentication"""
        # Configure SMTP auth
        digest_manager.smtp_user = "user@example.com"
        digest_manager.smtp_password = "password123"

        mock_db.get_user_follows.return_value = ["feed-1"]
        mock_db.get_feed_entries.return_value = sample_articles

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await digest_manager._send_digest(sample_digest)

        # Verify STARTTLS and login were called
        assert mock_server.starttls.called
        assert mock_server.login.called
        assert mock_server.login.call_args[0] == (
            "user@example.com",
            "password123",
        )

    def test_generate_html(self, digest_manager, sample_digest, sample_articles):
        """Test HTML email generation"""
        html = digest_manager._generate_html(sample_digest, sample_articles)

        # Verify HTML structure
        assert "<!DOCTYPE html>" in html
        assert "Your AI Web Feeds Digest" in html
        assert f"{len(sample_articles)} articles" in html

        # Verify all articles are included
        for article in sample_articles:
            assert article.title in html
            assert article.link in html
            if article.summary:
                assert article.summary in html

    def test_generate_html_empty_summary(self, digest_manager, sample_digest):
        """Test HTML generation with articles missing summaries"""
        article = FeedEntry(
            id=1,
            feed_id="test-feed",
            guid="article-1",
            link="http://example.com/article-1",
            title="Article Without Summary",
            summary=None,  # No summary
            pub_date=datetime.utcnow(),
            discovered_at=datetime.utcnow(),
        )

        html = digest_manager._generate_html(sample_digest, [article])

        # Should handle None summary gracefully
        assert "Article Without Summary" in html
        assert html.count("None") == 0  # Should not show "None"

    def test_generate_html_special_characters(self, digest_manager, sample_digest):
        """Test HTML generation with special characters"""
        article = FeedEntry(
            id=1,
            feed_id="test-feed",
            guid="article-1",
            link="http://example.com/article?id=1&ref=2",
            title='Article with <special> & "characters"',
            summary="Summary with 'quotes' and & symbols",
            pub_date=datetime.utcnow(),
            discovered_at=datetime.utcnow(),
        )

        html = digest_manager._generate_html(sample_digest, [article])

        # Should include the content (HTML escaping is browser's job)
        assert "Article with <special>" in html
        assert "&" in html

    def test_calculate_next_send_daily(self, digest_manager):
        """Test next send calculation for daily digest"""
        # Daily at 9:00 AM
        cron_expr = "0 9 * * *"
        from_time = datetime(2024, 1, 15, 8, 0)  # 8:00 AM

        next_send = digest_manager._calculate_next_send(cron_expr, from_time)

        # Should be 9:00 AM same day
        assert next_send.hour == 9
        assert next_send.minute == 0
        assert next_send.day == 15

    def test_calculate_next_send_weekly(self, digest_manager):
        """Test next send calculation for weekly digest"""
        # Monday at 9:00 AM
        cron_expr = "0 9 * * 1"
        from_time = datetime(2024, 1, 15, 10, 0)  # Monday 10:00 AM

        next_send = digest_manager._calculate_next_send(cron_expr, from_time)

        # Should be next Monday at 9:00 AM
        assert next_send > from_time
        assert next_send.weekday() == 0  # Monday

    def test_calculate_next_send_hourly(self, digest_manager):
        """Test next send calculation for hourly digest"""
        # Every hour at minute 0
        cron_expr = "0 * * * *"
        from_time = datetime(2024, 1, 15, 14, 30)

        next_send = digest_manager._calculate_next_send(cron_expr, from_time)

        # Should be 15:00 (next hour)
        assert next_send.hour == 15
        assert next_send.minute == 0

    @pytest.mark.asyncio
    async def test_send_digest_article_ordering(
        self, digest_manager, mock_db, sample_digest, sample_articles
    ):
        """Test articles are ordered by pub_date (most recent first)"""
        # Shuffle articles
        shuffled = sample_articles.copy()
        import random

        random.shuffle(shuffled)

        mock_db.get_user_follows.return_value = ["feed-1"]
        mock_db.get_feed_entries.return_value = shuffled

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            # Patch _generate_html to capture articles order
            original_generate = digest_manager._generate_html
            captured_articles = []

            def capture_articles(digest, articles):
                captured_articles.extend(articles)
                return original_generate(digest, articles)

            with patch.object(digest_manager, "_generate_html", side_effect=capture_articles):
                await digest_manager._send_digest(sample_digest)

        # Verify articles are ordered by pub_date (most recent first)
        assert len(captured_articles) > 0
        for i in range(len(captured_articles) - 1):
            assert captured_articles[i].pub_date >= captured_articles[i + 1].pub_date
