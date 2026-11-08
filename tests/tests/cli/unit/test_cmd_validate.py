"""Characterization tests for the validate CLI command."""

from __future__ import annotations

import importlib
import socket
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from typer.testing import CliRunner

validate_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.validate"))["app"]


def _block_network(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Fail the test if help or a mocked validation opens a TCP connection."""
    calls: list[str] = []

    def _blocked(*_args: object, **_kwargs: object) -> None:
        calls.append("socket.create_connection")
        msg = "validate command attempted a network connection"
        raise AssertionError(msg)

    monkeypatch.setattr(socket, "create_connection", _blocked)
    return calls


@pytest.mark.unit
def test_validate_help_does_not_call_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--help` lists subcommands and does not open a socket or validate URLs."""
    network_calls = _block_network(monkeypatch)
    runner = CliRunner()

    with (
        patch("ai_web_feeds.cli.commands.validate.DatabaseManager") as database_manager,
        patch("ai_web_feeds.cli.commands.validate.validate_all_feeds") as validate_all_feeds,
        patch(
            "ai_web_feeds.validate.httpx.AsyncClient",
            side_effect=AssertionError("validate command attempted a live HTTP call"),
        ) as http_client,
    ):
        result = runner.invoke(validate_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert network_calls == []
    database_manager.assert_not_called()
    validate_all_feeds.assert_not_called()
    http_client.assert_not_called()
    assert "Validate feed data against schemas" in result.output
    assert "feeds" in result.output
    assert "topics" in result.output
    assert "references" in result.output
    assert "http" in result.output
    assert "report" in result.output


@pytest.mark.unit
def test_validate_http_happy_path_is_mocked(monkeypatch: pytest.MonkeyPatch) -> None:
    """HTTP validation uses mocked results and does not open a live client."""
    network_calls = _block_network(monkeypatch)
    runner = CliRunner()
    feed = SimpleNamespace(id="example-feed")
    validation = SimpleNamespace(is_valid=True, response_time_ms=42.0, warnings=[])
    manager = MagicMock()
    manager.get_all_feed_sources.return_value = [feed]

    with (
        patch(
            "ai_web_feeds.cli.commands.validate.DatabaseManager",
            return_value=manager,
        ) as database_manager,
        patch(
            "ai_web_feeds.cli.commands.validate.validate_all_feeds",
            new_callable=AsyncMock,
            return_value=[validation],
        ) as validate_all_feeds,
        patch(
            "ai_web_feeds.validate.httpx.AsyncClient",
            side_effect=AssertionError("validate command attempted a live HTTP call"),
        ) as http_client,
    ):
        result = runner.invoke(
            validate_app,
            ["http", "--database", "sqlite:///:memory:", "--concurrency", "2"],
        )

    assert result.exit_code == 0, result.output
    assert network_calls == []
    http_client.assert_not_called()
    database_manager.assert_called_once_with("sqlite:///:memory:")
    manager.get_feed_source.assert_not_called()
    manager.get_all_feed_sources.assert_called_once_with()
    validate_all_feeds.assert_awaited_once_with(
        [feed],
        concurrency_limit=2,
        show_progress=True,
    )
    manager.add_validation_result.assert_called_once_with(validation)
    assert "HTTP Feed Validation" in result.output
    assert "Found 1 feeds" in result.output
    assert "Successful" in result.output
    assert "100.0%" in result.output
    assert "42ms" in result.output
