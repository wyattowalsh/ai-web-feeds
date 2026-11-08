"""Autocomplete suggestions from the trie index."""

from typing import Any

from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.models import FeedSource
from ai_web_feeds.search_pkg.runtime import get_settings, lookup
from ai_web_feeds.search_pkg.trie import TrieIndex


def autocomplete(
    session: Session,
    prefix: str,
    limit: int | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Get autocomplete suggestions.

    Args:
        session: Database session
        prefix: Search prefix
        limit: Maximum suggestions (default from settings: 8: 5 feeds + 3 topics)

    Returns:
        Dictionary with 'feeds' and 'topics' lists
    """
    settings = get_settings()
    if limit is None:
        limit = settings.search.autocomplete_limit

    logger.debug(f"Autocomplete: prefix='{prefix}', limit={limit}")

    if len(prefix) < 2:
        return {"feeds": [], "topics": []}

    trie: TrieIndex = lookup("get_trie_index")(session)
    suggestions = trie.search_prefix(prefix, limit=limit)
    feed_ids = sorted(
        {feed_id for _word, suggestion_ids, _freq in suggestions for feed_id in suggestion_ids}
    )

    if not feed_ids:
        return {"feeds": [], "topics": []}

    feeds = session.exec(select(FeedSource).where(FeedSource.id.in_(feed_ids))).all()
    feed_map = {feed.id: feed for feed in feeds}

    # Separate feeds and topics
    feed_suggestions = []
    topic_suggestions = []

    for word, suggestion_feed_ids, _frequency in suggestions:
        matching_feeds = [
            feed_map[feed_id] for feed_id in suggestion_feed_ids if feed_id in feed_map
        ]

        matching_feed = next(
            (feed for feed in matching_feeds if feed.title and word in feed.title.lower().split()),
            None,
        )

        is_topic = any(word in {topic.lower() for topic in feed.topics} for feed in matching_feeds)

        if matching_feed:
            feed_suggestions.append(
                {
                    "id": matching_feed.id,
                    "title": matching_feed.title,
                    "type": "feed",
                    "url": matching_feed.feed or matching_feed.site,
                }
            )

        if is_topic:
            topic_suggestions.append(
                {
                    "label": word.upper(),
                    "type": "topic",
                    "feed_count": len(suggestion_feed_ids),
                }
            )

    # Return top 5 feeds and top 3 topics
    return {
        "feeds": feed_suggestions[:5],
        "topics": topic_suggestions[:3],
    }
