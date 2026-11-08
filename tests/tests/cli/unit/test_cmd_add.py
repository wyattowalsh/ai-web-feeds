"""Characterization tests for the add CLI command."""

from __future__ import annotations

import importlib
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

add_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.add"))["app"]

_FEED_URL = "https://example.com/feed.xml"
_SOURCE_ID = "example-com-feed-xml-7a775db7"


@contextmanager
def _guard_network_and_pytest() -> Iterator[dict[str, MagicMock]]:
    """Replace socket, HTTP, and subprocess entry points the command must not use.

    ``--enrich`` would fetch the feed. The test command shells out to pytest.
    Neither path is part of ``--help`` or the mocked add.
    """
    with (
        patch("socket.create_connection") as create_connection,
        patch("socket.getaddrinfo") as getaddrinfo,
        patch("urllib.request.urlopen") as urlopen,
        patch("http.client.HTTPConnection.request") as http_request,
        patch("http.client.HTTPSConnection.connect") as https_connect,
        patch("httpx.AsyncClient") as async_client,
        patch("subprocess.run") as subprocess_run,
        patch("ai_web_feeds.enrich.enrich_feed_source") as enrich_feed_source,
        patch("ai_web_feeds.validate.validate_feeds") as validate_feeds,
    ):
        yield {
            "create_connection": create_connection,
            "getaddrinfo": getaddrinfo,
            "urlopen": urlopen,
            "http_request": http_request,
            "https_connect": https_connect,
            "async_client": async_client,
            "subprocess_run": subprocess_run,
            "enrich_feed_source": enrich_feed_source,
            "validate_feeds": validate_feeds,
        }


def _assert_guarded(guards: dict[str, MagicMock]) -> None:
    for guard in guards.values():
        guard.assert_not_called()


@pytest.mark.unit
def test_add_help_does_not_load_catalog_or_call_network() -> None:
    """`--help` lists add options and does not read, write, fetch, or run pytest."""
    runner = CliRunner()
    with (
        _guard_network_and_pytest() as guards,
        patch("ai_web_feeds.cli.commands.add.load_feeds") as load_feeds,
        patch("ai_web_feeds.cli.commands.add.save_feeds") as save_feeds,
    ):
        result = runner.invoke(add_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert "Add a new feed source URL to the catalog" in result.output
    assert "Feed or site URL to add" in result.output
    assert "--title" in result.output
    assert "--topics" in result.output
    assert "--tags" in result.output
    assert "--input" in result.output
    assert "--validate" in result.output
    assert "--enrich" in result.output
    load_feeds.assert_not_called()
    save_feeds.assert_not_called()
    _assert_guarded(guards)


@pytest.mark.unit
def test_add_happy_path_is_mocked(tmp_path: Path) -> None:
    """Add appends one local source via mocked load/save and does not fetch or validate."""
    runner = CliRunner()
    input_file = tmp_path / "feeds.yaml"
    sentinel = "schema_version: feeds-3.0.0\nsources: []\n"
    input_file.write_text(sentinel, encoding="utf-8")
    catalog: dict[str, object] = {
        "schema_version": "feeds-3.0.0",
        "sources": [],
    }

    with (
        _guard_network_and_pytest() as guards,
        patch(
            "ai_web_feeds.cli.commands.add.load_feeds",
            return_value=catalog,
        ) as load_feeds,
        patch("ai_web_feeds.cli.commands.add.save_feeds") as save_feeds,
    ):
        result = runner.invoke(
            add_app,
            [
                _FEED_URL,
                "--title",
                "Example Feed",
                "--topics",
                "ai,research",
                "--tags",
                "labs,rss",
                "--input",
                str(input_file),
            ],
        )

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert f"Added source: {_SOURCE_ID}" in result.output
    assert _FEED_URL in result.output
    assert "Topics: ai, research" in result.output
    assert "Tags: labs, rss" in result.output
    assert "Catalog:" in result.output
    # Rich wraps the long temp path across lines; the printed path is otherwise exact.
    assert str(input_file) in result.output.replace("\n", "")
    assert "already exists" not in result.output
    load_feeds.assert_called_once_with(input_file)
    save_feeds.assert_called_once_with(catalog, input_file)
    assert catalog["sources"] == [
        {
            "id": _SOURCE_ID,
            "url": _FEED_URL,
            "title": "Example Feed",
            "topics": ["ai", "research"],
            "tags": ["labs", "rss"],
        }
    ]
    assert input_file.read_text(encoding="utf-8") == sentinel
    _assert_guarded(guards)
