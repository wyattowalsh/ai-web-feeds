"""ai_web_feeds.recommendations -- AI-powered feed recommendations

This module provides recommendation functions using:
- Content-based filtering (embedding similarity)
- Popularity-based ranking
- Serendipity injection (random high-quality feeds)
- User interaction tracking

Implements Phase 1 recommendation strategy:
- 70% content similarity (topic-based)
- 20% popularity (validation success, subscriber counts)
- 10% serendipity (random high-quality feeds)
"""

from collections import Counter
from datetime import UTC, datetime
from functools import lru_cache
from secrets import SystemRandom
from typing import Any, cast

import numpy as np
from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.config import get_settings
from ai_web_feeds.models import (
    CurationStatus,
    FeedEmbedding,
    FeedSource,
    RecommendationInteraction,
    UserProfile,
)

EMBEDDING_NORM_EPSILON = 1e-8
_random = SystemRandom()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Get or create shared settings instance."""
    return Settings()


# ============================================================================
# Content-Based Recommendations
# ============================================================================


def calculate_content_similarity(
    session: Session,
    feed_ids: list[str],
    target_embedding: np.ndarray,
    limit: int = 20,
) -> list[tuple[str, float]]:
    """Calculate content similarity using embeddings.

    Args:
        session: Database session
        feed_ids: Feed IDs to compare
        target_embedding: Target embedding vector (384-dim)
        limit: Maximum recommendations

    Returns:
        List of (feed_id, similarity_score) tuples
    """
    logger.debug(f"Calculating content similarity for {len(feed_ids)} feeds")

    # Get embeddings for all feeds
    embeddings = session.exec(
        select(FeedEmbedding).where(cast(Any, FeedEmbedding.feed_id).in_(feed_ids))
    ).all()

    if not embeddings:
        logger.warning("No embeddings found for content similarity")
        return []

    # Guard against zero-norm target embedding
    target_norm = np.linalg.norm(target_embedding)
    if target_norm < EMBEDDING_NORM_EPSILON:
        logger.warning("Target embedding has zero norm, returning no results")
        return []

    # Calculate cosine similarities with zero-norm guards
    similarities = []
    for emb in embeddings:
        feed_vector = np.frombuffer(emb.embedding, dtype=np.float32)

        # Guard against zero-norm feed embedding
        feed_norm = np.linalg.norm(feed_vector)
        if feed_norm < EMBEDDING_NORM_EPSILON:
            logger.debug(f"Feed {emb.feed_id} has zero-norm embedding, skipping")
            continue

        # Compute cosine similarity safely
        similarity = np.dot(target_embedding, feed_vector) / (target_norm * feed_norm)
        similarities.append((emb.feed_id, float(similarity)))

    # Sort by similarity
    similarities.sort(key=lambda x: x[1], reverse=True)
    return similarities[:limit]


def get_similar_feeds_by_topic(
    session: Session,
    topics: list[str],
    exclude_ids: list[str],
    limit: int = 20,
) -> list[FeedSource]:
    """Get feeds with similar topics.

    Args:
        session: Database session
        topics: Target topics
        exclude_ids: Feed IDs to exclude
        limit: Maximum recommendations

    Returns:
        List of FeedSource objects
    """
    logger.debug(f"Finding feeds with topics: {topics}")

    # Get all feeds
    statement = (
        select(FeedSource)
        .where(cast(Any, FeedSource.id).not_in(exclude_ids))
        .where(FeedSource.curation_status != "inactive")
    )
    all_feeds = list(session.exec(statement).all())

    if not all_feeds:
        return []

    # Calculate topic overlap scores
    scored_feeds = []
    for feed in all_feeds:
        if not feed.topics:
            continue

        # Calculate Jaccard similarity with topics
        feed_topic_set = set(feed.topics)
        intersection = len(topic_set & feed_topic_set)
        union = len(topic_set | feed_topic_set)

        if intersection > 0 and union > 0:
            jaccard_score = intersection / union
            scored_feeds.append((feed, jaccard_score))

    # Sort by score
    scored_feeds.sort(key=lambda x: x[1], reverse=True)

    return [feed for feed, _ in scored_feeds[:limit]]


# ============================================================================
# Popularity-Based Recommendations
# ============================================================================


def calculate_popularity_scores(
    session: Session,
    feed_ids: list[str],
) -> dict[str, float]:
    """Calculate popularity scores for feeds.

    Combines:
    - Validation success rate (40%)
    - Validation count (frequency) (30%)
    - Verified status (30%)

    Args:
        session: Database session
        feed_ids: Feed IDs to score

    Returns:
        Dictionary mapping feed_id -> popularity_score (0.0-1.0)
    """
    logger.debug(f"Calculating popularity scores for {len(feed_ids)} feeds")

    feeds = session.exec(select(FeedSource).where(cast(Any, FeedSource.id).in_(feed_ids))).all()

    scores = {}

    # Get max validation count for normalization
    max_validation_count = max(
        (feed.validation_count for feed in feeds if feed.validation_count),
        default=1,
    )

    for feed in feeds:
        # Component 1: Validation success (from popularity_score field)
        validation_success = min(max(feed.popularity_score or 0.0, 0.0), 1.0)

        # Component 2: Validation frequency (normalized)
        validation_frequency = (
            (feed.validation_count or 0) / max_validation_count if max_validation_count > 0 else 0.0
        )

        # Component 3: Verified status
        verified_bonus = 1.0 if feed.verified else 0.5

        # Weighted average
        popularity = 0.4 * validation_success + 0.3 * validation_frequency + 0.3 * verified_bonus

        scores[feed.id] = min(max(popularity, 0.0), 1.0)

    return scores


def get_popular_feeds(
    session: Session,
    exclude_ids: list[str],
    limit: int = 10,
) -> list[FeedSource]:
    """Get most popular feeds.

    Args:
        session: Database session
        exclude_ids: Feed IDs to exclude
        limit: Maximum recommendations

    Returns:
        List of FeedSource objects sorted by popularity
    """
    logger.debug(f"Getting {limit} popular feeds")

    # Get all active verified feeds
    statement = (
        select(FeedSource)
        .where(cast(Any, FeedSource.id).not_in(exclude_ids))
        .where(cast(Any, FeedSource.verified).is_(True))
        .where(FeedSource.curation_status != "inactive")
    )
    if exclude_ids:
        statement = statement.where(FeedSource.id.not_in(exclude_ids))
    feeds = list(session.exec(statement).all())

    if not feeds:
        return []

    # Calculate popularity scores
    feed_ids = [feed.id for feed in feeds]
    popularity_scores = calculate_popularity_scores(session, feed_ids)

    # Sort by popularity
    feeds.sort(key=lambda f: popularity_scores.get(f.id, 0.0), reverse=True)

    return feeds[:limit]


# ============================================================================
# Serendipity Recommendations
# ============================================================================


def get_serendipity_feeds(
    session: Session,
    exclude_ids: list[str],
    limit: int = 5,
) -> list[FeedSource]:
    """Get random high-quality feeds for serendipity.

    Args:
        session: Database session
        exclude_ids: Feed IDs to exclude
        limit: Maximum recommendations

    Returns:
        List of random FeedSource objects (verified, active)
    """
    logger.debug(f"Getting {limit} serendipity feeds")

    # Get all verified active feeds
    statement = (
        select(FeedSource)
        .where(cast(Any, FeedSource.id).not_in(exclude_ids))
        .where(cast(Any, FeedSource.verified).is_(True))
        .where(FeedSource.curation_status != "inactive")
    )
    if exclude_ids:
        statement = statement.where(FeedSource.id.not_in(exclude_ids))
    feeds = list(session.exec(statement).all())

    if not feeds:
        return []

    # Random sample
    sample_size = min(limit, len(feeds))
    return _random.sample(feeds, sample_size)


# ============================================================================
# Unified Recommendation Engine
# ============================================================================


def generate_recommendations(
    session: Session,
    user_id: str | None = None,
    seed_feed_ids: list[str] | None = None,
    seed_topics: list[str] | None = None,
    limit: int = 20,
    content_weight: float | None = None,
    popularity_weight: float | None = None,
    serendipity_weight: float | None = None,
) -> list[tuple[FeedSource, float, str]]:
    """Generate personalized feed recommendations.

    Args:
        session: Database session
        user_id: User ID (optional, for personalization)
        seed_feed_ids: Seed feed IDs for content-based recommendations
        seed_topics: Seed topics for topic-based recommendations
        limit: Maximum recommendations
        content_weight: Weight for content similarity (default from config)
        popularity_weight: Weight for popularity (default from config)
        serendipity_weight: Weight for serendipity (default from config)

    Returns:
        List of (FeedSource, score, reason) tuples
    """
    settings = get_settings()
    logger.info(f"Generating {limit} recommendations for user {user_id}")

    # Use config weights if not provided
    content_weight = content_weight or settings.recommendation.content_weight
    popularity_weight = popularity_weight or settings.recommendation.popularity_weight
    serendipity_weight = serendipity_weight or settings.recommendation.serendipity_weight

    # Normalize weights
    total_weight = content_weight + popularity_weight + serendipity_weight
    content_weight /= total_weight
    popularity_weight /= total_weight
    serendipity_weight /= total_weight

    # Exclude seed feeds
    exclude_ids = list(seed_feed_ids or [])

    # Get user profile for interaction history
    if user_id:
        user_profile = session.get(UserProfile, user_id)
        if user_profile:
            exclude_ids.extend(user_profile.followed_feeds)
            exclude_ids.extend((user_profile.interaction_history or {}).keys())

    # Calculate recommendation counts
    content_count = int(limit * content_weight)
    popularity_count = int(limit * popularity_weight)
    serendipity_count = limit - content_count - popularity_count

    recommendations = []

    # 1. Content-based recommendations
    if content_count > 0 and (seed_feed_ids or seed_topics):
        if seed_topics:
            # Topic-based similarity
            content_recs = get_similar_feeds_by_topic(
                session,
                seed_topics,
                list(exclude_ids),
                content_count,
            )
            for feed in content_recs:
                recommendations.append((feed, content_weight, "similar_topics"))
        elif seed_feed_ids:
            # Embedding-based similarity (requires embeddings)
            # For MVP, fallback to topic-based
            seed_feed = session.get(FeedSource, seed_feed_ids[0])
            if seed_feed and seed_feed.topics:
                content_recs = get_similar_feeds_by_topic(
                    session, seed_feed.topics, list(exclude_ids), content_count
                )
                for feed in content_recs:
                    recommendations.append((feed, content_weight, "similar_content"))

    # 2. Popularity-based recommendations
    if popularity_count > 0:
        current_exclude = list(exclude_ids | {rec[0].id for rec in recommendations})
        popularity_recs = get_popular_feeds(session, current_exclude, popularity_count)
        for feed in popularity_recs:
            recommendations.append((feed, popularity_weight, "popular"))

    # 3. Serendipity recommendations
    if serendipity_count > 0:
        current_exclude = list(exclude_ids | {rec[0].id for rec in recommendations})
        serendipity_recs = get_serendipity_feeds(session, current_exclude, serendipity_count)
        for feed in serendipity_recs:
            recommendations.append((feed, serendipity_weight, "discover"))

    # Shuffle to mix different recommendation types
    _random.shuffle(recommendations)

    logger.debug(f"Generated {len(recommendations)} recommendations")
    return recommendations[:limit]


# ============================================================================
# User Interaction Tracking
# ============================================================================


def track_recommendation_interaction(
    session: Session,
    user_id: str,
    feed_id: str,
    interaction_type: str,
    recommendation_reason: str,
) -> None:
    """Track user interaction with recommendations.

    Args:
        session: Database session
        user_id: User ID
        feed_id: Feed ID
        interaction_type: 'view', 'click', 'subscribe', 'dismiss'
        recommendation_reason: Why feed was recommended
    """
    interaction = RecommendationInteraction(
        user_id=user_id,
        feed_id=feed_id,
        interaction_type=interaction_type,
        context={"reason": recommendation_reason},
    )

    session.add(interaction)

    # Update user profile
    user_profile = session.get(UserProfile, user_id)
    if not user_profile:
        user_profile = UserProfile(user_id=user_id)
        session.add(user_profile)

    feed = session.get(FeedSource, feed_id)

    if interaction_type == "subscribe":
        followed_feeds = list(user_profile.followed_feeds or [])
        if feed_id not in followed_feeds:
            followed_feeds.append(feed_id)
            user_profile.followed_feeds = followed_feeds

    if interaction_type in {"view", "click", "subscribe"} and feed is not None:
        preferred_topics = set(user_profile.preferred_topics or [])
        preferred_topics.update(feed.topics or [])
        user_profile.preferred_topics = sorted(preferred_topics)

    interaction_history = dict(user_profile.interaction_history or {})
    interaction_history[feed_id] = {
        "interaction_type": interaction_type,
        "reason": recommendation_reason,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    user_profile.interaction_history = interaction_history

    user_profile.updated_at = datetime.now(UTC)
    session.commit()
    logger.debug(f"Tracked {interaction_type} interaction: user={user_id}, feed={feed_id}")


def get_user_recommendations(
    session: Session,
    user_id: str,
    limit: int = 20,
) -> list[tuple[FeedSource, float, str]]:
    """Get personalized recommendations based on user profile.

    Args:
        session: Database session
        user_id: User ID
        limit: Maximum recommendations

    Returns:
        List of (FeedSource, score, reason) tuples
    """
    logger.info(f"Getting personalized recommendations for user {user_id}")

    # Get user profile
    user_profile = session.get(UserProfile, user_id)

    seed_feed_ids = None
    seed_topics = None

    if user_profile:
        # Use followed feeds as seeds
        if user_profile.followed_feeds:
            seed_feed_ids = user_profile.followed_feeds[:5]  # Top 5

        if user_profile.preferred_topics:
            seed_topics = user_profile.preferred_topics[:5]

        # Extract topics from followed feeds when no explicit topic preference exists
        if seed_feed_ids:
            feeds = session.exec(
                select(FeedSource).where(cast(Any, FeedSource.id).in_(seed_feed_ids))
            ).all()
            all_topics = []
            for feed in feeds:
                if feed.topics:
                    all_topics.extend(feed.topics)
            # Get most common topics
            if all_topics and not seed_topics:
                topic_counts = Counter(all_topics)
                seed_topics = [topic for topic, _ in topic_counts.most_common(5)]

    # Generate recommendations
    return generate_recommendations(
        session,
        user_id=user_id,
        seed_feed_ids=seed_feed_ids,
        seed_topics=seed_topics,
        limit=limit,
    )
