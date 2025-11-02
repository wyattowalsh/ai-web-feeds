"""Data service for visualization queries with caching and validation.

Implements FR-011 through FR-011g:
- Direct database queries to Phase 002 analytics tables
- 5-minute cache layer with Redis/LRU fallback
- Input validation and sanitization
- Error recovery with exponential backoff
"""

from datetime import datetime, timedelta
from typing import Any, Optional

from loguru import logger
from sqlalchemy import text
from sqlalchemy.exc import DatabaseError, OperationalError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ai_web_feeds.storage import get_session
from ai_web_feeds.visualization.cache import get_cache
from ai_web_feeds.visualization.validators import (
    DateRangeValidator,
    QueryValidator,
    ValidationError,
)


class DataService:
    """Service for querying analytics data with caching and validation.

    Provides access to Phase 002 analytics tables:
    - topic_metrics
    - feed_health
    - validation_logs
    - article_metadata
    """

    def __init__(self):
        """Initialize data service with cache."""
        self.cache = get_cache()
        self.validator = QueryValidator()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=9),
        retry=retry_if_exception_type((OperationalError, DatabaseError)),
    )
    def query_topic_metrics(
        self,
        topic_ids: list[int] | None = None,
        date_range: dict[str, str] | None = None,
        device_id: str = "",
        limit: int = 1000,
    ) -> list[dict[str, Any]]:
        """Query topic metrics with filters.

        Args:
            topic_ids: List of topic IDs to filter (optional)
            date_range: Date range with 'start' and 'end' keys
            device_id: Device identifier for caching
            limit: Maximum results (max 100k)

        Returns:
            List of topic metric records

        Raises:
            ValidationError: If parameters are invalid
        """
        # Validate inputs
        limit = self.validator.validate_result_limit(limit)

        # Parse and validate date range
        if date_range:
            date_validator = DateRangeValidator(
                start=datetime.fromisoformat(date_range["start"]),
                end=datetime.fromisoformat(date_range["end"]),
            )
            date_validator.validate_max_range(max_days=365)
            start_date = date_validator.start
            end_date = date_validator.end
        else:
            # Default to last 30 days
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=30)
            date_range = {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            }

        # Check cache
        filters = {"topic_ids": topic_ids, "limit": limit}
        cached_data = self.cache.get(
            query_type="topic_metrics",
            filters=filters,
            date_range=date_range,
            device_id=device_id,
        )
        if cached_data is not None:
            return cached_data

        # Execute query
        try:
            with get_session() as session:
                query = text(
                    """
                    SELECT
                        tm.topic_id,
                        tm.date,
                        tm.article_count,
                        tm.avg_quality_score,
                        tm.sentiment_score,
                        t.label as topic_label
                    FROM topic_metrics tm
                    JOIN topics t ON tm.topic_id = t.id
                    WHERE tm.date BETWEEN :start_date AND :end_date
                    AND (:topic_ids IS NULL OR tm.topic_id = ANY(:topic_ids))
                    ORDER BY tm.date DESC, tm.topic_id
                    LIMIT :limit
                    """
                )

                result = session.execute(
                    query,
                    {
                        "start_date": start_date,
                        "end_date": end_date,
                        "topic_ids": topic_ids,
                        "limit": limit,
                    },
                )

                data = [dict(row._mapping) for row in result]

                # Convert datetime objects to ISO strings for JSON serialization
                for record in data:
                    if "date" in record and isinstance(record["date"], datetime):
                        record["date"] = record["date"].isoformat()

                # Cache results
                self.cache.set(
                    query_type="topic_metrics",
                    filters=filters,
                    date_range=date_range,
                    device_id=device_id,
                    data=data,
                )

                logger.info(
                    f"Queried {len(data)} topic metric records "
                    f"({start_date.date()} to {end_date.date()})"
                )
                return data

        except OperationalError as e:
            logger.error(f"Database operation error: {e}")
            # Try to return cached data even if expired
            raise
        except DatabaseError as e:
            logger.error(f"Database error: {e}")
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=9),
        retry=retry_if_exception_type((OperationalError, DatabaseError)),
    )
    def query_feed_health(
        self,
        feed_ids: list[str] | None = None,
        date_range: dict[str, str] | None = None,
        device_id: str = "",
        limit: int = 1000,
    ) -> list[dict[str, Any]]:
        """Query feed health metrics.

        Args:
            feed_ids: List of feed IDs to filter
            date_range: Date range with 'start' and 'end' keys
            device_id: Device identifier for caching
            limit: Maximum results

        Returns:
            List of feed health records
        """
        limit = self.validator.validate_result_limit(limit)

        # Parse date range
        if date_range:
            date_validator = DateRangeValidator(
                start=datetime.fromisoformat(date_range["start"]),
                end=datetime.fromisoformat(date_range["end"]),
            )
            start_date = date_validator.start
            end_date = date_validator.end
        else:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=30)
            date_range = {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            }

        # Check cache
        filters = {"feed_ids": feed_ids, "limit": limit}
        cached_data = self.cache.get(
            query_type="feed_health",
            filters=filters,
            date_range=date_range,
            device_id=device_id,
        )
        if cached_data is not None:
            return cached_data

        # Execute query
        try:
            with get_session() as session:
                query = text(
                    """
                    SELECT
                        fh.feed_id,
                        fh.date,
                        fh.status_code,
                        fh.response_time_ms,
                        fh.error_count,
                        fh.success_rate,
                        fs.title as feed_title
                    FROM feed_health fh
                    JOIN sources fs ON fh.feed_id = fs.id
                    WHERE fh.date BETWEEN :start_date AND :end_date
                    AND (:feed_ids IS NULL OR fh.feed_id = ANY(:feed_ids))
                    ORDER BY fh.date DESC, fh.feed_id
                    LIMIT :limit
                    """
                )

                result = session.execute(
                    query,
                    {
                        "start_date": start_date,
                        "end_date": end_date,
                        "feed_ids": feed_ids,
                        "limit": limit,
                    },
                )

                data = [dict(row._mapping) for row in result]

                # Convert datetime objects
                for record in data:
                    if "date" in record and isinstance(record["date"], datetime):
                        record["date"] = record["date"].isoformat()

                # Cache results
                self.cache.set(
                    query_type="feed_health",
                    filters=filters,
                    date_range=date_range,
                    device_id=device_id,
                    data=data,
                )

                logger.info(f"Queried {len(data)} feed health records")
                return data

        except (OperationalError, DatabaseError) as e:
            logger.error(f"Database error querying feed health: {e}")
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=9),
    )
    def get_topic_graph_data(
        self,
        topic_ids: list[int] | None = None,
        device_id: str = "",
    ) -> dict[str, Any]:
        """Get topic graph data for 3D visualization.

        Args:
            topic_ids: Topic IDs to include (None = all)
            device_id: Device identifier for caching

        Returns:
            Graph data with nodes and edges
        """
        # Check cache
        filters = {"topic_ids": topic_ids}
        cached_data = self.cache.get(
            query_type="topic_graph",
            filters=filters,
            date_range={"start": "", "end": ""},  # Not time-dependent
            device_id=device_id,
        )
        if cached_data is not None:
            return cached_data

        try:
            with get_session() as session:
                # Query topics
                topic_query = text(
                    """
                    SELECT
                        t.id,
                        t.label,
                        t.facet,
                        t.description,
                        COUNT(DISTINCT am.article_id) as article_count
                    FROM topics t
                    LEFT JOIN article_metadata am ON t.id = ANY(am.topic_ids)
                    WHERE (:topic_ids IS NULL OR t.id = ANY(:topic_ids))
                    GROUP BY t.id, t.label, t.facet, t.description
                    """
                )

                topics = session.execute(
                    topic_query,
                    {"topic_ids": topic_ids},
                )

                nodes = [
                    {
                        "id": row.id,
                        "label": row.label,
                        "facet": row.facet,
                        "description": row.description,
                        "article_count": row.article_count or 0,
                    }
                    for row in topics
                ]

                # Query relationships (simplified - from topics.yaml in production)
                # This is a placeholder for Phase 002 topic relationship data
                edges = []  # Would be populated from topic_relations table

                graph_data = {
                    "nodes": nodes,
                    "edges": edges,
                }

                # Cache results (long TTL since topics change infrequently)
                self.cache.set(
                    query_type="topic_graph",
                    filters=filters,
                    date_range={"start": "", "end": ""},
                    device_id=device_id,
                    data=graph_data,
                    ttl=3600,  # 1 hour
                )

                logger.info(f"Retrieved graph data: {len(nodes)} nodes")
                return graph_data

        except (OperationalError, DatabaseError) as e:
            logger.error(f"Database error querying topic graph: {e}")
            raise

    def invalidate_cache(
        self,
        query_type: str | None = None,
    ) -> int:
        """Invalidate cached data.

        Args:
            query_type: Specific query type to invalidate (optional)

        Returns:
            Number of cache entries invalidated
        """
        count = self.cache.invalidate(query_type=query_type)
        logger.info(f"Invalidated {count} cache entries")
        return count

    def get_cache_stats(self) -> dict[str, Any]:
        """Get cache statistics.

        Returns:
            Dictionary with cache metrics
        """
        return self.cache.get_stats()
