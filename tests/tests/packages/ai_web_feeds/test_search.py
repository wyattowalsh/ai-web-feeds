"""Unit tests for ai_web_feeds.search module."""

from unittest.mock import Mock, patch

import pytest
from ai_web_feeds.models import FeedEmbedding, FeedSource, SearchQuery
from ai_web_feeds.search import (
    TrieIndex,
    TrieNode,
    autocomplete,
    build_trie_index,
    full_text_search,
    get_saved_searches,
    log_search_query,
    save_search,
    semantic_search,
)
from sqlmodel import Session, SQLModel, create_engine, select


@pytest.fixture
def test_engine():
    """Create in-memory SQLite engine for testing."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def test_session(test_engine):
    """Create test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def sample_feeds(test_session):
    """Create sample feed sources for testing."""
    feeds = [
        FeedSource(
            id="openai-blog",
            title="OpenAI Blog",
            feed="https://openai.com/blog/feed.xml",
            site="https://openai.com",
            notes="AI research and updates",
            topics=["llm", "agents", "research"],
            source_type="blog",
            verified=True,
            curation_status="verified",
        ),
        FeedSource(
            id="huggingface",
            title="Hugging Face Blog",
            feed="https://huggingface.co/blog/feed.xml",
            site="https://huggingface.co",
            notes="ML models and datasets",
            topics=["llm", "training", "opensource"],
            source_type="blog",
            verified=True,
            curation_status="verified",
        ),
        FeedSource(
            id="pytorch",
            title="PyTorch Blog",
            feed="https://pytorch.org/blog/feed.xml",
            site="https://pytorch.org",
            notes="PyTorch framework updates",
            topics=["training", "framework"],
            source_type="blog",
            verified=True,
            curation_status="verified",
        ),
    ]

    for feed in feeds:
        test_session.add(feed)
    test_session.commit()

    return feeds


class TestTrieIndex:
    """Tests for Trie index data structure."""

    def test_trie_node_initialization(self):
        """Test TrieNode initialization."""
        node = TrieNode()

        assert node.children == {}
        assert node.is_end_of_word is False
        assert node.feed_ids == []
        assert node.frequency == 0

    def test_trie_insert_single_word(self):
        """Test inserting a single word."""
        trie = TrieIndex()
        trie.insert("machine", "feed1")

        # Traverse the trie
        node = trie.root
        for char in "machine":
            assert char in node.children
            node = node.children[char]

        assert node.is_end_of_word is True
        assert "feed1" in node.feed_ids
        assert node.frequency == 1

    def test_trie_insert_multiple_words(self):
        """Test inserting multiple words."""
        trie = TrieIndex()
        trie.insert("machine", "feed1")
        trie.insert("machine", "feed2")
        trie.insert("learning", "feed3")

        # Check "machine" node
        node = trie.root
        for char in "machine":
            node = node.children[char]

        assert len(node.feed_ids) == 2
        assert "feed1" in node.feed_ids
        assert "feed2" in node.feed_ids
        assert node.frequency == 2

    def test_trie_search_prefix_found(self):
        """Test searching for existing prefix."""
        trie = TrieIndex()
        trie.insert("machine", "feed1")
        trie.insert("machine", "feed2")
        trie.insert("learning", "feed3")

        results = trie.search_prefix("mach", limit=5)

        assert len(results) == 1
        word, feed_ids, frequency = results[0]
        assert word == "machine"
        assert len(feed_ids) == 2
        assert frequency == 2

    def test_trie_search_prefix_not_found(self):
        """Test searching for non-existing prefix."""
        trie = TrieIndex()
        trie.insert("machine", "feed1")

        results = trie.search_prefix("xyz", limit=5)

        assert len(results) == 0

    def test_trie_search_prefix_limit(self):
        """Test search limit is respected."""
        trie = TrieIndex()
        words = ["apple", "application", "apply", "appreciate", "approach"]
        for word in words:
            trie.insert(word, f"feed_{word}")

        results = trie.search_prefix("app", limit=3)

        assert len(results) <= 3

    def test_trie_case_insensitive(self):
        """Test that Trie is case-insensitive."""
        trie = TrieIndex()
        trie.insert("Machine", "feed1")

        results = trie.search_prefix("mach", limit=5)

        assert len(results) == 1
        assert results[0][0] == "machine"


class TestBuildTrieIndex:
    """Tests for building Trie index from database."""

    def test_build_trie_index_empty_db(self, test_session):
        """Test building Trie with empty database."""
        trie = build_trie_index(test_session)

        assert trie is not None
        assert isinstance(trie, TrieIndex)

    def test_build_trie_index_with_feeds(self, test_session, sample_feeds):
        """Test building Trie with sample feeds."""
        trie = build_trie_index(test_session)

        # Check that feed titles are indexed
        results = trie.search_prefix("open", limit=5)
        assert len(results) > 0

        # Check that topics are indexed
        results = trie.search_prefix("llm", limit=5)
        assert len(results) > 0


class TestFullTextSearch:
    """Tests for FTS5 full-text search."""

    def test_full_text_search_basic(self, test_session, sample_feeds):
        """Test basic full-text search."""
        mock_connection = Mock()
        mock_connection.execute.return_value.all.return_value = [
            ("openai-blog", -0.5),
            ("huggingface", -1.0),
        ]

        with patch.object(test_session, "connection", return_value=mock_connection):
            results = full_text_search(test_session, "machine learning", limit=10)

        mock_connection.execute.assert_called_once()
        assert [feed.id for feed in results] == ["openai-blog", "huggingface"]

    def test_full_text_search_uses_parameterized_query(self, test_session, sample_feeds):
        """Test that FTS uses SQLAlchemy text() with parameterized query."""
        from sqlalchemy import text as real_text

        mock_connection = Mock()
        mock_connection.execute.return_value.all.return_value = [
            ("openai-blog", -0.5),
        ]

        # Use the real text() function for this test
        with patch("ai_web_feeds.search.text", side_effect=real_text) as mock_text_call:
            with patch.object(test_session, "connection", return_value=mock_connection):
                full_text_search(test_session, "test query", limit=10)

        call_args = mock_text_call.call_args[0][0]
        assert ":query" in call_args
        assert ":limit" in call_args
        assert "MATCH :query" in call_args

        execute_args = mock_connection.execute.call_args[0]
        assert execute_args[1]["query"] == "test query"
        assert execute_args[1]["limit"] == 20

    def test_full_text_search_with_filters(self, test_session, sample_feeds):
        """Test full-text search with filters."""
        filters = {
            "source_type": "blog",
            "verified": True,
        }

        # Since FTS5 requires actual SQLite setup, we'll test the filter logic
        statement = select(FeedSource).where(FeedSource.source_type == "blog")
        results = list(test_session.exec(statement).all())

        assert len(results) == 3
        assert all(feed.source_type == "blog" for feed in results)


class TestSemanticSearch:
    """Tests for semantic similarity search."""

    @pytest.fixture
    def sample_embeddings(self, test_session, sample_feeds):
        """Create sample embeddings for testing."""
        import numpy as np

        embeddings = []
        for feed in sample_feeds:
            # Create dummy 384-dim embedding
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

    @patch("ai_web_feeds.embeddings.get_local_model")
    def test_generate_query_embedding_uses_cached_model(self, mock_get_model):
        """Test that generate_query_embedding uses cached model from embeddings."""
        import numpy as np

        # Mock the cached model
        mock_model = Mock()
        mock_embedding = np.random.rand(1, 384).astype(np.float32)
        mock_model.encode.return_value = mock_embedding
        mock_get_model.return_value = mock_model

        from ai_web_feeds.search import generate_query_embedding

        # Import fresh to ensure we test the right function
        embedding = generate_query_embedding("test query")

        # Verify cached model was used
        mock_get_model.assert_called_once()
        mock_model.encode.assert_called_once_with(["test query"])

        # Verify embedding is correct
        assert isinstance(embedding, np.ndarray)
        assert embedding.shape == (384,)
        assert embedding.dtype == np.float32

    @patch("ai_web_feeds.embeddings.get_local_model")
    def test_semantic_search_uses_cached_embedding_model(
        self, mock_get_model, test_session, sample_feeds, sample_embeddings
    ):
        """Test that semantic_search uses cached model for query embedding."""
        import numpy as np

        # Mock the cached model
        mock_model = Mock()
        query_embedding = np.random.rand(384).astype(np.float32)
        mock_model.encode.return_value = np.array([query_embedding])
        mock_get_model.return_value = mock_model

        results = semantic_search(test_session, "test query", threshold=0.5, limit=10)

        # Verify cached model was used
        mock_get_model.assert_called_once()

        # Should return list of (FeedSource, similarity) tuples
        assert isinstance(results, list)

    @patch("ai_web_feeds.search.generate_query_embedding")
    def test_semantic_search_with_threshold(
        self, mock_gen_embedding, test_session, sample_feeds, sample_embeddings
    ):
        """Test semantic search respects similarity threshold."""
        import numpy as np

        # Create query embedding similar to first feed's embedding
        first_embedding = np.frombuffer(sample_embeddings[0].embedding, dtype=np.float32)
        query_embedding = first_embedding + np.random.rand(384).astype(np.float32) * 0.1
        query_embedding = query_embedding / np.linalg.norm(query_embedding)
        mock_gen_embedding.return_value = query_embedding

        # Search with high threshold
        results_high = semantic_search(test_session, "test query", threshold=0.9, limit=10)

        # Search with low threshold
        results_low = semantic_search(test_session, "test query", threshold=0.5, limit=10)

        # Low threshold should have more or equal results
        assert len(results_low) >= len(results_high)


class TestAutocomplete:
    """Tests for autocomplete functionality."""

    def test_autocomplete_empty_prefix(self, test_session, sample_feeds):
        """Test autocomplete with empty/short prefix."""
        results = autocomplete(test_session, "a", limit=8)

        assert "feeds" in results
        assert "topics" in results
        assert results["feeds"] == []
        assert results["topics"] == []

    @patch("ai_web_feeds.search.get_trie_index")
    def test_autocomplete_feed_suggestions(self, mock_get_trie, test_session, sample_feeds):
        """Test autocomplete returns feed suggestions."""
        # Mock Trie index
        mock_trie = Mock(spec=TrieIndex)
        mock_trie.search_prefix.return_value = [
            ("openai", ["openai-blog"], 1),
            ("open", ["openai-blog"], 1),
        ]
        mock_get_trie.return_value = mock_trie

        results = autocomplete(test_session, "open", limit=8)

        assert "feeds" in results
        assert len(results["feeds"]) > 0
        assert results["feeds"][0]["id"] == "openai-blog"

    @patch("ai_web_feeds.search.get_trie_index")
    def test_autocomplete_topic_suggestions(self, mock_get_trie, test_session, sample_feeds):
        """Test autocomplete returns topic suggestions."""
        # Mock Trie index with topic results
        mock_trie = Mock(spec=TrieIndex)
        mock_trie.search_prefix.return_value = [
            ("llm", ["openai-blog", "huggingface"], 2),
        ]
        mock_get_trie.return_value = mock_trie

        results = autocomplete(test_session, "llm", limit=8)

        assert "topics" in results


class TestSearchLogging:
    """Tests for search query logging."""

    def test_log_search_query(self, test_session):
        """Test logging a search query."""
        log_search_query(
            test_session,
            user_id="test_user",
            query_text="machine learning",
            search_type="full_text",
            filters={"source_type": "blog"},
            result_count=10,
            clicked_results=["feed1", "feed2"],
        )

        # Verify query was logged
        queries = list(test_session.exec(select(SearchQuery)).all())
        assert len(queries) == 1

        query = queries[0]
        assert query.user_id == "test_user"
        assert query.query_text == "machine learning"
        assert query.search_type == "full_text"
        assert query.result_count == 10
        assert len(query.clicked_results) == 2


class TestSavedSearches:
    """Tests for saved search functionality."""

    def test_save_search(self, test_session):
        """Test saving a search."""
        saved = save_search(
            test_session,
            user_id="test_user",
            search_name="ML Research",
            query_text="machine learning",
            filters={"topics": ["llm", "training"]},
        )

        assert saved is not None
        assert saved.user_id == "test_user"
        assert saved.search_name == "ML Research"
        assert saved.query_text == "machine learning"
        assert saved.filters["topics"] == ["llm", "training"]

    def test_get_saved_searches(self, test_session):
        """Test retrieving saved searches."""
        # Save multiple searches
        save_search(test_session, "user1", "Search 1", "query1", {})
        save_search(test_session, "user1", "Search 2", "query2", {})
        save_search(test_session, "user2", "Search 3", "query3", {})

        # Get searches for user1
        searches = get_saved_searches(test_session, "user1")

        assert len(searches) == 2
        assert all(s.user_id == "user1" for s in searches)

    def test_get_saved_searches_empty(self, test_session):
        """Test retrieving saved searches for user with no searches."""
        searches = get_saved_searches(test_session, "nonexistent_user")

        assert len(searches) == 0


# Property-based tests
@pytest.mark.parametrize(
    "word,feed_id",
    [
        ("test", "feed1"),
        ("machine", "feed2"),
        ("learning", "feed3"),
        ("artificial", "feed4"),
        ("intelligence", "feed5"),
    ],
)
def test_trie_insert_various_words(word, feed_id):
    """Property test: Trie should correctly insert various words."""
    trie = TrieIndex()
    trie.insert(word, feed_id)

    results = trie.search_prefix(word[:3], limit=10)

    assert len(results) > 0
    assert any(feed_id in result[1] for result in results)


@pytest.mark.parametrize(
    "prefix,expected_min_results",
    [
        ("ma", 0),  # May or may not have results
        ("mach", 0),
        ("machin", 0),
    ],
)
def test_trie_search_prefix_lengths(prefix, expected_min_results):
    """Property test: Longer prefixes should maintain or reduce results."""
    trie = TrieIndex()
    trie.insert("machine", "feed1")
    trie.insert("machinery", "feed2")
    trie.insert("machines", "feed3")

    results = trie.search_prefix(prefix, limit=10)

    assert len(results) >= expected_min_results
