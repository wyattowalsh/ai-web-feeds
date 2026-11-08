"""Characterization tests for the export CLI command."""

from __future__ import annotations

import importlib
import socket
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

export_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.export"))["app"]

_CATALOG: dict[str, list[dict[str, str | list[str]]]] = {
    "sources": [
        {
            "id": "example-source",
            "title": "Example Source",
            "url": "https://example.com/feed.xml",
            "topics": ["ai"],
        }
    ],
}


def _block_network(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Fail the test if help or a mocked export opens a TCP connection."""
    calls: list[str] = []

    def _blocked(*_args: object, **_kwargs: object) -> None:
        calls.append("socket.create_connection")
        raise AssertionError("export command attempted a network connection")

    monkeypatch.setattr(socket, "create_connection", _blocked)
    return calls


@pytest.mark.unit
def test_export_help_does_not_call_network(monkeypatch: pytest.MonkeyPatch) -> None:
    network_calls = _block_network(monkeypatch)
    runner = CliRunner()

    with (
        patch("ai_web_feeds.cli.commands.export.load_feeds") as load_feeds,
        patch("ai_web_feeds.cli.commands.export.export_to_json") as export_to_json,
        patch("ai_web_feeds.cli.commands.export.export_to_opml") as export_to_opml,
        patch("ai_web_feeds.cli.commands.export.export_all_formats") as export_all_formats,
    ):
        result = runner.invoke(export_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert network_calls == []
    load_feeds.assert_not_called()
    export_to_json.assert_not_called()
    export_to_opml.assert_not_called()
    export_all_formats.assert_not_called()
    assert "Export feed data in various formats" in result.output
    assert "json" in result.output
    assert "opml" in result.output
    assert "csv" in result.output


@pytest.mark.unit
def test_export_json_happy_path_is_mocked(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    network_calls = _block_network(monkeypatch)
    runner = CliRunner()
    input_file = tmp_path / "feeds.yaml"
    output_file = tmp_path / "feeds.json"

    with (
        patch(
            "ai_web_feeds.cli.commands.export.load_feeds",
            return_value=_CATALOG,
        ) as load_feeds,
        patch("ai_web_feeds.cli.commands.export.export_to_json") as export_to_json,
        patch("ai_web_feeds.cli.commands.export.export_to_opml") as export_to_opml,
    ):
        result = runner.invoke(
            export_app,
            ["json", "--input", str(input_file), "--output", str(output_file)],
        )

    rendered = result.output.replace("\n", "")
    assert result.exit_code == 0, result.output
    assert network_calls == []
    load_feeds.assert_called_once_with(input_file)
    export_to_json.assert_called_once_with(_CATALOG, output_file)
    export_to_opml.assert_not_called()
    assert not output_file.exists()
    assert "Exported 1 feeds" in rendered
    assert str(output_file) in rendered
