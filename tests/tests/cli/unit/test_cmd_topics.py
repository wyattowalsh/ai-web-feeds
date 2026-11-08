"""Characterization tests for the topics CLI command."""

from __future__ import annotations

import importlib
import socket
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

topics_app: Any = importlib.import_module("ai_web_feeds.cli.commands.topics").app

_TOPICS: dict[str, list[dict[str, str | list[str]]]] = {
    "topics": [
        {
            "id": "ml",
            "label": "Machine Learning",
            "facet": "domain",
            "facet_group": "conceptual",
            "parents": ["ai"],
        }
    ],
}


def _block_network(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Fail the test if help or a mocked topics command opens a TCP connection."""
    calls: list[str] = []

    def _blocked(*_args: object, **_kwargs: object) -> None:
        calls.append("socket.create_connection")
        raise AssertionError("topics command attempted a network connection")

    monkeypatch.setattr(socket, "create_connection", _blocked)
    return calls


@pytest.mark.unit
def test_topics_help_does_not_call_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--help` lists subcommands and does not load the taxonomy or open a socket."""
    network_calls = _block_network(monkeypatch)
    runner = CliRunner()

    with (
        patch("ai_web_feeds.cli.commands.topics.load_topics") as load_topics,
        patch("socket.getaddrinfo") as getaddrinfo,
        patch("urllib.request.urlopen") as urlopen,
        patch("http.client.HTTPConnection.request") as http_request,
        patch("http.client.HTTPSConnection.connect") as https_connect,
        patch("subprocess.run") as subprocess_run,
    ):
        result = runner.invoke(topics_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert network_calls == []
    load_topics.assert_not_called()
    getaddrinfo.assert_not_called()
    urlopen.assert_not_called()
    http_request.assert_not_called()
    https_connect.assert_not_called()
    subprocess_run.assert_not_called()
    assert "Manage and inspect the topic taxonomy" in result.output
    assert "list" in result.output
    assert "show" in result.output


@pytest.mark.unit
def test_topics_list_happy_path_is_mocked(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """List prints a mocked taxonomy and does not parse YAML or open a socket."""
    network_calls = _block_network(monkeypatch)
    runner = CliRunner()
    topics_file = tmp_path / "topics.yaml"
    topics_file.write_text("# sentinel: load_topics is mocked\n", encoding="utf-8")

    with (
        patch(
            "ai_web_feeds.cli.commands.topics.load_topics",
            return_value=_TOPICS,
        ) as load_topics,
        patch("socket.getaddrinfo") as getaddrinfo,
        patch("urllib.request.urlopen") as urlopen,
        patch("http.client.HTTPConnection.request") as http_request,
        patch("http.client.HTTPSConnection.connect") as https_connect,
        patch("subprocess.run") as subprocess_run,
    ):
        result = runner.invoke(topics_app, ["list", "--file", str(topics_file)])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert network_calls == []
    load_topics.assert_called_once_with(topics_file)
    getaddrinfo.assert_not_called()
    urlopen.assert_not_called()
    http_request.assert_not_called()
    https_connect.assert_not_called()
    subprocess_run.assert_not_called()
    assert "Machine Learning" in result.output
    assert "ml" in result.output
    assert "domain" in result.output
    assert "conceptual" in result.output
    assert "ai" in result.output
    assert "Topics (1/1)" in result.output
    assert "By Facet:" in result.output
    assert "domain: 1" in result.output
    assert "By Group:" in result.output
    assert "conceptual: 1" in result.output
