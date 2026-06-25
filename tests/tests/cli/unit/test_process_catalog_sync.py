"""Unit tests for process CLI catalog sync (step 6)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
import yaml
from ai_web_feeds.catalog_sync import CatalogSyncResult
from ai_web_feeds.config import DEFAULT_DATABASE_URL, resolve_database_url
from ai_web_feeds.validate import ValidationResult
from typer.testing import CliRunner


def _write_feeds(path: Path) -> None:
    path.write_text(
        yaml.safe_dump(
            {
                "schema_version": "feeds-3.0.0",
                "sources": [
                    {
                        "id": "feed-1",
                        "url": "https://example.com/feed.xml",
                        "title": "Example Feed",
                        "topics": ["ai"],
                    }
                ],
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )


@pytest.mark.unit
class TestProcessCatalogSync:
    def test_process_step6_calls_sync_catalog_to_db(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli import app

        runner = CliRunner()
        with runner.isolated_filesystem(temp_dir=tmp_path):
            input_file = Path("feeds.yaml")
            output_file = Path("feeds.enriched.yaml")
            _write_feeds(input_file)

            mock_result = CatalogSyncResult(
                topics_count=12,
                sources_count=1,
                junction_count=3,
                pipeline_run_id="run-abc-123",
            )
            ok = ValidationResult(valid=True, errors=[])

            with (
                patch("ai_web_feeds.cli.validate_feeds", return_value=ok),
                patch(
                    "ai_web_feeds.cli.enrich_all_feeds",
                    return_value=yaml.safe_load(input_file.read_text()),
                ),
                patch("ai_web_feeds.cli.upgrade_database_to_head"),
                patch("ai_web_feeds.cli.DatabaseManager"),
                patch("ai_web_feeds.cli.sync_catalog_to_db", return_value=mock_result) as mock_sync,
            ):
                result = runner.invoke(
                    app,
                    [
                        "process",
                        "--input",
                        str(input_file),
                        "--output",
                        str(output_file),
                        "--database",
                        "sqlite:///catalog.db",
                        "--no-export",
                    ],
                )

            assert result.exit_code == 0, result.output
            mock_sync.assert_called_once_with(
                feeds_path=input_file,
                enriched_path=output_file,
                database_url="sqlite:///catalog.db",
            )

    def test_process_prints_catalog_sync_summary(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli import app

        runner = CliRunner()
        with runner.isolated_filesystem(temp_dir=tmp_path):
            input_file = Path("feeds.yaml")
            output_file = Path("feeds.enriched.yaml")
            _write_feeds(input_file)

            mock_result = CatalogSyncResult(
                topics_count=92,
                sources_count=496,
                junction_count=1514,
                pipeline_run_id="pipeline-run-42",
            )
            ok = ValidationResult(valid=True, errors=[])

            with (
                patch("ai_web_feeds.cli.validate_feeds", return_value=ok),
                patch(
                    "ai_web_feeds.cli.enrich_all_feeds",
                    return_value=yaml.safe_load(input_file.read_text()),
                ),
                patch("ai_web_feeds.cli.upgrade_database_to_head"),
                patch("ai_web_feeds.cli.DatabaseManager"),
                patch("ai_web_feeds.cli.sync_catalog_to_db", return_value=mock_result),
            ):
                result = runner.invoke(
                    app,
                    [
                        "process",
                        "--input",
                        str(input_file),
                        "--output",
                        str(output_file),
                        "--database",
                        "sqlite:///catalog.db",
                        "--skip-validation",
                        "--no-export",
                    ],
                )

            assert result.exit_code == 0, result.output
            assert "Topics: 92" in result.output
            assert "Sources: 496" in result.output
            assert "Junctions: 1514" in result.output
            assert "pipeline-run-42" in result.output

    def test_process_resolves_database_url_when_option_omitted(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from ai_web_feeds.cli import app

        monkeypatch.delenv("DATABASE_URL", raising=False)
        monkeypatch.delenv("AIWF_DATABASE_URL", raising=False)

        runner = CliRunner()
        with runner.isolated_filesystem(temp_dir=tmp_path):
            input_file = Path("feeds.yaml")
            output_file = Path("feeds.enriched.yaml")
            _write_feeds(input_file)

            mock_result = CatalogSyncResult(
                topics_count=1,
                sources_count=1,
                junction_count=1,
                pipeline_run_id="run-default",
            )

            with (
                patch(
                    "ai_web_feeds.cli.enrich_all_feeds",
                    return_value=yaml.safe_load(input_file.read_text()),
                ),
                patch("ai_web_feeds.cli.upgrade_database_to_head"),
                patch("ai_web_feeds.cli.DatabaseManager"),
                patch("ai_web_feeds.cli.sync_catalog_to_db", return_value=mock_result) as mock_sync,
            ):
                result = runner.invoke(
                    app,
                    [
                        "process",
                        "--input",
                        str(input_file),
                        "--output",
                        str(output_file),
                        "--skip-validation",
                        "--skip-enrichment",
                        "--no-export",
                    ],
                )

            assert result.exit_code == 0, result.output
            expected_url = resolve_database_url()
            assert expected_url == DEFAULT_DATABASE_URL
            mock_sync.assert_called_once_with(
                feeds_path=input_file,
                enriched_path=output_file,
                database_url=expected_url,
            )
            assert expected_url in result.output

    def test_process_catalog_sync_failure_exits_nonzero(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli import app

        runner = CliRunner()
        with runner.isolated_filesystem(temp_dir=tmp_path):
            input_file = Path("feeds.yaml")
            _write_feeds(input_file)

            with (
                patch(
                    "ai_web_feeds.cli.enrich_all_feeds",
                    return_value=yaml.safe_load(input_file.read_text()),
                ),
                patch("ai_web_feeds.cli.upgrade_database_to_head"),
                patch("ai_web_feeds.cli.DatabaseManager"),
                patch(
                    "ai_web_feeds.cli.sync_catalog_to_db",
                    side_effect=RuntimeError("sync failed"),
                ),
            ):
                result = runner.invoke(
                    app,
                    [
                        "process",
                        "--input",
                        str(input_file),
                        "--output",
                        "out.yaml",
                        "--database",
                        "sqlite:///bad.db",
                        "--skip-validation",
                        "--no-export",
                    ],
                )

            assert result.exit_code == 1
            assert "Catalog sync failed" in result.output
