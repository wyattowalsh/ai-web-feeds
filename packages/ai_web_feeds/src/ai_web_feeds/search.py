"""ai_web_feeds.search -- Search and discovery functionality

This module provides search functions including:
- Full-text search with SQLite FTS5
- Semantic similarity search with embeddings
- Autocomplete with Trie index
- Faceted filtering
- Search history tracking
- Saved search management

Uses SQLite FTS5 for full-text search and NumPy for vector similarity.
"""

from typing import Any

import numpy as np
from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import (
    FeedEmbedding,
    FeedSource,
    SavedSearch,
    SearchQuery,
)

settings = Settings()


# ============================================================================
# Trie Index for Autocomplete
# ============================================================================


class TrieNode:
    """Trie node for autocomplete suggestions."""

    def __init__(self):
        self.children: dict[str, TrieNode] = {}
        self.is_end_of_word = False
        self.feed_ids: list[str] = []
        self.frequency: int = 0


class TrieIndex:
    """Trie index for fast autocomplete suggestions."""

    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str, feed_id: str):
        """Insert word into Trie with associated feed ID."""
        node = self.root
        word_lower = word.lower()

        for char in word_lower:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]

        node.is_end_of_word = True
        if feed_id not in node.feed_ids:
            node.feed_ids.append(feed_id)
        node.frequency += 1

    def search_prefix(self, prefix: str, limit: int = 8) -> list[tuple[str, list[str], int]]:
        """Search for words with given prefix.

        Args:
            prefix: Search prefix
            limit: Maximum number of suggestions

        Returns:
            List of (word, feed_ids, frequency) tuples
        """
        node = self.root
        prefix_lower = prefix.lower()

        # Traverse to prefix node
        for char in prefix_lower:
            if char not in node.children:
                return []
            node = node.children[char]

        # Collect all words with this prefix
        results = []
        self._collect_words(node, prefix_lower, results)

        # Sort by frequency and return top results
        results.sort(key=lambda x: x[2], reverse=True)
        return results[:limit]

    def _collect_words(self, node: TrieNode, current_word: str, results: list):
        """Recursively collect all words from node."""
        if node.is_end_of_word:
            results.append((current_word, node.feed_ids, node.frequency))

        for char, child_node in node.children.items():
            self._collect_words(child_node, current_word + char, results)


# Global Trie index (cached in memory)
_trie_index: TrieIndex | None = None


def build_trie_index(session: Session) -> TrieIndex:
    """Build Trie index from feed titles and topics.

    Args:
        session: Database session

    Returns:
        Populated TrieIndex
    """
    global _trie_index

    logger.info("Building Trie index for autocomplete")

    trie = TrieIndex()

    # Get all feeds
    feeds = session.exec(select(FeedSource)).all()

    for feed in feeds:
        # Index feed title words
        if feed.title:
            words = feed.title.lower().split()
            for word in words:
                if len(word) >= 2:  # Only index words >= 2 chars
                    trie.insert(word, feed.id)

        # Index topics
        for topic in feed.topics:
            trie.insert(topic, feed.id)

    _trie_index = trie
    logger.info(f"Trie index built with {len(feeds)} feeds")
    return trie


def get_trie_index(session: Session) -> TrieIndex:
    """Get cached Trie index or build if not exists."""
    global _trie_index
    if _trie_index is None:
        _trie_index = build_trie_index(session)
    return _trie_index


# ============================================================================
# Full-Text Search (FTS5)
# ============================================================================


def create_fts_table(session: Session):
    """Create FTS5 virtual table for full-text search.

    Creates feeds_fts table with title, description, and topics columns.
    """
    logger.info("Creating FTS5 table for full-text search")

    # Create FTS5 virtual table
    session.exec(
        """
        CREATE VIRTUAL TABLE IF NOT EXISTS feeds_fts USING fts5(
            feed_id UNINDEXED,
            title,
            description,
            topics,
            content='sources',
            content_rowid='rowid'
        )
        """
    )

    # Create triggers to keep FTS5 in sync with sources table
    session.exec(
        """
        CREATE TRIGGER IF NOT EXISTS feeds_fts_insert AFTER INSERT ON sources BEGIN
            INSERT INTO feeds_fts(feed_id, title, description, topics)
            VALUES (new.id, new.title, new.notes, json_extract(new.topics, '$'));
        END
        """
    )

    session.exec(
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

    session.exec(
        """
        CREATE TRIGGER IF NOT EXISTS feeds_fts_delete AFTER DELETE ON sources BEGIN
            DELETE FROM feeds_fts WHERE feed_id = old.id;
        END
        """
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
    logger.info(f"Full-text search: query='{query}', limit={limit}")

    # Build FTS5 query
    fts_query = query.replace("'", "''")  # Escape quotes

    # Search FTS5 table
    fts_results = session.exec(
        f"""
        SELECT feed_id, rank
        FROM feeds_fts
        WHERE feeds_fts MATCH '{fts_query}'
        ORDER BY rank
        LIMIT {limit * 2}
        """
    ).all()

    if not fts_results:
        logger.debug("No FTS5 results found")
        return []

    # Get feed IDs
    feed_ids = [row[0] for row in fts_results]

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

    # Sort by boosted score
    feeds.sort(key=lambda f: getattr(f, "_search_score", 1.0), reverse=True)

    logger.debug(f"Full-text search returned {len(feeds)} results")
    return feeds[:limit]


# ============================================================================
# Semantic Search (Embeddings)
# ============================================================================


def generate_query_embedding(query_text: str) -> np.ndarray:
    """Generate embedding for search query.

    Args:
        query_text: Search query

    Returns:
        384-dim embedding vector
    """
    # Import here to avoid circular dependency
    try:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(settings.embedding.local_model)
        embedding = model.encode([query_text])[0]
        return embedding.astype(np.float32)
    except ImportError:
        logger.error("sentence-transformers not installed")
        raise


def semantic_search(
    session: Session,
    query: str,
    threshold: float = 0.7,
    limit: int = 20,
    filters: dict[str, Any] | None = None,
) -> list[tuple[FeedSource, float]]:
    """Perform semantic similarity search.

    Args:
        session: Database session
        query: Search query
        threshold: Minimum similarity threshold (0.0-1.0)
        limit: Maximum results
        filters: Optional filters

    Returns:
        List of (FeedSource, similarity_score) tuples
    """
    logger.info(f"Semantic search: query='{query}', threshold={threshold}")

    # Generate query embedding
    query_embedding = generate_query_embedding(query)

    # Get all feed embeddings
    embeddings = session.exec(select(FeedEmbedding)).all()

    if not embeddings:
        logger.warning("No feed embeddings found")
        return []

    # Calculate cosine similarities
    similarities = []
    for emb in embeddings:
        feed_vector = np.frombuffer(emb.embedding, dtype=np.float32)
        similarity = np.dot(query_embedding, feed_vector) / (
            np.linalg.norm(query_embedding) * np.linalg.norm(feed_vector)
        )

        if similarity >= threshold:
            similarities.append((emb.feed_id, float(similarity)))

    # Sort by similarity
    similarities.sort(key=lambda x: x[1], reverse=True)
    top_feed_ids = [feed_id for feed_id, _ in similarities[: limit * 2]]

    # Get feeds with filters
    statement = select(FeedSource).where(FeedSource.id.in_(top_feed_ids))

    if filters:
        if filters.get("source_type"):
            statement = statement.where(FeedSource.source_type == filters["source_type"])
        if filters.get("topics"):
            for topic in filters["topics"]:
                statement = statement.where(FeedSource.topics.contains([topic]))
        if filters.get("verified") is not None:
            statement = statement.where(FeedSource.verified == filters["verified"])

    feeds = list(session.exec(statement).all())

    # Create feed_id -> feed mapping
    feed_map = {feed.id: feed for feed in feeds}

    # Combine feeds with similarity scores
    results = []
    for feed_id, similarity in similarities[: limit * 2]:
        if feed_id in feed_map:
            results.append((feed_map[feed_id], similarity))

    logger.debug(f"Semantic search returned {len(results)} results")
    return results[:limit]


# ============================================================================
# Autocomplete
# ============================================================================


def autocomplete(
    session: Session,
    prefix: str,
    limit: int = 8,
) -> dict[str, list[dict[str, Any]]]:
    """Get autocomplete suggestions.

    Args:
        session: Database session
        prefix: Search prefix
        limit: Maximum suggestions (default 8: 5 feeds + 3 topics)

    Returns:
        Dictionary with 'feeds' and 'topics' lists
    """
    logger.info(f"Autocomplete: prefix='{prefix}'")

    if len(prefix) < 2:
        return {"feeds": [], "topics": []}

    trie = get_trie_index(session)
    suggestions = trie.search_prefix(prefix, limit=limit)

    # Separate feeds and topics
    feed_suggestions = []
    topic_suggestions = []

    for word, feed_ids, frequency in suggestions:
        # Check if it's a topic (single word, lowercase)
        if len(word.split()) == 1 and word.islower():
            # Likely a topic
            topic_suggestions.append(
                {
                    "label": word.upper(),
                    "type": "topic",
                    "feed_count": len(feed_ids),
                }
            )
        # Feed title word
        # Get first feed for this word
        elif feed_ids:
            feed = session.get(FeedSource, feed_ids[0])
            if feed:
                feed_suggestions.append(
                    {
                        "id": feed.id,
                        "title": feed.title,
                        "type": "feed",
                        "url": feed.feed or feed.site,
                    }
                )

    # Return top 5 feeds and top 3 topics
    return {
        "feeds": feed_suggestions[:5],
        "topics": topic_suggestions[:3],
    }


# ============================================================================
# Search History & Saved Searches
# ============================================================================


def log_search_query(
    session: Session,
    user_id: str | None,
    query_text: str,
    search_type: str,
    filters: dict[str, Any],
    result_count: int,
    clicked_results: list[str] | None = None,
):
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


def delete_saved_search(session: Session, search_id: str):
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
