"""ai_web_feeds.notifications -- Notification creation and delivery

This module handles notification creation, bundling, and WebSocket broadcasting
for real-time alerts.
"""

from datetime import datetime, timedelta

from loguru import logger

from ai_web_feeds.config import Settings
from ai_web_feeds.models import (
    FeedEntry,
    Notification,
    NotificationType,
    TrendingTopic,
)
from ai_web_feeds.storage import DatabaseManager


class NotificationManager:
    """Manage notification creation and delivery."""

    def __init__(
        self,
        db: DatabaseManager,
        settings: Settings,
    ):
        """Initialize notification manager.

        Args:
            db: Database manager instance
            settings: Application settings
        """
        self.db = db
        self.settings = settings
        self.bundle_threshold = settings.phase3b.notification_bundle_threshold
        self.bundle_window_seconds = settings.phase3b.notification_bundle_window_seconds

    async def notify_new_articles(
        self,
        feed_id: str,
        articles: list[FeedEntry],
    ) -> None:
        """Create notifications for new articles.

        Implements bundling: If >N articles in <M minutes, send 1 bundled notification.

        Args:
            feed_id: Feed ID
            articles: List of new FeedEntry objects
        """
        if not articles:
            return

        # Get users following this feed
        followers = self.db.get_feed_followers(feed_id)
        if not followers:
            logger.debug(f"No followers for feed {feed_id}, skipping notifications")
            return

        # Check if bundling needed
        if len(articles) >= self.bundle_threshold:
            # Send bundled notification
            for user_id in followers:
                notification = Notification(
                    user_id=user_id,
                    type=NotificationType.FEED_UPDATED,
                    title=f"{len(articles)} new articles",
                    message=f"{len(articles)} new articles from {feed_id}",
                    action_url=f"/feeds/{feed_id}",
                    context_data={
                        "feed_id": feed_id,
                        "article_count": len(articles),
                        "article_ids": [a.id for a in articles[:5]],
                    },
                )
                self.db.create_notification(notification)
                await self._broadcast_notification(notification)

        else:
            # Send individual notifications
            for article in articles:
                for user_id in followers:
                    notification = Notification(
                        user_id=user_id,
                        type=NotificationType.NEW_ARTICLE,
                        title=article.title,
                        message=article.summary or article.title,
                        action_url=article.link,
                        context_data={
                            "feed_id": feed_id,
                            "article_id": article.id,
                        },
                    )
                    self.db.create_notification(notification)
                    await self._broadcast_notification(notification)

        logger.info(f"Created notifications for {len(articles)} articles to {len(followers)} users")

    async def notify_trending_topic(
        self,
        topic: TrendingTopic,
        user_ids: list[str],
    ) -> None:
        """Create trending topic notifications.

        Args:
            topic: TrendingTopic instance
            user_ids: List of user IDs to notify
        """
        for user_id in user_ids:
            notification = Notification(
                user_id=user_id,
                type=NotificationType.TRENDING_TOPIC,
                title=f"Trending: {topic.topic_id}",
                message=f"{topic.article_count} articles in the last hour (Z-score: {topic.z_score:.2f})",
                action_url=f"/topics/{topic.topic_id}",
                context_data={
                    "topic_id": topic.topic_id,
                    "z_score": topic.z_score,
                    "article_ids": topic.representative_articles,
                },
            )
            self.db.create_notification(notification)
            await self._broadcast_notification(notification)

        logger.info(
            f"Created trending notifications for topic {topic.topic_id} to {len(user_ids)} users"
        )

    async def _broadcast_notification(self, notification: Notification) -> None:
        """Broadcast notification via WebSocket.

        Args:
            notification: Notification to broadcast
        """
        # TODO: Implement WebSocket broadcasting in websocket_server.py
        # For now, just log
        logger.debug(f"Broadcasting notification {notification.id} to user {notification.user_id}")

    def cleanup_old_notifications(self) -> int:
        """Delete notifications older than retention period.

        Returns:
            Number of deleted notifications
        """
        retention_days = self.settings.phase3b.notification_retention_days
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

        # TODO: Implement bulk delete in storage.py
        # For now, return 0
        logger.info(f"Cleaned up notifications older than {cutoff_date}")
        return 0
