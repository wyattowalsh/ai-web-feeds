"""ai_web_feeds.polling -- Feed polling and article discovery

This module handles periodic feed polling, article extraction, and notification
triggering for real-time feed monitoring.
"""

from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any

import feedparser
import httpx
from loguru import logger
from sqlmodel import select
from tenacity import retry, stop_after_attempt, wait_exponential

from ai_web_feeds.config import Settings
from ai_web_feeds.models import FeedEntry, FeedPollJob, PollStatus
from ai_web_feeds.storage import DatabaseManager


def _utc_now() -> datetime:
    """Return the current UTC timestamp as a timezone-aware datetime."""
    return datetime.now(UTC)


class FeedPoller:
    """Poll RSS/Atom feeds and discover new articles."""

    def __init__(
        self,
        db: DatabaseManager,
        settings: Settings,
    ):
        """Initialize feed poller.

        Args:
            db: Database manager instance
            settings: Application settings
        """
        self.db = db
        self.settings = settings
        self.poll_timeout = settings.phase3b.feed_poll_timeout
        self.max_concurrent = settings.phase3b.feed_poll_max_concurrent

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def fetch_feed(self, feed_url: str) -> dict[str, Any]:
        """Fetch feed XML/JSON with retry logic.

        Args:
            feed_url: Feed URL to fetch

        Returns:
            Parsed feed dictionary (via feedparser)

        Raises:
            httpx.HTTPError: On HTTP errors after retries
        """
        async with httpx.AsyncClient(timeout=self.poll_timeout) as client:
            response = await client.get(feed_url)
            response.raise_for_status()
            return feedparser.parse(response.text)

    async def poll_feed(self, feed_id: str, feed_url: str) -> FeedPollJob:
        """Poll a single feed and store new articles.

        Args:
            feed_id: Feed ID from feeds.yaml
            feed_url: Feed URL to poll

        Returns:
            FeedPollJob with polling results
        """
        job = FeedPollJob(
            feed_id=feed_id,
            scheduled_at=_utc_now(),
            started_at=_utc_now(),
            status=PollStatus.RUNNING,
        )
        job = self.db.create_poll_job(job)

        try:
            start_ms = _utc_now().timestamp() * 1000
            parsed_feed = await self.fetch_feed(feed_url)
            end_ms = _utc_now().timestamp() * 1000

            articles_count = 0
            for entry in parsed_feed.entries:
                if await self._is_new_entry(entry.get("id") or entry.get("link")):
                    feed_entry = self._parse_entry(entry, feed_id)
                    self.db.add_feed_entry(feed_entry)
                    articles_count += 1

            # Update job success
            job.completed_at = _utc_now()
            job.status = PollStatus.SUCCESS
            job.articles_discovered = articles_count
            job.response_time_ms = int(end_ms - start_ms)
            self.db.update_poll_job(job)

            logger.info(f"Feed poll success: {feed_id} ({articles_count} new articles)")
            return job

        except Exception as e:
            # Update job failure
            job.completed_at = _utc_now()
            job.status = PollStatus.FAILURE
            job.error_message = str(e)
            self.db.update_poll_job(job)

            logger.error(f"Feed poll failed: {feed_id} - {e}")
            raise

    async def _is_new_entry(self, guid: str | None) -> bool:
        """Check if entry GUID is new (not in database).

        Args:
            guid: Article GUID

        Returns:
            True if new entry, False if exists
        """
        if not guid:
            return False

        with self.db.get_session() as session:
            statement = select(FeedEntry.id).where(FeedEntry.guid == guid).limit(1)
            return session.exec(statement).first() is None

    def _parse_entry(self, entry: dict[str, Any], feed_id: str) -> FeedEntry:
        """Parse feedparser entry into FeedEntry model.

        Args:
            entry: Feedparser entry dict
            feed_id: Feed ID

        Returns:
            FeedEntry model instance
        """
        return FeedEntry(
            feed_id=feed_id,
            guid=entry.get("id") or entry.get("link"),
            link=entry.get("link", ""),
            title=entry.get("title", "Untitled"),
            summary=entry.get("summary"),
            content_html=entry.get("content", [{}])[0].get("value")
            if entry.get("content")
            else None,
            pub_date=self._parse_date(entry.get("published") or entry.get("updated")),
            author=entry.get("author"),
            categories=[tag.get("term", "") for tag in entry.get("tags", [])],
        )

    def _parse_date(self, date_str: str | None) -> datetime:
        """Parse date string to datetime.

        Args:
            date_str: Date string from feed

        Returns:
            Parsed datetime or current time if parsing fails
        """
        if not date_str:
            return _utc_now()

        try:
            parsed = parsedate_to_datetime(date_str)
        except (TypeError, ValueError, IndexError):
            try:
                parsed = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except ValueError:
                return _utc_now()

        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)
