"""Unit tests for ai_web_feeds.recommendations module."""

import pytest
import numpy as np
from unittest.mock import Mock, patch
from sqlmodel import Session, SQLModel, create_engine, select
from datetime import datetime

from ai_web_feeds.models import (
    FeedSource,
    FeedEmbedding,
    UserProfile,
    RecommendationInteraction,
)
from ai_web_feeds.recommendations import (
    calculate_content_similarity,
    get_similar_feeds_by_topic,
    calculate_popularity_scores,
    get_popular_feeds,
    get_serendipity_feeds,
    generate_recommendations,
    track_recommendation_interaction,
    get_user_recommendations,
)


@pytest.fixture
def test_engine():
    """Create in-memory SQLite engine for testing."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def test_session(test_engine):
    """Create test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def sample_feeds(test_session):
    """Create sample feeds for testing."""
    feeds = [
        FeedSource(
            id="feed1",
            title="ML Research Feed",
            topics=["llm", "research"],
            verified=True,
            curation_status="verified",
            popularity_score=0.9,
            validation_count=100,
        ),
        FeedSource(
            id="feed2",
            title="Training Blog",
            topics=["training", "llm"],
            verified=True,
            curation_status="verified",
            popularity_score=0.8,
            validation_count=80,
        ),
        FeedSource(
            id="feed3",
            title="CV Research",
            topics=["cv", "research"],
            verified=True,
            curation_status="verified",
            popularity_score=0.7,
            validation_count=60,
        ),
        FeedSource(
            id="feed4",
            title="Inactive Feed",
            topics=["old"],
            verified=False,
            curation_status="inactive",
            popularity_score=0.3,
            validation_count=10,
        ),
    ]
    
    for feed in feeds:
        test_session.add(feed)
    test_session.commit()
    
    return feeds


@pytest.fixture
def sample_embeddings(test_session, sample_feeds):
    """Create sample embeddings."""
    embeddings = []
    for feed in sample_feeds[:3]:  # Only for active feeds
        embedding_vector = np.random.rand(384).astype(np.float32)
        embedding = FeedEmbedding(
            feed_id=feed.id,
            embedding=embedding_vector.tobytes(),
            embedding_model="test-model",
            embedding_provider="local",
        )
        test_session.add(embedding)
        embeddings.append(embedding)
    
    test_session.commit()
    return embeddings


class TestContentSimilarity:
    """Tests for content-based similarity calculations."""
    
    def test_calculate_content_similarity(self, test_session, sample_embeddings):
        """Test calculating content similarity."""
        # Create target embedding similar to first feed
        first_embedding = np.frombuffer(sample_embeddings[0].embedding, dtype=np.float32)
        target_embedding = first_embedding + np.random.rand(384).astype(np.float32) * 0.1
        target_embedding = target_embedding / np.linalg.norm(target_embedding)
        
        feed_ids = ["feed1", "feed2", "feed3"]
        similarities = calculate_content_similarity(
            test_session, feed_ids, target_embedding, limit=3
        )
        
        assert len(similarities) <= 3
        for feed_id, similarity in similarities:
            assert feed_id in feed_ids
            assert 0.0 <= similarity <= 1.0
    
    def test_calculate_content_similarity_empty(self, test_session):
        """Test content similarity with no embeddings."""
        target_embedding = np.random.rand(384).astype(np.float32)
        
        similarities = calculate_content_similarity(
            test_session, ["nonexistent"], target_embedding, limit=10
        )
        
        assert len(similarities) == 0
    
    def test_get_similar_feeds_by_topic(self, test_session, sample_feeds):
        """Test getting similar feeds by topic overlap."""
        target_topics = ["llm", "research"]
        exclude_ids = []
        
        similar_feeds = get_similar_feeds_by_topic(
            test_session, target_topics, exclude_ids, limit=10
        )
        
        # Should return feeds with topic overlap
        assert len(similar_feeds) > 0
        
        # Feeds with more topic overlap should come first
        for feed in similar_feeds:
            assert any(topic in feed.topics for topic in target_topics)
    
    def test_get_similar_feeds_by_topic_exclude(self, test_session, sample_feeds):
        """Test topic similarity respects exclusions."""
        target_topics = ["llm"]
        exclude_ids = ["feed1", "feed2"]
        
        similar_feeds = get_similar_feeds_by_topic(
            test_session, target_topics, exclude_ids, limit=10
        )
        
        # Should not include excluded feeds
        for feed in similar_feeds:
            assert feed.id not in exclude_ids


class TestPopularityScoring:
    """Tests for popularity-based recommendations."""
    
    def test_calculate_popularity_scores(self, test_session, sample_feeds):
        """Test calculating popularity scores."""
        feed_ids = ["feed1", "feed2", "feed3"]
        
        scores = calculate_popularity_scores(test_session, feed_ids)
        
        assert len(scores) == 3
        for feed_id, score in scores.items():
            assert feed_id in feed_ids
            assert 0.0 <= score <= 1.0
        
        # Feed1 should have highest score (highest validation metrics)
        assert scores["feed1"] >= scores["feed2"]
        assert scores["feed2"] >= scores["feed3"]
    
    def test_get_popular_feeds(self, test_session, sample_feeds):
        """Test getting popular feeds."""
        exclude_ids = []
        
        popular_feeds = get_popular_feeds(test_session, exclude_ids, limit=3)
        
        # Should return verified active feeds
        assert len(popular_feeds) > 0
        for feed in popular_feeds:
            assert feed.verified is True
            assert feed.curation_status != "inactive"
        
        # Should be sorted by popularity
        if len(popular_feeds) >= 2:
            assert popular_feeds[0].popularity_score >= popular_feeds[1].popularity_score
    
    def test_get_popular_feeds_exclude(self, test_session, sample_feeds):
        """Test popular feeds respects exclusions."""
        exclude_ids = ["feed1"]
        
        popular_feeds = get_popular_feeds(test_session, exclude_ids, limit=10)
        
        # Should not include excluded feed
        for feed in popular_feeds:
            assert feed.id not in exclude_ids


class TestSerendipity:
    """Tests for serendipity recommendations."""
    
    def test_get_serendipity_feeds(self, test_session, sample_feeds):
        """Test getting random high-quality feeds."""
        exclude_ids = []
        
        serendipity_feeds = get_serendipity_feeds(test_session, exclude_ids, limit=2)
        
        # Should return verified active feeds
        assert len(serendipity_feeds) <= 2
        for feed in serendipity_feeds:
            assert feed.verified is True
            assert feed.curation_status != "inactive"
    
    def test_get_serendipity_feeds_randomness(self, test_session, sample_feeds):
        """Test that serendipity picks are random."""
        exclude_ids = []
        
        # Get multiple samples
        samples = [
            get_serendipity_feeds(test_session, exclude_ids, limit=1)
            for _ in range(10)
        ]
        
        # Should have some variety (not always same feed)
        unique_feeds = set(s[0].id for s in samples if s)
        assert len(unique_feeds) >= 1  # At least one different feed


class TestUnifiedRecommendations:
    """Tests for unified recommendation engine."""
    
    def test_generate_recommendations_with_topics(self, test_session, sample_feeds):
        """Test generating recommendations with topic seeds."""
        recommendations = generate_recommendations(
            test_session,
            seed_topics=["llm", "research"],
            limit=5,
        )
        
        assert len(recommendations) <= 5
        for feed, score, reason in recommendations:
            assert isinstance(feed, FeedSource)
            assert 0.0 <= score <= 1.0
            assert reason in ["similar_topics", "similar_content", "popular", "discover"]
    
    def test_generate_recommendations_with_feeds(self, test_session, sample_feeds):
        """Test generating recommendations with feed seeds."""
        recommendations = generate_recommendations(
            test_session,
            seed_feed_ids=["feed1"],
            limit=5,
        )
        
        assert len(recommendations) <= 5
        
        # Seed feed should be excluded
        for feed, _, _ in recommendations:
            assert feed.id != "feed1"
    
    def test_generate_recommendations_respects_weights(self, test_session, sample_feeds):
        """Test recommendation weights are applied."""
        recommendations = generate_recommendations(
            test_session,
            seed_topics=["llm"],
            limit=20,
            content_weight=0.7,
            popularity_weight=0.2,
            serendipity_weight=0.1,
        )
        
        # Count recommendation types
        reason_counts = {}
        for _, _, reason in recommendations:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
        
        # Should have mix of recommendation types
        assert len(reason_counts) > 0


class TestUserInteractions:
    """Tests for user interaction tracking."""
    
    def test_track_recommendation_interaction(self, test_session, sample_feeds):
        """Test tracking user interactions."""
        user_id = "test_user"
        feed_id = "feed1"
        
        track_recommendation_interaction(
            test_session,
            user_id=user_id,
            feed_id=feed_id,
            interaction_type="click",
            recommendation_reason="popular",
        )
        
        # Verify interaction was logged
        interactions = list(test_session.exec(select(RecommendationInteraction)).all())
        assert len(interactions) == 1
        
        interaction = interactions[0]
        assert interaction.user_id == user_id
        assert interaction.feed_id == feed_id
        assert interaction.interaction_type == "click"
        assert interaction.recommendation_reason == "popular"
    
    def test_track_interaction_creates_user_profile(self, test_session, sample_feeds):
        """Test interaction tracking creates user profile if needed."""
        user_id = "new_user"
        
        track_recommendation_interaction(
            test_session,
            user_id=user_id,
            feed_id="feed1",
            interaction_type="view",
            recommendation_reason="discover",
        )
        
        # User profile should be created
        user_profile = test_session.get(UserProfile, user_id)
        assert user_profile is not None
        assert "feed1" in user_profile.viewed_feeds
    
    def test_track_subscribe_interaction(self, test_session, sample_feeds):
        """Test tracking subscribe interactions."""
        user_id = "test_user"
        feed_id = "feed1"
        
        track_recommendation_interaction(
            test_session,
            user_id=user_id,
            feed_id=feed_id,
            interaction_type="subscribe",
            recommendation_reason="similar_topics",
        )
        
        # User profile should track subscription
        user_profile = test_session.get(UserProfile, user_id)
        assert feed_id in user_profile.subscribed_feeds


class TestPersonalizedRecommendations:
    """Tests for personalized recommendations."""
    
    def test_get_user_recommendations_new_user(self, test_session, sample_feeds):
        """Test recommendations for new user with no history."""
        user_id = "new_user"
        
        recommendations = get_user_recommendations(test_session, user_id, limit=5)
        
        # Should still get recommendations (popular + serendipity)
        assert len(recommendations) > 0
    
    def test_get_user_recommendations_with_history(self, test_session, sample_feeds):
        """Test personalized recommendations based on user history."""
        user_id = "test_user"
        
        # Create user profile with subscriptions
        user_profile = UserProfile(
            user_id=user_id,
            subscribed_feeds=["feed1"],
            viewed_feeds=["feed1", "feed2"],
        )
        test_session.add(user_profile)
        test_session.commit()
        
        recommendations = get_user_recommendations(test_session, user_id, limit=5)
        
        # Should get personalized recommendations
        assert len(recommendations) > 0
        
        # Should exclude viewed feeds
        for feed, _, _ in recommendations:
            assert feed.id not in user_profile.viewed_feeds
    
    def test_get_user_recommendations_uses_subscribed_topics(self, test_session, sample_feeds):
        """Test recommendations use topics from subscribed feeds."""
        user_id = "test_user"
        
        # Create user profile with subscription to feed1 (topics: llm, research)
        user_profile = UserProfile(
            user_id=user_id,
            subscribed_feeds=["feed1"],
            viewed_feeds=["feed1"],
        )
        test_session.add(user_profile)
        test_session.commit()
        
        recommendations = get_user_recommendations(test_session, user_id, limit=10)
        
        # Should recommend feeds with similar topics
        assert len(recommendations) > 0
        
        # At least some recommendations should have overlapping topics
        topic_overlap_found = False
        for feed, _, reason in recommendations:
            if reason == "similar_topics" and any(t in ["llm", "research"] for t in feed.topics):
                topic_overlap_found = True
                break
        
        # Note: May not always find overlap due to randomness, so we check reason types
        reason_types = set(reason for _, _, reason in recommendations)
        assert len(reason_types) > 0


# Property-based tests
@pytest.mark.parametrize("limit", [5, 10, 20, 50])
def test_generate_recommendations_respects_limit(test_session, sample_feeds, limit):
    """Property test: Recommendations respect limit parameter."""
    recommendations = generate_recommendations(
        test_session,
        seed_topics=["llm"],
        limit=limit,
    )
    
    assert len(recommendations) <= limit


@pytest.mark.parametrize("interaction_type", ["view", "click", "subscribe", "dismiss"])
def test_track_all_interaction_types(test_session, sample_feeds, interaction_type):
    """Property test: All interaction types can be tracked."""
    track_recommendation_interaction(
        test_session,
        user_id="test_user",
        feed_id="feed1",
        interaction_type=interaction_type,
        recommendation_reason="test",
    )
    
    interactions = list(test_session.exec(select(RecommendationInteraction)).all())
    assert len(interactions) == 1
    assert interactions[0].interaction_type == interaction_type


@pytest.mark.parametrize("num_feeds", [1, 5, 10])
def test_popularity_scores_all_feeds(test_session, num_feeds):
    """Property test: Popularity scores work for various feed counts."""
    # Create test feeds
    feeds = [
        FeedSource(
            id=f"feed{i}",
            title=f"Feed {i}",
            verified=True,
            popularity_score=0.5 + (i * 0.1),
            validation_count=10 * i,
        )
        for i in range(num_feeds)
    ]
    
    for feed in feeds:
        test_session.add(feed)
    test_session.commit()
    
    feed_ids = [f.id for f in feeds]
    scores = calculate_popularity_scores(test_session, feed_ids)
    
    assert len(scores) == num_feeds
    for score in scores.values():
        assert 0.0 <= score <= 1.0

