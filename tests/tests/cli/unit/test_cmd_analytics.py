"""Characterization tests for the analytics CLI."""

from __future__ import annotations

import importlib
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

analytics_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.analytics"))["app"]


@pytest.mark.unit
def test_analytics_help_does_not_call_the_network() -> None:
    """`--help` prints subcommands and does not open a socket or database."""
    runner = CliRunner()
    with (
        patch("socket.create_connection") as create_connection,
        patch("socket.getaddrinfo") as getaddrinfo,
        patch("urllib.request.urlopen") as urlopen,
        patch("http.client.HTTPConnection.request") as http_request,
        patch("http.client.HTTPSConnection.connect") as https_connect,
        patch("ai_web_feeds.cli.commands.analytics.DatabaseManager") as database_manager,
    ):
        result = runner.invoke(analytics_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert "Analytics dashboard commands" in result.output
    assert "summary" in result.output
    assert "trending" in result.output
    assert "velocity" in result.output
    assert "snapshot" in result.output
    assert "export" in result.output
    create_connection.assert_not_called()
    getaddrinfo.assert_not_called()
    urlopen.assert_not_called()
    http_request.assert_not_called()
    https_connect.assert_not_called()
    database_manager.assert_not_called()


@pytest.mark.unit
def test_analytics_summary_mocked_happy_path() -> None:
    """Summary renders deterministic metrics without a database or RNG series."""
    metrics = {
        "total_feeds": 4,
        "active_feeds": 3,
        "validation_success_rate": 0.75,
        "avg_response_time": 12.5,
        "health_distribution": {"healthy": 2, "moderate": 1, "unhealthy": 0},
    }
    session = MagicMock()
    manager = MagicMock()
    manager.get_session.return_value.__enter__.return_value = session
    manager.get_session.return_value.__exit__.return_value = False

    runner = CliRunner()
    with (
        patch(
            "ai_web_feeds.cli.commands.analytics.DatabaseManager",
            return_value=manager,
        ) as database_manager,
        patch(
            "ai_web_feeds.cli.commands.analytics.calculate_summary_metrics",
            return_value=metrics,
        ) as calculate_summary_metrics,
    ):
        result = runner.invoke(
            analytics_app,
            [
                "summary",
                "--database-url",
                "sqlite:///:memory:",
                "--date-range",
                "7d",
                "--topic",
                "ai",
            ],
        )

    assert result.exit_code == 0, result.output
    assert result.exception is None
    output = result.output
    assert "Analytics Summary" in output
    assert "Total Feeds" in output
    assert "Active Feeds" in output
    assert "75.00%" in output
    assert "12.50 ms" in output
    assert "Healthy" in output
    assert "Summary complete" in output
    database_manager.assert_called_once_with("sqlite:///:memory:")
    calculate_summary_metrics.assert_called_once_with(session, date_range="7d", topic="ai")
