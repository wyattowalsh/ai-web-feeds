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
from tenacity import retry, stop_after_attempt, wait_exponential

from ai_web_feeds.config import Settings
from ai_web_feeds.models import ArticleEntry, CurationStatus, FeedPollJob, FeedSource, PollStatus
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
    ) -> None:
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
                feed_entry = self._parse_entry(entry, feed_id)
                if await self._is_new_entry(feed_entry.guid, feed_entry.link, feed_id):
                    self.db.add_article(feed_entry)
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

    async def refresh_corpus(
        self,
        feed_sources: list[FeedSource] | None = None,
    ) -> dict[str, Any]:
        """Poll all active feeds and return a corpus refresh summary."""
        if feed_sources is None:
            feed_sources = [
                feed
                for feed in self.db.get_all_feed_sources()
                if feed.curation_status not in {CurationStatus.ARCHIVED, CurationStatus.INACTIVE}
            ]

        feed_sources = sorted(feed_sources, key=lambda feed: feed.id)
        summary: dict[str, Any] = {
            "attempted_feeds": len(feed_sources),
            "successful_feeds": 0,
            "failed_feeds": 0,
            "failed_feed_ids": [],
            "articles_discovered": 0,
            "status": "complete",
            "partial_coverage": None,
        }

        for feed_source in feed_sources:
            feed_url = feed_source.feed
            if not feed_url:
                summary["failed_feeds"] += 1
                summary["failed_feed_ids"].append(feed_source.id)
                logger.warning(f"Skipping feed without URL: {feed_source.id}")
                continue

            try:
                job = await self.poll_feed(feed_source.id, feed_url)
            except Exception as exc:
                summary["failed_feeds"] += 1
                summary["failed_feed_ids"].append(feed_source.id)
                logger.warning(f"Feed refresh failed: {feed_source.id} - {exc}")
                continue

            summary["successful_feeds"] += 1
            summary["articles_discovered"] += job.articles_discovered

        if summary["failed_feeds"] > 0:
            summary["status"] = "partial"
            summary["partial_coverage"] = {
                "status": "partial",
                "attempted_feeds": summary["attempted_feeds"],
                "successful_feeds": summary["successful_feeds"],
                "failed_feeds": summary["failed_feeds"],
                "failed_feed_ids": summary["failed_feed_ids"],
                "coverage_ratio": (
                    round(summary["successful_feeds"] / summary["attempted_feeds"], 4)
                    if summary["attempted_feeds"]
                    else 1.0
                ),
            }

        return summary

    async def _is_new_entry(
        self,
        guid: str | None,
        link: str | None = None,
        feed_id: str | None = None,
    ) -> bool:
        """Check if entry identity is new (not in database).

        Args:
            guid: Article GUID
            link: Link identity used when a feed item has no GUID
            feed_id: Feed/source ID used to scope article identity

        Returns:
            True if new entry, False if exists
        """
        if (not guid and not link) or not feed_id:
            return False

        return self.db.get_article_by_identity(guid, link, feed_id) is None

    def _parse_entry(self, entry: dict[str, Any], feed_id: str) -> ArticleEntry:
        """Parse feedparser entry into ArticleEntry model.

        Args:
            entry: Feedparser entry dict
            feed_id: Feed ID

        Returns:
            ArticleEntry model instance
        """
        return ArticleEntry(
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
            topics=[],
            raw_categories=[tag.get("term", "") for tag in entry.get("tags", [])],
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
