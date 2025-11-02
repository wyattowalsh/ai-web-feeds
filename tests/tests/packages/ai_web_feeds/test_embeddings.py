"""Unit tests for ai_web_feeds.embeddings module."""

from unittest.mock import Mock, patch

import numpy as np
import pytest
from sqlmodel import Session, SQLModel, create_engine

from ai_web_feeds.embeddings import (
    bytes_to_embedding,
    embedding_to_bytes,
    generate_all_feed_embeddings,
    generate_embeddings,
    generate_embeddings_hf,
    generate_embeddings_local,
    generate_feed_embedding,
    get_local_model,
    save_feed_embedding,
)
from ai_web_feeds.models import FeedSource


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
def sample_feed():
    """Create a sample feed for testing."""
    return FeedSource(
        id="test-feed",
        title="Test Feed",
        feed="https://example.com/feed.xml",
        site="https://example.com",
        notes="Test feed description",
        topics=["test", "example"],
        source_type="blog",
        verified=True,
    )


class TestEmbeddingConversion:
    """Tests for embedding byte conversion utilities."""

    def test_embedding_to_bytes(self):
        """Test converting embedding array to bytes."""
        embedding = np.random.rand(384).astype(np.float32)

        embedding_bytes = embedding_to_bytes(embedding)

        assert isinstance(embedding_bytes, bytes)
        assert len(embedding_bytes) == 384 * 4  # 4 bytes per float32

    def test_bytes_to_embedding(self):
        """Test converting bytes back to embedding array."""
        original = np.random.rand(384).astype(np.float32)
        embedding_bytes = original.tobytes()

        recovered = bytes_to_embedding(embedding_bytes)

        assert isinstance(recovered, np.ndarray)
        assert recovered.dtype == np.float32
        assert recovered.shape == (384,)
        np.testing.assert_array_equal(recovered, original)

    def test_roundtrip_conversion(self):
        """Test embedding -> bytes -> embedding roundtrip."""
        original = np.random.rand(384).astype(np.float32)

        # Convert to bytes and back
        embedding_bytes = embedding_to_bytes(original)
        recovered = bytes_to_embedding(embedding_bytes)

        # Should be identical
        np.testing.assert_array_almost_equal(recovered, original, decimal=6)


class TestLocalEmbeddings:
    """Tests for local Sentence-Transformers embeddings."""

    @patch("ai_web_feeds.embeddings.SentenceTransformer")
    def test_get_local_model_cached(self, mock_st):
        """Test that local model is cached."""
        mock_model = Mock()
        mock_st.return_value = mock_model

        # Clear cache first
        get_local_model.cache_clear()

        # First call should load model
        model1 = get_local_model()
        assert model1 is mock_model

        # Second call should return cached model
        model2 = get_local_model()
        assert model2 is mock_model

        # SentenceTransformer should only be called once
        assert mock_st.call_count == 1

    @patch("ai_web_feeds.embeddings.get_local_model")
    def test_generate_embeddings_local(self, mock_get_model):
        """Test generating embeddings with local model."""
        # Mock model
        mock_model = Mock()
        mock_embeddings = np.random.rand(3, 384).astype(np.float32)
        mock_model.encode.return_value = mock_embeddings
        mock_get_model.return_value = mock_model

        texts = ["text 1", "text 2", "text 3"]
        embeddings = generate_embeddings_local(texts, show_progress=False)

        # Verify model was called
        mock_model.encode.assert_called_once()

        # Verify embeddings shape
        assert embeddings.shape == (3, 384)
        assert embeddings.dtype == np.float32

    @patch("ai_web_feeds.embeddings.get_local_model")
    def test_generate_embeddings_local_single_text(self, mock_get_model):
        """Test generating embedding for single text."""
        mock_model = Mock()
        mock_embedding = np.random.rand(1, 384).astype(np.float32)
        mock_model.encode.return_value = mock_embedding
        mock_get_model.return_value = mock_model

        texts = ["single text"]
        embeddings = generate_embeddings_local(texts, show_progress=False)

        assert embeddings.shape == (1, 384)


class TestHuggingFaceEmbeddings:
    """Tests for Hugging Face API embeddings."""

    @patch("ai_web_feeds.embeddings.requests.post")
    @patch("ai_web_feeds.embeddings.settings")
    def test_generate_embeddings_hf_success(self, mock_settings, mock_post):
        """Test successful HF API embedding generation."""
        # Mock settings
        mock_settings.embedding.hf_api_token = "test_token"
        mock_settings.embedding.hf_model = "test-model"

        # Mock API response
        mock_response = Mock()
        mock_response.json.return_value = [[0.1] * 384, [0.2] * 384]
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        texts = ["text 1", "text 2"]
        embeddings = generate_embeddings_hf(texts)

        # Verify API was called
        assert mock_post.call_count == 2  # Once per text

        # Verify embeddings
        assert embeddings.shape == (2, 384)
        assert embeddings.dtype == np.float32

    @patch("ai_web_feeds.embeddings.os.getenv")
    @patch("ai_web_feeds.embeddings.settings")
    def test_generate_embeddings_hf_no_token(self, mock_settings, mock_getenv):
        """Test HF API fails without token."""
        mock_settings.embedding.hf_api_token = ""
        mock_getenv.return_value = None

        with pytest.raises(ValueError, match="HF_API_TOKEN not set"):
            generate_embeddings_hf(["text"])

    @patch("ai_web_feeds.embeddings.requests.post")
    @patch("ai_web_feeds.embeddings.settings")
    def test_generate_embeddings_hf_api_error(self, mock_settings, mock_post):
        """Test HF API error handling."""
        mock_settings.embedding.hf_api_token = "test_token"
        mock_settings.embedding.hf_model = "test-model"

        # Mock API error
        mock_post.side_effect = Exception("API error")

        with pytest.raises(Exception):
            generate_embeddings_hf(["text"])


class TestHybridEmbeddings:
    """Tests for hybrid embedding generation."""

    @patch("ai_web_feeds.embeddings.generate_embeddings_hf")
    @patch("ai_web_feeds.embeddings.settings")
    @patch("ai_web_feeds.embeddings.os.getenv")
    def test_generate_embeddings_uses_api(self, mock_getenv, mock_settings, mock_gen_hf):
        """Test hybrid mode uses HF API when requested."""
        mock_settings.embedding.provider = "huggingface"
        mock_settings.embedding.hf_api_token = "test_token"
        mock_getenv.return_value = "test_token"

        mock_embeddings = np.random.rand(2, 384).astype(np.float32)
        mock_gen_hf.return_value = mock_embeddings

        texts = ["text 1", "text 2"]
        embeddings = generate_embeddings(texts, use_api=True, show_progress=False)

        # Verify HF API was called
        mock_gen_hf.assert_called_once_with(texts)
        np.testing.assert_array_equal(embeddings, mock_embeddings)

    @patch("ai_web_feeds.embeddings.generate_embeddings_local")
    @patch("ai_web_feeds.embeddings.generate_embeddings_hf")
    @patch("ai_web_feeds.embeddings.settings")
    @patch("ai_web_feeds.embeddings.os.getenv")
    def test_generate_embeddings_fallback_to_local(
        self, mock_getenv, mock_settings, mock_gen_hf, mock_gen_local
    ):
        """Test hybrid mode falls back to local on API failure."""
        mock_settings.embedding.provider = "huggingface"
        mock_settings.embedding.hf_api_token = "test_token"
        mock_getenv.return_value = "test_token"

        # HF API fails
        mock_gen_hf.side_effect = Exception("API error")

        # Local succeeds
        mock_embeddings = np.random.rand(2, 384).astype(np.float32)
        mock_gen_local.return_value = mock_embeddings

        texts = ["text 1", "text 2"]
        embeddings = generate_embeddings(texts, use_api=True, show_progress=False)

        # Verify fallback to local
        mock_gen_local.assert_called_once()
        np.testing.assert_array_equal(embeddings, mock_embeddings)


class TestFeedEmbeddings:
    """Tests for feed-specific embedding functions."""

    @patch("ai_web_feeds.embeddings.generate_embeddings")
    def test_generate_feed_embedding(self, mock_gen, sample_feed):
        """Test generating embedding for a single feed."""
        mock_embedding = np.random.rand(384).astype(np.float32)
        mock_gen.return_value = np.array([mock_embedding])

        embedding = generate_feed_embedding(sample_feed)

        # Verify text was constructed from feed
        call_args = mock_gen.call_args[0][0]
        assert len(call_args) == 1
        assert "Test Feed" in call_args[0]
        assert "Test feed description" in call_args[0]

        # Verify embedding
        assert embedding.shape == (384,)
        assert embedding.dtype == np.float32

    @patch("ai_web_feeds.embeddings.generate_embeddings")
    def test_generate_all_feed_embeddings(self, mock_gen):
        """Test generating embeddings for multiple feeds."""
        feeds = [FeedSource(id=f"feed{i}", title=f"Feed {i}", topics=["test"]) for i in range(3)]

        mock_embeddings = np.random.rand(3, 384).astype(np.float32)
        mock_gen.return_value = mock_embeddings

        embedding_map = generate_all_feed_embeddings(feeds, batch_size=32, show_progress=False)

        # Verify all feeds have embeddings
        assert len(embedding_map) == 3
        for i in range(3):
            assert f"feed{i}" in embedding_map
            assert embedding_map[f"feed{i}"].shape == (384,)

    @patch("ai_web_feeds.embeddings.generate_embeddings")
    def test_generate_all_feed_embeddings_batching(self, mock_gen):
        """Test batch processing of feed embeddings."""
        feeds = [FeedSource(id=f"feed{i}", title=f"Feed {i}") for i in range(65)]

        # Mock will be called multiple times for batches
        def mock_gen_side_effect(texts, **kwargs):
            return np.random.rand(len(texts), 384).astype(np.float32)

        mock_gen.side_effect = mock_gen_side_effect

        embedding_map = generate_all_feed_embeddings(feeds, batch_size=32, show_progress=False)

        # Verify all feeds processed
        assert len(embedding_map) == 65

        # Verify batching (should be called 3 times: 32 + 32 + 1)
        assert mock_gen.call_count >= 2


class TestEmbeddingStorage:
    """Tests for embedding database storage."""

    def test_save_feed_embedding_new(self, test_session, sample_feed):
        """Test saving new feed embedding."""
        test_session.add(sample_feed)
        test_session.commit()

        embedding = np.random.rand(384).astype(np.float32)

        saved = save_feed_embedding(test_session, sample_feed.id, embedding, "local")

        assert saved is not None
        assert saved.feed_id == sample_feed.id
        assert saved.embedding_provider == "local"

        # Verify embedding can be recovered
        recovered = bytes_to_embedding(saved.embedding)
        np.testing.assert_array_almost_equal(recovered, embedding, decimal=6)

    def test_save_feed_embedding_update(self, test_session, sample_feed):
        """Test updating existing feed embedding."""
        test_session.add(sample_feed)
        test_session.commit()

        # Save initial embedding
        embedding1 = np.random.rand(384).astype(np.float32)
        saved1 = save_feed_embedding(test_session, sample_feed.id, embedding1, "local")

        # Update with new embedding
        embedding2 = np.random.rand(384).astype(np.float32)
        saved2 = save_feed_embedding(test_session, sample_feed.id, embedding2, "huggingface")

        # Should update same record
        assert saved2.feed_id == sample_feed.id
        assert saved2.embedding_provider == "huggingface"

        # New embedding should be different
        recovered = bytes_to_embedding(saved2.embedding)
        assert not np.array_equal(recovered, embedding1)


# Property-based tests
@pytest.mark.parametrize("dimension", [384, 768, 1024])
def test_embedding_bytes_conversion_various_dimensions(dimension):
    """Property test: Byte conversion works for various dimensions."""
    embedding = np.random.rand(dimension).astype(np.float32)

    embedding_bytes = embedding_to_bytes(embedding)
    recovered = bytes_to_embedding(embedding_bytes)

    np.testing.assert_array_almost_equal(recovered, embedding, decimal=6)


@pytest.mark.parametrize("num_texts", [1, 5, 10, 50])
@patch("ai_web_feeds.embeddings.get_local_model")
def test_generate_embeddings_local_various_batch_sizes(mock_get_model, num_texts):
    """Property test: Local embeddings work for various batch sizes."""
    mock_model = Mock()
    mock_embeddings = np.random.rand(num_texts, 384).astype(np.float32)
    mock_model.encode.return_value = mock_embeddings
    mock_get_model.return_value = mock_model

    texts = [f"text {i}" for i in range(num_texts)]
    embeddings = generate_embeddings_local(texts, show_progress=False)

    assert embeddings.shape == (num_texts, 384)
    assert embeddings.dtype == np.float32
