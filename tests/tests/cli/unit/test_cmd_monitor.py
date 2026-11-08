"""Characterization tests for the monitor CLI."""

from __future__ import annotations

import http.client
import importlib
import socket
import subprocess
import urllib.request
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

monitor_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.monitor"))["app"]


def _guard_network_and_pytest(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Record and reject sockets, HTTP, and a nested pytest or uv subprocess."""
    calls: list[str] = []

    def _blocked(name: str):
        def _inner(*_args: object, **_kwargs: object) -> None:
            calls.append(name)
            raise AssertionError(f"monitor command attempted {name}")

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
    monkeypatch.setattr(subprocess, "run", _blocked("subprocess.run"))
    monkeypatch.setattr(pytest, "main", _blocked("pytest.main"))
    return calls


@pytest.mark.unit
def test_monitor_help_does_not_call_network_or_pytest(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`--help` lists subcommands and does not open a socket, database, or pytest."""
    guarded_calls = _guard_network_and_pytest(monkeypatch)
    runner = CliRunner()

    with (
        patch("ai_web_feeds.cli.commands.monitor.Settings") as settings_cls,
        patch("ai_web_feeds.cli.commands.monitor.DatabaseManager") as database_manager,
        patch("ai_web_feeds.cli.commands.monitor.SchedulerManager") as scheduler_manager,
        patch("ai_web_feeds.cli.commands.monitor.WebSocketServer") as websocket_server,
        patch("ai_web_feeds.cli.commands.monitor.upgrade_database_to_head") as upgrade_database,
        patch("ai_web_feeds.cli.commands.monitor.asyncio.run") as asyncio_run,
    ):
        result = runner.invoke(monitor_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    assert "Real-time feed monitoring commands" in result.output
    assert "start" in result.output
    assert "status" in result.output
    assert "follow" in result.output
    assert "unfollow" in result.output
    assert "list-follows" in result.output
    assert "subscribe-digest" in result.output
    assert "unsubscribe-digest" in result.output
    assert "list-digests" in result.output
    settings_cls.assert_not_called()
    database_manager.assert_not_called()
    scheduler_manager.assert_not_called()
    websocket_server.assert_not_called()
    upgrade_database.assert_not_called()
    asyncio_run.assert_not_called()


@pytest.mark.unit
def test_monitor_status_mocked_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    """Status prints a running scheduler from mocks and does not serve or poll."""
    guarded_calls = _guard_network_and_pytest(monkeypatch)
    runner = CliRunner()
    settings = MagicMock()
    settings.database_url = "sqlite:///:memory:"
    settings.phase3b.websocket_port = 8765
    database = MagicMock()
    scheduler = MagicMock()
    scheduler.scheduler.running = True
    scheduler.list_jobs.return_value = [
        {
            "id": "poll_feeds",
            "name": "Poll all feeds",
            "next_run": "2026-11-08 09:00",
            "trigger": "interval",
        }
    ]

    with (
        patch("ai_web_feeds.cli.commands.monitor.Settings", return_value=settings) as settings_cls,
        patch(
            "ai_web_feeds.cli.commands.monitor.DatabaseManager",
            return_value=database,
        ) as database_manager,
        patch(
            "ai_web_feeds.cli.commands.monitor.SchedulerManager",
            return_value=scheduler,
        ) as scheduler_manager,
        patch("ai_web_feeds.cli.commands.monitor.WebSocketServer") as websocket_server,
        patch("ai_web_feeds.cli.commands.monitor.upgrade_database_to_head") as upgrade_database,
        patch("ai_web_feeds.cli.commands.monitor.asyncio.run") as asyncio_run,
    ):
        result = runner.invoke(monitor_app, ["status"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    output = result.output
    assert "Monitoring Server Status" in output
    assert "Running" in output
    assert "Scheduled Jobs" in output
    assert "poll_feeds" in output
    assert "Poll all feeds" in output
    assert "2026-11-08 09:00" in output
    assert "8765" in output
    assert "monitor start" in output
    settings_cls.assert_called_once_with()
    database_manager.assert_called_once_with("sqlite:///:memory:")
    scheduler_manager.assert_called_once_with(database, settings)
    scheduler.list_jobs.assert_called_once_with()
    websocket_server.assert_not_called()
    upgrade_database.assert_not_called()
    asyncio_run.assert_not_called()
