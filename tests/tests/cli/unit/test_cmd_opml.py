"""Characterization tests for the OPML CLI."""

from __future__ import annotations

import http.client
import importlib
import socket
import subprocess
import urllib.request
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

opml_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.opml"))["app"]

_GENERATED_OPML = "<opml>generated</opml>"
_WRAPPED_OPML = "<opml>wrapped</opml>"
_SOURCES = [
    SimpleNamespace(id="alpha", title="Alpha"),
    SimpleNamespace(id="beta", title="Beta"),
]


def _guard_network_and_pytest(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Record and refuse live HTTP and a nested pytest run."""
    calls: list[str] = []

    def _refuse(channel: str):
        def _blocked(*_args: object, **_kwargs: object) -> None:
            calls.append(channel)
            raise AssertionError(f"opml command attempted guarded access via {channel}")

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
    monkeypatch.setattr(subprocess, "run", _refuse("subprocess.run"))
    monkeypatch.setattr(pytest, "main", _refuse("pytest.main"))
    return calls


@pytest.mark.unit
def test_opml_help_does_not_call_network_or_pytest(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--help` lists OPML commands and does not open a socket, database, or pytest."""
    guarded_calls = _guard_network_and_pytest(monkeypatch)
    runner = CliRunner()

    with (
        patch("ai_web_feeds.cli.commands.opml.DatabaseManager") as database_manager,
        patch("ai_web_feeds.cli.commands.opml.generate_opml") as generate_opml,
        patch("ai_web_feeds.cli.commands.opml.generate_categorized_opml") as generate_categorized,
        patch("ai_web_feeds.cli.commands.opml.generate_filtered_opml") as generate_filtered,
        patch("ai_web_feeds.cli.commands.opml.wrap_opml_with_root_folder") as wrap_opml,
        patch("ai_web_feeds.cli.commands.opml.save_opml") as save_opml,
    ):
        result = runner.invoke(opml_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    assert "Generate OPML files from feed sources" in result.output
    assert "all" in result.output
    assert "categorized" in result.output
    assert "filtered" in result.output
    database_manager.assert_not_called()
    generate_opml.assert_not_called()
    generate_categorized.assert_not_called()
    generate_filtered.assert_not_called()
    wrap_opml.assert_not_called()
    save_opml.assert_not_called()


@pytest.mark.unit
def test_opml_all_happy_path_is_mocked(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`all` writes through mocked generators and does not touch the network or pytest."""
    guarded_calls = _guard_network_and_pytest(monkeypatch)
    output_file = tmp_path / "feeds.opml"
    database_url = "sqlite:///:memory:"
    manager = MagicMock()
    manager.get_all_feed_sources.return_value = _SOURCES
    runner = CliRunner()

    with (
        patch(
            "ai_web_feeds.cli.commands.opml.DatabaseManager",
            return_value=manager,
        ) as database_manager,
        patch(
            "ai_web_feeds.cli.commands.opml.generate_opml",
            return_value=_GENERATED_OPML,
        ) as generate_opml,
        patch("ai_web_feeds.cli.commands.opml.generate_categorized_opml") as generate_categorized,
        patch("ai_web_feeds.cli.commands.opml.generate_filtered_opml") as generate_filtered,
        patch(
            "ai_web_feeds.cli.commands.opml.wrap_opml_with_root_folder",
            return_value=_WRAPPED_OPML,
        ) as wrap_opml,
        patch("ai_web_feeds.cli.commands.opml.save_opml") as save_opml,
    ):
        result = runner.invoke(
            opml_app,
            ["all", "--output", str(output_file), "--database", database_url],
        )

    rendered = result.output.replace("\n", "")
    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    database_manager.assert_called_once_with(database_url)
    manager.get_all_feed_sources.assert_called_once_with()
    generate_opml.assert_called_once_with(_SOURCES, title="AI Web Feeds - All Feeds")
    generate_categorized.assert_not_called()
    generate_filtered.assert_not_called()
    wrap_opml.assert_called_once_with(_GENERATED_OPML)
    save_opml.assert_called_once_with(_WRAPPED_OPML, output_file)
    assert not output_file.exists()
    assert "Generated OPML with 2 feeds" in rendered
    assert str(output_file) in rendered
