"""Characterization tests for the fetch CLI."""

from __future__ import annotations

import http.client
import importlib
import socket
import urllib.request
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from typer.testing import CliRunner

fetch_app = importlib.import_module("ai_web_feeds.cli.commands.fetch").app

_FEED_ID = "example-feed"
_FEED_URL = "https://example.com/feed.xml"
_DATABASE_URL = "sqlite:///:memory:"
_FEED_XML = """<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <item>
      <title>Hello</title>
      <link>https://example.com/hello</link>
      <guid>hello-1</guid>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
"""


def _guard_live_http(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Record and reject sockets or HTTP clients the fetch command must not use."""
    calls: list[str] = []

    def _blocked(name: str):
        def _inner(*_args: object, **_kwargs: object) -> None:
            calls.append(name)
            raise AssertionError(f"fetch command attempted a live HTTP call via {name}")

        return _inner

    monkeypatch.setattr(socket, "create_connection", _blocked("socket.create_connection"))
    monkeypatch.setattr(socket, "getaddrinfo", _blocked("socket.getaddrinfo"))
    monkeypatch.setattr(urllib.request, "urlopen", _blocked("urllib.request.urlopen"))
    monkeypatch.setattr(
        http.client.HTTPConnection,
        "request",
        _blocked("http.client.HTTPConnection.request"),
    )
    monkeypatch.setattr(
        http.client.HTTPSConnection,
        "connect",
        _blocked("http.client.HTTPSConnection.connect"),
    )
    return calls


def _return_same(value: object) -> object:
    """Echo the poll job the database mock is asked to persist."""
    return value


def _mocked_http_client() -> tuple[AsyncMock, AsyncMock]:
    """Build an async client whose GET returns fixture XML and never opens a socket."""
    response = MagicMock()
    response.text = _FEED_XML
    response.raise_for_status = MagicMock()

    http = AsyncMock()
    http.get = AsyncMock(return_value=response)

    client = AsyncMock()
    client.__aenter__.return_value = http
    client.__aexit__.return_value = None
    return client, http


@pytest.mark.unit
def test_fetch_help_does_not_call_the_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--help` lists subcommands and does not open a socket, database, or HTTP client."""
    guarded_calls = _guard_live_http(monkeypatch)
    runner = CliRunner()

    with (
        patch("ai_web_feeds.cli.commands.fetch.upgrade_database_to_head") as upgrade_database,
        patch("ai_web_feeds.cli.commands.fetch.DatabaseManager") as database_manager,
        patch("ai_web_feeds.cli.commands.fetch.FeedPoller") as feed_poller,
        patch("ai_web_feeds.polling.httpx.AsyncClient") as async_client,
    ):
        result = runner.invoke(fetch_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    assert "Fetch feeds and publish discovered articles" in result.output
    assert "one" in result.output
    assert "all" in result.output
    upgrade_database.assert_not_called()
    database_manager.assert_not_called()
    feed_poller.assert_not_called()
    async_client.assert_not_called()


@pytest.mark.unit
def test_fetch_one_happy_path_uses_mocked_http(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fetch one feed through the poller with HTTP mocked and live sockets rejected."""
    guarded_calls = _guard_live_http(monkeypatch)
    runner = CliRunner()
    feed = MagicMock()
    feed.id = _FEED_ID
    feed.feed = _FEED_URL
    client, http = _mocked_http_client()
    manager = MagicMock()
    manager.get_feed_source.return_value = feed
    manager.create_poll_job.side_effect = _return_same
    manager.update_poll_job.side_effect = _return_same
    manager.get_article_by_identity.return_value = None

    with (
        patch("ai_web_feeds.cli.commands.fetch.upgrade_database_to_head") as upgrade_database,
        patch(
            "ai_web_feeds.cli.commands.fetch.DatabaseManager",
            return_value=manager,
        ) as database_manager,
        patch("ai_web_feeds.polling.httpx.AsyncClient", return_value=client) as async_client,
    ):
        result = runner.invoke(
            fetch_app,
            ["one", _FEED_ID, "--database", _DATABASE_URL],
        )

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    output = result.output
    assert "Fetch successful" in output
    assert _FEED_ID in output
    assert "success" in output
    upgrade_database.assert_called_once_with(_DATABASE_URL)
    database_manager.assert_called_once_with(_DATABASE_URL)
    manager.get_feed_source.assert_called_once_with(_FEED_ID)
    async_client.assert_called_once()
    http.get.assert_awaited_once_with(_FEED_URL)
    manager.add_article.assert_called_once()
