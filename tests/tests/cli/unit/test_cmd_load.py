"""Characterization tests for the load CLI command."""

from __future__ import annotations

import importlib
import socket
import subprocess
import urllib.request
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

load_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.load"))["app"]

_DATABASE_URL = "sqlite:///:memory:"
_CATALOG: dict[str, Any] = {
    "sources": [
        {
            "url": "https://example.com/feed.xml",
            "title": "Example Source",
            "source_type": "blog",
            "description": "An example feed",
            "website_url": "https://example.com",
            "verified": True,
            "is_active": True,
            "topics": ["ai"],
            "tags": ["rss"],
        }
    ],
}


def _guard_network_and_pytest(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Fail the test if load opens a socket or shells out (pytest uses subprocess)."""
    calls: list[str] = []

    def _refuse(channel: str):
        def _blocked(*_args: object, **_kwargs: object) -> None:
            calls.append(channel)
            message = f"load command attempted guarded access via {channel}"
            raise AssertionError(message)

        return _blocked

    monkeypatch.setattr(socket, "create_connection", _refuse("socket.create_connection"))
    monkeypatch.setattr(socket, "getaddrinfo", _refuse("socket.getaddrinfo"))
    monkeypatch.setattr(urllib.request, "urlopen", _refuse("urllib.request.urlopen"))
    monkeypatch.setattr(subprocess, "run", _refuse("subprocess.run"))
    return calls


@pytest.mark.unit
def test_load_help_does_not_call_network_or_pytest(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--help` lists load commands and does not open a database, socket, or pytest."""
    guarded_calls = _guard_network_and_pytest(monkeypatch)
    runner = CliRunner()

    with (
        patch("ai_web_feeds.cli.commands.load.upgrade_database_to_head") as upgrade_database,
        patch("ai_web_feeds.cli.commands.load.DatabaseManager") as database_manager,
        patch("ai_web_feeds.cli.commands.load.load_feeds") as load_feeds,
    ):
        result = runner.invoke(load_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    upgrade_database.assert_not_called()
    database_manager.assert_not_called()
    load_feeds.assert_not_called()
    assert "Load feeds from YAML into database" in result.output
    assert "from-yaml" in result.output
    assert "all" in result.output


@pytest.mark.unit
def test_load_from_yaml_happy_path_is_mocked(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """from-yaml inserts one mocked source and does not migrate, read YAML, or connect."""
    guarded_calls = _guard_network_and_pytest(monkeypatch)
    runner = CliRunner()
    input_file = tmp_path / "feeds.yaml"
    manager = MagicMock()

    with (
        patch("ai_web_feeds.cli.commands.load.upgrade_database_to_head") as upgrade_database,
        patch(
            "ai_web_feeds.cli.commands.load.DatabaseManager",
            return_value=manager,
        ) as database_manager,
        patch(
            "ai_web_feeds.cli.commands.load.load_feeds",
            return_value=_CATALOG,
        ) as load_feeds,
    ):
        result = runner.invoke(
            load_app,
            ["from-yaml", "--input", str(input_file), "--database", _DATABASE_URL],
        )

    rendered = " ".join(result.output.split())
    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    assert not input_file.exists()
    upgrade_database.assert_called_once_with(_DATABASE_URL)
    database_manager.assert_called_once_with(_DATABASE_URL)
    load_feeds.assert_called_once_with(input_file)
    manager.get_session.assert_not_called()
    manager.add_feed_source.assert_called_once()
    added = manager.add_feed_source.call_args.args[0]
    assert added.url == "https://example.com/feed.xml"
    assert added.title == "Example Source"
    assert str(getattr(added.source_type, "value", added.source_type)) == "blog"
    assert added.verified is True
    assert added.topics == ["ai"]
    assert added.tags == ["rss"]
    assert "Found 1 feed sources" in rendered
    assert "Successfully loaded 1 feeds" in rendered
    assert "failed to load" not in rendered
    assert f"Database: {_DATABASE_URL}" in rendered
    assert "Total feeds: 1" in rendered
