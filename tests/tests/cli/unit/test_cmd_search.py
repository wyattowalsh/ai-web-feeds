"""Characterization tests for the search CLI."""

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

search_cmd: Any = importlib.import_module("ai_web_feeds.cli.commands.search")
search_app: Any = vars(search_cmd)["app"]


def _guard_external_calls(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Fail if search opens a socket or re-enters pytest."""
    calls: list[str] = []

    def _reject(channel: str):
        def _blocked(*_args: object, **_kwargs: object) -> None:
            calls.append(channel)
            message = f"search command attempted a guarded call: {channel}"
            raise AssertionError(message)

        return _blocked

    monkeypatch.setattr(socket, "create_connection", _reject("socket.create_connection"))
    monkeypatch.setattr(socket, "getaddrinfo", _reject("socket.getaddrinfo"))
    monkeypatch.setattr(urllib.request, "urlopen", _reject("urllib.request.urlopen"))
    monkeypatch.setattr(
        http.client.HTTPConnection,
        "request",
        _reject("http.client.HTTPConnection.request"),
    )
    monkeypatch.setattr(
        http.client.HTTPSConnection,
        "connect",
        _reject("http.client.HTTPSConnection.connect"),
    )
    monkeypatch.setattr(pytest, "main", _reject("pytest.main"))
    return calls


@pytest.mark.unit
def test_search_help_does_not_call_the_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--help` lists subcommands and does not open a socket, database, or pytest."""
    guarded_calls = _guard_external_calls(monkeypatch)
    runner = CliRunner()

    with patch("ai_web_feeds.cli.commands.search.DatabaseManager") as database_manager:
        result = runner.invoke(search_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    database_manager.assert_not_called()
    assert "Search and discovery commands" in result.output
    for name in ("query", "autocomplete", "init", "embeddings", "save", "list-saved"):
        assert name in result.output


@pytest.mark.unit
def test_search_query_mocked_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    """Full-text query renders one mocked feed and does not touch the network or pytest."""
    guarded_calls = _guard_external_calls(monkeypatch)
    # Rich uses both dimensions; setting only width leaves the live terminal size.
    monkeypatch.setattr(search_cmd.console, "_width", 240)
    monkeypatch.setattr(search_cmd.console, "_height", 48)
    title = "Transformer Weekly " + ("Digest " * 8)
    feed_url = "https://example.com/feeds/transformer-weekly.xml"
    feed = SimpleNamespace(
        title=title,
        topics=["llm", "nlp", "research", "extra"],
        verified=True,
        feed=feed_url,
        site=None,
    )
    manager = MagicMock()
    manager.search_feeds.return_value = [feed]
    runner = CliRunner()

    with patch(
        "ai_web_feeds.cli.commands.search.DatabaseManager",
        return_value=manager,
    ) as database_manager:
        result = runner.invoke(
            search_app,
            [
                "query",
                "transformers",
                "--database-url",
                "sqlite:///:memory:",
                "--type",
                "full_text",
                "--limit",
                "5",
                "--source-type",
                "blog",
                "--topics",
                "llm, nlp",
                "--verified",
            ],
        )

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    output = result.output
    assert "Search Query" in output
    assert "transformers" in output
    assert "Search Results (1)" in output
    assert title[:50] in output
    assert title not in output
    assert "llm, nlp, research +1 more" in output
    assert feed_url[:40] in output
    assert feed_url not in output
    assert "Found 1 results" in output
    assert "No results found" not in output
    database_manager.assert_called_once_with("sqlite:///:memory:")
    manager.search_feeds.assert_called_once_with(
        "transformers",
        search_type="full_text",
        limit=5,
        filters={
            "source_type": "blog",
            "topics": ["llm", "nlp"],
            "verified": True,
        },
    )
