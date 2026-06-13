"""ai_web_feeds.trending -- Trending topic detection

This module implements Z-score trending detection for real-time topic monitoring.
"""

from datetime import UTC, datetime, timedelta

import numpy as np
from loguru import logger
from sqlmodel import select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import ArticleEntry, TrendingTopic
from ai_web_feeds.storage import DatabaseManager


class TrendingDetector:
    """Detect trending topics using Z-score analysis."""

    def __init__(
        self,
        db: DatabaseManager,
        settings: Settings,
    ):
        """Initialize trending detector.

        Args:
            db: Database manager instance
            settings: Application settings
        """
        self.db = db
        self.settings = settings
        self.baseline_days = settings.phase3b.trending_baseline_days
        self.z_threshold = settings.phase3b.trending_z_score_threshold
        self.min_articles = settings.phase3b.trending_min_articles
        self.update_interval_h = settings.phase3b.trending_update_interval_hours

    async def detect_trending_topics(self) -> list[TrendingTopic]:
        """Detect trending topics using Z-score analysis.

        Algorithm:
        1. Calculate baseline: Mean & StdDev of article counts per topic over last N days
        2. Calculate current: Article counts per topic in last 1 hour
        3. Compute Z-score: (current - baseline_mean) / baseline_std
        4. Filter: Z-score > threshold AND current > min_articles
        5. Rank by Z-score

        Returns:
            List of TrendingTopic objects ordered by rank
        """
        now = datetime.now(UTC)
        period_start = now - timedelta(hours=1)
        baseline_start = now - timedelta(days=self.baseline_days)

        # Get topic counts for current period and baseline
        current_counts = await self._get_topic_counts(period_start, now)
        baseline_stats = await self._get_baseline_stats(baseline_start, now)

        trending_topics = []
        rank = 1

        for topic_id, current_count in current_counts.items():
            if current_count < self.min_articles:
                continue

            baseline = baseline_stats.get(topic_id)
            if not baseline:
                # No baseline data, skip
                continue

            baseline_mean, baseline_std = baseline
            if baseline_std == 0:
                # No variance, skip
                continue

            # Calculate Z-score
            z_score = (current_count - baseline_mean) / baseline_std

            if z_score >= self.z_threshold:
                # Get representative articles
                article_ids = await self._get_representative_articles(
                    topic_id, period_start, now, limit=3
                )

                trending_topic = TrendingTopic(
                    topic_id=topic_id,
                    period_start=period_start,
                    period_end=now,
                    article_count=current_count,
                    baseline_mean=baseline_mean,
                    baseline_std=baseline_std,
                    z_score=z_score,
                    rank=rank,
                    representative_articles=article_ids,
                )
                trending_topics.append(trending_topic)
                rank += 1

        # Sort by Z-score (descending)
        trending_topics.sort(key=lambda t: t.z_score, reverse=True)

        # Update ranks
        for i, topic in enumerate(trending_topics, start=1):
            topic.rank = i

        # Save to database
        if trending_topics:
            self.db.save_trending_topics(trending_topics)
            logger.info(f"Detected {len(trending_topics)} trending topics")

        return trending_topics

    async def _get_topic_counts(self, start: datetime, end: datetime) -> dict[str, int]:
        """Get article counts per topic for a period.

        Args:
            start: Period start
            end: Period end

        Returns:
            Dict mapping topic_id -> article_count
        """
        with self.db.get_session() as session:
            statement = select(ArticleEntry).where(
                ArticleEntry.discovered_at >= start,
                ArticleEntry.discovered_at < end,
            )
            entries = session.exec(statement).all()

            topic_counts: dict[str, int] = {}
            for entry in entries:
                for topic in entry.topics:
                    topic_counts[topic] = topic_counts.get(topic, 0) + 1

            return topic_counts

    async def _get_baseline_stats(
        self, start: datetime, end: datetime
    ) -> dict[str, tuple[float, float]]:
        """Calculate baseline mean and std dev per topic.

        Args:
            start: Baseline start
            end: Baseline end

        Returns:
            Dict mapping topic_id -> (mean, std_dev)
        """
        # Group articles into rolling 24-hour baseline buckets relative to the
        # end of the window instead of by calendar day. This keeps the baseline
        # stable even when the current time is mid-day.
        with self.db.get_session() as session:
            statement = select(ArticleEntry).where(
                ArticleEntry.discovered_at >= start,
                ArticleEntry.discovered_at < end,
            )
            entries = session.exec(statement).all()

            # Group by topic and rolling day bucket
            bucketed_counts: dict[str, dict[int, int]] = {}
            for entry in entries:
                bucket_index = int((end - entry.discovered_at).total_seconds() // 86400)
                for topic in entry.topics:
                    topic_buckets = bucketed_counts.setdefault(topic, {})
                    topic_buckets[bucket_index] = topic_buckets.get(bucket_index, 0) + 1

            # Calculate mean and std dev per topic
            baseline_stats = {}
            for topic, counts_by_bucket in bucketed_counts.items():
                counts = [count for _, count in sorted(counts_by_bucket.items())]
                if len(counts) >= 2:  # Need at least 2 days for std dev
                    mean = float(np.mean(counts))
                    std_dev = float(np.std(counts))
                    baseline_stats[topic] = (mean, std_dev)

            return baseline_stats

    async def _get_representative_articles(
        self, topic_id: str, start: datetime, end: datetime, limit: int = 3
    ) -> list[int]:
        """Get top N article IDs for a topic.

        Args:
            topic_id: TopicNode ID
            start: Period start
            end: Period end
            limit: Max articles to return

        Returns:
            List of article IDs
        """
        with self.db.get_session() as session:
            statement = (
                select(ArticleEntry.id)
                .where(
                    ArticleEntry.discovered_at >= start,
                    ArticleEntry.discovered_at < end,
                )
                .order_by(ArticleEntry.pub_date.desc())
                .limit(limit)
            )
            entries = session.exec(statement).all()

            article_ids = []
            for entry_id in entries:
                entry = session.get(ArticleEntry, entry_id)
                if entry and topic_id in entry.topics:
                    article_ids.append(entry_id)
                    if len(article_ids) >= limit:
                        break

            return article_ids
