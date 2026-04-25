"""ai_web_feeds.embeddings -- Embedding generation for semantic search

This module provides embedding generation functions using:
- Local: Sentence-Transformers (default, zero-setup)
- Hugging Face API: Optional offload to HF Inference API

Embeddings are 384-dim vectors from all-MiniLM-L6-v2 model.
"""

import os
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path

import numpy as np
import requests
from loguru import logger
from sqlmodel import select
from tqdm import tqdm

from ai_web_feeds.config import settings
from ai_web_feeds.models import FeedEmbedding, FeedSource
from ai_web_feeds.timestamps import utc_now

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover - exercised via patched tests
    SentenceTransformer = None

SUPPORTED_EMBEDDING_PROVIDERS = frozenset({"local", "huggingface"})
LOCAL_MODEL_CACHE_SIZE = 8
HF_API_TIMEOUT_SECONDS = 30
OFFLINE_ENV_VARS = ("AIWF_OFFLINE", "HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE")


@dataclass(frozen=True, slots=True)
class EmbeddingGenerationResult:
    """Embeddings plus the provider/model that actually produced them."""

    embeddings: np.ndarray
    provider: str
    model_name: str


def normalize_embedding_provider(provider: str | None = None) -> str:
    """Return a validated embedding provider name."""
    resolved = (provider or settings.embedding.provider or "local").strip().lower()
    if resolved not in SUPPORTED_EMBEDDING_PROVIDERS:
        supported = ", ".join(sorted(SUPPORTED_EMBEDDING_PROVIDERS))
        msg = f"Unsupported embedding provider '{resolved}'. Supported providers: {supported}"
        raise ValueError(msg)
    return resolved


def resolve_local_model_name(model_name: str | None = None) -> str:
    """Resolve the effective local embedding model name."""
    resolved = (model_name or settings.embedding.local_model).strip()
    if not resolved:
        raise ValueError("Local embedding model must not be empty")
    return resolved


def resolve_hf_model_name(model_name: str | None = None) -> str:
    """Resolve the effective Hugging Face embedding model name."""
    resolved = (model_name or settings.embedding.hf_model).strip()
    if not resolved:
        raise ValueError("Hugging Face embedding model must not be empty")
    return resolved


def _has_hf_api_token(api_token: str | None = None) -> bool:
    """Return True when the canonical HF token setting is configured."""
    candidate = api_token if api_token is not None else settings.embedding.hf_api_token
    return bool(candidate.strip())


def _resolve_hf_api_token(api_token: str | None = None) -> str:
    """Resolve the canonical Hugging Face API token setting."""
    resolved = (api_token if api_token is not None else settings.embedding.hf_api_token).strip()
    if not resolved:
        raise ValueError("AIWF_EMBEDDING__HF_API_TOKEN is not set")
    return resolved


# ============================================================================
# Local Embedding Generation (Sentence-Transformers)
# ============================================================================


@lru_cache(maxsize=LOCAL_MODEL_CACHE_SIZE)
def _load_local_model(
    model_name: str,
    cache_folder: str,
    local_files_only: bool,
):
    """Load and cache a local Sentence-Transformers model by its effective load spec."""
    if SentenceTransformer is None:
        raise ImportError("sentence-transformers is not installed")
    logger.info(f"Loading local model: {model_name}")
    model_kwargs = {}
    if cache_folder:
        model_kwargs["cache_folder"] = cache_folder
    if local_files_only:
        model_kwargs["local_files_only"] = True
    model = SentenceTransformer(model_name, **model_kwargs)
    logger.info("Local model loaded successfully")
    return model


def _local_model_cache_folder(cache_folder: str | None = None) -> str:
    """Resolve the effective cache folder for local embedding models."""
    raw_folder = cache_folder or settings.phase5.model_cache_dir
    if not raw_folder:
        return ""
    return str(Path(raw_folder).expanduser())


def _local_files_only_enabled(local_files_only: bool | None = None) -> bool:
    """Return True when local-only model loading is enabled."""
    if local_files_only is not None:
        return local_files_only
    return any(
        os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}
        for name in OFFLINE_ENV_VARS
    )


def get_local_model(
    model_name: str | None = None,
    *,
    cache_folder: str | None = None,
    local_files_only: bool | None = None,
):
    """Get a cached Sentence-Transformers model for the effective load spec."""
    return _load_local_model(
        resolve_local_model_name(model_name),
        _local_model_cache_folder(cache_folder),
        _local_files_only_enabled(local_files_only),
    )


get_local_model.cache_clear = _load_local_model.cache_clear  # type: ignore[attr-defined]
get_local_model.cache_info = _load_local_model.cache_info  # type: ignore[attr-defined]


def generate_embeddings_local(
    texts: list[str],
    show_progress: bool = True,
    model_name: str | None = None,
) -> np.ndarray:
    """Generate embeddings using local Sentence-Transformers.

    Args:
        texts: List of text strings
        show_progress: Show progress bar

    Returns:
        NumPy array of embeddings (N x 384)
    """
    if not texts:
        return np.empty((0, 0), dtype=np.float32)

    model = get_local_model(model_name)
    embeddings = model.encode(texts, show_progress_bar=show_progress)
    return embeddings.astype(np.float32)


# ============================================================================
# Hugging Face API Embedding Generation
# ============================================================================


def _extract_hf_embedding_payload(payload: object) -> object:
    """Extract the actual embedding payload from varied HF response shapes."""
    if isinstance(payload, dict):
        if payload.get("error"):
            raise ValueError(f"Hugging Face API returned an error payload: {payload['error']}")
        for key in ("embedding", "embeddings", "vector"):
            if key in payload:
                return payload[key]
        if "data" in payload:
            data = payload["data"]
            if not isinstance(data, list):
                raise ValueError("Hugging Face embedding payload field 'data' must be a list")
            if data and isinstance(data[0], dict) and "embedding" in data[0]:
                if len(data) != 1:
                    raise ValueError(
                        "Hugging Face embedding payload unexpectedly returned multiple embeddings"
                    )
                return data[0]["embedding"]
            return data
        keys = ", ".join(sorted(payload.keys())) or "<empty>"
        raise ValueError(f"Unsupported Hugging Face embedding payload keys: {keys}")

    if isinstance(payload, list) and payload and isinstance(payload[0], dict):
        if len(payload) != 1:
            raise ValueError(
                "Hugging Face embedding payload unexpectedly returned multiple embedding records"
            )
        first_item = payload[0]
        if "embedding" in first_item:
            return first_item["embedding"]
        raise ValueError("Hugging Face embedding payload record did not include 'embedding'")

    return payload


def _normalize_hf_embedding(payload: object) -> np.ndarray:
    """Coerce varied HF response payloads into a single finite vector."""
    raw_embedding = _extract_hf_embedding_payload(payload)
    try:
        embedding = np.asarray(raw_embedding, dtype=np.float32)
    except (TypeError, ValueError) as exc:
        raise ValueError("Hugging Face embedding payload must be numeric") from exc

    if embedding.size == 0:
        raise ValueError("Hugging Face embedding payload was empty")

    if embedding.ndim == 2:
        embedding = embedding.mean(axis=0)
    elif embedding.ndim != 1:
        raise ValueError("Hugging Face embedding payload must be a vector or 2D token matrix")

    if not np.isfinite(embedding).all():
        raise ValueError("Hugging Face embedding payload contained non-finite values")

    return embedding


def generate_embeddings_hf(
    texts: list[str],
    *,
    model_name: str | None = None,
    api_token: str | None = None,
) -> np.ndarray:
    """Generate embeddings using Hugging Face Inference API.

    Args:
        texts: List of text strings

    Returns:
        NumPy array of embeddings (N x 384)

    Raises:
        ValueError: If HF_API_TOKEN not set
        requests.RequestException: If API call fails
    """
    if not texts:
        return np.empty((0, 0), dtype=np.float32)

    hf_model_name = resolve_hf_model_name(model_name)
    hf_api_token = _resolve_hf_api_token(api_token)

    hf_api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{hf_model_name}"

    headers = {"Authorization": f"Bearer {hf_api_token}"}

    logger.info(f"Generating embeddings via HF API for {len(texts)} texts")

    embeddings = []
    expected_dim: int | None = None
    for text in tqdm(texts, desc="HF API Embeddings"):
        response = requests.post(
            hf_api_url,
            headers=headers,
            json={"inputs": text},
            timeout=HF_API_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        try:
            payload = response.json()
        except ValueError as exc:
            raise ValueError("Hugging Face API returned invalid JSON") from exc
        embedding = _normalize_hf_embedding(payload)
        if expected_dim is None:
            expected_dim = int(embedding.shape[0])
        elif embedding.shape[0] != expected_dim:
            msg = (
                "Hugging Face embedding payload dimensions changed between requests: "
                f"expected {expected_dim}, received {embedding.shape[0]}"
            )
            raise ValueError(msg)
        embeddings.append(embedding)

    return np.vstack(embeddings).astype(np.float32)


# ============================================================================
# Hybrid Embedding Generation
# ============================================================================


def generate_embeddings_with_metadata(
    texts: list[str],
    *,
    provider: str | None = None,
    show_progress: bool = True,
    allow_fallback: bool = True,
    local_model: str | None = None,
    hf_model: str | None = None,
    hf_api_token: str | None = None,
) -> EmbeddingGenerationResult:
    """Generate embeddings while reporting the provider/model actually used."""
    resolved_provider = normalize_embedding_provider(provider)
    if resolved_provider == "huggingface":
        resolved_hf_model = resolve_hf_model_name(hf_model)
        if _has_hf_api_token(hf_api_token):
            try:
                embeddings = generate_embeddings_hf(
                    texts,
                    model_name=resolved_hf_model,
                    api_token=hf_api_token,
                )
                return EmbeddingGenerationResult(
                    embeddings=embeddings,
                    provider="huggingface",
                    model_name=resolved_hf_model,
                )
            except Exception as exc:
                if not allow_fallback:
                    raise
                logger.warning(f"HF API failed, falling back to local embeddings: {exc}")
        elif not allow_fallback:
            _resolve_hf_api_token(hf_api_token)
        else:
            logger.warning(
                "AIWF_EMBEDDING__HF_API_TOKEN is not set, falling back to local embeddings"
            )

    resolved_local_model = resolve_local_model_name(local_model)
    embeddings = generate_embeddings_local(
        texts,
        show_progress=show_progress,
        model_name=resolved_local_model,
    )
    return EmbeddingGenerationResult(
        embeddings=embeddings,
        provider="local",
        model_name=resolved_local_model,
    )


def generate_embeddings(
    texts: list[str],
    use_api: bool | None = None,
    show_progress: bool = True,
    provider: str | None = None,
    local_model: str | None = None,
    hf_model: str | None = None,
    allow_fallback: bool = True,
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
    resolved_provider = provider
    if resolved_provider is None and use_api is not None:
        resolved_provider = "huggingface" if use_api else "local"

    return generate_embeddings_with_metadata(
        texts,
        provider=resolved_provider,
        show_progress=show_progress,
        allow_fallback=allow_fallback,
        local_model=local_model,
        hf_model=hf_model,
    ).embeddings


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
    text = _build_feed_embedding_text(feed)

    # Generate embedding
    embedding = generate_embeddings([text], show_progress=False)[0]
    return embedding


def _build_feed_embedding_text(feed: FeedSource) -> str:
    """Build a deterministic embedding input string for a feed."""
    parts = []
    if feed.title:
        parts.append(feed.title)
    if feed.notes:
        parts.append(feed.notes)
    if feed.topics:
        parts.append(" ".join(feed.topics))
    return " ".join(parts)


    # Generate embedding
    return generate_embeddings([text], show_progress=False)[0]


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

    texts, feed_ids = _prepare_feed_embedding_inputs(feeds)
    if not texts:
        return {}

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
    model_name: str | None = None,
) -> FeedEmbedding:
    """Save feed embedding to database.

    Args:
        session: Database session
        feed_id: Feed source ID
        embedding: 384-dim embedding vector
        provider: Embedding provider ("local" or "huggingface")
        model_name: Actual embedding model used

    Returns:
        Saved FeedEmbedding object
    """
    # Convert to bytes
    embedding_bytes = embedding.tobytes()
    resolved_provider = provider.strip().lower() if provider else "local"
    resolved_model_name = model_name
    if not resolved_model_name:
        if resolved_provider == "huggingface":
            resolved_model_name = resolve_hf_model_name()
        else:
            resolved_model_name = resolve_local_model_name()

    # Check if embedding exists
    existing = session.get(FeedEmbedding, feed_id)

    if existing:
        # Update existing
        existing.embedding = embedding_bytes
        existing.embedding_provider = provider
        existing.updated_at = datetime.now(UTC)
        session.add(existing)
    else:
        # Create new
        feed_embedding = FeedEmbedding(
            feed_id=feed_id,
            embedding=embedding_bytes,
            embedding_model=resolved_model_name,
            embedding_provider=resolved_provider,
        )
        session.add(feed_embedding)

    session.commit()
    logger.debug(f"Saved embedding for feed {feed_id}")

    return existing if existing else feed_embedding


def refresh_all_embeddings(
    session,
    show_progress: bool = True,
    provider: str | None = None,
    local_model: str | None = None,
    hf_model: str | None = None,
):
    """Refresh embeddings for all feeds.

    Args:
        session: Database session
        show_progress: Show progress bar
        provider: Optional provider override
        local_model: Optional local model override
        hf_model: Optional Hugging Face model override
    """
    logger.info("Refreshing all feed embeddings")

    # Get all feeds
    feeds = list(session.exec(select(FeedSource)).all())
    texts, feed_ids = _prepare_feed_embedding_inputs(feeds)
    if not texts:
        logger.info("No feeds found; skipping embedding refresh")
        return

    for i in tqdm(
        range(0, len(texts), 32),
        desc="Generating embeddings",
        disable=not show_progress,
    ):
        batch_texts = texts[i : i + 32]
        batch_feed_ids = feed_ids[i : i + 32]
        batch_result = generate_embeddings_with_metadata(
            batch_texts,
            provider=provider,
            show_progress=False,
            local_model=local_model,
            hf_model=hf_model,
        )

        for feed_id, embedding in zip(batch_feed_ids, batch_result.embeddings, strict=False):
            save_feed_embedding(
                session,
                feed_id,
                embedding,
                provider=batch_result.provider,
                model_name=batch_result.model_name,
            )

    logger.info(f"Refreshed {len(feed_ids)} embeddings")


# ============================================================================
# Utility Functions
# ============================================================================


def embedding_to_bytes(embedding: np.ndarray) -> bytes:
    """Convert embedding array to bytes."""
    return embedding.astype(np.float32).tobytes()


def bytes_to_embedding(embedding_bytes: bytes) -> np.ndarray:
    """Convert bytes to embedding array."""
    return np.frombuffer(embedding_bytes, dtype=np.float32)
