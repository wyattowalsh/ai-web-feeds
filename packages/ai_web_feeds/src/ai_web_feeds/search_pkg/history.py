"""Search history and saved searches."""

from typing import Any

from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.models import SavedSearch, SearchQuery


def log_search_query(
    session: Session,
    user_id: str | None,
    query_text: str,
    search_type: str,
    filters: dict[str, Any],
    result_count: int,
    clicked_results: list[str] | None = None,
) -> None:
    """Log search query for analytics.

    Args:
        session: Database session
        user_id: User ID (optional, from localStorage)
        query_text: Search query
        search_type: 'full_text' or 'semantic'
        filters: Applied filters
        result_count: Number of results returned
        clicked_results: Feed IDs clicked by user
    """
    search_query = SearchQuery(
        user_id=user_id,
        query_text=query_text,
        search_type=search_type,
        filters_applied=filters,
        result_count=result_count,
        clicked_results=clicked_results or [],
    )

    session.add(search_query)
    session.commit()
    logger.debug(f"Logged search query: {query_text}")


def save_search(
    session: Session,
    user_id: str,
    search_name: str,
    query_text: str,
    filters: dict[str, Any],
) -> SavedSearch:
    """Save search for one-click replay.

    Args:
        session: Database session
        user_id: User ID (localStorage key)
        search_name: User-provided name
        query_text: Search query
        filters: Saved filters

    Returns:
        Saved SavedSearch object
    """
    saved_search = SavedSearch(
        user_id=user_id,
        search_name=search_name,
        query_text=query_text,
        filters=filters,
    )

    session.add(saved_search)
    session.commit()
    session.refresh(saved_search)

    logger.info(f"Saved search: {search_name} for user {user_id}")
    return saved_search


def get_saved_searches(session: Session, user_id: str) -> list[SavedSearch]:
    """Get all saved searches for a user.

    Args:
        session: Database session
        user_id: User ID

    Returns:
        List of SavedSearch objects
    """
    statement = (
        select(SavedSearch)
        .where(SavedSearch.user_id == user_id)
        .order_by(SavedSearch.last_used_at.desc())
    )
    return list(session.exec(statement).all())


def delete_saved_search(session: Session, search_id: str) -> None:
    """Delete a saved search.

    Args:
        session: Database session
        search_id: SavedSearch UUID
    """
    saved_search = session.get(SavedSearch, search_id)
    if saved_search:
        session.delete(saved_search)
        session.commit()
        logger.info(f"Deleted saved search: {search_id}")
