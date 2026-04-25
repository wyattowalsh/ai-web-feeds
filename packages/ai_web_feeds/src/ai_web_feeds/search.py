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

import re
from collections.abc import Iterable
from typing import Any
from uuid import UUID

import numpy as np
from loguru import logger
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, select

from ai_web_feeds.config import get_settings
from ai_web_feeds.embeddings import (
    generate_embeddings_with_metadata,
    normalize_embedding_provider,
)
from ai_web_feeds.embeddings import (
    get_local_model as _get_local_model,
)
from ai_web_feeds.models import (
    CurationStatus,
    FeedEmbedding,
    FeedSource,
    SavedSearch,
    SearchQuery,
    SourceType,
)

MIN_INDEXED_WORD_LENGTH = 2
FTS_FILTER_BUFFER_MULTIPLIER = 2
MIN_AUTOCOMPLETE_PREFIX_LENGTH = 2
POPULARITY_BOOST_THRESHOLD = 0.7
ZERO_NORM_THRESHOLD = 1e-8
DEFAULT_SEMANTIC_THRESHOLD = 0.7
MIN_SEMANTIC_THRESHOLD = 0.5
MAX_SEMANTIC_THRESHOLD = 1.0
_WHITESPACE_RE = re.compile(r"\s+")

_search_cache: dict[str, Any] = {
    "trie_index": None,
}


def _coerce_source_type_filter(value: SourceType | str | None) -> SourceType | None:
    """Normalize source-type filter inputs to the enum used by the ORM."""
    if value is None or isinstance(value, SourceType):
        return value
    try:
        return SourceType(value)
    except ValueError:
        logger.warning(f"Ignoring unsupported source_type filter: {value}")
        return None


def normalize_search_query(value: str | None) -> str:
    """Collapse internal whitespace and trim user-entered search text."""
    if not value:
        return ""

    return _WHITESPACE_RE.sub(" ", value).strip()


def normalize_search_topics(topics: Iterable[str] | None) -> list[str]:
    """Trim, lowercase, and de-duplicate topic filters while preserving order."""
    normalized_topics: list[str] = []
    seen: set[str] = set()

    for topic in topics or []:
        normalized_topic = normalize_search_query(topic).lower()
        if not normalized_topic or normalized_topic in seen:
            continue
        seen.add(normalized_topic)
        normalized_topics.append(normalized_topic)

    return normalized_topics


def normalize_search_filters(
    filters: dict[str, Any] | None,
    *,
    search_type: str | None = None,
) -> dict[str, Any]:
    """Normalize persisted and runtime search filters across entry points."""
    if not filters:
        return {}

    normalized: dict[str, Any] = {}

    if "search_type" in filters:
        normalized["search_type"] = (
            "semantic" if str(filters["search_type"]).strip().lower() == "semantic" else "full_text"
        )
    elif search_type is not None:
        normalized["search_type"] = "semantic" if search_type == "semantic" else "full_text"

    source_type = _coerce_source_type_filter(filters.get("source_type"))
    if source_type is not None:
        normalized["source_type"] = source_type.value

    raw_topics = filters.get("topics")
    if isinstance(raw_topics, str):
        normalized_topics = normalize_search_topics(raw_topics.split(","))
    elif isinstance(raw_topics, Iterable):
        normalized_topics = normalize_search_topics(
            topic for topic in raw_topics if isinstance(topic, str)
        )
    else:
        normalized_topics = []
    if normalized_topics:
        normalized["topics"] = normalized_topics

    verified = filters.get("verified")
    if isinstance(verified, bool):
        normalized["verified"] = verified
    elif isinstance(verified, str):
        verified_value = verified.strip().lower()
        if verified_value == "true":
            normalized["verified"] = True
        elif verified_value == "false":
            normalized["verified"] = False

    active = filters.get("active")
    if isinstance(active, bool):
        normalized["active"] = active
    elif isinstance(active, str):
        active_value = active.strip().lower()
        if active_value == "true":
            normalized["active"] = True
        elif active_value == "false":
            normalized["active"] = False

    threshold_value = filters.get("threshold")
    if threshold_value is not None:
        try:
            normalized["threshold"] = max(
                MIN_SEMANTIC_THRESHOLD,
                min(float(threshold_value), MAX_SEMANTIC_THRESHOLD),
            )
        except (TypeError, ValueError):
            normalized["threshold"] = DEFAULT_SEMANTIC_THRESHOLD

    return normalized


def get_local_model(model_name: str | None = None) -> Any:
    """Lazily load the shared embedding model."""
    return _get_local_model(model_name)


# ============================================================================
# Trie Index for Autocomplete
# ============================================================================


class TrieNode:
    """Trie node for autocomplete suggestions."""

    def __init__(self) -> None:
        self.children: dict[str, TrieNode] = {}
        self.is_end_of_word = False
        self.feed_ids: list[str] = []
        self.frequency: int = 0


class TrieIndex:
    """Trie index for fast autocomplete suggestions."""

    def __init__(self) -> None:
        self.root = TrieNode()

    def insert(self, word: str, feed_id: str) -> None:
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

    def _collect_words(
        self,
        node: TrieNode,
        current_word: str,
        results: list[tuple[str, list[str], int]],
    ) -> None:
        """Recursively collect all words from node."""
        if node.is_end_of_word:
            results.append((current_word, node.feed_ids, node.frequency))

        for char, child_node in node.children.items():
            self._collect_words(child_node, current_word + char, results)


def build_trie_index(session: Session) -> TrieIndex:
    """Build Trie index from feed titles and topics.

    Args:
        session: Database session

    Returns:
        Populated TrieIndex
    """
    logger.info("Building Trie index for autocomplete")

    trie = TrieIndex()

    # Get all feeds
    feeds = session.exec(select(FeedSource)).all()

    for feed in feeds:
        # Index feed title words
        if feed.title:
            words = normalize_search_query(feed.title).lower().split()
            for word in words:
                if len(word) >= MIN_INDEXED_WORD_LENGTH:
                    trie.insert(word, feed.id)

        # Index topics
        for topic in normalize_search_topics(feed.topics or []):
            trie.insert(topic, feed.id)

    _search_cache["trie_index"] = trie
    logger.info(f"Trie index built with {len(feeds)} feeds")
    return trie


def get_trie_index(session: Session) -> TrieIndex:
    """Get cached Trie index or build if not exists."""
    cached_trie = _search_cache["trie_index"]
    if cached_trie is None:
        cached_trie = build_trie_index(session)
    return cached_trie


# ============================================================================
# Full-Text Search (FTS5)
# ============================================================================


def create_fts_table(session: Session) -> None:
    """Create FTS5 virtual table for full-text search.

    Creates feeds_fts table with title, description, and topics columns.
    """
    logger.info("Creating FTS5 table for full-text search")

    # Recreate the FTS table so its schema stays aligned with the current
    # source-table contract instead of relying on external-content column names.
    session.connection().execute(text("DROP TABLE IF EXISTS feeds_fts"))

    # Create FTS5 virtual table
    session.connection().execute(
        text(
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
        text(
            """
        CREATE TRIGGER IF NOT EXISTS feeds_fts_insert AFTER INSERT ON sources BEGIN
            INSERT INTO feeds_fts(feed_id, title, description, topics)
            VALUES (new.id, new.title, new.notes, json_extract(new.topics, '$'));
        END
        """
        )
    )

    session.connection().execute(
        text(
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
        text(
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
        text(
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
    query = normalize_search_query(query)
    if not query:
        return []
    logger.info(f"Full-text search: query='{query}', limit={limit}")
    filters = normalize_search_filters(filters, search_type="full_text")

    # Validate and clamp limit
    limit = max(1, min(limit, settings.search.full_text_limit))

    # Use LIMIT with buffer for filtering
    fts_limit = limit * FTS_FILTER_BUFFER_MULTIPLIER

    # Search FTS5 table using parameterized query with text()
    statement = text(
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
        create_fts_table(session)
        fts_results = session.connection().execute(statement, parameters).all()

    if not fts_results:
        logger.debug("No FTS5 results found")
        return []

    # Get feed IDs preserving FTS rank order
    feed_ids = [row[0] for row in fts_results]
    feed_positions = {feed_id: index for index, feed_id in enumerate(feed_ids)}

    # Build filter query
    statement = select(FeedSource).where(FeedSource.id.in_(feed_ids))

    if filters:
        if filters.get("source_type"):
            source_type = _coerce_source_type_filter(filters["source_type"])
            if source_type is not None:
                statement = statement.where(FeedSource.source_type == source_type)
        if filters.get("topics"):
            # Filter by topics (JSON array contains)
            for topic in filters["topics"]:
                statement = statement.where(FeedSource.topics.contains([topic]))
        if filters.get("verified") is not None:
            statement = statement.where(FeedSource.verified == filters["verified"])
        if filters.get("active") is not None:
            if filters["active"]:
                statement = statement.where(FeedSource.curation_status != CurationStatus.INACTIVE)
            else:
                statement = statement.where(FeedSource.curation_status == CurationStatus.INACTIVE)

    feeds = list(session.exec(statement).all())
    feed_map = {feed.id: feed for feed in feeds if hasattr(feed, "id")}

    # Apply boost factors
    ordered_feeds: list[FeedSource] = []
    for feed_id in feed_ids:
        feed = feed_map.get(feed_id)
        if feed is None:
            continue
        boost = 1.0
        if feed.verified:
            boost *= 1.2
        if feed.curation_status != CurationStatus.INACTIVE:
            boost *= 1.1
        if feed.popularity_score and feed.popularity_score > POPULARITY_BOOST_THRESHOLD:
            boost *= 1.05
        feed._search_score = boost  # Store for sorting
        ordered_feeds.append(feed)

    # Sort by boosted score while preserving the underlying FTS rank order as
    # the tie-breaker so search results remain deterministic.
    feeds.sort(
        key=lambda feed: (
            -getattr(feed, "_search_score", 1.0),
            feed_positions.get(feed.id, len(feed_positions)),
        )
    )

    logger.debug(f"Full-text search returned {len(ordered_feeds)} results")
    return ordered_feeds[:limit]


# ============================================================================
# Semantic Search (Embeddings)
# ============================================================================


def generate_query_embedding(
    query_text: str,
    *,
    provider: str | None = None,
    model_name: str | None = None,
) -> np.ndarray:
    """Generate embedding for search query using cached model.

    Uses the shared cached Sentence-Transformers model from embeddings module.

    Args:
        query_text: Search query

    Returns:
        384-dim embedding vector
    """
    resolved_provider = normalize_embedding_provider(provider)
    if resolved_provider == "local":
        try:
            model = get_local_model(model_name)
            embedding = model.encode([query_text])[0]
            return embedding.astype(np.float32)
        except ImportError:
            logger.error("sentence-transformers not installed")
            raise

    result = generate_embeddings_with_metadata(
        [query_text],
        provider=resolved_provider,
        show_progress=False,
        allow_fallback=False,
        hf_model=model_name if resolved_provider == "huggingface" else None,
        local_model=model_name if resolved_provider == "local" else None,
    )
    return result.embeddings[0]


def semantic_search(
    session: Session,
    query: str,
    threshold: float = DEFAULT_SEMANTIC_THRESHOLD,
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
    settings = get_settings()
    query = normalize_search_query(query)
    if not query:
        return []
    logger.info(f"Semantic search: query='{query}', threshold={threshold}")
    filters = normalize_search_filters(filters, search_type="semantic")

    # Validate and clamp limit
    limit = max(1, min(limit, settings.search.full_text_limit))
    threshold = max(MIN_SEMANTIC_THRESHOLD, min(threshold, MAX_SEMANTIC_THRESHOLD))

    # Get all feed embeddings
    embeddings = session.exec(
        select(
            FeedEmbedding.feed_id,
            FeedEmbedding.embedding,
            FeedEmbedding.embedding_provider,
            FeedEmbedding.embedding_model,
        )
    ).all()

    if not embeddings:
        logger.warning("No feed embeddings found")
        return []

    query_embeddings: dict[tuple[str, str], tuple[np.ndarray, float]] = {}
    skipped_specs: set[tuple[str, str]] = set()

    # Calculate cosine similarities with zero-norm guards
    similarities = []
    for feed_id, embedding_bytes, provider, model_name in embeddings:
        spec = ((provider or "local").strip().lower(), (model_name or "").strip())
        if spec in skipped_specs:
            continue
        if spec not in query_embeddings:
            try:
                query_embedding = _generate_query_embedding_for_spec(query, spec)
            except Exception as exc:
                logger.warning(
                    f"Skipping semantic-search spec {spec[0]} ({spec[1] or 'default'}): {exc}"
                )
                skipped_specs.add(spec)
                continue

            query_norm = np.linalg.norm(query_embedding)
            if query_norm < ZERO_NORM_THRESHOLD:
                logger.warning(
                    f"Query embedding for {spec[0]} ({spec[1] or 'default'}) had zero norm"
                )
                skipped_specs.add(spec)
                continue

            query_embeddings[spec] = (query_embedding, query_norm)

        query_embedding, query_norm = query_embeddings[spec]
        feed_vector = np.frombuffer(embedding_bytes, dtype=np.float32)

        # Guard against zero-norm feed embedding
        feed_norm = np.linalg.norm(feed_vector)
        if feed_norm < ZERO_NORM_THRESHOLD:
            logger.debug(f"Feed {feed_id} has zero-norm embedding, skipping")
            continue

        # Compute cosine similarity safely
        similarity = np.dot(query_embedding, feed_vector) / (query_norm * feed_norm)

        if similarity >= threshold:
            similarities.append((feed_id, float(similarity)))

    # Sort by similarity
    similarities.sort(key=lambda x: x[1], reverse=True)
    top_feed_ids = [feed_id for feed_id, _ in similarities[: limit * 2]]

    # Get feeds with filters
    statement = select(FeedSource).where(FeedSource.id.in_(top_feed_ids))

    if filters:
        if filters.get("source_type"):
            source_type = _coerce_source_type_filter(filters["source_type"])
            if source_type is not None:
                statement = statement.where(FeedSource.source_type == source_type)
        if filters.get("topics"):
            for topic in filters["topics"]:
                statement = statement.where(FeedSource.topics.contains([topic]))
        if filters.get("verified") is not None:
            statement = statement.where(FeedSource.verified == filters["verified"])
        if filters.get("active") is not None:
            if filters["active"]:
                statement = statement.where(FeedSource.curation_status != CurationStatus.INACTIVE)
            else:
                statement = statement.where(FeedSource.curation_status == CurationStatus.INACTIVE)

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


def _generate_query_embedding_for_spec(
    query: str,
    spec: tuple[str, str],
) -> np.ndarray:
    """Dispatch query embedding generation while tolerating simple test doubles."""
    try:
        return generate_query_embedding(
            query,
            provider=spec[0],
            model_name=spec[1] or None,
        )
    except TypeError as exc:
        if "unexpected keyword argument" not in str(exc):
            raise
        return generate_query_embedding(query)


# ============================================================================
# Autocomplete
# ============================================================================


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

    if len(prefix) < MIN_AUTOCOMPLETE_PREFIX_LENGTH:
        return {"feeds": [], "topics": []}

    trie = get_trie_index(session)
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

    for word, feed_ids, _frequency in suggestions:
        matching_feeds = [feed_map[feed_id] for feed_id in feed_ids if feed_id in feed_map]

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
                    "label": word,
                    "type": "topic",
                    "feed_count": len(feed_ids),
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
) -> None:
    """Log search query for analytics.

    Args:
        session: Database session
        user_id: User ID (optional, from anonymous device binding)
        query_text: Search query
        search_type: 'full_text' or 'semantic'
        filters: Applied filters
        result_count: Number of results returned
        clicked_results: Feed IDs clicked by user
    """
    normalized_query = normalize_search_query(query_text)
    normalized_filters = normalize_search_filters(filters, search_type=search_type)
    search_query = SearchQuery(
        user_id=user_id,
        query_text=normalized_query,
        search_type=search_type,
        filters_applied=normalized_filters,
        result_count=result_count,
        clicked_results=clicked_results or [],
    )

    session.add(search_query)
    session.commit()
    logger.debug(f"Logged search query: {normalized_query}")


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
        user_id: User ID (anonymous device binding)
        search_name: User-provided name
        query_text: Search query
        filters: Saved filters

    Returns:
        Saved SavedSearch object
    """
    normalized_filters = normalize_search_filters(filters)
    normalized_search_name = normalize_search_query(search_name)
    normalized_query = normalize_search_query(query_text)
    saved_search = SavedSearch(
        user_id=user_id.strip(),
        search_name=normalized_search_name or search_name.strip(),
        query_text=normalized_query,
        filters=normalized_filters,
    )

    session.add(saved_search)
    session.commit()
    session.refresh(saved_search)

    logger.info(f"Saved search: {saved_search.search_name} for user {saved_search.user_id}")
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


def delete_saved_search(session: Session, user_id: str, search_id: str) -> None:
    """Delete a saved search owned by a specific user.

    Args:
        session: Database session
        user_id: Anonymous device-scoped user ID
        search_id: SavedSearch UUID
    """
    try:
        search_uuid = UUID(str(search_id).strip())
    except (TypeError, ValueError):
        logger.warning(f"Ignoring saved-search delete for invalid id: {search_id}")
        return

    saved_search = session.exec(
        select(SavedSearch).where(
            SavedSearch.id == search_uuid,
            SavedSearch.user_id == user_id.strip(),
        )
    ).first()
    if saved_search:
        session.delete(saved_search)
        session.commit()
        logger.info(f"Deleted saved search: {search_id} for user {user_id.strip()}")
