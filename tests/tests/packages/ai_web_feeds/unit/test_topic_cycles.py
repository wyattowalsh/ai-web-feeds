"""Unit tests for directed topic-graph cycle detection."""

from __future__ import annotations

import pytest
from ai_web_feeds.taxonomy.cycles import Edge, has_cycle


@pytest.mark.unit
def test_acyclic_chain_has_no_cycle() -> None:
    edges = [("a", "b"), ("b", "c"), ("c", "d")]
    assert has_cycle(edges) is False


@pytest.mark.unit
def test_self_loop_is_a_cycle() -> None:
    assert has_cycle([("topic", "topic")]) is True


@pytest.mark.unit
def test_two_node_cycle() -> None:
    assert has_cycle([Edge("a", "b"), Edge("b", "a")]) is True


@pytest.mark.unit
def test_cycle_in_larger_graph() -> None:
    edges = [
        ("root", "a"),
        ("a", "b"),
        ("b", "c"),
        ("c", "a"),
        ("b", "leaf"),
    ]
    assert has_cycle(edges) is True


@pytest.mark.unit
def test_disconnected_cycle() -> None:
    edges = [("a", "b"), ("c", "d"), ("d", "e"), ("e", "c")]
    assert has_cycle(edges) is True


@pytest.mark.unit
def test_empty_graph_has_no_cycle() -> None:
    assert has_cycle(()) is False


@pytest.mark.unit
def test_duplicate_edges_are_not_a_cycle() -> None:
    assert has_cycle([("a", "b"), ("a", "b")]) is False


@pytest.mark.unit
def test_long_chain_is_acyclic() -> None:
    edges = [(str(index), str(index + 1)) for index in range(5000)]
    assert has_cycle(edges) is False
