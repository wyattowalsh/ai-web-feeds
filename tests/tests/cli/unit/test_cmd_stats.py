"""Characterization tests for the stats CLI."""

from __future__ import annotations

import importlib
import socket
import subprocess
import urllib.request
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

stats_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.stats"))["app"]


def _guard_network_and_pytest(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Record and refuse live HTTP and a nested pytest run."""
    calls: list[str] = []

    def _refuse(channel: str):
        def _blocked(*_args: object, **_kwargs: object) -> None:
            calls.append(channel)
            raise AssertionError(f"stats command attempted guarded access via {channel}")

        return _blocked

    monkeypatch.setattr(socket, "create_connection", _refuse("socket.create_connection"))
    monkeypatch.setattr(socket, "getaddrinfo", _refuse("socket.getaddrinfo"))
    monkeypatch.setattr(urllib.request, "urlopen", _refuse("urllib.request.urlopen"))
    monkeypatch.setattr(subprocess, "run", _refuse("subprocess.run"))
    return calls


@pytest.mark.unit
def test_stats_help_does_not_call_network_or_pytest(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--help` lists show and does not open a socket, database, or pytest."""
    guarded_calls = _guard_network_and_pytest(monkeypatch)
    runner = CliRunner()

    with patch("ai_web_feeds.cli.commands.stats.DatabaseManager") as database_manager:
        result = runner.invoke(stats_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert "show" in result.output
    assert "statistics" in result.output.lower()
    assert guarded_calls == []
    database_manager.assert_not_called()


@pytest.mark.unit
def test_stats_show_mocked_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    """Show prints mocked source counts and does not touch the network or pytest."""
    guarded_calls = _guard_network_and_pytest(monkeypatch)
    blog = SimpleNamespace(value="blog")
    newsletter = SimpleNamespace(value="newsletter")
    sources = [
        SimpleNamespace(verified=True, source_type=blog),
        SimpleNamespace(verified=True, source_type=blog),
        SimpleNamespace(verified=False, source_type=newsletter),
    ]
    manager = MagicMock()
    manager.get_all_feed_sources.return_value = sources

    runner = CliRunner()
    database_url = "sqlite:///:memory:"
    with patch(
        "ai_web_feeds.cli.commands.stats.DatabaseManager",
        return_value=manager,
    ) as database_manager:
        # Typer 0.25 flattens a one-command app, so `show` is the command itself.
        result = runner.invoke(stats_app, ["--database", database_url])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    output = result.output
    assert "Feed Statistics" in output
    assert "Total Feeds: 3" in output
    assert "Verified: 2 (66.7%)" in output
    assert "  blog            :   2" in output
    assert "  newsletter      :   1" in output
    database_manager.assert_called_once_with(database_url)
    manager.get_all_feed_sources.assert_called_once_with()
