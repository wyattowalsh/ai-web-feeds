"""ai_web_feeds.embeddings -- Embedding generation for semantic search

This module provides embedding generation functions using:
- Local: Sentence-Transformers (default, zero-setup)
- Hugging Face API: Optional offload to HF Inference API

Embeddings are 384-dim vectors from all-MiniLM-L6-v2 model.
"""

from functools import lru_cache
import os

from loguru import logger
import numpy as np
import requests
from tqdm import tqdm

from ai_web_feeds.config import Settings
from ai_web_feeds.models import FeedEmbedding, FeedSource


settings = Settings()


# ============================================================================
# Local Embedding Generation (Sentence-Transformers)
# ============================================================================


@lru_cache(maxsize=1)
def get_local_model():
    """Get cached Sentence-Transformers model."""
    from sentence_transformers import SentenceTransformer

    logger.info(f"Loading local model: {settings.embedding.local_model}")
    model = SentenceTransformer(settings.embedding.local_model)
    logger.info("Local model loaded successfully")
    return model


def generate_embeddings_local(texts: list[str], show_progress: bool = True) -> np.ndarray:
    """Generate embeddings using local Sentence-Transformers.

    Args:
        texts: List of text strings
        show_progress: Show progress bar

    Returns:
        NumPy array of embeddings (N x 384)
    """
    model = get_local_model()
    embeddings = model.encode(texts, show_progress_bar=show_progress)
    return embeddings.astype(np.float32)


# ============================================================================
# Hugging Face API Embedding Generation
# ============================================================================


def generate_embeddings_hf(texts: list[str]) -> np.ndarray:
    """Generate embeddings using Hugging Face Inference API.

    Args:
        texts: List of text strings

    Returns:
        NumPy array of embeddings (N x 384)

    Raises:
        ValueError: If HF_API_TOKEN not set
        requests.RequestException: If API call fails
    """
    hf_api_token = settings.embedding.hf_api_token or os.getenv("HF_API_TOKEN")
    if not hf_api_token:
        raise ValueError("HF_API_TOKEN not set in config or environment")

    hf_api_url = (
        f"https://api-inference.huggingface.co/pipeline/feature-extraction/"
        f"{settings.embedding.hf_model}"
    )

    headers = {"Authorization": f"Bearer {hf_api_token}"}

    logger.info(f"Generating embeddings via HF API for {len(texts)} texts")

    embeddings = []
    for text in tqdm(texts, desc="HF API Embeddings"):
        response = requests.post(
            hf_api_url,
            headers=headers,
            json={"inputs": text},
            timeout=30,
        )
        response.raise_for_status()
        embedding = response.json()
        embeddings.append(embedding)

    return np.array(embeddings, dtype=np.float32)


# ============================================================================
# Hybrid Embedding Generation
# ============================================================================


def generate_embeddings(
    texts: list[str],
    use_api: bool | None = None,
    show_progress: bool = True,
) -> np.ndarray:
    """Generate embeddings with hybrid approach.

    Uses HF API if available and requested, otherwise falls back to local.

    Args:
        texts: List of text strings
        use_api: Force use of HF API (None = auto-detect from config)
        show_progress: Show progress bar (local only)

    Returns:
        NumPy array of embeddings (N x 384)
    """
    # Determine provider
    if use_api is None:
        use_api = settings.embedding.provider == "huggingface"

    # Try HF API first if requested
    if use_api and (settings.embedding.hf_api_token or os.getenv("HF_API_TOKEN")):
        try:
            return generate_embeddings_hf(texts)
        except (requests.RequestException, KeyError, ValueError) as e:
            logger.warning(f"HF API failed, falling back to local: {e}")

    # Use local model
    return generate_embeddings_local(texts, show_progress=show_progress)


# ============================================================================
# Feed Embedding Generation
# ============================================================================


def generate_feed_embedding(feed: FeedSource) -> np.ndarray:
    """Generate embedding for a single feed.

    Combines feed title, description (notes), and topics.

    Args:
        feed: FeedSource object

    Returns:
        384-dim embedding vector
    """
    # Build text from feed metadata
    parts = []
    if feed.title:
        parts.append(feed.title)
    if feed.notes:
        parts.append(feed.notes)
    if feed.topics:
        parts.append(" ".join(feed.topics))

    text = " ".join(parts)

    # Generate embedding
    embedding = generate_embeddings([text], show_progress=False)[0]
    return embedding


def generate_all_feed_embeddings(
    feeds: list[FeedSource],
    batch_size: int = 32,
    show_progress: bool = True,
) -> dict[str, np.ndarray]:
    """Generate embeddings for all feeds in batches.

    Args:
        feeds: List of FeedSource objects
        batch_size: Batch size for processing
        show_progress: Show progress bar

    Returns:
        Dictionary mapping feed_id -> embedding vector
    """
    logger.info(f"Generating embeddings for {len(feeds)} feeds")

    # Build texts
    texts = []
    feed_ids = []

    for feed in feeds:
        parts = []
        if feed.title:
            parts.append(feed.title)
        if feed.notes:
            parts.append(feed.notes)
        if feed.topics:
            parts.append(" ".join(feed.topics))

        texts.append(" ".join(parts))
        feed_ids.append(feed.id)

    # Generate embeddings in batches
    all_embeddings = []

    for i in tqdm(
        range(0, len(texts), batch_size),
        desc="Generating embeddings",
        disable=not show_progress,
    ):
        batch_texts = texts[i : i + batch_size]
        batch_embeddings = generate_embeddings(batch_texts, show_progress=False)
        all_embeddings.append(batch_embeddings)

    # Concatenate batches
    embeddings_array = np.vstack(all_embeddings)

    # Create mapping
    embedding_map = {feed_id: embeddings_array[i] for i, feed_id in enumerate(feed_ids)}

    logger.info(f"Generated {len(embedding_map)} embeddings")
    return embedding_map


# ============================================================================
# Storage Integration
# ============================================================================


def save_feed_embedding(
    session,
    feed_id: str,
    embedding: np.ndarray,
    provider: str = "local",
) -> FeedEmbedding:
    """Save feed embedding to database.

    Args:
        session: Database session
        feed_id: Feed source ID
        embedding: 384-dim embedding vector
        provider: Embedding provider ("local" or "huggingface")

    Returns:
        Saved FeedEmbedding object
    """
    # Convert to bytes
    embedding_bytes = embedding.tobytes()

    # Check if embedding exists
    existing = session.get(FeedEmbedding, feed_id)

    if existing:
        # Update existing
        existing.embedding = embedding_bytes
        existing.embedding_provider = provider
        existing.updated_at = datetime.utcnow()
        session.add(existing)
    else:
        # Create new
        feed_embedding = FeedEmbedding(
            feed_id=feed_id,
            embedding=embedding_bytes,
            embedding_model=settings.embedding.local_model,
            embedding_provider=provider,
        )
        session.add(feed_embedding)

    session.commit()
    logger.debug(f"Saved embedding for feed {feed_id}")

    return existing if existing else feed_embedding


def refresh_all_embeddings(session, show_progress: bool = True):
    """Refresh embeddings for all feeds.

    Args:
        session: Database session
        show_progress: Show progress bar
    """
    from sqlmodel import select

    logger.info("Refreshing all feed embeddings")

    # Get all feeds
    feeds = list(session.exec(select(FeedSource)).all())

    # Generate embeddings
    embedding_map = generate_all_feed_embeddings(feeds, batch_size=32, show_progress=show_progress)

    # Save to database
    provider = settings.embedding.provider

    for feed_id, embedding in tqdm(
        embedding_map.items(),
        desc="Saving embeddings",
        disable=not show_progress,
    ):
        save_feed_embedding(session, feed_id, embedding, provider=provider)

    logger.info(f"Refreshed {len(embedding_map)} embeddings")


# ============================================================================
# Utility Functions
# ============================================================================


def embedding_to_bytes(embedding: np.ndarray) -> bytes:
    """Convert embedding array to bytes."""
    return embedding.astype(np.float32).tobytes()


def bytes_to_embedding(embedding_bytes: bytes) -> np.ndarray:
    """Convert bytes to embedding array."""
    return np.frombuffer(embedding_bytes, dtype=np.float32)


# Import datetime at the end to avoid circular import
from datetime import datetime
