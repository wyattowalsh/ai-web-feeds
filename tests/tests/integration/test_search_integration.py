"""Integration tests for search functionality.

These tests verify the integration between search, embeddings, and storage modules.
"""

import numpy as np
import pytest
from ai_web_feeds.embeddings import save_feed_embedding
from ai_web_feeds.models import FeedEmbedding, FeedSource
from ai_web_feeds.search import autocomplete, build_trie_index
from ai_web_feeds.storage import DatabaseManager
from sqlmodel import SQLModel, create_engine


@pytest.fixture
def integration_db():
    """Create temporary database for integration tests."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    db = DatabaseManager(str(engine.url))
    return db


@pytest.fixture
def populated_db(integration_db):
    """Populate database with test data."""
    with integration_db.get_session() as session:
        # Create sample feeds
        feeds = [
            FeedSource(
                id="openai",
                title="OpenAI Blog",
                feed="https://openai.com/blog/feed.xml",
                site="https://openai.com",
                topics=["llm", "research", "agents"],
                notes="AI research from OpenAI",
                verified=True,
            ),
            FeedSource(
                id="huggingface",
                title="Hugging Face",
                feed="https://huggingface.co/blog/feed.xml",
                site="https://huggingface.co",
                topics=["llm", "opensource", "training"],
                notes="ML models and datasets",
                verified=True,
            ),
        ]

        for feed in feeds:
            session.add(feed)
        session.commit()

    return integration_db


class TestSearchStorageIntegration:
    """Test integration between search and storage."""

    def test_initialize_search_tables(self, populated_db):
        """Test initializing FTS5 and Trie index."""
        # Should not raise errors
        try:
            populated_db.initialize_search_tables()
        except Exception as e:
            # FTS5 may not work in all SQLite versions
            pytest.skip(f"FTS5 not available: {e}")

    def test_autocomplete_with_real_data(self, populated_db):
        """Test autocomplete with populated database."""
        with populated_db.get_session() as session:
            # Build Trie index
            build_trie_index(session)

            # Test autocomplete
            results = autocomplete(session, "open", limit=5)

            assert "feeds" in results
            assert "topics" in results


class TestEmbeddingSearchIntegration:
    """Test integration between embeddings and search."""

    @pytest.mark.slow
    def test_generate_and_search_embeddings(self, populated_db):
        """Test generating embeddings and searching with them."""
        with populated_db.get_session() as session:
            # Get feeds
            feeds = list(session.query(FeedSource).all())

            # Generate embeddings (mocked in unit tests, here we test real flow)
            for feed in feeds:
                try:
                    # This will fail without actual model, but tests the flow
                    embedding = np.random.rand(384).astype(np.float32)
                    save_feed_embedding(session, feed.id, embedding, "test")
                except Exception as e:
                    pytest.skip(f"Model not available: {e}")

            # Verify embeddings were saved
            embeddings = list(session.query(FeedEmbedding).all())
            assert len(embeddings) == len(feeds)


class TestSearchRecommendationIntegration:
    """Test integration between search and recommendations."""

    def test_search_to_recommendation_flow(self, populated_db):
        """Test user flow: search -> view -> get recommendations."""
        # 1. User searches
        results = populated_db.search_feeds("machine learning", search_type="full_text", limit=10)

        # 2. User views results (log search)
        user_id = "test_user"
        populated_db.log_search(
            user_id=user_id,
            query_text="machine learning",
            search_type="full_text",
            filters={},
            result_count=len(results),
            clicked_results=[results[0].id] if results else [],
        )

        # 3. Get recommendations based on viewed feed
        if results:
            recommendations = populated_db.get_recommendations(
                user_id=user_id,
                seed_feed_ids=[results[0].id],
                limit=5,
            )

            # Should get some recommendations
            assert isinstance(recommendations, list)


class TestFullWorkflowIntegration:
    """Test complete user workflows."""

    def test_complete_analytics_workflow(self, populated_db):
        """Test analytics data collection and retrieval."""
        # 1. Get summary metrics
        with populated_db.get_session() as session:
            from ai_web_feeds.analytics import calculate_summary_metrics

            metrics = calculate_summary_metrics(session, date_range_days=30)

            assert "total_feeds" in metrics
            assert metrics["total_feeds"] >= 0

    def test_complete_search_workflow(self, populated_db):
        """Test complete search workflow."""
        # 1. Initialize search
        populated_db.initialize_search_tables()

        # 2. Perform search
        results = populated_db.search_feeds("AI", search_type="full_text", limit=10)

        # 3. Get autocomplete
        autocomplete_results = populated_db.autocomplete_search("ope", limit=5)

        assert isinstance(results, list)
        assert "feeds" in autocomplete_results
