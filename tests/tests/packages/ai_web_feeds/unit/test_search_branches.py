"""Characterization of current ai_web_feeds.search branches."""

import socket
from collections.abc import Iterator
from unittest.mock import MagicMock

import numpy as np
import pytest
from ai_web_feeds.models import FeedEmbedding, FeedSource
from ai_web_feeds.search import autocomplete, semantic_search
from sqlmodel import Session, SQLModel, create_engine


@pytest.fixture(autouse=True)
def _block_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail closed if search code opens a socket."""

    def refuse_connection(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("network access is not allowed in search branch tests")

    monkeypatch.setattr(socket, "create_connection", refuse_connection)


@pytest.fixture
def session() -> Iterator[Session]:
    """In-memory database with the current search tables."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db_session:
        yield db_session
    engine.dispose()


@pytest.mark.unit
def test_semantic_search_returns_feed_for_matching_embedding(
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Success path: a stored embedding aligned with the query is returned."""
    vector = np.zeros(8, dtype=np.float32)
    vector[0] = 1.0
    feed = FeedSource(id="aligned-feed", title="Aligned Feed")
    session.add(feed)
    session.add(
        FeedEmbedding(
            feed_id=feed.id,
            embedding=vector.tobytes(),
            embedding_model="test-model",
            embedding_provider="local",
        )
    )
    session.commit()

    def fake_embedding(query_text: str) -> np.ndarray:
        assert query_text == "aligned"
        return vector

    monkeypatch.setattr("ai_web_feeds.search.generate_query_embedding", fake_embedding)

    results = semantic_search(session, "aligned", threshold=0.7, limit=5)

    assert len(results) == 1
    matched, score = results[0]
    assert matched.id == "aligned-feed"
    assert score == pytest.approx(1.0)


@pytest.mark.unit
def test_autocomplete_short_prefix_returns_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty-input path: prefixes shorter than two characters skip the index."""

    def fail_index(_session: object) -> None:
        raise AssertionError("trie index should not be built for a short prefix")

    monkeypatch.setattr("ai_web_feeds.search.get_trie_index", fail_index)

    assert autocomplete(MagicMock(), "") == {"feeds": [], "topics": []}
    assert autocomplete(MagicMock(), "a") == {"feeds": [], "topics": []}
