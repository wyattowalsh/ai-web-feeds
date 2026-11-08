"""Semantic and hybrid search."""

from typing import Any

import numpy as np
from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.models import FeedEmbedding, FeedSource
from ai_web_feeds.search_pkg.runtime import get_settings, lookup


def generate_query_embedding(query_text: str) -> np.ndarray:
    """Generate embedding for search query using cached model.

    Uses the shared cached Sentence-Transformers model from embeddings module.

    Args:
        query_text: Search query

    Returns:
        384-dim embedding vector
    """
    # Import here to avoid circular dependency
    try:
        from ai_web_feeds.embeddings import get_local_model

        model = get_local_model()
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
    settings = get_settings()
    logger.info(f"Semantic search: query='{query}', threshold={threshold}")

    # Validate and clamp limit
    limit = max(1, min(limit, settings.search.full_text_limit))
    threshold = max(0.0, min(threshold, 1.0))

    # Generate query embedding
    query_embedding = lookup("generate_query_embedding")(query)

    # Guard against zero-norm query embedding
    query_norm = np.linalg.norm(query_embedding)
    if query_norm < 1e-8:
        logger.warning("Query embedding has zero norm, returning no results")
        return []

    # Get all feed embeddings
    embeddings = session.exec(select(FeedEmbedding)).all()

    if not embeddings:
        logger.warning("No feed embeddings found")
        return []

    # Calculate cosine similarities with zero-norm guards
    similarities: list[tuple[str, float]] = []
    for emb in embeddings:
        feed_vector = np.frombuffer(emb.embedding, dtype=np.float32)

        # Guard against zero-norm feed embedding
        feed_norm = np.linalg.norm(feed_vector)
        if feed_norm < 1e-8:
            logger.debug(f"Feed {emb.feed_id} has zero-norm embedding, skipping")
            continue

        # Compute cosine similarity safely
        similarity = np.dot(query_embedding, feed_vector) / (query_norm * feed_norm)

        if similarity >= threshold:
            similarities.append((emb.feed_id, float(similarity)))

    # Sort by similarity
    similarities.sort(key=lambda item: item[1], reverse=True)
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
    results: list[tuple[FeedSource, float]] = []
    for feed_id, similarity in similarities[: limit * 2]:
        if feed_id in feed_map:
            results.append((feed_map[feed_id], similarity))

    logger.debug(f"Semantic search returned {len(results)} results")
    return results[:limit]


def hybrid_search(
    session: Session,
    query: str,
    limit: int = 20,
    filters: dict[str, Any] | None = None,
    full_text_weight: float = 0.6,
    semantic_weight: float = 0.4,
    semantic_threshold: float = 0.5,
) -> list[tuple[FeedSource, float]]:
    """Perform hybrid search combining full-text and semantic results.

    Combines FTS5 full-text search with embedding-based semantic search
    using weighted score fusion for improved relevance.

    Args:
        session: Database session
        query: Search query
        limit: Maximum results
        filters: Optional filters (source_type, topics, verified, active)
        full_text_weight: Weight for full-text results (default 0.6)
        semantic_weight: Weight for semantic results (default 0.4)
        semantic_threshold: Minimum similarity for semantic candidates

    Returns:
        List of (FeedSource, combined_score) tuples sorted by score descending
    """
    settings = get_settings()
    logger.info(
        "Hybrid search: query='%s', ft_weight=%s, sem_weight=%s",
        query,
        full_text_weight,
        semantic_weight,
    )

    # Validate and clamp limit
    limit = max(1, min(limit, settings.search.full_text_limit))

    # Normalize weights
    total_weight = full_text_weight + semantic_weight
    if total_weight <= 0:
        full_text_weight, semantic_weight = 0.6, 0.4
    else:
        full_text_weight = full_text_weight / total_weight
        semantic_weight = semantic_weight / total_weight

    # Get full-text results (with rank info via internal scoring)
    fts_results = lookup("full_text_search")(session, query, limit=limit * 2, filters=filters)

    # Build FTS rank map (earlier position = higher rank, invert to score)
    fts_rank: dict[str, float] = {}
    if fts_results:
        max_rank = len(fts_results)
        for idx, feed in enumerate(fts_results):
            # Convert position to score: first result gets ~1.0, last gets small positive
            fts_rank[feed.id] = (max_rank - idx) / max(1, max_rank)

    # Get semantic results
    sem_results = lookup("semantic_search")(
        session,
        query,
        threshold=semantic_threshold,
        limit=limit * 2,
        filters=filters,
    )

    # Build semantic score map
    sem_score: dict[str, float] = {feed.id: score for feed, score in sem_results}

    # Collect all unique feed IDs from both sources
    all_feed_ids = set(fts_rank.keys()) | set(sem_score.keys())

    # Combine scores using weighted fusion
    combined: list[tuple[FeedSource, float]] = []
    feed_map: dict[str, FeedSource] = {}

    # Build feed map from FTS results
    for feed in fts_results:
        feed_map[feed.id] = feed

    # Add any feeds only in semantic results
    for feed, _score in sem_results:
        if feed.id not in feed_map:
            feed_map[feed.id] = feed

    for feed_id in all_feed_ids:
        ft = fts_rank.get(feed_id, 0.0)
        sm = sem_score.get(feed_id, 0.0)
        combined_score = (full_text_weight * ft) + (semantic_weight * sm)
        if feed_id in feed_map:
            combined.append((feed_map[feed_id], float(combined_score)))

    # Sort by combined score descending
    combined.sort(key=lambda item: item[1], reverse=True)

    logger.debug(f"Hybrid search returned {len(combined)} results")
    return combined[:limit]
