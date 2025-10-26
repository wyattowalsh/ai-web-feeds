"""Unit tests for ai_web_feeds.notifications module"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from ai_web_feeds.config import Settings
from ai_web_feeds.models import FeedEntry, Notification, NotificationType, TrendingTopic
from ai_web_feeds.notifications import NotificationManager
from ai_web_feeds.storage import DatabaseManager


@pytest.fixture
def mock_db():
    """Mock database manager"""
    db = MagicMock(spec=DatabaseManager)
    db.get_feed_followers = MagicMock(return_value=["user-1", "user-2"])
    db.create_notification = MagicMock()
    return db


@pytest.fixture
def mock_settings():
    """Mock settings"""
    settings = Settings()
    settings.phase3b.notification_bundle_threshold = 3
    settings.phase3b.notification_bundle_window_seconds = 300
    return settings


@pytest.fixture
def notifier(mock_db, mock_settings):
    """Create NotificationManager instance"""
    return NotificationManager(mock_db, mock_settings)


@pytest.fixture
def sample_articles():
    """Sample feed entries"""
    return [
        FeedEntry(
            id=i,
            feed_id="test-feed",
            guid=f"article-{i}",
            link=f"http://example.com/article-{i}",
            title=f"Article {i}",
            summary=f"Summary {i}",
            pub_date=datetime.utcnow(),
        )
        for i in range(1, 6)
    ]


class TestNotificationManager:
    """Test NotificationManager class"""

    @pytest.mark.asyncio
    async def test_notify_new_articles_bundled(self, notifier, mock_db, sample_articles):
        """Test bundled notifications when threshold exceeded"""
        # 5 articles > threshold of 3, should bundle
        await notifier.notify_new_articles("test-feed", sample_articles)

        # Should create 2 notifications (one per follower), bundled
        assert mock_db.create_notification.call_count == 2

        # Check notification content
        notification = mock_db.create_notification.call_args_list[0][0][0]
        assert notification.type == NotificationType.FEED_UPDATED
        assert "5 new articles" in notification.title
        assert notification.metadata["article_count"] == 5
        assert len(notification.metadata["article_ids"]) == 5

    @pytest.mark.asyncio
    async def test_notify_new_articles_individual(self, notifier, mock_db, sample_articles):
        """Test individual notifications when below threshold"""
        # 2 articles < threshold of 3, should send individually
        await notifier.notify_new_articles("test-feed", sample_articles[:2])

        # Should create 4 notifications (2 articles × 2 followers)
        assert mock_db.create_notification.call_count == 4

        # Check notification content
        notification = mock_db.create_notification.call_args_list[0][0][0]
        assert notification.type == NotificationType.NEW_ARTICLE
        assert notification.title == "Article 1"
        assert notification.metadata["article_id"] == 1

    @pytest.mark.asyncio
    async def test_notify_new_articles_no_followers(self, notifier, mock_db, sample_articles):
        """Test notification when no followers"""
        mock_db.get_feed_followers.return_value = []

        await notifier.notify_new_articles("test-feed", sample_articles)

        # Should not create any notifications
        assert not mock_db.create_notification.called

    @pytest.mark.asyncio
    async def test_notify_new_articles_empty_list(self, notifier, mock_db):
        """Test notification with empty article list"""
        await notifier.notify_new_articles("test-feed", [])

        # Should not create any notifications
        assert not mock_db.create_notification.called

    @pytest.mark.asyncio
    async def test_notify_trending_topic(self, notifier, mock_db):
        """Test trending topic notifications"""
        topic = TrendingTopic(
            id=1,
            topic_id="artificial-intelligence",
            period_start=datetime.utcnow(),
            period_end=datetime.utcnow(),
            article_count=50,
            baseline_mean=10.0,
            baseline_std=2.0,
            z_score=2.5,
            rank=1,
            representative_articles=[1, 2, 3],
        )

        user_ids = ["user-1", "user-2", "user-3"]

        await notifier.notify_trending_topic(topic, user_ids)

        # Should create 3 notifications (one per user)
        assert mock_db.create_notification.call_count == 3

        # Check notification content
        notification = mock_db.create_notification.call_args_list[0][0][0]
        assert notification.type == NotificationType.TRENDING_TOPIC
        assert "Trending" in notification.title
        assert "artificial-intelligence" in notification.title
        assert notification.metadata["topic_id"] == "artificial-intelligence"
        assert notification.metadata["z_score"] == 2.5

    @pytest.mark.asyncio
    async def test_broadcast_notification(self, notifier):
        """Test WebSocket broadcast (placeholder)"""
        notification = Notification(
            id=1,
            user_id="user-1",
            type=NotificationType.NEW_ARTICLE,
            title="Test",
            message="Test message",
            created_at=datetime.utcnow(),
        )

        # Should not raise exception (currently just logs)
        await notifier._broadcast_notification(notification)

    def test_cleanup_old_notifications(self, notifier, mock_settings):
        """Test notification cleanup"""
        result = notifier.cleanup_old_notifications()

        # Currently returns 0 (placeholder)
        assert result == 0

