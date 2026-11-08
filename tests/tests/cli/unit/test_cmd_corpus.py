"""Characterization tests for the corpus CLI."""

from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

corpus_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.corpus"))["app"]


@pytest.mark.unit
def test_corpus_help_does_not_open_database_or_poll() -> None:
    """`--help` lists subcommands and does not touch storage or the network."""
    runner = CliRunner()
    with (
        patch("ai_web_feeds.cli.commands.corpus.DatabaseManager") as mock_db,
        patch("ai_web_feeds.cli.commands.corpus.FeedPoller") as mock_poller,
    ):
        result = runner.invoke(corpus_app, ["--help"])

    assert result.exit_code == 0
    assert "export" in result.output
    assert "refresh" in result.output
    mock_db.assert_not_called()
    mock_poller.assert_not_called()


@pytest.mark.unit
def test_corpus_export_happy_path_uses_mocked_database(tmp_path: Path) -> None:
    """Export prints stored counts from a mocked database and does not poll feeds."""
    runner = CliRunner()
    output_file = tmp_path / "corpus.json"
    payload = {
        "metadata": {
            "article_count": 4,
            "feed_count": 2,
            "latest_published_at": None,
        }
    }
    with (
        patch("ai_web_feeds.cli.commands.corpus.DatabaseManager") as mock_db,
        patch("ai_web_feeds.cli.commands.corpus.FeedPoller") as mock_poller,
    ):
        manager = MagicMock()
        manager.export_articles_corpus.return_value = payload
        mock_db.return_value = manager
        result = runner.invoke(
            corpus_app,
            [
                "export",
                "--database-url",
                "sqlite:///:memory:",
                "--output",
                str(output_file),
            ],
        )

    assert result.exit_code == 0, result.output
    assert "Exported 4 articles" in result.output
    assert "from 2 feeds" in result.output
    mock_db.assert_called_once_with("sqlite:///:memory:")
    manager.export_articles_corpus.assert_called_once_with(output_file)
    mock_poller.assert_not_called()
