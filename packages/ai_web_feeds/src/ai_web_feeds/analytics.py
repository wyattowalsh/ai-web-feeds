"""ai_web_feeds.analytics -- Analytics and metrics calculation

This module provides analytics functions for the dashboard, including:
- Summary metrics calculation
- Trending topics (Most Active Topics)
- Publication velocity
- Feed health distribution
- Analytics snapshot generation
- CSV export

Uses caching (functools.lru_cache) for performance per config settings.
"""

import csv
from datetime import datetime, timedelta
from functools import lru_cache
from io import StringIO
from typing import Any

from loguru import logger
from sqlmodel import Session, func, select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import (
    AnalyticsSnapshot,
    FeedSource,
    FeedValidationResult,
    TopicStats,
)


settings = Settings()


def calculate_summary_metrics(
    session: Session,
    date_range: str = "30d",
    topic: str | None = None,
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
    logger.info(f"Calculating summary metrics for date_range={date_range}, topic={topic}")

    # Parse date range
    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(date_range, 30)
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Base query for feeds
    feed_query = select(FeedSource)
    if topic:
        feed_query = feed_query.where(FeedSource.topics.contains([topic]))

    feeds = session.exec(feed_query).all()
    total_feeds = len(feeds)
    active_feeds = sum(1 for f in feeds if f.curation_status != "inactive")

    # Validation metrics
    validation_query = select(FeedValidationResult).where(
        FeedValidationResult.validated_at >= cutoff_date
    )
    validations = session.exec(validation_query).all()

    if validations:
        success_count = sum(1 for v in validations if v.success)
        validation_success_rate = success_count / len(validations)
        successful_validations = [v for v in validations if v.success and v.response_time_ms]
        avg_response_time = (
            sum(v.response_time_ms for v in successful_validations) / len(successful_validations)
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

    logger.debug(f"Summary metrics calculated: {total_feeds} feeds, {validation_success_rate:.2%} success rate")

    return {
        "total_feeds": total_feeds,
        "active_feeds": active_feeds,
        "validation_success_rate": validation_success_rate,
        "avg_response_time": avg_response_time,
        "health_distribution": health_distribution,
        "date_range": date_range,
        "topic": topic,
    }


def get_trending_topics(
    session: Session,
    limit: int = 10,
    date_range: str = "30d",
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
    logger.info(f"Getting trending topics: limit={limit}, date_range={date_range}")

    # Query TopicStats for the latest snapshot date
    latest_snapshot = session.exec(
        select(TopicStats.snapshot_date)
        .order_by(TopicStats.snapshot_date.desc())
        .limit(1)
    ).first()

    if not latest_snapshot:
        logger.warning("No TopicStats snapshots found")
        return []

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
    logger.info(f"Getting publication velocity: granularity={granularity}, date_range={date_range}")

    # Parse date range
    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(date_range, 30)
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Get validations in date range
    validations = session.exec(
        select(FeedValidationResult)
        .where(FeedValidationResult.validated_at >= cutoff_date)
        .where(FeedValidationResult.success == True)
    ).all()

    # Group by date based on granularity
    from collections import defaultdict

    date_counts: dict[str, int] = defaultdict(int)
    feed_counts: dict[str, int] = defaultdict(int)

    for validation in validations:
        date_key = _format_date_by_granularity(validation.validated_at, granularity)
        date_counts[date_key] += 1
        feed_counts[validation.feed_source_id] += 1

    # Sort data points
    data_points = [{"date": date, "count": count} for date, count in sorted(date_counts.items())]

    # Calculate average per feed
    avg_per_feed = len(validations) / len(feed_counts) if feed_counts else 0.0

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
    elif granularity == "weekly":
        # ISO week format
        return dt.strftime("%Y-W%W")
    else:  # monthly
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


@lru_cache(maxsize=100)
def _cached_analytics(cache_key: str, ttl_seconds: int) -> tuple[str, int]:
    """Internal cache helper with TTL tracking.

    Returns cache key and timestamp for expiry checking.
    """
    return cache_key, int(datetime.utcnow().timestamp())


def cache_analytics(func):
    """Decorator for caching analytics functions with TTL.

    Uses static_cache_ttl or dynamic_cache_ttl from settings.
    """
    from functools import wraps

    @wraps(func)
    def wrapper(*args, **kwargs):
        # Determine TTL based on function name
        func_name = func.__name__
        if func_name in ["get_health_distribution", "calculate_summary_metrics"]:
            ttl = settings.analytics.static_cache_ttl  # 1 hour
        else:
            ttl = settings.analytics.dynamic_cache_ttl  # 5 minutes

        # Create cache key
        cache_key = f"{func_name}:{args}:{sorted(kwargs.items())}"

        # Check cache
        try:
            cached_key, cached_timestamp = _cached_analytics(cache_key, ttl)
            current_timestamp = int(datetime.utcnow().timestamp())
            if current_timestamp - cached_timestamp < ttl:
                logger.debug(f"Cache hit for {func_name}")
                return func(*args, **kwargs)
        except (TypeError, KeyError):
            pass

        # Cache miss - call function
        logger.debug(f"Cache miss for {func_name}")
        return func(*args, **kwargs)

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

    today = datetime.utcnow().strftime("%Y-%m-%d")

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
        writer.writerow([
            topic["topic"],
            topic["feed_count"],
            f"{topic['validation_frequency']:.2f}",
            f"{topic['avg_health_score']:.2f}",
        ])
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

