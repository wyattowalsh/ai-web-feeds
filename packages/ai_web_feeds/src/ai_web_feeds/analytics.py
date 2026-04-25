"""ai_web_feeds.analytics -- Analytics and metrics calculation

This module provides analytics functions for the dashboard, including:
- Summary metrics calculation
- Trending topics (Most Active Topics)
- Publication velocity
- Feed health distribution
- Analytics snapshot generation
- CSV export

Uses caching with TTL for performance per config settings.
"""

import csv
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from io import StringIO
from typing import Any

from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import (
    AnalyticsSnapshot,
    FeedSource,
    FeedValidationResult,
    TopicStats,
)

# Shared settings instance
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get or create shared settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def calculate_summary_metrics(
    session: Session,
    date_range: str = "30d",
    topic: str | None = None,
    date_range_days: int | None = None,
) -> dict[str, Any]:
    """Calculate summary metrics for analytics dashboard.

    Args:
        session: Database session
        date_range: Time range: "7d", "30d", "90d"
        topic: Optional topic filter

    Returns:
        Dictionary with summary metrics:
        - total_feeds: int
        - active_feeds: int
        - validation_success_rate: float
        - avg_response_time: float
        - health_score_distribution: dict
    """
    resolved_date_range, days = resolve_date_range(date_range, date_range_days)
    logger.info(f"Calculating summary metrics for date_range={resolved_date_range}, topic={topic}")

    # Parse date range
    cutoff_date = datetime.now(UTC) - timedelta(days=days)

    # Base query for feeds
    feeds = session.exec(select(FeedSource)).all()
    if topic:
        feeds = [feed for feed in feeds if topic in (feed.topics or [])]
    total_feeds = len(feeds)
    active_feeds = sum(1 for f in feeds if f.curation_status != "inactive")
    verified_feeds = sum(1 for feed in feeds if feed.verified)
    total_topics = len({topic_name for feed in feeds for topic_name in feed.topics or []})

    # Validation metrics
    validation_query = select(FeedValidationResult).where(
        FeedValidationResult.validated_at >= cutoff_date
    )
    validations = session.exec(validation_query).all()

    if validations:
        success_count = sum(1 for validation in validations if validation_succeeded(validation))
        validation_success_rate = success_count / len(validations)
        successful_validations = [
            validation
            for validation in validations
            if validation_succeeded(validation) and validation.response_time_ms is not None
        ]
        avg_response_time = (
            sum(validation.response_time_ms or 0 for validation in successful_validations)
            / len(successful_validations)
            if successful_validations
            else 0.0
        )
    else:
        validation_success_rate = 0.0
        avg_response_time = 0.0

    # Health score distribution
    health_distribution = {"healthy": 0, "moderate": 0, "unhealthy": 0}
    for feed in feeds:
        if feed.quality_score is not None:
            if feed.quality_score >= 0.8:
                health_distribution["healthy"] += 1
            elif feed.quality_score >= 0.5:
                health_distribution["moderate"] += 1
            else:
                health_distribution["unhealthy"] += 1

    logger.debug(
        "Summary metrics calculated: "
        f"{total_feeds} feeds, {validation_success_rate:.2%} success rate"
    )

    return {
        "total_feeds": total_feeds,
        "active_feeds": active_feeds,
        "verified_feeds": verified_feeds,
        "total_topics": total_topics,
        "validation_success_rate": validation_success_rate,
        "avg_response_time": avg_response_time,
        "health_distribution": health_distribution,
        "date_range": resolved_date_range,
        "topic": topic,
    }


def get_trending_topics(
    session: Session,
    limit: int = 10,
    date_range: str = "30d",
    date_range_days: int | None = None,
) -> list[dict[str, Any]]:
    """Get Most Active Topics ranked by validation frequency.

    Topics are ranked by validation frequency (last 30 days) weighted by
    feed health scores as proxy for publication activity.

    Args:
        session: Database session
        limit: Maximum number of topics to return
        date_range: Time range: "7d", "30d", "90d"

    Returns:
        List of topic dictionaries with:
        - topic: str (topic ID)
        - feed_count: int
        - validation_frequency: float
        - avg_health_score: float
    """
    resolved_date_range, days = resolve_date_range(date_range, date_range_days)
    logger.info(f"Getting trending topics: limit={limit}, date_range={resolved_date_range}")

    # Query TopicStats for the latest snapshot date
    latest_snapshot = session.exec(
        select(TopicStats.snapshot_date).order_by(TopicStats.snapshot_date.desc()).limit(1)
    ).first()

    if not latest_snapshot:
        logger.warning("No TopicStats snapshots found, falling back to live aggregation")
        return aggregate_trending_topics(session, days=days, limit=limit)

    # Get top topics by validation frequency
    query = (
        select(TopicStats)
        .where(TopicStats.snapshot_date == latest_snapshot)
        .order_by(TopicStats.validation_frequency.desc())
        .limit(limit)
    )

    topic_stats = session.exec(query).all()

    result = [
        {
            "topic": ts.topic,
            "feed_count": ts.feed_count,
            "validation_count": round(ts.validation_frequency * ts.feed_count),
            "validation_frequency": ts.validation_frequency,
            "avg_health_score": ts.avg_health_score,
        }
        for ts in topic_stats
    ]

    logger.debug(f"Trending topics found: {len(result)}")
    return result


def get_publication_velocity(
    session: Session,
    granularity: str = "daily",
    date_range: str = "30d",
    date_range_days: int | None = None,
) -> dict[str, Any]:
    """Get publication velocity metrics (validation frequency as proxy).

    Args:
        session: Database session
        granularity: "daily", "weekly", or "monthly"
        date_range: Time range: "7d", "30d", "90d"

    Returns:
        Dictionary with:
        - granularity: str
        - data_points: list[dict] with date and count
        - avg_per_feed: float
        - most_active_feed: dict
        - least_active_feed: dict
    """
    resolved_date_range, days = resolve_date_range(date_range, date_range_days)
    logger.info(
        f"Getting publication velocity: granularity={granularity}, date_range={resolved_date_range}"
    )

    # Parse date range
    cutoff_date = datetime.now(UTC) - timedelta(days=days)

    # Get validations in date range
    validations = session.exec(
        select(FeedValidationResult).where(FeedValidationResult.validated_at >= cutoff_date)
    ).all()
    successful_validations = [
        validation for validation in validations if validation_succeeded(validation)
    ]

    # Group by date based on granularity
    date_counts: dict[str, int] = defaultdict(int)
    feed_counts: dict[str, int] = defaultdict(int)

    for validation in successful_validations:
        date_key = _format_date_by_granularity(validation.validated_at, granularity)
        date_counts[date_key] += 1
        feed_counts[validation.feed_source_id] += 1

    # Sort data points
    data_points = [{"date": date, "count": count} for date, count in sorted(date_counts.items())]

    # Calculate average per feed
    avg_per_feed = len(successful_validations) / len(feed_counts) if feed_counts else 0.0

    # Find most/least active feeds
    if feed_counts:
        most_active_feed_id = max(feed_counts, key=feed_counts.get)
        least_active_feed_id = min(feed_counts, key=feed_counts.get)

        most_active_feed = session.get(FeedSource, most_active_feed_id)
        least_active_feed = session.get(FeedSource, least_active_feed_id)

        most_active = {
            "id": most_active_feed_id,
            "title": most_active_feed.title if most_active_feed else "Unknown",
            "count": feed_counts[most_active_feed_id],
        }
        least_active = {
            "id": least_active_feed_id,
            "title": least_active_feed.title if least_active_feed else "Unknown",
            "count": feed_counts[least_active_feed_id],
        }
    else:
        most_active = None
        least_active = None

    logger.debug(f"Publication velocity calculated: {len(data_points)} data points")

    return {
        "granularity": granularity,
        "data_points": data_points,
        "avg_per_feed": avg_per_feed,
        "most_active_feed": most_active,
        "least_active_feed": least_active,
    }


def _format_date_by_granularity(dt: datetime, granularity: str) -> str:
    """Format datetime by granularity."""
    if granularity == "daily":
        return dt.strftime("%Y-%m-%d")
    if granularity == "weekly":
        # ISO week format
        return dt.strftime("%Y-W%W")
    # monthly
    return dt.strftime("%Y-%m")


def get_health_distribution(session: Session) -> dict[str, int]:
    """Get feed health distribution (healthy, moderate, unhealthy).

    Args:
        session: Database session

    Returns:
        Dictionary with counts:
        - healthy: int (quality_score >= 0.8)
        - moderate: int (0.5 <= quality_score < 0.8)
        - unhealthy: int (quality_score < 0.5)
    """
    logger.info("Getting health distribution")

    feeds = session.exec(select(FeedSource)).all()

    health_distribution = {"healthy": 0, "moderate": 0, "unhealthy": 0}
    for feed in feeds:
        if feed.quality_score is not None:
            if feed.quality_score >= 0.8:
                health_distribution["healthy"] += 1
            elif feed.quality_score >= 0.5:
                health_distribution["moderate"] += 1
            else:
                health_distribution["unhealthy"] += 1

    logger.debug(f"Health distribution: {health_distribution}")
    return health_distribution


def calculate_trending_topics(
    session: Session,
    date_range_days: int = 30,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Compatibility wrapper for trending topic calculations."""
    return get_trending_topics(session, limit=limit, date_range_days=date_range_days)


def calculate_validation_velocity(
    session: Session,
    date_range_days: int = 30,
    granularity: str = "daily",
) -> list[dict[str, Any]]:
    """Compatibility wrapper that returns only velocity datapoints."""
    return get_publication_velocity(
        session,
        granularity=granularity,
        date_range_days=date_range_days,
    )["data_points"]


def calculate_health_distribution(
    session: Session,
    date_range_days: int = 30,
) -> dict[str, int]:
    """Compatibility wrapper for validation-derived health distribution."""
    cutoff_date = datetime.now(UTC) - timedelta(days=date_range_days)
    validations = session.exec(
        select(FeedValidationResult).where(FeedValidationResult.validated_at >= cutoff_date)
    ).all()
    validations_by_feed: dict[str, list[FeedValidationResult]] = defaultdict(list)
    for validation in validations:
        validations_by_feed[validation.feed_source_id].append(validation)

    distribution = {"healthy": 0, "moderate": 0, "unhealthy": 0}
    feeds = session.exec(select(FeedSource)).all()
    for feed in feeds:
        feed_validations = validations_by_feed.get(feed.id, [])
        if feed_validations:
            success_rate = sum(
                1 for validation in feed_validations if validation_succeeded(validation)
            ) / len(feed_validations)
            if success_rate >= 0.8:
                distribution["healthy"] += 1
            elif success_rate >= 0.5:
                distribution["moderate"] += 1
            else:
                distribution["unhealthy"] += 1
            continue

        if feed.quality_score is None:
            distribution["moderate"] += 1
        elif feed.quality_score >= 0.8:
            distribution["healthy"] += 1
        elif feed.quality_score >= 0.5:
            distribution["moderate"] += 1
        else:
            distribution["unhealthy"] += 1

    return distribution


def generate_analytics_csv_report(
    session: Session,
    date_range_days: int = 30,
) -> str:
    """Compatibility wrapper for CSV export."""
    return export_analytics_csv(session, date_range=f"{date_range_days}d")


def resolve_date_range(
    date_range: str = "30d",
    date_range_days: int | None = None,
) -> tuple[str, int]:
    """Resolve legacy day-based inputs into the canonical range format."""
    if date_range_days is not None:
        return f"{date_range_days}d", date_range_days

    days_map = {"7d": 7, "30d": 30, "90d": 90}
    return date_range, days_map.get(date_range, 30)


def validation_succeeded(validation: FeedValidationResult) -> bool:
    """Determine whether a validation should count as successful."""
    if validation.is_valid:
        return True
    return validation.is_accessible and validation.format_valid


def aggregate_trending_topics(
    session: Session,
    *,
    days: int,
    limit: int,
) -> list[dict[str, Any]]:
    """Aggregate trending topics directly from feeds and validations."""
    cutoff_date = datetime.now(UTC) - timedelta(days=days)
    validation_counts: dict[str, int] = defaultdict(int)
    for validation in session.exec(
        select(FeedValidationResult).where(FeedValidationResult.validated_at >= cutoff_date)
    ).all():
        validation_counts[validation.feed_source_id] += 1

    topic_stats: dict[str, dict[str, Any]] = {}
    feeds = session.exec(select(FeedSource)).all()
    for feed in feeds:
        feed_topics = feed.topics or []
        if not feed_topics:
            continue

        feed_validation_count = validation_counts.get(feed.id, 0)
        feed_health = (
            feed.quality_score if feed.quality_score is not None else feed.popularity_score or 0.0
        )
        for topic_name in feed_topics:
            stats = topic_stats.setdefault(
                topic_name,
                {
                    "topic": topic_name,
                    "feed_ids": set(),
                    "validation_count": 0,
                    "health_scores": [],
                },
            )
            stats["feed_ids"].add(feed.id)
            stats["validation_count"] += feed_validation_count
            stats["health_scores"].append(feed_health)

    aggregated = []
    for stats in topic_stats.values():
        feed_count = len(stats["feed_ids"])
        validation_count = stats["validation_count"]
        health_scores = stats["health_scores"]
        aggregated.append(
            {
                "topic": stats["topic"],
                "feed_count": feed_count,
                "validation_count": validation_count,
                "validation_frequency": validation_count / feed_count if feed_count else 0.0,
                "avg_health_score": sum(health_scores) / len(health_scores)
                if health_scores
                else 0.0,
            }
        )

    aggregated.sort(
        key=lambda item: (
            item["validation_count"],
            item["feed_count"],
            item["avg_health_score"],
        ),
        reverse=True,
    )
    return aggregated[:limit]


class _ResultCache:
    """Simple result cache with TTL support."""

    def __init__(self):
        self._cache: dict[str, tuple[Any, float]] = {}

    def get(self, key: str, ttl_seconds: int) -> Any | None:
        """Get cached value if not expired."""
        if key not in self._cache:
            return None

        result, timestamp = self._cache[key]
        current_time = datetime.now(UTC).timestamp()
        if current_time - timestamp > ttl_seconds:
            del self._cache[key]
            return None

        return result

    def set(self, key: str, value: Any):
        """Set cached value with current timestamp."""
        current_time = datetime.now(UTC).timestamp()
        self._cache[key] = (value, current_time)


_result_cache = _ResultCache()


def cache_analytics(func):
    """Decorator for caching analytics functions with TTL.

    Uses static_cache_ttl or dynamic_cache_ttl from settings.
    """
    from functools import wraps

    @wraps(func)
    def wrapper(*args, **kwargs):
        settings = get_settings()

        # Determine TTL based on function name
        func_name = func.__name__
        if func_name in ["get_health_distribution", "calculate_summary_metrics"]:
            ttl = settings.analytics.static_cache_ttl  # 1 hour
        else:
            ttl = settings.analytics.dynamic_cache_ttl  # 5 minutes

        # Create cache key from function name and arguments
        cache_key = f"{func_name}:{args}:{sorted(kwargs.items())}"

        # Check cache
        cached_result = _result_cache.get(cache_key, ttl)
        if cached_result is not None:
            logger.debug(f"Cache hit for {func_name}")
            return cached_result

        # Cache miss - call function
        logger.debug(f"Cache miss for {func_name}")
        result = func(*args, **kwargs)
        _result_cache.set(cache_key, result)
        return result

    return wrapper


def generate_analytics_snapshot(session: Session) -> AnalyticsSnapshot:
    """Generate daily analytics snapshot for historical trending.

    Args:
        session: Database session

    Returns:
        AnalyticsSnapshot model

    Creates a snapshot of key metrics for efficient historical analysis
    without real-time aggregation queries.
    """
    logger.info("Generating analytics snapshot")

    today = datetime.now(UTC).strftime("%Y-%m-%d")

    # Calculate metrics
    summary = calculate_summary_metrics(session, date_range="30d")
    trending = get_trending_topics(session, limit=10, date_range="30d")
    health_dist = get_health_distribution(session)

    # Create snapshot
    snapshot = AnalyticsSnapshot(
        snapshot_date=today,
        total_feeds=summary["total_feeds"],
        active_feeds=summary["active_feeds"],
        validation_success_rate=summary["validation_success_rate"],
        avg_response_time=summary["avg_response_time"],
        trending_topics=trending,
        health_distribution=health_dist,
    )

    # Save to database
    session.add(snapshot)
    session.commit()
    session.refresh(snapshot)

    logger.info(f"Analytics snapshot created for {today}")
    return snapshot


def export_analytics_csv(
    session: Session,
    date_range: str = "30d",
) -> str:
    """Export analytics metrics to CSV format.

    Args:
        session: Database session
        date_range: Time range: "7d", "30d", "90d"

    Returns:
        CSV string with analytics data
    """
    logger.info(f"Exporting analytics to CSV: date_range={date_range}")

    # Get metrics
    summary = calculate_summary_metrics(session, date_range=date_range)
    trending = get_trending_topics(session, limit=20, date_range=date_range)
    velocity = get_publication_velocity(session, granularity="daily", date_range=date_range)

    # Create CSV
    output = StringIO()
    writer = csv.writer(output)

    # Summary section
    writer.writerow(["Analytics Summary"])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Date Range", date_range])
    writer.writerow(["Total Feeds", summary["total_feeds"]])
    writer.writerow(["Active Feeds", summary["active_feeds"]])
    writer.writerow(["Validation Success Rate", f"{summary['validation_success_rate']:.2%}"])
    writer.writerow(["Avg Response Time (ms)", f"{summary['avg_response_time']:.2f}"])
    writer.writerow([])

    # Health distribution
    writer.writerow(["Health Distribution"])
    writer.writerow(["Category", "Count"])
    for category, count in summary["health_distribution"].items():
        writer.writerow([category.capitalize(), count])
    writer.writerow([])

    # Trending topics
    writer.writerow(["Most Active Topics"])
    writer.writerow(["Topic", "Feed Count", "Validation Frequency", "Avg Health Score"])
    for topic in trending:
        writer.writerow(
            [
                topic["topic"],
                topic["feed_count"],
                f"{topic['validation_frequency']:.2f}",
                f"{topic['avg_health_score']:.2f}",
            ]
        )
    writer.writerow([])

    # Publication velocity
    writer.writerow(["Publication Velocity"])
    writer.writerow(["Date", "Validation Count"])
    for dp in velocity["data_points"]:
        writer.writerow([dp["date"], dp["count"]])

    csv_content = output.getvalue()
    output.close()

    logger.info(f"CSV export complete: {len(csv_content)} bytes")
    return csv_content
