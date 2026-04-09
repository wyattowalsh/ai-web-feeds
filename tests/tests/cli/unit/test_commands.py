"""Unit tests for CLI command registration and common options."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch

import pytest
from ai_web_feeds.cli import app, cli
from ai_web_feeds.cli import commands as command_modules
from ai_web_feeds.cli import support as cli_support
from ai_web_feeds.cli.commands import analytics, monitor, nlp, recommend, search, visualize
from ai_web_feeds.models import SourceType
from typer.testing import CliRunner

runner = CliRunner()


@pytest.mark.unit
def test_cli_alias_exposes_root_app() -> None:
    """The compatibility alias should expose the same Typer app."""
    assert cli is app


@pytest.mark.unit
def test_root_help_lists_foundation_command_groups() -> None:
    """Root help should include the wired CLI command groups."""
    result = runner.invoke(cli, ["--help"])

    assert result.exit_code == 0
    for command in (
        "process",
        "fetch",
        "load",
        "validate",
        "enrich",
        "export",
        "opml",
        "stats",
        "test",
        "analytics",
        "search",
        "recommend",
        "monitor",
        "visualize",
        "nlp",
    ):
        assert command in result.output


@pytest.mark.unit
def test_command_loader_imports_core_and_optional_groups() -> None:
    """The command loader should import both core and optional command groups."""
    assert command_modules.load_command_module("fetch").app is not None
    assert command_modules.load_optional_command_module("nlp") is not None
    assert command_modules.load_optional_command_module("visualize") is not None
    assert command_modules.load_optional_command_module("does_not_exist") is None


@pytest.mark.unit
def test_cli_command_modules_share_console_instance() -> None:
    """Interactive command groups should share the support console instance."""
    for module in (analytics, monitor, nlp, recommend, search, visualize):
        assert module.console is cli_support.console


@pytest.mark.unit
@pytest.mark.parametrize(
    ("argv", "expected_option"),
    [
        (["fetch", "url", "--help"], "--timeout"),
        (["fetch", "url", "--help"], "--format"),
        (["load", "from-yaml", "--help"], "--input"),
        (["load", "from-yaml", "--help"], "--verbose"),
        (["validate", "feeds", "--help"], "--schema"),
        (["validate", "url", "--help"], "--timeout"),
        (["export", "all", "--help"], "--prefix"),
        (["stats", "show", "--help"], "--format"),
        (["test", "all", "--help"], "--coverage"),
        (["analytics", "summary", "--help"], "--database"),
        (["search", "query", "--help"], "--database"),
        (["recommend", "get", "--help"], "--database"),
        (["nlp", "stats", "--help"], "--database"),
        (["visualize", "stats", "--help"], "--input"),
        (["monitor", "status", "--help"], "--database"),
    ],
)
def test_foundation_help_uses_normalized_option_names(
    argv: list[str], expected_option: str
) -> None:
    """Foundation commands should advertise the canonical option names."""
    result = runner.invoke(cli, argv)

    assert result.exit_code == 0
    assert expected_option in result.output


@pytest.mark.unit
def test_stats_default_alias_supports_json_output() -> None:
    """``ai-web-feeds stats`` should alias ``stats show`` and emit JSON when asked."""
    fake_feed = Mock(verified=True, source_type=SourceType.BLOG)
    fake_db = Mock()
    fake_db.get_all_feed_sources.return_value = [fake_feed, fake_feed]

    with patch("ai_web_feeds.cli.commands.stats.DatabaseManager", return_value=fake_db):
        result = runner.invoke(cli, ["stats", "--format", "json"])

    assert result.exit_code == 0
    payload = json.loads(result.output)
    assert payload["status"] == "success"
    assert payload["details"]["total_feeds"] == 2
    assert payload["details"]["verified_feeds"] == 2
    assert payload["details"]["by_source_type"] == {"blog": 2}


@pytest.mark.unit
def test_analytics_trending_without_rows_exits_cleanly() -> None:
    """``analytics trending`` should warn without failing when no rows are available."""
    fake_db = MagicMock()
    fake_db.get_session.return_value.__enter__.return_value = Mock()

    with (
        patch("ai_web_feeds.cli.commands.analytics.DatabaseManager", return_value=fake_db),
        patch("ai_web_feeds.cli.commands.analytics.get_trending_topics", return_value=[]),
    ):
        result = runner.invoke(cli, ["analytics", "trending"])

    assert result.exit_code == 0
    assert "No topic stats found" in result.output


@pytest.mark.unit
def test_search_list_saved_handles_never_used_queries() -> None:
    """``search list-saved`` should render searches that have never been replayed."""
    saved_search = SimpleNamespace(
        search_name="Unread",
        query_text="agents",
        filters={},
        last_used_at=None,
    )
    fake_db = Mock()
    fake_db.get_user_saved_searches.return_value = [saved_search]

    with patch("ai_web_feeds.cli.commands.search.DatabaseManager", return_value=fake_db):
        result = runner.invoke(cli, ["search", "list-saved", "--user-id", "user-1"])

    assert result.exit_code == 0
    assert "Never" in result.output


@pytest.mark.unit
def test_validate_feeds_command_accepts_input_and_schema_options(tmp_path: Path) -> None:
    """``validate feeds`` should accept normalized input and schema options."""
    feed_file = tmp_path / "feeds.yaml"
    schema_file = tmp_path / "feeds.schema.json"
    feed_file.write_text(
        "sources:\n"
        "  - id: test-feed\n"
        "    title: Test Feed\n"
        "    feed: https://example.com/feed.xml\n"
        "    site: https://example.com\n"
        "    topics: [testing]\n",
        encoding="utf-8",
    )
    schema_file.write_text(
        json.dumps(
            {
                "type": "object",
                "properties": {
                    "sources": {
                        "type": "array",
                        "items": {"type": "object"},
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    result = runner.invoke(
        cli,
        ["validate", "feeds", "--input", str(feed_file), "--schema", str(schema_file)],
    )

    assert result.exit_code == 0
    assert "Feed document validation passed" in result.output


@pytest.mark.unit
def test_export_all_writes_all_supported_formats(tmp_path: Path) -> None:
    """``export all`` should write JSON and both OPML variants."""
    feed_file = tmp_path / "feeds.yaml"
    output_dir = tmp_path / "exports"
    feed_file.write_text(
        "sources:\n"
        "  - id: test-feed\n"
        "    title: Test Feed\n"
        "    feed: https://example.com/feed.xml\n"
        "    site: https://example.com\n"
        "    topics: [testing]\n",
        encoding="utf-8",
    )

    result = runner.invoke(
        cli,
        [
            "export",
            "all",
            "--input",
            str(feed_file),
            "--output-dir",
            str(output_dir),
            "--prefix",
            "sample",
        ],
    )

    assert result.exit_code == 0
    assert (output_dir / "sample.json").exists()
    assert (output_dir / "sample.opml").exists()
    assert (output_dir / "sample.categorized.opml").exists()


@pytest.mark.unit
def test_search_embeddings_provider_override_passes_through() -> None:
    """``search embeddings --provider`` should forward the normalized provider override."""
    session = MagicMock()
    db = MagicMock()
    db.get_session.return_value.__enter__.return_value = session

    with (
        patch("ai_web_feeds.cli.commands.search.DatabaseManager", return_value=db),
        patch("ai_web_feeds.embeddings.refresh_all_embeddings") as mock_refresh,
    ):
        result = runner.invoke(cli, ["search", "embeddings", "--provider", "huggingface"])

    assert result.exit_code == 0
    mock_refresh.assert_called_once_with(
        session,
        show_progress=True,
        provider="huggingface",
    )
