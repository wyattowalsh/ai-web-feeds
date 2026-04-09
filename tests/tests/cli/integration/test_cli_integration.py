"""Integration tests for core CLI workflows."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from ai_web_feeds.cli import cli
from typer.testing import CliRunner

runner = CliRunner()


@pytest.mark.integration
def test_validate_then_export_workflow(tmp_path: Path) -> None:
    """A validated feed document should export into all supported artifact formats."""
    feed_file = tmp_path / "feeds.yaml"
    schema_file = tmp_path / "feeds.schema.json"
    export_dir = tmp_path / "exports"

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
                    "sources": {"type": "array", "items": {"type": "object"}},
                },
            }
        ),
        encoding="utf-8",
    )

    validate_result = runner.invoke(
        cli,
        ["validate", "feeds", "--input", str(feed_file), "--schema", str(schema_file)],
    )
    assert validate_result.exit_code == 0

    export_result = runner.invoke(
        cli,
        [
            "export",
            "all",
            "--input",
            str(feed_file),
            "--output-dir",
            str(export_dir),
            "--prefix",
            "bundle",
        ],
    )
    assert export_result.exit_code == 0
    assert (export_dir / "bundle.json").exists()
    assert (export_dir / "bundle.opml").exists()
    assert (export_dir / "bundle.categorized.opml").exists()


@pytest.mark.integration
def test_load_then_stats_workflow(tmp_path: Path, temp_db_path: Path) -> None:
    """Loading a feed document should feed the stats command."""
    feed_file = tmp_path / "feeds.yaml"
    database_url = f"sqlite:///{temp_db_path}"

    feed_file.write_text(
        "sources:\n"
        "  - id: test-feed\n"
        "    title: Test Feed\n"
        "    feed: https://example.com/feed.xml\n"
        "    site: https://example.com\n"
        "    source_type: blog\n",
        encoding="utf-8",
    )

    load_result = runner.invoke(
        cli,
        ["load", "from-yaml", "--input", str(feed_file), "--database", database_url],
    )
    assert load_result.exit_code == 0

    stats_result = runner.invoke(
        cli,
        ["stats", "show", "--database", database_url, "--format", "json"],
    )
    assert stats_result.exit_code == 0
    payload = json.loads(stats_result.output)
    assert payload["details"]["total_feeds"] == 1
    assert payload["details"]["by_source_type"] == {"blog": 1}
