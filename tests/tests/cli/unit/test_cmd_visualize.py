"""Characterization tests for the visualize CLI.

The command renders the local taxonomy graph. It has no demo catalog, no
forecast series, and no optional ML weights. Network entry points stay guarded.
"""

from __future__ import annotations

import http.client
import importlib
import socket
import urllib.request
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

module = importlib.import_module("ai_web_feeds.cli.commands.visualize")
visualize_app: Any = getattr(module, "app")  # noqa: B009

_MOCK_STATS: dict[str, object] = {
    "total_topics": 2,
    "root_topics": 1,
    "max_depth": 1,
    "avg_depth": 0.5,
    "facets": {"domain": 2},
    "facet_groups": {"conceptual": 2},
}


def _guard_network(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Record and refuse live sockets or HTTP the visualize command must not use."""
    calls: list[str] = []

    def _refuse(channel: str):
        def _blocked(*_args: object, **_kwargs: object) -> None:
            calls.append(channel)
            raise AssertionError(f"visualize command attempted guarded access via {channel}")

        return _blocked

    monkeypatch.setattr(socket, "create_connection", _refuse("socket.create_connection"))
    monkeypatch.setattr(socket, "getaddrinfo", _refuse("socket.getaddrinfo"))
    monkeypatch.setattr(urllib.request, "urlopen", _refuse("urllib.request.urlopen"))
    monkeypatch.setattr(
        http.client.HTTPConnection,
        "request",
        _refuse("http.client.HTTPConnection.request"),
    )
    monkeypatch.setattr(
        http.client.HTTPSConnection,
        "connect",
        _refuse("http.client.HTTPSConnection.connect"),
    )
    return calls


@pytest.mark.unit
def test_visualize_help_does_not_call_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--help` lists mermaid, json, and stats and does not load or render a graph."""
    guarded_calls = _guard_network(monkeypatch)
    runner = CliRunner()

    with (
        patch("ai_web_feeds.taxonomy.load_taxonomy") as load_taxonomy,
        patch("ai_web_feeds.taxonomy.TaxonomyVisualizer") as visualizer_cls,
    ):
        result = runner.invoke(visualize_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    load_taxonomy.assert_not_called()
    visualizer_cls.assert_not_called()
    assert "Visualize the taxonomy/ontology graph" in result.output
    assert "mermaid" in result.output
    assert "json" in result.output
    assert "stats" in result.output


@pytest.mark.unit
def test_visualize_stats_mocked_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stats prints a mocked local taxonomy summary and does not emit a graph series."""
    guarded_calls = _guard_network(monkeypatch)
    taxonomy = SimpleNamespace(topics=(object(), object()))
    visualizer = MagicMock()
    visualizer.get_statistics.return_value = _MOCK_STATS
    runner = CliRunner()

    with (
        patch(
            "ai_web_feeds.taxonomy.load_taxonomy",
            return_value=taxonomy,
        ) as load_taxonomy,
        patch(
            "ai_web_feeds.taxonomy.TaxonomyVisualizer",
            return_value=visualizer,
        ) as visualizer_cls,
    ):
        result = runner.invoke(visualize_app, ["stats"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    load_taxonomy.assert_called_once_with()
    visualizer_cls.assert_called_once_with(taxonomy)
    visualizer.get_statistics.assert_called_once_with()
    visualizer.to_mermaid.assert_not_called()
    visualizer.to_json_graph.assert_not_called()
    collapsed = " ".join(result.output.split())
    assert "Taxonomy Statistics" in collapsed
    assert "Total Topics 2" in collapsed
    assert "Root Topics 1" in collapsed
    assert "Maximum Depth 1" in collapsed
    assert "Average Depth 0.50" in collapsed
    assert "Facets" in collapsed
    assert "domain" in collapsed
    assert "Facet Groups" in collapsed
    assert "conceptual" in collapsed
