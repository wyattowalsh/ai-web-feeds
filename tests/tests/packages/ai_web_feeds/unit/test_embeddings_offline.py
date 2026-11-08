"""Offline characterization of the current embeddings module.

Public names, return shapes, and empty-input behavior are locked here.
sentence-transformers is optional: the import is stubbed, and Hugging Face
HTTP is refused. Importing this test must not download weights.
"""

from __future__ import annotations

import http.client
import inspect
import socket
import sys
import urllib.request
from collections.abc import Iterator
from types import ModuleType, SimpleNamespace
from typing import Any, NamedTuple
from unittest.mock import Mock

import numpy as np
import pytest
from numpy.typing import DTypeLike

_WEIGHT_ROOTS = frozenset(
    {
        "huggingface_hub",
        "sentence_transformers",
        "torch",
        "transformers",
    }
)
_LOCAL_MODEL = "unit-local-model"
_HF_MODEL = "unit-hf-model"
_HF_TOKEN = "unit-hf-token"
_REQUIRED = inspect.Parameter.empty
_SIGNATURES: dict[str, tuple[tuple[str, object], ...]] = {
    "get_settings": (),
    "get_local_model": (),
    "generate_embeddings_local": (("texts", _REQUIRED), ("show_progress", True)),
    "generate_embeddings_hf": (("texts", _REQUIRED),),
    "generate_embeddings": (
        ("texts", _REQUIRED),
        ("use_api", None),
        ("show_progress", True),
    ),
    "generate_feed_embedding": (("feed", _REQUIRED),),
    "generate_all_feed_embeddings": (
        ("feeds", _REQUIRED),
        ("batch_size", 32),
        ("show_progress", True),
    ),
    "save_feed_embedding": (
        ("session", _REQUIRED),
        ("feed_id", _REQUIRED),
        ("embedding", _REQUIRED),
        ("provider", "local"),
    ),
    "refresh_all_embeddings": (("session", _REQUIRED), ("show_progress", True)),
    "embedding_to_bytes": (("embedding", _REQUIRED),),
    "bytes_to_embedding": (("embedding_bytes", _REQUIRED),),
}


class _LoadCache:
    module: Any | None = None
    imported: frozenset[str] = frozenset()


class Offline(NamedTuple):
    """Embeddings module loaded under a network and model-download block."""

    module: Any
    imported: frozenset[str]
    sentence_transformers: Any
    post: Mock


_CACHE = _LoadCache()
pytestmark = pytest.mark.unit


def _refuse_network(*_args: object, **_kwargs: object) -> None:
    message = "embeddings offline test refused a network call"
    raise AssertionError(message)


def _block_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(socket, "create_connection", _refuse_network)
    monkeypatch.setattr(socket, "getaddrinfo", _refuse_network)
    monkeypatch.setattr(urllib.request, "urlopen", _refuse_network)
    monkeypatch.setattr(http.client.HTTPConnection, "connect", _refuse_network)
    monkeypatch.setattr(http.client.HTTPConnection, "request", _refuse_network)
    monkeypatch.setattr(http.client.HTTPSConnection, "connect", _refuse_network)
    monkeypatch.setattr(http.client.HTTPSConnection, "request", _refuse_network)
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("HF_HUB_DISABLE_TELEMETRY", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")


def _weight_imports(imported: frozenset[str]) -> list[str]:
    found: list[str] = []
    for name in sorted(imported):
        if name.split(".", 1)[0] in _WEIGHT_ROOTS:
            found.append(name)
    return found


def _load_embeddings() -> tuple[Any, frozenset[str]]:
    if _CACHE.module is None:
        before = set(sys.modules)
        import ai_web_feeds.embeddings as embeddings_module

        _CACHE.module = embeddings_module
        _CACHE.imported = frozenset(set(sys.modules) - before)
    return _CACHE.module, _CACHE.imported


def _embedding_settings(
    *,
    provider: str = "local",
    hf_api_token: str = "",
    hf_model: str = _HF_MODEL,
    local_model: str = _LOCAL_MODEL,
) -> SimpleNamespace:
    return SimpleNamespace(
        embedding=SimpleNamespace(
            provider=provider,
            hf_api_token=hf_api_token,
            hf_model=hf_model,
            local_model=local_model,
        )
    )


def _getenv_without_token(key: str, default: str | None = None) -> str | None:
    if key == "HF_API_TOKEN":
        return None
    return default


def _install_encoder(offline: Offline, encoded: np.ndarray) -> Mock:
    model = Mock()
    model.encode.return_value = encoded
    constructor = Mock(return_value=model)
    offline.sentence_transformers.SentenceTransformer = constructor
    offline.module.get_local_model.cache_clear()
    return model


def _hf_response(vector: list[float]) -> Mock:
    response = Mock()
    response.json.return_value = list(vector)
    response.raise_for_status = Mock()
    return response


def _assert_array(array: np.ndarray, shape: tuple[int, ...], dtype: DTypeLike) -> None:
    assert isinstance(array, np.ndarray)
    assert array.shape == shape
    assert array.dtype == dtype


@pytest.fixture(autouse=True)
def offline(monkeypatch: pytest.MonkeyPatch) -> Iterator[Offline]:
    """Import embeddings with sockets refused and a fake local model."""

    _block_network(monkeypatch)
    module, imported = _load_embeddings()
    module.get_local_model.cache_clear()
    fake: Any = ModuleType("sentence_transformers")
    fake.SentenceTransformer = Mock(
        side_effect=AssertionError("SentenceTransformer download is disabled")
    )
    monkeypatch.setitem(sys.modules, "sentence_transformers", fake)
    post = Mock(side_effect=AssertionError("Hugging Face HTTP is disabled"))
    monkeypatch.setattr(module.requests, "post", post)
    monkeypatch.setattr(module.os, "getenv", _getenv_without_token)
    previous_settings = module._settings
    module._settings = _embedding_settings()
    bundle = Offline(module, imported, fake, post)
    try:
        yield bundle
    finally:
        module._settings = previous_settings
        module.get_local_model.cache_clear()


def test_import_does_not_load_weight_packages(offline: Offline) -> None:
    """Importing embeddings does not import sentence-transformers or Hub clients."""

    assert _weight_imports(offline.imported) == []
    assert "SentenceTransformer" not in vars(offline.module)
    assert "sentence_transformers" not in vars(offline.module)


def test_public_names_and_signatures(offline: Offline) -> None:
    """The callable surface is the eleven current functions, with today's defaults."""

    module = offline.module
    public = {
        name
        for name, value in vars(module).items()
        if callable(value)
        and not name.startswith("_")
        and getattr(value, "__module__", None) == "ai_web_feeds.embeddings"
    }
    assert public == frozenset(_SIGNATURES)
    assert "__all__" not in vars(module)

    returns = {
        "get_settings": module.Settings,
        "get_local_model": inspect.Signature.empty,
        "generate_embeddings_local": np.ndarray,
        "generate_embeddings_hf": np.ndarray,
        "generate_embeddings": np.ndarray,
        "generate_feed_embedding": np.ndarray,
        "generate_all_feed_embeddings": dict[str, np.ndarray],
        "save_feed_embedding": module.FeedEmbedding,
        "refresh_all_embeddings": inspect.Signature.empty,
        "embedding_to_bytes": bytes,
        "bytes_to_embedding": np.ndarray,
    }
    for name, expected in _SIGNATURES.items():
        signature = inspect.signature(getattr(module, name))
        actual = tuple((param.name, param.default) for param in signature.parameters.values())
        assert actual == expected
        assert all(
            param.kind is inspect.Parameter.POSITIONAL_OR_KEYWORD
            for param in signature.parameters.values()
        )
        assert signature.return_annotation == returns[name]
    assert hasattr(module.get_local_model, "cache_clear")


def test_get_settings_caches_one_instance(offline: Offline) -> None:
    """get_settings() builds one Settings object and then returns it."""

    module = offline.module
    previous = module._settings
    module._settings = None
    try:
        first = module.get_settings()
        second = module.get_settings()
    finally:
        module._settings = previous

    assert first is second
    assert isinstance(first, module.Settings)


def test_get_local_model_caches_the_stubbed_constructor(offline: Offline) -> None:
    """The local loader calls SentenceTransformer once with the configured model id."""

    module = offline.module
    model = _install_encoder(offline, np.zeros((1, 2), dtype=np.float32))
    constructor = offline.sentence_transformers.SentenceTransformer

    assert module.get_local_model() is model
    module._settings = _embedding_settings(local_model="other-model")
    assert module.get_local_model() is model
    constructor.assert_called_once_with(_LOCAL_MODEL)


def test_generate_embeddings_local_casts_encoder_shape(offline: Offline) -> None:
    """Local generation returns the encoder matrix cast to float32, including a non-384 width."""

    encoded = np.arange(6, dtype=np.float64).reshape(2, 3) + 0.5
    model = _install_encoder(offline, encoded)

    result = offline.module.generate_embeddings_local(["one", "two"], show_progress=False)

    _assert_array(result, (2, 3), np.float32)
    np.testing.assert_array_equal(result, encoded.astype(np.float32))
    model.encode.assert_called_once_with(["one", "two"], show_progress_bar=False)
    offline.post.assert_not_called()


def test_generate_embeddings_local_empty_keeps_encoder_shape(offline: Offline) -> None:
    """An empty text list is forwarded; the wrapper does not invent rows."""

    encoded = np.zeros((0, 5), dtype=np.float64)
    model = _install_encoder(offline, encoded)

    result = offline.module.generate_embeddings_local([])

    _assert_array(result, (0, 5), np.float32)
    model.encode.assert_called_once_with([], show_progress_bar=True)
    offline.post.assert_not_called()


def test_generate_embeddings_hf_stacks_one_row_per_text(offline: Offline) -> None:
    """Each Hugging Face JSON vector becomes one float32 row, in request order."""

    module = offline.module
    module._settings = _embedding_settings(hf_api_token=_HF_TOKEN, hf_model=_HF_MODEL)
    vectors = ([1.0, 2.0, 3.0], [4.0, 5.0, 6.0])
    offline.post.side_effect = [_hf_response(vector) for vector in vectors]

    result = module.generate_embeddings_hf(["left", "right"])

    _assert_array(result, (2, 3), np.float32)
    np.testing.assert_array_equal(result, np.array(vectors, dtype=np.float32))
    assert offline.post.call_count == 2
    url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{_HF_MODEL}"
    assert [call.args[0] for call in offline.post.call_args_list] == [url, url]
    assert [call.kwargs["json"] for call in offline.post.call_args_list] == [
        {"inputs": "left"},
        {"inputs": "right"},
    ]
    assert offline.post.call_args_list[0].kwargs["headers"] == {
        "Authorization": f"Bearer {_HF_TOKEN}"
    }
    assert offline.post.call_args_list[0].kwargs["timeout"] == 30
    offline.sentence_transformers.SentenceTransformer.assert_not_called()


def test_generate_embeddings_hf_empty_skips_http_or_raises_without_token(offline: Offline) -> None:
    """Empty HF input with a token is a rank-1 float32 empty array and does not POST.

    Without a token the same empty list raises before any request. np.array([])
    does not grow a feature axis, so the shape is (0,) rather than (0, width).
    """

    module = offline.module
    module._settings = _embedding_settings(hf_api_token=_HF_TOKEN)
    result = module.generate_embeddings_hf([])

    _assert_array(result, (0,), np.float32)
    assert result.ndim == 1
    assert result.size == 0
    offline.post.assert_not_called()

    module._settings = _embedding_settings(hf_api_token="")
    for texts in ([], ["text"]):
        with pytest.raises(ValueError, match="HF_API_TOKEN not set"):
            module.generate_embeddings_hf(texts)
    offline.post.assert_not_called()


def test_generate_embeddings_routes_empty_input_without_http(offline: Offline) -> None:
    """Empty hybrid input follows provider and token, and never calls the network."""

    module = offline.module
    encoded = np.zeros((0, 4), dtype=np.float64)
    model = _install_encoder(offline, encoded)

    local = module.generate_embeddings([], use_api=False, show_progress=False)
    _assert_array(local, (0, 4), np.float32)
    model.encode.assert_called_once_with([], show_progress_bar=False)

    module.get_local_model.cache_clear()
    offline.sentence_transformers.SentenceTransformer = Mock(
        side_effect=AssertionError("SentenceTransformer download is disabled")
    )
    module._settings = _embedding_settings(provider="huggingface", hf_api_token=_HF_TOKEN)
    api_empty = module.generate_embeddings([])
    _assert_array(api_empty, (0,), np.float32)
    offline.post.assert_not_called()
    offline.sentence_transformers.SentenceTransformer.assert_not_called()

    module._settings = _embedding_settings(provider="huggingface", hf_api_token="")
    model = _install_encoder(offline, encoded)
    fallback = module.generate_embeddings([], show_progress=False)
    _assert_array(fallback, (0, 4), np.float32)
    model.encode.assert_called_once_with([], show_progress_bar=False)
    offline.post.assert_not_called()


def test_generate_embeddings_env_token_empty_still_skips_http(
    offline: Offline,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A huggingface provider plus only an env token still builds the empty HF array."""

    def getenv(key: str, default: str | None = None) -> str | None:
        if key == "HF_API_TOKEN":
            return "env-token"
        return default

    monkeypatch.setattr(offline.module.os, "getenv", getenv)
    offline.module._settings = _embedding_settings(provider="huggingface", hf_api_token="")

    result = offline.module.generate_embeddings([])

    _assert_array(result, (0,), np.float32)
    offline.post.assert_not_called()
    offline.sentence_transformers.SentenceTransformer.assert_not_called()


def test_generate_embeddings_api_failure_returns_local_float32(offline: Offline) -> None:
    """A failed API call falls back to the local encoder's float32 shape."""

    module = offline.module
    module._settings = _embedding_settings(
        provider="huggingface",
        hf_api_token=_HF_TOKEN,
        hf_model=_HF_MODEL,
    )
    offline.post.side_effect = module.requests.RequestException("offline")
    encoded = np.arange(8, dtype=np.float64).reshape(2, 4)
    model = _install_encoder(offline, encoded)

    result = module.generate_embeddings(["a", "b"], use_api=True, show_progress=False)

    _assert_array(result, (2, 4), np.float32)
    np.testing.assert_array_equal(result, encoded.astype(np.float32))
    model.encode.assert_called_once_with(["a", "b"], show_progress_bar=False)
    assert offline.post.call_count == 1


def test_generate_feed_embedding_returns_the_first_row(
    offline: Offline,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Feed text is title, notes, then topics; the return is row 0 unchanged."""

    module = offline.module
    feed = module.FeedSource(
        id="feed-1",
        title="Title",
        notes="Notes",
        topics=["alpha", "beta"],
    )
    matrix = np.array([[9.0, 8.0, 7.0]], dtype=np.float64)
    generate = Mock(return_value=matrix)
    monkeypatch.setattr(module, "generate_embeddings", generate)

    vector = module.generate_feed_embedding(feed)

    generate.assert_called_once_with(["Title Notes alpha beta"], show_progress=False)
    _assert_array(vector, (3,), np.float64)
    np.testing.assert_array_equal(vector, matrix[0])


def test_generate_feed_embedding_blank_metadata_embeds_empty_string(
    offline: Offline,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Missing title, notes, and topics embed a single empty string."""

    module = offline.module
    feed = module.FeedSource(id="blank", title="")
    matrix = np.array([[1.0, 2.0]], dtype=np.float32)
    generate = Mock(return_value=matrix)
    monkeypatch.setattr(module, "generate_embeddings", generate)

    vector = module.generate_feed_embedding(feed)

    generate.assert_called_once_with([""], show_progress=False)
    _assert_array(vector, (2,), np.float32)
    np.testing.assert_array_equal(vector, matrix[0])
    assert feed.notes in (None, "")
    assert list(feed.topics) == []


def test_generate_all_feed_embeddings_maps_float32_rows(offline: Offline) -> None:
    """One batch becomes a feed-id map of float32 rows in feed order."""

    encoded = np.array([[1.0, 2.0], [3.0, 4.0]], dtype=np.float64)
    model = _install_encoder(offline, encoded)
    module = offline.module
    feeds = [
        module.FeedSource(id="a", title="Alpha"),
        module.FeedSource(id="b", title="Beta", notes="note", topics=["t1", "t2"]),
    ]

    mapping = module.generate_all_feed_embeddings(feeds, batch_size=32, show_progress=False)

    assert list(mapping) == ["a", "b"]
    _assert_array(mapping["a"], (2,), np.float32)
    _assert_array(mapping["b"], (2,), np.float32)
    np.testing.assert_array_equal(mapping["a"], np.array([1.0, 2.0], dtype=np.float32))
    np.testing.assert_array_equal(mapping["b"], np.array([3.0, 4.0], dtype=np.float32))
    model.encode.assert_called_once_with(
        ["Alpha", "Beta note t1 t2"],
        show_progress_bar=False,
    )


def test_generate_all_feed_embeddings_batches_preserve_order(offline: Offline) -> None:
    """Batch splits stay in feed order and each row keeps that batch's values."""

    seen: list[list[str]] = []

    def encode(texts: list[str], show_progress_bar: bool = True) -> np.ndarray:
        assert show_progress_bar is False
        seen.append(list(texts))
        value = float(len(seen))
        return np.full((len(texts), 2), value, dtype=np.float64)

    model = _install_encoder(offline, np.zeros((1, 2), dtype=np.float64))
    model.encode.side_effect = encode
    module = offline.module
    feeds = [module.FeedSource(id=f"f{index}", title=f"T{index}") for index in range(3)]

    mapping = module.generate_all_feed_embeddings(feeds, batch_size=2, show_progress=False)

    assert seen == [["T0", "T1"], ["T2"]]
    assert list(mapping) == ["f0", "f1", "f2"]
    np.testing.assert_array_equal(mapping["f0"], np.full(2, 1.0, dtype=np.float32))
    np.testing.assert_array_equal(mapping["f1"], np.full(2, 1.0, dtype=np.float32))
    np.testing.assert_array_equal(mapping["f2"], np.full(2, 2.0, dtype=np.float32))


def test_generate_all_feed_embeddings_empty_raises(offline: Offline) -> None:
    """No feeds never calls the model; np.vstack of zero batches raises ValueError."""

    with pytest.raises(ValueError, match="at least one array to concatenate"):
        offline.module.generate_all_feed_embeddings([], show_progress=False)

    offline.post.assert_not_called()
    offline.sentence_transformers.SentenceTransformer.assert_not_called()


def test_byte_helpers_flatten_float32_and_empty_roundtrip() -> None:
    """Bytes helpers cast to flat float32. An empty vector round-trips as shape (0,)."""

    from ai_web_feeds import embeddings

    matrix = np.arange(6, dtype=np.float64).reshape(2, 3)
    raw = embeddings.embedding_to_bytes(matrix)

    assert isinstance(raw, bytes)
    assert len(raw) == 24
    recovered = embeddings.bytes_to_embedding(raw)
    _assert_array(recovered, (6,), np.float32)
    np.testing.assert_array_equal(recovered, matrix.astype(np.float32).reshape(-1))
    assert embeddings.embedding_to_bytes(np.array([], dtype=np.float64)) == b""
    empty = embeddings.bytes_to_embedding(b"")
    _assert_array(empty, (0,), np.float32)


def test_save_feed_embedding_returns_new_or_same_row(offline: Offline) -> None:
    """Insert returns the new row. Update returns the same row and does not change the model id."""

    module = offline.module
    vector = np.arange(4, dtype=np.float32)
    session = Mock()
    session.get.return_value = None

    saved = module.save_feed_embedding(session, "feed-1", vector)

    assert isinstance(saved, module.FeedEmbedding)
    assert saved.feed_id == "feed-1"
    assert saved.embedding == vector.tobytes()
    assert saved.embedding_provider == "local"
    assert saved.embedding_model == _LOCAL_MODEL
    session.get.assert_called_once_with(module.FeedEmbedding, "feed-1")
    session.add.assert_called_once_with(saved)
    session.commit.assert_called_once()

    existing = module.FeedEmbedding(
        feed_id="feed-1",
        embedding=b"old",
        embedding_model="original-model",
        embedding_provider="local",
    )
    session = Mock()
    session.get.return_value = existing
    updated_vector = np.arange(4, dtype=np.float32) + 1

    updated = module.save_feed_embedding(
        session,
        "feed-1",
        updated_vector,
        provider="huggingface",
    )

    assert updated is existing
    assert updated.embedding == updated_vector.tobytes()
    assert updated.embedding_provider == "huggingface"
    assert updated.embedding_model == "original-model"
    assert updated.updated_at.tzinfo is not None
    session.commit.assert_called_once()


def test_save_feed_embedding_keeps_the_array_dtype(offline: Offline) -> None:
    """save_feed_embedding stores raw tobytes(); embedding_to_bytes is the cast helper."""

    module = offline.module
    vector = np.array([1.0, 2.0], dtype=np.float64)
    session = Mock()
    session.get.return_value = None

    saved = module.save_feed_embedding(session, "feed-1", vector)

    assert saved.embedding == vector.tobytes()
    assert len(saved.embedding) == 16
    encoded = module.embedding_to_bytes(vector)
    assert len(encoded) == 8
    assert encoded != vector.tobytes()


def test_refresh_all_embeddings_returns_none(offline: Offline) -> None:
    """Refreshing one feed saves a float32 blob and returns None."""

    encoded = np.arange(4, dtype=np.float64).reshape(1, 4)
    _install_encoder(offline, encoded)
    module = offline.module
    session = Mock()
    session.exec.return_value.all.return_value = [module.FeedSource(id="feed-1", title="Title")]
    session.get.return_value = None

    assert module.refresh_all_embeddings(session, show_progress=False) is None

    saved = session.add.call_args.args[0]
    assert isinstance(saved, module.FeedEmbedding)
    assert saved.feed_id == "feed-1"
    assert saved.embedding_provider == "local"
    assert saved.embedding_model == _LOCAL_MODEL
    recovered = module.bytes_to_embedding(saved.embedding)
    _assert_array(recovered, (4,), np.float32)
    np.testing.assert_array_equal(recovered, encoded.astype(np.float32).reshape(-1))
    session.commit.assert_called_once()


def test_refresh_all_embeddings_empty_catalog_raises_before_save(offline: Offline) -> None:
    """An empty catalog hits the same vstack failure and does not save."""

    module = offline.module
    session = Mock()
    session.exec.return_value.all.return_value = []

    with pytest.raises(ValueError, match="at least one array to concatenate"):
        module.refresh_all_embeddings(session, show_progress=False)

    session.add.assert_not_called()
    session.commit.assert_not_called()
    offline.post.assert_not_called()
    offline.sentence_transformers.SentenceTransformer.assert_not_called()
