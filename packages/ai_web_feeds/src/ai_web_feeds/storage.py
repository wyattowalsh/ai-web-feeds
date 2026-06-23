"""ai_web_feeds.storage -- Database and storage management"""

import hashlib
import json
from contextlib import suppress
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config
from loguru import logger
from sqlalchemy import create_engine, desc
from sqlalchemy.engine import make_url
from sqlmodel import Session, SQLModel, select

from ai_web_feeds.config import DEFAULT_DATABASE_URL
from ai_web_feeds.models import (
    AnalyticsSnapshot,
    ArticleEntry,
    CurationStatus,
    EmailDigest,
    FeedAnalytics,
    FeedEnrichmentData,
    FeedFetchLog,
    FeedPollJob,
    FeedSource,
    FeedValidationResult,
    Notification,
    NotificationPreference,
    SavedSearch,
    TopicNode,
    TopicStats,
    TrendingTopic,
    UserSourceFollow,
)


def upgrade_database_to_head(database_url: str = DEFAULT_DATABASE_URL) -> None:
    """Apply reviewed Alembic migrations to the configured database."""
    url = make_url(database_url)
    if url.drivername.startswith("sqlite") and url.database and url.database != ":memory:":
        Path(url.database).parent.mkdir(parents=True, exist_ok=True)

    packages_dir = Path(__file__).resolve().parents[3]
    config_path = packages_dir / "alembic.ini"
    if not config_path.exists():
        raise FileNotFoundError(f"Alembic config not found: {config_path}")

    alembic_config = Config(str(config_path))
    alembic_config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(alembic_config, "head")
    logger.info("Database migrations applied to head")


class DatabaseManager:
    """Manage SQLModel database connections and operations."""

    def __init__(self, database_url: str = DEFAULT_DATABASE_URL) -> None:
        """Initialize database manager.

        Args:
            database_url: SQLAlchemy database URL
        """
        self.database_url = database_url
        self.engine = create_engine(
            self.database_url,
            echo=False,  # Set to True for SQL debugging
            connect_args={"check_same_thread": False}
            if self.database_url.startswith("sqlite")
            else {},
        )
        logger.info(f"Database initialized: {self.database_url}")

    def create_db_and_tables(self) -> None:
        """Create tables directly for isolated tests and local fixtures."""
        # Ensure the data directory exists for SQLite
        if self.database_url.startswith("sqlite"):
            db_path = self.database_url.replace("sqlite:///", "")
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

        SQLModel.metadata.create_all(self.engine)
        logger.info("Database tables created")

    def get_session(self) -> Session:
        """Get a database session.

        Returns:
            Database session
        """
        return Session(self.engine)

    def close(self) -> None:
        """Dispose pooled database connections owned by this manager."""
        self.engine.dispose()

    def __enter__(self) -> "DatabaseManager":
        """Return this manager for context-managed use."""
        return self

    def __exit__(self, *_exc_info: object) -> None:
        """Dispose pooled connections when leaving a context manager."""
        self.close()

    def __del__(self) -> None:
        """Best-effort cleanup for tests and short-lived CLI commands."""
        with suppress(Exception):
            self.close()

    def add_feed_source(self, feed_source: FeedSource) -> FeedSource:
        """Add or update a feed source.

        Args:
            feed_source: FeedSource to add

        Returns:
            Added/updated FeedSource
        """
        with self.get_session() as session:
            feed_source = session.merge(feed_source)
            session.commit()
            session.refresh(feed_source)
            logger.info(f"Added/updated feed source: {feed_source.id}")
            return feed_source

    def get_feed_source(self, feed_id: str) -> FeedSource | None:
        """Get a feed source by ID.

        Args:
            feed_id: Feed source ID

        Returns:
            FeedSource or None if not found
        """
        with self.get_session() as session:
            statement = select(FeedSource).where(FeedSource.id == feed_id)
            return session.exec(statement).first()

    def get_all_feed_sources(self) -> list[FeedSource]:
        """Get all feed sources.

        Returns:
            List of all FeedSource objects
        """
        with self.get_session() as session:
            statement = select(FeedSource)
            return list(session.exec(statement).all())

    def update_feed_source(self, feed_source: FeedSource) -> FeedSource:
        """Update an existing feed source.

        Args:
            feed_source: FeedSource with updated data

        Returns:
            Updated FeedSource
        """
        return self.add_feed_source(feed_source)  # SQLModel merge handles updates

    def add_feed_fetch_log(self, log: FeedFetchLog) -> FeedFetchLog:
        """Add a feed fetch log entry.

        Args:
            log: FeedFetchLog to add

        Returns:
            Added FeedFetchLog
        """
        with self.get_session() as session:
            session.add(log)
            session.commit()
            session.refresh(log)
            return log

    def get_fetch_logs(self, feed_source_id: str) -> list[FeedFetchLog]:
        """Get fetch logs for a feed source.

        Args:
            feed_source_id: Feed source ID

        Returns:
            List of FeedFetchLog objects
        """
        with self.get_session() as session:
            statement = select(FeedFetchLog).where(FeedFetchLog.feed_source_id == feed_source_id)
            return list(session.exec(statement).all())

    def add_topic(self, topic: TopicNode) -> TopicNode:
        """Add or update a topic.

        Args:
            topic: TopicNode to add

        Returns:
            Added/updated TopicNode
        """
        with self.get_session() as session:
            session.add(topic)
            session.commit()
            session.refresh(topic)
            logger.info(f"Added/updated topic: {topic.id}")
            return topic

    def get_all_topics(self) -> list[TopicNode]:
        """Get all topics.

        Returns:
            List of all TopicNode objects
        """
        with self.get_session() as session:
            statement = select(TopicNode)
            return list(session.exec(statement).all())

    def get_topic(self, topic_id: str) -> TopicNode | None:
        """Get a topic by ID.

        Args:
            topic_id: TopicNode ID

        Returns:
            TopicNode or None if not found
        """
        with self.get_session() as session:
            statement = select(TopicNode).where(TopicNode.id == topic_id)
            return session.exec(statement).first()

    def bulk_insert_feed_sources(self, feed_sources: list[FeedSource]) -> None:
        """Bulk insert feed sources.

        Args:
            feed_sources: List of FeedSource objects to insert
        """
        with self.get_session() as session:
            session.add_all(feed_sources)
            session.commit()
            logger.info(f"Bulk inserted {len(feed_sources)} feed sources")

    def bulk_insert_topics(self, topics: list[TopicNode]) -> None:
        """Bulk insert topics.

        Args:
            topics: List of TopicNode objects to insert
        """
        with self.get_session() as session:
            session.add_all(topics)
            session.commit()
            logger.info(f"Bulk inserted {len(topics)} topics")

    # ===== ENRICHMENT DATA METHODS =====

    def add_enrichment_data(self, enrichment: FeedEnrichmentData) -> FeedEnrichmentData:
        """Add or update feed enrichment data.

        Args:
            enrichment: FeedEnrichmentData to add

        Returns:
            Added/updated FeedEnrichmentData
        """
        with self.get_session() as session:
            session.add(enrichment)
            session.commit()
            session.refresh(enrichment)
            logger.info(f"Added enrichment data for feed: {enrichment.feed_source_id}")
            return enrichment

    def get_enrichment_data(self, feed_source_id: str) -> FeedEnrichmentData | None:
        """Get latest enrichment data for a feed source.

        Args:
            feed_source_id: Feed source ID

        Returns:
            Latest FeedEnrichmentData or None
        """
        with self.get_session() as session:
            statement = (
                select(FeedEnrichmentData)
                .where(FeedEnrichmentData.feed_source_id == feed_source_id)
                .order_by(FeedEnrichmentData.enriched_at.desc())
            )
            return session.exec(statement).first()

    def get_all_enrichment_data(self, feed_source_id: str) -> list[FeedEnrichmentData]:
        """Get all enrichment data for a feed source.

        Args:
            feed_source_id: Feed source ID

        Returns:
            List of FeedEnrichmentData (newest first)
        """
        with self.get_session() as session:
            statement = (
                select(FeedEnrichmentData)
                .where(FeedEnrichmentData.feed_source_id == feed_source_id)
                .order_by(FeedEnrichmentData.enriched_at.desc())
            )
            return list(session.exec(statement).all())

    def delete_old_enrichments(self, feed_source_id: str, keep_count: int = 5) -> int:
        """Delete old enrichment data, keeping only recent entries.

        Args:
            feed_source_id: Feed source ID
            keep_count: Number of recent enrichments to keep

        Returns:
            Number of deleted entries
        """
        with self.get_session() as session:
            # Get IDs to keep
            keep_statement = (
                select(FeedEnrichmentData.id)
                .where(FeedEnrichmentData.feed_source_id == feed_source_id)
                .order_by(FeedEnrichmentData.enriched_at.desc())
                .limit(keep_count)
            )
            keep_ids = list(session.exec(keep_statement).all())

            # Delete old ones
            delete_statement = select(FeedEnrichmentData).where(
                FeedEnrichmentData.feed_source_id == feed_source_id,
                FeedEnrichmentData.id.not_in(keep_ids),
            )
            old_enrichments = list(session.exec(delete_statement).all())

            for enrichment in old_enrichments:
                session.delete(enrichment)

            session.commit()
            logger.info(f"Deleted {len(old_enrichments)} old enrichments for {feed_source_id}")
            return len(old_enrichments)

    # ===== VALIDATION RESULT METHODS =====

    def add_validation_result(self, validation: FeedValidationResult) -> FeedValidationResult:
        """Add a feed validation result.

        Args:
            validation: FeedValidationResult to add

        Returns:
            Added FeedValidationResult
        """
        with self.get_session() as session:
            session.add(validation)
            session.commit()
            session.refresh(validation)
            logger.info(f"Added validation result for feed: {validation.feed_source_id}")
            return validation

    def get_validation_result(self, feed_source_id: str) -> FeedValidationResult | None:
        """Get latest validation result for a feed source.

        Args:
            feed_source_id: Feed source ID

        Returns:
            Latest FeedValidationResult or None
        """
        with self.get_session() as session:
            statement = (
                select(FeedValidationResult)
                .where(FeedValidationResult.feed_source_id == feed_source_id)
                .order_by(FeedValidationResult.validated_at.desc())
            )
            return session.exec(statement).first()

    def get_all_validation_results(self, feed_source_id: str) -> list[FeedValidationResult]:
        """Get all validation results for a feed source.

        Args:
            feed_source_id: Feed source ID

        Returns:
            List of FeedValidationResult (newest first)
        """
        with self.get_session() as session:
            statement = (
                select(FeedValidationResult)
                .where(FeedValidationResult.feed_source_id == feed_source_id)
                .order_by(FeedValidationResult.validated_at.desc())
            )
            return list(session.exec(statement).all())

    def get_failed_validations(self) -> list[FeedValidationResult]:
        """Get all failed validation results (latest per feed).

        Returns:
            List of FeedValidationResult for failed feeds
        """
        with self.get_session() as session:
            # Get all feed IDs
            feed_ids = session.exec(select(FeedSource.id)).all()

            failed_validations = []
            for feed_id in feed_ids:
                statement = (
                    select(FeedValidationResult)
                    .where(FeedValidationResult.feed_source_id == feed_id)
                    .order_by(FeedValidationResult.validated_at.desc())
                    .limit(1)
                )
                result = session.exec(statement).first()
                if result and not result.is_valid:
                    failed_validations.append(result)

            return failed_validations

    def get_feed_validation_history(
        self,
        feed_source_id: str,
        limit: int = 10,
    ) -> list[FeedValidationResult]:
        """Get the most recent validation history for a single feed source.

        Args:
            feed_source_id: Feed source ID
            limit: Maximum number of results to return (most recent first)

        Returns:
            List of FeedValidationResult (newest first)
        """
        with self.get_session() as session:
            statement = (
                select(FeedValidationResult)
                .where(FeedValidationResult.feed_source_id == feed_source_id)
                .order_by(FeedValidationResult.validated_at.desc())
                .limit(limit)
            )
            return list(session.exec(statement).all())

    # ===== ANALYTICS METHODS =====

    def add_analytics(self, analytics: FeedAnalytics) -> FeedAnalytics:
        """Add feed analytics data.

        Args:
            analytics: FeedAnalytics to add

        Returns:
            Added FeedAnalytics
        """
        with self.get_session() as session:
            session.add(analytics)
            session.commit()
            session.refresh(analytics)
            logger.info(
                f"Added analytics for feed: {analytics.feed_source_id} ({analytics.period_type})"
            )
            return analytics

    def get_analytics(
        self,
        feed_source_id: str,
        period_type: str | None = None,
        limit: int = 10,
    ) -> list[FeedAnalytics]:
        """Get analytics for a feed source.

        Args:
            feed_source_id: Feed source ID
            period_type: Filter by period type (daily, weekly, monthly, yearly)
            limit: Maximum number of records to return

        Returns:
            List of FeedAnalytics (newest first)
        """
        with self.get_session() as session:
            statement = select(FeedAnalytics).where(FeedAnalytics.feed_source_id == feed_source_id)

            if period_type:
                statement = statement.where(FeedAnalytics.period_type == period_type)

            statement = statement.order_by(FeedAnalytics.period_end.desc()).limit(limit)

            return list(session.exec(statement).all())

    def get_all_analytics(self, period_type: str | None = None) -> list[FeedAnalytics]:
        """Get all analytics across all feeds.

        Args:
            period_type: Filter by period type

        Returns:
            List of FeedAnalytics
        """
        with self.get_session() as session:
            statement = select(FeedAnalytics)

            if period_type:
                statement = statement.where(FeedAnalytics.period_type == period_type)

            statement = statement.order_by(FeedAnalytics.period_end.desc())
            return list(session.exec(statement).all())

    # ===== COMPREHENSIVE QUERY METHODS =====

    def get_feed_complete_data(self, feed_source_id: str) -> dict[str, Any]:
        """Get all data for a feed source (source, enrichment, validation, analytics).

        Args:
            feed_source_id: Feed source ID

        Returns:
            Dictionary with all feed data
        """
        return {
            "source": self.get_feed_source(feed_source_id),
            "enrichment": self.get_enrichment_data(feed_source_id),
            "validation": self.get_validation_result(feed_source_id),
            "analytics": self.get_analytics(feed_source_id, limit=1),
            "recent_articles": self.get_articles(feed_source_id, limit=10),
        }

    def get_health_summary(self) -> dict[str, Any]:
        """Get overall health summary of all feeds.

        Returns:
            Dictionary with health metrics
        """
        with self.get_session() as session:
            # Get all enrichments in a single query to avoid N+1 problem
            enrichments = session.exec(select(FeedEnrichmentData)).all()

            total_feeds = len(enrichments)
            health_scores = []
            quality_scores = []

            for enrichment in enrichments:
                if enrichment:
                    if enrichment.health_score is not None:
                        health_scores.append(enrichment.health_score)
                    if enrichment.quality_score is not None:
                        quality_scores.append(enrichment.quality_score)

            return {
                "total_feeds": total_feeds,
                "feeds_with_health_data": len(health_scores),
                "avg_health_score": (
                    sum(health_scores) / len(health_scores) if health_scores else None
                ),
                "avg_quality_score": (
                    sum(quality_scores) / len(quality_scores) if quality_scores else None
                ),
                "feeds_healthy": len([s for s in health_scores if s >= 0.7]),
                "feeds_warning": len([s for s in health_scores if 0.4 <= s < 0.7]),
                "feeds_critical": len([s for s in health_scores if s < 0.4]),
            }

    # ========================================================================
    # Phase 1: Analytics Storage Extensions
    # ========================================================================

    def get_analytics_summary(
        self,
        date_range_days: int = 30,
        topic: str | None = None,
    ) -> dict[str, Any]:
        """Get analytics summary with optional topic filter.

        Args:
            date_range_days: Number of days to include in analysis
            topic: Optional topic ID to filter by

        Returns:
            Dictionary with analytics metrics
        """
        with self.get_session() as session:
            from ai_web_feeds.analytics import calculate_summary_metrics

            date_range = f"{date_range_days}d"
            return calculate_summary_metrics(session, date_range=date_range, topic=topic)

    def get_topic_stats(
        self,
        snapshot_date: str | None = None,
        limit: int = 10,
    ) -> list[TopicStats]:
        """Get topic statistics for a specific snapshot date.

        Args:
            snapshot_date: ISO date YYYY-MM-DD (defaults to latest)
            limit: Maximum number of topics to return

        Returns:
            List of TopicStats ordered by validation frequency
        """
        with self.get_session() as session:
            # Get latest snapshot date if not provided
            if not snapshot_date:
                latest = session.exec(
                    select(TopicStats.snapshot_date)
                    .order_by(TopicStats.snapshot_date.desc())
                    .limit(1)
                ).first()
                snapshot_date = latest if latest else datetime.now(UTC).strftime("%Y-%m-%d")

            # Query topic stats
            statement = (
                select(TopicStats)
                .where(TopicStats.snapshot_date == snapshot_date)
                .order_by(TopicStats.validation_frequency.desc())
                .limit(limit)
            )
            return list(session.exec(statement).all())

    def get_validation_history(
        self,
        feed_source_id: str | None = None,
        days: int = 30,
        limit: int = 100,
    ) -> list[FeedValidationResult]:
        """Get validation history with aggregations.

        Args:
            feed_source_id: Optional feed ID to filter by
            days: Number of days to look back
            limit: Maximum number of results

        Returns:
            List of FeedValidationResult ordered by timestamp desc
        """
        with self.get_session() as session:
            cutoff_date = datetime.now(UTC) - timedelta(days=days)

            statement = (
                select(FeedValidationResult)
                .where(FeedValidationResult.validated_at >= cutoff_date)
                .order_by(FeedValidationResult.validated_at.desc())
                .limit(limit)
            )

            if feed_source_id:
                statement = statement.where(FeedValidationResult.feed_source_id == feed_source_id)

            return list(session.exec(statement).all())

    def save_analytics_snapshot(self, snapshot: AnalyticsSnapshot) -> AnalyticsSnapshot:
        """Save or update analytics snapshot.

        Args:
            snapshot: AnalyticsSnapshot to save

        Returns:
            Saved snapshot with any updates
        """
        with self.get_session() as session:
            # Check if snapshot exists for this date
            existing = session.get(AnalyticsSnapshot, snapshot.snapshot_date)
            if existing:
                # Update existing
                for key, value in snapshot.dict(exclude={"snapshot_date"}).items():
                    setattr(existing, key, value)
                session.add(existing)
                session.commit()
                session.refresh(existing)
                logger.info(f"Updated analytics snapshot for {snapshot.snapshot_date}")
                return existing
            # Create new
            session.add(snapshot)
            session.commit()
            session.refresh(snapshot)
            logger.info(f"Created analytics snapshot for {snapshot.snapshot_date}")
            return snapshot

    def get_latest_analytics_snapshot(self) -> AnalyticsSnapshot | None:
        """Get the most recent analytics snapshot.

        Returns:
            Latest AnalyticsSnapshot or None
        """
        with self.get_session() as session:
            statement = (
                select(AnalyticsSnapshot).order_by(AnalyticsSnapshot.snapshot_date.desc()).limit(1)
            )
            return session.exec(statement).first()

    # ========================================================================
    # Phase 1: Search Storage Extensions
    # ========================================================================

    def search_feeds(
        self,
        query: str,
        search_type: str = "full_text",
        limit: int = 20,
        filters: dict[str, Any] | None = None,
    ) -> list[FeedSource] | list[tuple[FeedSource, float]]:
        """Search feeds with full-text or semantic search.

        Args:
            query: Search query
            search_type: 'full_text' or 'semantic'
            limit: Maximum results
            filters: Optional filters (source_type, topics, verified, active)

        Returns:
            List of FeedSource (full-text) or (FeedSource, score) tuples (semantic)
        """
        with self.get_session() as session:
            from ai_web_feeds.search import full_text_search, semantic_search

            if search_type == "semantic":
                threshold = filters.get("threshold", 0.7) if filters else 0.7
                return semantic_search(
                    session, query, threshold=threshold, limit=limit, filters=filters
                )
            return full_text_search(session, query, limit=limit, filters=filters)

    def autocomplete_search(
        self,
        prefix: str,
        limit: int = 8,
    ) -> dict[str, list[dict[str, Any]]]:
        """Get autocomplete suggestions.

        Args:
            prefix: Search prefix
            limit: Maximum suggestions

        Returns:
            Dictionary with 'feeds' and 'topics' lists
        """
        with self.get_session() as session:
            from ai_web_feeds.search import autocomplete

            return autocomplete(session, prefix, limit=limit)

    def log_search(
        self,
        user_id: str | None,
        query_text: str,
        search_type: str,
        filters: dict[str, Any],
        result_count: int,
        clicked_results: list[str] | None = None,
    ):
        """Log search query for analytics.

        Args:
            user_id: User ID (optional)
            query_text: Search query
            search_type: 'full_text' or 'semantic'
            filters: Applied filters
            result_count: Number of results
            clicked_results: Feed IDs clicked
        """
        with self.get_session() as session:
            from ai_web_feeds.search import log_search_query

            log_search_query(
                session,
                user_id,
                query_text,
                search_type,
                filters,
                result_count,
                clicked_results,
            )

    def save_user_search(
        self,
        user_id: str,
        search_name: str,
        query_text: str,
        filters: dict[str, Any],
    ) -> SavedSearch:
        """Save search for one-click replay.

        Args:
            user_id: User ID
            search_name: User-provided name
            query_text: Search query
            filters: Saved filters

        Returns:
            SavedSearch object
        """
        with self.get_session() as session:
            from ai_web_feeds.search import save_search

            return save_search(session, user_id, search_name, query_text, filters)

    def get_user_saved_searches(self, user_id: str) -> list[SavedSearch]:
        """Get all saved searches for a user.

        Args:
            user_id: User ID

        Returns:
            List of SavedSearch objects
        """
        with self.get_session() as session:
            from ai_web_feeds.search import get_saved_searches

            return get_saved_searches(session, user_id)

    def initialize_search_tables(self):
        """Initialize FTS5 table and Trie index."""
        with self.get_session() as session:
            from ai_web_feeds.search import build_trie_index, create_fts_table

            create_fts_table(session)
            build_trie_index(session)
            logger.info("Search tables initialized")

    # ========================================================================
    # Phase 1: Recommendation Storage Extensions
    # ========================================================================

    def get_recommendations(
        self,
        user_id: str | None = None,
        seed_feed_ids: list[str] | None = None,
        seed_topics: list[str] | None = None,
        limit: int = 20,
    ) -> list[tuple[FeedSource, float, str]]:
        """Get feed recommendations.

        Args:
            user_id: User ID for personalization
            seed_feed_ids: Seed feed IDs for content-based
            seed_topics: Seed topics for topic-based
            limit: Maximum recommendations

        Returns:
            List of (FeedSource, score, reason) tuples
        """
        with self.get_session() as session:
            from ai_web_feeds.recommendations import generate_recommendations

            return generate_recommendations(
                session,
                user_id=user_id,
                seed_feed_ids=seed_feed_ids,
                seed_topics=seed_topics,
                limit=limit,
            )

    def get_user_recommendations(
        self,
        user_id: str,
        limit: int = 20,
    ) -> list[tuple[FeedSource, float, str]]:
        """Get personalized recommendations for user.

        Args:
            user_id: User ID
            limit: Maximum recommendations

        Returns:
            List of (FeedSource, score, reason) tuples
        """
        with self.get_session() as session:
            from ai_web_feeds.recommendations import get_user_recommendations

            return get_user_recommendations(session, user_id, limit)

    def track_recommendation_click(
        self,
        user_id: str,
        feed_id: str,
        interaction_type: str,
        reason: str,
    ):
        """Track recommendation interaction.

        Args:
            user_id: User ID
            feed_id: Feed ID
            interaction_type: 'view', 'click', 'subscribe', 'dismiss'
            reason: Recommendation reason
        """
        with self.get_session() as session:
            from ai_web_feeds.recommendations import track_recommendation_interaction

            track_recommendation_interaction(
                session,
                user_id,
                feed_id,
                interaction_type,
                reason,
            )

    # ========================================================================
    # Article storage methods
    # ========================================================================

    def _find_article(
        self,
        session: Session,
        guid: str | None,
        link: str | None = None,
        feed_id: str = "",
    ) -> ArticleEntry | None:
        """Find an existing article by deterministic per-feed identity hashes."""
        if not feed_id:
            return None

        normalized_guid_hash = self._identity_hash(guid)
        normalized_link_hash = self._identity_hash(link)

        if normalized_guid_hash:
            statement = (
                select(ArticleEntry)
                .where(ArticleEntry.feed_id == feed_id)
                .where(ArticleEntry.guid_hash == normalized_guid_hash)
                .limit(1)
            )
            existing = session.exec(statement).first()
            if existing is not None:
                return existing

        if normalized_link_hash:
            statement = (
                select(ArticleEntry)
                .where(ArticleEntry.feed_id == feed_id)
                .where(ArticleEntry.link_hash == normalized_link_hash)
                .limit(1)
            )
            existing = session.exec(statement).first()
            if existing is not None:
                return existing

        return None

    def get_article_by_identity(
        self,
        guid: str | None,
        link: str | None,
        feed_id: str,
    ) -> ArticleEntry | None:
        """Return an article using the canonical per-source GUID/link hash identity."""
        with self.get_session() as session:
            return self._find_article(session, guid, link, feed_id)

    def add_article(self, entry: ArticleEntry) -> ArticleEntry:
        """Add a new article from polling.

        Args:
            entry: ArticleEntry to add

        Returns:
            Added ArticleEntry with ID, or the existing deduplicated entry
        """
        with self.get_session() as session:
            entry.canonical_url = entry.canonical_url or entry.link
            entry.guid_hash = entry.guid_hash or self._identity_hash(entry.guid)
            entry.link_hash = entry.link_hash or self._identity_hash(
                entry.canonical_url or entry.link
            )
            entry.first_seen_at = entry.first_seen_at or entry.discovered_at
            entry.last_seen_at = datetime.now(UTC)

            existing = self._find_article(session, entry.guid, entry.link, entry.feed_id)
            if existing is not None:
                existing.last_seen_at = datetime.now(UTC)
                session.add(existing)
                session.commit()
                session.refresh(existing)
                return existing

            session.add(entry)
            session.commit()
            session.refresh(entry)
            return entry

    def get_articles(
        self,
        feed_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> list[ArticleEntry]:
        """Get recent articles for a feed.

        Args:
            feed_id: Feed ID
            limit: Max articles to return
            offset: Pagination offset

        Returns:
            List of ArticleEntry objects
        """
        with self.get_session() as session:
            statement = (
                select(ArticleEntry)
                .where(ArticleEntry.feed_id == feed_id)
                .order_by(desc(ArticleEntry.pub_date))
                .limit(limit)
                .offset(offset)
            )
            return list(session.exec(statement).all())

    def get_recent_articles(self, since: datetime, limit: int = 100) -> list[ArticleEntry]:
        """Get articles discovered since a timestamp.

        Args:
            since: Timestamp to filter from
            limit: Max articles to return

        Returns:
            List of recent ArticleEntry objects
        """
        with self.get_session() as session:
            statement = (
                select(ArticleEntry)
                .where(ArticleEntry.discovered_at >= since)
                .order_by(desc(ArticleEntry.discovered_at))
                .limit(limit)
            )
            return list(session.exec(statement).all())

    def get_all_articles(
        self,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[ArticleEntry]:
        """Get canonical article entries ordered for deterministic corpus export."""
        with self.get_session() as session:
            statement = select(ArticleEntry).order_by(
                desc(ArticleEntry.pub_date),
                desc(ArticleEntry.created_at),
                ArticleEntry.guid,
            )
            if offset:
                statement = statement.offset(offset)
            if limit is not None:
                statement = statement.limit(limit)
            return list(session.exec(statement).all())

    @staticmethod
    def _identity_hash(value: str | None) -> str | None:
        """Hash normalized article identity values for per-feed uniqueness."""
        normalized = value.strip().lower() if isinstance(value, str) else ""
        if not normalized:
            return None
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def build_articles_corpus_payload(
        self,
        partial_coverage: dict[str, Any] | None = None,
        source_db: str | None = None,
    ) -> dict[str, Any]:
        """Build the generated article corpus payload from stored articles."""
        feed_sources = {feed.id: feed for feed in self.get_all_feed_sources()}
        entries = self.get_all_articles()

        articles: list[dict[str, Any]] = []
        seen_guids: set[str] = set()
        seen_links: set[str] = set()
        latest_published_at: datetime | None = None
        feed_ids: set[str] = set()

        for entry in entries:
            if entry.guid and entry.guid in seen_guids:
                continue
            if entry.link and entry.link in seen_links:
                continue

            if entry.guid:
                seen_guids.add(entry.guid)
            if entry.link:
                seen_links.add(entry.link)

            feed_source = feed_sources.get(entry.feed_id)
            feed_title = entry.feed_id
            source_topics: list[str] = []
            source_type = None
            verified = False
            is_active = True

            if feed_source is not None:
                feed_title = feed_source.title
                source_topics = list(feed_source.topics)
                verified = bool(feed_source.verified)
                if feed_source.source_type is not None:
                    source_type = feed_source.source_type.value
                is_active = feed_source.curation_status not in {
                    CurationStatus.ARCHIVED,
                    CurationStatus.INACTIVE,
                }

            published_at = entry.pub_date
            if latest_published_at is None or published_at > latest_published_at:
                latest_published_at = published_at

            feed_ids.add(entry.feed_id)
            articles.append(
                {
                    "id": entry.guid or entry.link,
                    "feed_id": entry.feed_id,
                    "feed_title": feed_title,
                    "title": entry.title,
                    "link": entry.link,
                    "canonical_url": entry.canonical_url or entry.link,
                    "summary": entry.summary,
                    "content_html": entry.content_html,
                    "author": entry.author,
                    "published_at": published_at.isoformat(),
                    "discovered_at": entry.discovered_at.isoformat(),
                    "topics": list(entry.topics or source_topics),
                    "raw_categories": list(entry.raw_categories),
                    "source_topics": source_topics,
                    "source_type": source_type,
                    "verified": verified,
                    "is_active": is_active,
                    "ingest_meta": {
                        "first_seen_at": entry.first_seen_at.isoformat(),
                        "last_seen_at": entry.last_seen_at.isoformat(),
                        "guid_hash": entry.guid_hash,
                        "link_hash": entry.link_hash,
                    },
                }
            )

        metadata: dict[str, Any] = {
            "schema_version": "articles-3.0.0",
            "generated_at": datetime.now(UTC).isoformat(),
            "source_db": source_db or self.database_url,
            "article_count": len(articles),
            "feed_count": len(feed_ids),
            "latest_published_at": latest_published_at.isoformat() if latest_published_at else None,
            "freshness_watermark": latest_published_at.isoformat() if latest_published_at else None,
        }
        if partial_coverage is not None:
            metadata["partial_coverage"] = partial_coverage

        return {
            "metadata": metadata,
            "articles": articles,
        }

    def export_articles_corpus(
        self,
        output_path: Path,
        partial_coverage: dict[str, Any] | None = None,
        source_db: str | None = None,
    ) -> dict[str, Any]:
        """Export the generated article corpus artifact to JSON."""
        payload = self.build_articles_corpus_payload(
            partial_coverage=partial_coverage,
            source_db=source_db,
        )
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        logger.info(
            "Exported article corpus: {} articles -> {}",
            payload["metadata"]["article_count"],
            output_path,
        )
        return payload

    # T016: Poll Jobs
    def create_poll_job(self, job: FeedPollJob) -> FeedPollJob:
        """Create new feed poll job.

        Args:
            job: FeedPollJob to create

        Returns:
            Created FeedPollJob with ID
        """
        with self.get_session() as session:
            session.add(job)
            session.commit()
            session.refresh(job)
            return job

    def update_poll_job(self, job: FeedPollJob) -> FeedPollJob:
        """Update existing poll job status.

        Args:
            job: FeedPollJob with updated fields

        Returns:
            Updated FeedPollJob
        """
        with self.get_session() as session:
            session.add(job)
            session.commit()
            session.refresh(job)
            return job

    def get_poll_jobs(self, feed_id: str, limit: int = 10) -> list[FeedPollJob]:
        """Get recent poll jobs for a feed.

        Args:
            feed_id: Feed ID
            limit: Max jobs to return

        Returns:
            List of FeedPollJob objects
        """
        with self.get_session() as session:
            statement = (
                select(FeedPollJob)
                .where(FeedPollJob.feed_id == feed_id)
                .order_by(desc(FeedPollJob.scheduled_at))
                .limit(limit)
            )
            return list(session.exec(statement).all())

    # T017: Notifications
    def create_notification(self, notification: Notification) -> Notification:
        """Create new notification.

        Args:
            notification: Notification to create

        Returns:
            Created Notification with ID
        """
        with self.get_session() as session:
            session.add(notification)
            session.commit()
            session.refresh(notification)
            return notification

    def get_user_notifications(
        self, user_id: str, unread_only: bool = False, limit: int = 50
    ) -> list[Notification]:
        """Get notifications for a user.

        Args:
            user_id: User ID (localStorage UUID)
            unread_only: Filter to unread only
            limit: Max notifications to return

        Returns:
            List of Notification objects
        """
        with self.get_session() as session:
            statement = select(Notification).where(Notification.user_id == user_id)
            if unread_only:
                statement = statement.where(Notification.read_at.is_(None))
            statement = statement.order_by(desc(Notification.created_at)).limit(limit)
            return list(session.exec(statement).all())

    def mark_notification_read(self, notification_id: int) -> None:
        """Mark notification as read.

        Args:
            notification_id: Notification ID
        """
        with self.get_session() as session:
            notification = session.get(Notification, notification_id)
            if notification:
                notification.read_at = datetime.now(UTC)
                session.add(notification)
                session.commit()

    def dismiss_notification(self, notification_id: int) -> None:
        """Dismiss notification.

        Args:
            notification_id: Notification ID
        """
        with self.get_session() as session:
            notification = session.get(Notification, notification_id)
            if notification:
                notification.dismissed_at = datetime.now(UTC)
                session.add(notification)
                session.commit()

    def delete_notifications_before(self, cutoff_date: datetime) -> int:
        """Delete notifications created before the cutoff date.

        Args:
            cutoff_date: Exclusive created_at cutoff.

        Returns:
            Number of deleted notification records.
        """
        with self.get_session() as session:
            statement = select(Notification).where(Notification.created_at < cutoff_date)
            notifications = list(session.exec(statement).all())
            for notification in notifications:
                session.delete(notification)
            session.commit()
            return len(notifications)

    # T018: Trending Topics
    def save_trending_topics(self, topics: list[TrendingTopic]) -> None:
        """Bulk save trending topics.

        Args:
            topics: List of TrendingTopic objects
        """
        with self.get_session() as session:
            for topic in topics:
                session.add(topic)
            session.commit()

    def get_trending_topics(self, limit: int = 10) -> list[TrendingTopic]:
        """Get current trending topics.

        Args:
            limit: Max topics to return

        Returns:
            List of TrendingTopic objects ordered by rank
        """
        with self.get_session() as session:
            statement = select(TrendingTopic).order_by(TrendingTopic.rank).limit(limit)
            return list(session.exec(statement).all())

    # T019: Notification Preferences
    def save_notification_preference(self, pref: NotificationPreference) -> NotificationPreference:
        """Save or update notification preference.

        Args:
            pref: NotificationPreference to save

        Returns:
            Saved NotificationPreference with ID
        """
        with self.get_session() as session:
            pref.updated_at = datetime.now(UTC)
            session.add(pref)
            session.commit()
            session.refresh(pref)
            return pref

    def get_user_preferences(self, user_id: str) -> list[NotificationPreference]:
        """Get all notification preferences for a user.

        Args:
            user_id: User ID (localStorage UUID)

        Returns:
            List of NotificationPreference objects
        """
        with self.get_session() as session:
            statement = select(NotificationPreference).where(
                NotificationPreference.user_id == user_id
            )
            return list(session.exec(statement).all())

    # T020: Email Digests
    def create_email_digest(self, digest: EmailDigest) -> EmailDigest:
        """Create email digest subscription.

        Args:
            digest: EmailDigest to create

        Returns:
            Created EmailDigest with ID
        """
        with self.get_session() as session:
            session.add(digest)
            session.commit()
            session.refresh(digest)
            return digest

    def get_email_digest(self, digest_id: int) -> EmailDigest | None:
        """Get email digest by ID.

        Args:
            digest_id: Digest ID

        Returns:
            EmailDigest if found, None otherwise
        """
        with self.get_session() as session:
            return session.get(EmailDigest, digest_id)

    def get_user_digests(self, user_id: str) -> list[EmailDigest]:
        """Get all digest subscriptions for a user.

        Args:
            user_id: User ID

        Returns:
            List of EmailDigest objects
        """
        with self.get_session() as session:
            stmt = select(EmailDigest).where(EmailDigest.user_id == user_id)
            result = session.execute(stmt)
            return list(result.scalars().all())

    def update_email_digest(self, digest: EmailDigest) -> EmailDigest:
        """Update email digest subscription.

        Args:
            digest: EmailDigest with updated fields

        Returns:
            Updated EmailDigest
        """
        with self.get_session() as session:
            session.add(digest)
            session.commit()
            session.refresh(digest)
            return digest

    def get_due_digests(self, now: datetime) -> list[EmailDigest]:
        """Get digests due for sending.

        Args:
            now: Current datetime

        Returns:
            List of EmailDigest objects due for sending
        """
        with self.get_session() as session:
            statement = (
                select(EmailDigest)
                .where(EmailDigest.next_send_at <= now)
                .where(EmailDigest.unsubscribed_at.is_(None))
            )
            return list(session.exec(statement).all())

    # T020b: User Source Follows
    def follow_source(self, user_id: str, source_id: str) -> UserSourceFollow:
        """Create user-source follow relationship.

        Args:
            user_id: User ID (localStorage UUID)
            source_id: Source ID

        Returns:
            Created UserSourceFollow
        """
        with self.get_session() as session:
            follow = UserSourceFollow(user_id=user_id, source_id=source_id)
            session.add(follow)
            session.commit()
            session.refresh(follow)
            return follow

    def unfollow_source(self, user_id: str, source_id: str) -> None:
        """Remove user-source follow relationship.

        Args:
            user_id: User ID (localStorage UUID)
            source_id: Source ID
        """
        with self.get_session() as session:
            statement = select(UserSourceFollow).where(
                UserSourceFollow.user_id == user_id,
                UserSourceFollow.source_id == source_id,
            )
            follow = session.exec(statement).first()
            if follow:
                session.delete(follow)
                session.commit()

    def get_source_followers(self, source_id: str) -> list[str]:
        """Get user IDs following a source.

        Args:
            source_id: Source ID

        Returns:
            List of user IDs
        """
        with self.get_session() as session:
            statement = select(UserSourceFollow.user_id).where(
                UserSourceFollow.source_id == source_id
            )
            return list(session.exec(statement).all())

    def get_user_followed_sources(self, user_id: str) -> list[str]:
        """Get source IDs a user follows.

        Args:
            user_id: User ID (localStorage UUID)

        Returns:
            List of source IDs
        """
        with self.get_session() as session:
            statement = select(UserSourceFollow.source_id).where(
                UserSourceFollow.user_id == user_id
            )
            return list(session.exec(statement).all())

    def get_active_user_ids(self) -> list[str]:
        """Get all active user IDs (users with at least one source follow).

        Used for broadcasting topic-level notifications (e.g. trending).

        Returns:
            List of distinct user IDs
        """
        with self.get_session() as session:
            statement = select(UserSourceFollow.user_id).distinct()
            return list(session.exec(statement).all())


_db_manager: DatabaseManager | None = None


def get_database_manager() -> DatabaseManager:
    """Return a process-wide database manager singleton."""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager


def get_session() -> Session:
    """Return a database session from the shared manager."""
    return get_database_manager().get_session()
