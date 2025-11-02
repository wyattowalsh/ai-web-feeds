"""ai_web_feeds.scheduler -- Background job scheduling

This module manages APScheduler for feed polling, trending detection, and digest delivery.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger

from ai_web_feeds.config import Settings
from ai_web_feeds.digests import DigestManager
from ai_web_feeds.load import load_feeds
from ai_web_feeds.notifications import NotificationManager
from ai_web_feeds.polling import FeedPoller
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.trending import TrendingDetector


class SchedulerManager:
    """Manage background jobs with APScheduler."""

    def __init__(
        self,
        db: DatabaseManager,
        settings: Settings,
    ):
        """Initialize scheduler manager.

        Args:
            db: Database manager instance
            settings: Application settings
        """
        self.db = db
        self.settings = settings
        self.scheduler = AsyncIOScheduler()
        self.poller = FeedPoller(db, settings)
        self.notifier = NotificationManager(db, settings)
        self.trending = TrendingDetector(db, settings)
        self.digests = DigestManager(db, settings)

        logger.info("Scheduler manager initialized")

    def start(self) -> None:
        """Start background scheduler with all jobs."""
        # Job 1: Poll all feeds periodically
        poll_interval_min = self.settings.phase3b.feed_poll_interval_min
        self.scheduler.add_job(
            self._poll_all_feeds,
            trigger=IntervalTrigger(minutes=poll_interval_min),
            id="poll_feeds",
            name="Poll all feeds",
            max_instances=1,
            replace_existing=True,
        )
        logger.info(f"Added feed polling job (every {poll_interval_min} min)")

        # Job 2: Detect trending topics hourly
        trending_interval_h = self.settings.phase3b.trending_update_interval_hours
        self.scheduler.add_job(
            self._detect_trending,
            trigger=IntervalTrigger(hours=trending_interval_h),
            id="detect_trending",
            name="Detect trending topics",
            max_instances=1,
            replace_existing=True,
        )
        logger.info(f"Added trending detection job (every {trending_interval_h}h)")

        # Job 3: Send email digests (check every minute for due digests)
        self.scheduler.add_job(
            self._send_digests,
            trigger=CronTrigger(minute="*/1"),  # Every minute
            id="send_digests",
            name="Send email digests",
            max_instances=1,
            replace_existing=True,
        )
        logger.info("Added digest delivery job (check every minute)")

        # Job 4: Cleanup old notifications daily
        self.scheduler.add_job(
            self._cleanup_notifications,
            trigger=CronTrigger(hour=3, minute=0),  # 3:00 AM UTC
            id="cleanup_notifications",
            name="Cleanup old notifications",
            max_instances=1,
            replace_existing=True,
        )
        logger.info("Added notification cleanup job (daily at 3:00 AM UTC)")

        # Start scheduler
        self.scheduler.start()
        logger.info("Background scheduler started")

    def stop(self) -> None:
        """Stop background scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=True)
            logger.info("Background scheduler stopped")

    async def _poll_all_feeds(self) -> None:
        """Poll all active feeds and create notifications."""
        try:
            # Load feeds from YAML
            feeds = load_feeds()
            logger.info(f"Polling {len(feeds)} feeds...")

            # Poll each feed
            for feed in feeds:
                if not feed.get("active", True):
                    continue

                feed_id = feed["id"]
                feed_url = feed["feed"]

                try:
                    job = await self.poller.poll_feed(feed_id, feed_url)

                    # If new articles discovered, send notifications
                    if job.articles_discovered > 0:
                        articles = self.db.get_feed_entries(feed_id, limit=job.articles_discovered)
                        await self.notifier.notify_new_articles(feed_id, articles)

                except Exception as e:
                    logger.error(f"Failed to poll feed {feed_id}: {e}")

            logger.info("Feed polling cycle complete")

        except Exception as e:
            logger.error(f"Feed polling job failed: {e}")

    async def _detect_trending(self) -> None:
        """Detect trending topics and send alerts."""
        try:
            trending_topics = await self.trending.detect_trending_topics()

            # Send notifications for each trending topic
            # TODO: Implement user preference filtering (only notify interested users)
            for topic in trending_topics[:5]:  # Top 5 trending
                # For MVP, notify all users (in production, filter by preferences)
                all_users = []  # TODO: Get all active user IDs
                await self.notifier.notify_trending_topic(topic, all_users)

            logger.info(f"Trending detection complete: {len(trending_topics)} topics")

        except Exception as e:
            logger.error(f"Trending detection job failed: {e}")

    async def _send_digests(self) -> None:
        """Send due email digests."""
        try:
            sent_count = await self.digests.send_due_digests()
            if sent_count > 0:
                logger.info(f"Sent {sent_count} email digests")

        except Exception as e:
            logger.error(f"Digest delivery job failed: {e}")

    async def _cleanup_notifications(self) -> None:
        """Cleanup old notifications."""
        try:
            deleted_count = self.notifier.cleanup_old_notifications()
            logger.info(f"Cleaned up {deleted_count} old notifications")

        except Exception as e:
            logger.error(f"Notification cleanup job failed: {e}")

    def get_job_status(self, job_id: str) -> dict:
        """Get job status.

        Args:
            job_id: Job ID

        Returns:
            Job status dict
        """
        job = self.scheduler.get_job(job_id)
        if not job:
            return {"exists": False}

        return {
            "exists": True,
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "max_instances": job.max_instances,
        }

    def list_jobs(self) -> list[dict]:
        """List all scheduled jobs.

        Returns:
            List of job status dicts
        """
        return [
            {
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            }
            for job in self.scheduler.get_jobs()
        ]
