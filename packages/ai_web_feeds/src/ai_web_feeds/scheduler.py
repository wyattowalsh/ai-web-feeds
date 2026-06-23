"""ai_web_feeds.scheduler -- Background job scheduling

This module manages APScheduler for feed polling, trending detection, and digest delivery.
"""

import contextlib
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger

from ai_web_feeds.config import Settings
from ai_web_feeds.digests import DigestManager
from ai_web_feeds.load import load_feeds
from ai_web_feeds.models import NotificationFrequency
from ai_web_feeds.nlp.scheduler import NLPScheduler
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
        self.nlp_scheduler = NLPScheduler(settings)

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

        # Register NLP batch jobs (Phase 5)
        self.nlp_scheduler.register_jobs()
        logger.info("Registered NLP scheduler jobs")

        # Start scheduler
        self.scheduler.start()
        logger.info("Background scheduler started")

    def stop(self) -> None:
        """Stop background scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=True)
            logger.info("Background scheduler stopped")
        # Stop NLP scheduler if running
        with contextlib.suppress(Exception):
            self.nlp_scheduler.shutdown(wait=True)

    async def _poll_all_feeds(self) -> None:
        """Poll all active feeds and create notifications."""
        try:
            # Load the canonical catalog shape used by the CLI and data validators.
            catalog = load_feeds(Path("data/feeds.yaml"))
            feeds = [feed for feed in catalog.get("sources", []) if isinstance(feed, dict)]
            logger.info(f"Polling {len(feeds)} feeds...")

            # Poll each feed
            for feed in feeds:
                curation = feed.get("curation") if isinstance(feed.get("curation"), dict) else {}
                if feed.get("is_active") is False or curation.get("status") == "inactive":
                    continue

                feed_id = feed.get("id")
                feed_url = feed.get("feed") or feed.get("url") or feed.get("site")
                if not isinstance(feed_id, str) or not feed_id:
                    logger.warning("Skipping feed without canonical id")
                    continue
                if not isinstance(feed_url, str) or not feed_url:
                    logger.warning(f"Skipping feed without pollable URL: {feed_id}")
                    continue

                try:
                    job = await self.poller.poll_feed(feed_id, feed_url)

                    # If new articles discovered, send notifications
                    if job.articles_discovered > 0:
                        articles = self.db.get_articles(feed_id, limit=job.articles_discovered)
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

            # Get active user IDs from storage (users with follows)
            active_users = self.db.get_active_user_ids()

            # Send notifications for each trending topic, filtered by user prefs
            for topic in trending_topics[:5]:  # Top 5 trending
                interested_users = self._get_interested_users_for_trending(active_users)
                if interested_users:
                    await self.notifier.notify_trending_topic(topic, interested_users)

            logger.info(f"Trending detection complete: {len(trending_topics)} topics")

        except Exception as e:
            logger.error(f"Trending detection job failed: {e}")

    def _get_interested_users_for_trending(self, user_ids: list[str]) -> list[str]:
        """Filter users by NotificationPreference (global prefs apply to trending).

        Notify users unless they have explicitly set global frequency to OFF.
        Defaults to notifying active users who have not opted out.

        Args:
            user_ids: Candidate active user IDs

        Returns:
            List of user IDs to receive trending notifications
        """
        interested: list[str] = []
        for user_id in user_ids:
            prefs = self.db.get_user_preferences(user_id)
            # Check global prefs (feed_id=None) for OFF
            opted_out = any(
                (p.feed_id is None and p.frequency == NotificationFrequency.OFF) for p in prefs
            )
            if not opted_out:
                interested.append(user_id)
        return interested

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
