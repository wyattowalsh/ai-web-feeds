"""CLI regression tests for database environment precedence."""

from unittest.mock import MagicMock, patch

from ai_web_feeds.cli.commands.stats import app
from typer.testing import CliRunner

runner = CliRunner()


def test_stats_command_uses_aiwf_database_url(monkeypatch, tmp_path):
    """The stats command should respect AIWF_DATABASE_URL when no flag is provided."""
    database_url = f"sqlite:///{(tmp_path / 'stats.db').as_posix()}"
    monkeypatch.setenv("AIWF_DATABASE_URL", database_url)

    mock_db = MagicMock()
    mock_db.get_all_feed_sources.return_value = []

    with patch("ai_web_feeds.cli.commands.stats.DatabaseManager", return_value=mock_db) as manager:
        result = runner.invoke(app, ["show"])

    assert result.exit_code == 0
    manager.assert_called_once_with(database_url)
