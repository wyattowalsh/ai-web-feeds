"""Full-text search with SQLite FTS5."""

from typing import Any

from loguru import logger
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, select

from ai_web_feeds.models import FeedSource
from ai_web_feeds.search_pkg.runtime import get_settings, lookup


def create_fts_table(session: Session) -> None:
    """Create FTS5 virtual table for full-text search.

    Creates feeds_fts table with title, description, and topics columns.
    """
    logger.info("Creating FTS5 table for full-text search")
    sql_text = lookup("text")

    # Recreate the FTS table so its schema stays aligned with the current
    # source-table contract instead of relying on external-content column names.
    session.connection().execute(sql_text("DROP TABLE IF EXISTS feeds_fts"))

    # Create FTS5 virtual table
    session.connection().execute(
        sql_text(
            """
        CREATE VIRTUAL TABLE feeds_fts USING fts5(
            feed_id UNINDEXED,
            title,
            description,
            topics
        )
        """
        )
    )

    # Create triggers to keep FTS5 in sync with sources table
    session.connection().execute(
        sql_text(
            """
        CREATE TRIGGER IF NOT EXISTS feeds_fts_insert AFTER INSERT ON sources BEGIN
            INSERT INTO feeds_fts(feed_id, title, description, topics)
            VALUES (new.id, new.title, new.notes, json_extract(new.topics, '$'));
        END
        """
        )
    )

    session.connection().execute(
        sql_text(
            """
        CREATE TRIGGER IF NOT EXISTS feeds_fts_update AFTER UPDATE ON sources BEGIN
            UPDATE feeds_fts
            SET title = new.title,
                description = new.notes,
                topics = json_extract(new.topics, '$')
            WHERE feed_id = old.id;
        END
        """
        )
    )

    session.connection().execute(
        sql_text(
            """
        CREATE TRIGGER IF NOT EXISTS feeds_fts_delete AFTER DELETE ON sources BEGIN
            DELETE FROM feeds_fts WHERE feed_id = old.id;
        END
        """
        )
    )

    # Backfill existing sources so full-text search works even when the FTS table
    # is initialized after sources have already been inserted.
    session.connection().execute(
        sql_text(
            """
        INSERT OR REPLACE INTO feeds_fts(rowid, feed_id, title, description, topics)
        SELECT rowid, id, title, notes, json_extract(topics, '$')
        FROM sources
        """
        )
    )

    session.commit()
    logger.info("FTS5 table and triggers created")


def full_text_search(
    session: Session,
    query: str,
    limit: int = 20,
    filters: dict[str, Any] | None = None,
) -> list[FeedSource]:
    """Perform full-text search with FTS5.

    Args:
        session: Database session
        query: Search query
        limit: Maximum results
        filters: Optional filters (source_type, topics, verified, active)

    Returns:
        List of matching FeedSource objects
    """
    settings = get_settings()
    logger.info(f"Full-text search: query='{query}', limit={limit}")

    # Validate and clamp limit
    limit = max(1, min(limit, settings.search.full_text_limit))

    # Use LIMIT with buffer for filtering
    fts_limit = limit * 2

    # Search FTS5 table using parameterized query with text()
    statement = lookup("text")(
        """
    SELECT feed_id, rank
    FROM feeds_fts
    WHERE feeds_fts MATCH :query
    ORDER BY rank
    LIMIT :limit
    """
    )
    parameters = {"query": query, "limit": fts_limit}

    try:
        fts_results = session.connection().execute(statement, parameters).all()
    except OperationalError as exc:
        if "no such table: feeds_fts" not in str(exc).lower():
            raise
        logger.info("FTS5 table missing during search; initializing lazily")
        lookup("create_fts_table")(session)
        fts_results = session.connection().execute(statement, parameters).all()

    if not fts_results:
        logger.debug("No FTS5 results found")
        return []

    # Get feed IDs
    feed_ids = [row[0] for row in fts_results]
    feed_positions = {feed_id: index for index, feed_id in enumerate(feed_ids)}

    # Build filter query
    statement = select(FeedSource).where(FeedSource.id.in_(feed_ids))

    if filters:
        if filters.get("source_type"):
            statement = statement.where(FeedSource.source_type == filters["source_type"])
        if filters.get("topics"):
            # Filter by topics (JSON array contains)
            for topic in filters["topics"]:
                statement = statement.where(FeedSource.topics.contains([topic]))
        if filters.get("verified") is not None:
            statement = statement.where(FeedSource.verified == filters["verified"])
        if filters.get("active") is not None:
            active_status = "inactive" if not filters["active"] else "verified"
            statement = statement.where(FeedSource.curation_status != active_status)

    feeds = list(session.exec(statement).all())

    # Apply boost factors
    for feed in feeds:
        boost = 1.0
        if feed.verified:
            boost *= 1.2
        if feed.curation_status != "inactive":
            boost *= 1.1
        if feed.popularity_score and feed.popularity_score > 0.7:
            boost *= 1.05
        feed._search_score = boost  # Store for sorting

    # Sort by boosted score while preserving the underlying FTS rank order as
    # the tie-breaker so search results remain deterministic.
    feeds.sort(
        key=lambda feed: (
            -getattr(feed, "_search_score", 1.0),
            feed_positions.get(feed.id, len(feed_positions)),
        )
    )

    logger.debug(f"Full-text search returned {len(feeds)} results")
    return feeds[:limit]
