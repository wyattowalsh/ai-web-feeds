"""Characterization tests for topic recommendation branches.

The session is a mock. These paths do not open a database or the network.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from ai_web_feeds.recommendations import get_similar_feeds_by_topic


def _session_returning(rows: list[object]) -> MagicMock:
    """Return a session whose queries yield rows and never connect."""
    session = MagicMock()
    session.exec.return_value.all.return_value = rows
    return session


def _feed(feed_id: str, topics: list[str] | None) -> SimpleNamespace:
    """Build a feed row with the fields topic scoring reads."""
    return SimpleNamespace(id=feed_id, topics=topics)


@pytest.mark.unit
def test_similar_feeds_by_topic_ranks_overlap_and_skips_unrelated() -> None:
    """Jaccard overlap orders matching feeds and drops feeds with no shared topics."""
    exact = _feed("exact", ["llm", "research"])
    partial = _feed("partial", ["llm"])
    unrelated = _feed("unrelated", ["cooking"])
    blank = _feed("blank", None)
    session = _session_returning([partial, unrelated, blank, exact])

    ranked = get_similar_feeds_by_topic(
        session,
        ["llm", "research"],
        exclude_ids=["seed"],
        limit=10,
    )

    assert ranked == [exact, partial]
    session.exec.assert_called_once()


@pytest.mark.unit
def test_similar_feeds_by_topic_empty_catalog_returns_empty() -> None:
    """An empty query result is an empty recommendation list."""
    session = _session_returning([])

    ranked = get_similar_feeds_by_topic(session, ["llm"], exclude_ids=[], limit=5)

    assert ranked == []
