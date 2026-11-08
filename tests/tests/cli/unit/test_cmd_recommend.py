"""Characterization tests for the recommend CLI."""

from __future__ import annotations

import importlib
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

recommend_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.recommend"))["app"]


class _StubFeed:
    """Feed stand-in exposing only the fields the recommend table reads."""

    def __init__(self, title: str, topics: list[str]) -> None:
        self.title = title
        self.topics = topics


def _assert_network_idle(
    create_connection: MagicMock,
    getaddrinfo: MagicMock,
    urlopen: MagicMock,
    http_request: MagicMock,
    https_connect: MagicMock,
) -> None:
    """Fail if the command opened a socket or issued an HTTP request."""
    create_connection.assert_not_called()
    getaddrinfo.assert_not_called()
    urlopen.assert_not_called()
    http_request.assert_not_called()
    https_connect.assert_not_called()


@pytest.mark.unit
def test_recommend_help_does_not_call_the_network() -> None:
    """`--help` lists subcommands and does not open a socket or database."""
    runner = CliRunner()
    with (
        patch("socket.create_connection") as create_connection,
        patch("socket.getaddrinfo") as getaddrinfo,
        patch("urllib.request.urlopen") as urlopen,
        patch("http.client.HTTPConnection.request") as http_request,
        patch("http.client.HTTPSConnection.connect") as https_connect,
        patch("ai_web_feeds.cli.commands.recommend.DatabaseManager") as database_manager,
    ):
        result = runner.invoke(recommend_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert "AI-powered feed recommendations" in result.output
    assert "get" in result.output
    assert "track" in result.output
    assert "weights" in result.output
    _assert_network_idle(
        create_connection,
        getaddrinfo,
        urlopen,
        http_request,
        https_connect,
    )
    database_manager.assert_not_called()


@pytest.mark.unit
def test_recommend_get_mocked_happy_path() -> None:
    """Topic recommendations render from a mocked database without HTTP."""
    feed = _StubFeed(title="Example AI Feed", topics=["machine-learning", "nlp"])
    recommendations = [(feed, 0.95, "similar_topics")]
    manager = MagicMock()
    manager.get_recommendations.return_value = recommendations

    runner = CliRunner()
    with (
        patch("socket.create_connection") as create_connection,
        patch("socket.getaddrinfo") as getaddrinfo,
        patch("urllib.request.urlopen") as urlopen,
        patch("http.client.HTTPConnection.request") as http_request,
        patch("http.client.HTTPSConnection.connect") as https_connect,
        patch(
            "ai_web_feeds.cli.commands.recommend.DatabaseManager",
            return_value=manager,
        ) as database_manager,
    ):
        result = runner.invoke(
            recommend_app,
            [
                "get",
                "--database-url",
                "sqlite:///:memory:",
                "--topics",
                "machine-learning, nlp",
                "--limit",
                "5",
            ],
        )

    assert result.exit_code == 0, result.output
    assert result.exception is None
    output = result.output
    assert "AI-Powered Feed Recommendations" in output
    assert "Recommendations for topics" in output
    assert "machine-learning" in output
    assert "Example AI Feed" in output
    assert "0.950" in output
    assert "Similar Topics" in output
    assert "Generated 1 recommendations" in output
    assert "Recommendation Breakdown" in output
    database_manager.assert_called_once_with("sqlite:///:memory:")
    manager.get_recommendations.assert_called_once_with(
        seed_topics=["machine-learning", "nlp"],
        limit=5,
    )
    manager.get_user_recommendations.assert_not_called()
    _assert_network_idle(
        create_connection,
        getaddrinfo,
        urlopen,
        http_request,
        https_connect,
    )
