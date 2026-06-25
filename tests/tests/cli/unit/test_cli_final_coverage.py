"""Final CLI coverage for validate, export, test, enrich, and process pipeline."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
import yaml
from typer.testing import CliRunner


def _minimal_feeds_yaml(path: Path) -> None:
    path.write_text(
        yaml.safe_dump(
            {
                "schema_version": "feeds-3.0.0",
                "sources": [
                    {
                        "id": "feed-a",
                        "url": "https://example.com/feed.xml",
                        "title": "Feed A",
                        "topics": ["ai"],
                    }
                ],
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )


@pytest.mark.unit
class TestCLIValidateFinalCoverage:
    """Deep validate CLI coverage."""

    def test_validate_feeds_jsonschema_import_error(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.validate import app as val_app

        runner = CliRunner()
        real_modules = sys.modules.copy()
        with patch.dict(sys.modules, {"jsonschema": None}):
            result = runner.invoke(val_app, ["feeds"])
            assert result.exit_code != 0

        sys.modules.update(real_modules)

    def test_validate_feeds_duplicate_lenient_and_missing_schema(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.validate import app as val_app

        runner = CliRunner()
        with (
            patch("ai_web_feeds.cli.commands.validate.get_data_dir", return_value=tmp_path),
            patch("ai_web_feeds.cli.commands.validate.jsonschema", create=True) as mjs,
        ):
            mjs.validate.return_value = None
            (tmp_path / "feeds.yaml").write_text(
                yaml.safe_dump(
                    {
                        "schema_version": "feeds-3.0.0",
                        "sources": [
                            {"id": "dup", "title": "A"},
                            {"id": "dup", "title": "B"},
                        ],
                    }
                ),
                encoding="utf-8",
            )
            (tmp_path / "feeds.schema.json").write_text("{}", encoding="utf-8")
            result = runner.invoke(val_app, ["feeds", "--lenient"])
            assert result.exit_code == 0

        with patch("ai_web_feeds.cli.commands.validate.get_data_dir", return_value=tmp_path):
            (tmp_path / "feeds.schema.json").unlink(missing_ok=True)
            result = runner.invoke(val_app, ["feeds"])
            assert result.exit_code != 0

        with patch("ai_web_feeds.cli.commands.validate.get_data_dir", return_value=tmp_path):
            (tmp_path / "feeds.yaml").write_text("{}", encoding="utf-8")
            (tmp_path / "feeds.schema.json").unlink(missing_ok=True)
            result = runner.invoke(val_app, ["feeds"])
            assert result.exit_code != 0

    def test_validate_topics_and_references_errors(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.validate import app as val_app

        runner = CliRunner()
        with patch("ai_web_feeds.cli.commands.validate.get_data_dir", return_value=tmp_path):
            result = runner.invoke(val_app, ["topics"])
            assert result.exit_code != 0

        with (
            patch("ai_web_feeds.cli.commands.validate.get_data_dir", return_value=tmp_path),
            patch("ai_web_feeds.cli.commands.validate.jsonschema", create=True) as mjs,
        ):
            mjs.validate.return_value = None
            (tmp_path / "topics.yaml").write_text("topics: []\n", encoding="utf-8")
            (tmp_path / "topics.schema.json").write_text("{}", encoding="utf-8")
            result = runner.invoke(val_app, ["topics"])
            assert result.exit_code == 0

        with patch("ai_web_feeds.cli.commands.validate.get_data_dir", return_value=tmp_path):
            (tmp_path / "feeds.yaml").write_text(
                yaml.safe_dump({"sources": [{"id": "f1", "topics": ["missing"]}]}),
                encoding="utf-8",
            )
            (tmp_path / "topics.yaml").write_text(
                yaml.safe_dump({"topics": [{"id": "ai"}]}),
                encoding="utf-8",
            )
            result = runner.invoke(val_app, ["references"])
            assert result.exit_code != 0

    def test_validate_all_partial_failure(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.validate import app as val_app

        runner = CliRunner()
        with (
            patch("ai_web_feeds.cli.commands.validate.validate_feeds", side_effect=SystemExit(1)),
            patch("ai_web_feeds.cli.commands.validate.validate_topics"),
            patch("ai_web_feeds.cli.commands.validate.validate_topic_references"),
        ):
            result = runner.invoke(val_app, ["all"])
            assert result.exit_code == 1


@pytest.mark.unit
class TestCLIValidateHttpAndReportDeep:
    """HTTP validation and report edge cases."""

    def test_validate_http_failure_summary(self) -> None:
        from ai_web_feeds.cli.commands.validate import app as val_app

        runner = CliRunner()
        bad = MagicMock(is_valid=False, response_time_ms=10, warnings=["timeout: slow"])
        with (
            patch("ai_web_feeds.cli.commands.validate.DatabaseManager") as mdb,
            patch("ai_web_feeds.cli.commands.validate.asyncio.run", return_value=[bad, bad]),
        ):
            inst = MagicMock()
            inst.get_all_feed_sources.return_value = [
                MagicMock(id="f1", title="T"),
                MagicMock(id="f2", title="T2"),
            ]
            mdb.return_value = inst
            result = runner.invoke(val_app, ["http"])
            assert result.exit_code == 1

    def test_validation_report_with_history(self) -> None:
        from ai_web_feeds.cli.commands.validate import app as val_app

        runner = CliRunner()
        with (
            patch("ai_web_feeds.cli.commands.validate.DatabaseManager") as mdb,
            patch(
                "ai_web_feeds.cli.commands.validate.calculate_health_score",
                return_value=0.55,
            ),
        ):
            inst = MagicMock()
            feed = MagicMock(id="mid", title="Mid Health", verified=False)
            inst.get_all_feed_sources.return_value = [feed]
            inst.get_validation_history.return_value = [MagicMock(is_valid=False)]
            mdb.return_value = inst
            result = runner.invoke(val_app, ["report"])
            assert result.exit_code == 0


@pytest.mark.unit
class TestCLIExportFinalCoverage:
    """Export CLI json/opml/csv/all error and success paths."""

    def test_export_commands_success_and_errors(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.export import app as export_app

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        _minimal_feeds_yaml(feeds)
        out_json = tmp_path / "out.json"
        out_opml = tmp_path / "out.opml"
        out_csv = tmp_path / "out.csv"
        out_dir = tmp_path / "exports"
        out_dir.mkdir()

        result = runner.invoke(
            export_app,
            ["json", "--input", str(feeds), "--output", str(out_json), "--compact"],
        )
        assert result.exit_code == 0

        result = runner.invoke(
            export_app,
            ["opml", "--input", str(feeds), "--output", str(out_opml), "--categorized"],
        )
        assert result.exit_code == 0

        result = runner.invoke(
            export_app,
            ["csv", "--input", str(feeds), "--output", str(out_csv)],
        )
        assert result.exit_code == 0

        result = runner.invoke(
            export_app,
            ["all", "--input", str(feeds), "--output-dir", str(out_dir)],
        )
        assert result.exit_code == 0

        with patch(
            "ai_web_feeds.cli.commands.export.load_feeds", side_effect=FileNotFoundError("x")
        ):
            result = runner.invoke(export_app, ["json", "--input", str(tmp_path / "nope.yaml")])
            assert result.exit_code == 1

        with patch("ai_web_feeds.cli.commands.export.load_feeds", side_effect=RuntimeError("boom")):
            result = runner.invoke(export_app, ["opml", "--input", str(feeds)])
            assert result.exit_code == 1

        from ai_web_feeds.cli.commands.export import _csv_value, _export_to_csv

        _export_to_csv(
            {
                "sources": [
                    {"id": "a", "title": "A", "topics": ["ai"], "tags": {"k": "v"}},
                    "skip-me",
                ]
            },
            tmp_path / "manual.csv",
        )
        assert _csv_value(None) == ""
        assert _csv_value(["a", "b"]) == "a,b"
        assert _csv_value({"x": 1}).startswith("{")


@pytest.mark.unit
class TestCLIMainLoadAndProcessSuccess:
    """Main CLI load and process happy paths."""

    def test_load_command_success(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli import app as main_app

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        _minimal_feeds_yaml(feeds)
        result = runner.invoke(main_app, ["load", str(feeds)])
        assert result.exit_code == 0

    def test_process_full_success_with_mocks(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli import app as main_app
        from ai_web_feeds.validate import ValidationResult

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        out = tmp_path / "feeds.enriched.yaml"
        _minimal_feeds_yaml(feeds)

        catalog = {
            "schema_version": "feeds-3.0.0",
            "sources": [{"id": "feed-a", "url": "https://example.com/feed.xml", "title": "Feed A"}],
        }
        sync_result = MagicMock(
            succeeded=True,
            topics_count=1,
            sources_count=1,
            junction_count=1,
            pipeline_run_id="run-1",
        )

        with (
            patch("ai_web_feeds.cli.load_feeds", return_value=catalog),
            patch("ai_web_feeds.cli.validate_feeds", return_value=ValidationResult(valid=True)),
            patch("ai_web_feeds.cli.enrich_all_feeds", return_value=catalog),
            patch("ai_web_feeds.cli.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.DatabaseManager"),
            patch("ai_web_feeds.cli.save_feeds"),
            patch("ai_web_feeds.cli.export_all_formats"),
            patch("ai_web_feeds.cli.sync_catalog_to_db", return_value=sync_result),
            patch("ai_web_feeds.cli.resolve_database_url", return_value="sqlite:///:memory:"),
        ):
            result = runner.invoke(
                main_app,
                ["process", "--input", str(feeds), "--output", str(out)],
            )
            assert result.exit_code == 0


@pytest.mark.unit
class TestCLIProcessFullPipeline:
    """Process pipeline warning and failure branches."""

    def test_process_enrichment_failure(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli import app as main_app
        from ai_web_feeds.validate import ValidationResult

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        _minimal_feeds_yaml(feeds)
        catalog = {"sources": [{"id": "a", "url": "https://example.com", "title": "A"}]}

        with (
            patch("ai_web_feeds.cli.load_feeds", return_value=catalog),
            patch("ai_web_feeds.cli.validate_feeds", return_value=ValidationResult(valid=True)),
            patch("ai_web_feeds.cli.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.enrich_all_feeds", side_effect=RuntimeError("enrich failed")),
        ):
            result = runner.invoke(main_app, ["process", "--input", str(feeds), "--no-export"])
            assert result.exit_code == 1

    def test_process_with_enrichment_and_storage_warnings(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli import app as main_app
        from ai_web_feeds.validate import ValidationResult

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        out = tmp_path / "out.yaml"
        _minimal_feeds_yaml(feeds)
        catalog = {"sources": [{"id": "a", "url": "https://example.com/feed.xml", "title": "A"}]}

        with (
            patch("ai_web_feeds.cli.load_feeds", return_value=catalog),
            patch(
                "ai_web_feeds.cli.validate_feeds",
                side_effect=[
                    ValidationResult(valid=True),
                    ValidationResult(valid=False, errors=["warn"]),
                ],
            ),
            patch("ai_web_feeds.cli.enrich_all_feeds", return_value=catalog),
            patch("ai_web_feeds.cli.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.DatabaseManager"),
            patch("ai_web_feeds.cli.save_feeds"),
            patch(
                "ai_web_feeds.cli.sync_catalog_to_db",
                return_value=MagicMock(
                    succeeded=True,
                    topics_count=0,
                    sources_count=1,
                    junction_count=0,
                    pipeline_run_id=None,
                ),
            ),
            patch("ai_web_feeds.cli.resolve_database_url", return_value="sqlite:///:memory:"),
        ):
            result = runner.invoke(
                main_app,
                ["process", "--input", str(feeds), "--output", str(out), "--no-export"],
            )
            assert result.exit_code == 0

    def test_process_post_validation_warnings_and_db_failure(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli import app as main_app
        from ai_web_feeds.validate import ValidationResult

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        _minimal_feeds_yaml(feeds)
        catalog = {"sources": [{"id": "a", "url": "https://example.com/feed.xml", "title": "A"}]}

        with (
            patch("ai_web_feeds.cli.load_feeds", return_value=catalog),
            patch("ai_web_feeds.cli.validate_feeds", return_value=ValidationResult(valid=True)),
            patch("ai_web_feeds.cli.enrich_all_feeds", return_value=catalog),
            patch("ai_web_feeds.cli.upgrade_database_to_head"),
            patch("ai_web_feeds.cli.DatabaseManager"),
            patch("ai_web_feeds.cli.save_feeds"),
            patch("ai_web_feeds.cli.sync_catalog_to_db", side_effect=RuntimeError("sync fail")),
            patch("ai_web_feeds.cli.resolve_database_url", return_value="sqlite:///:memory:"),
        ):
            result = runner.invoke(
                main_app,
                ["process", "--input", str(feeds), "--no-export", "--skip-enrichment"],
            )
            assert result.exit_code == 1


@pytest.mark.unit
class TestCLITopicsAndAddDeep:
    """Topics list/show and add command coverage."""

    def test_topics_list_filters_and_missing_file(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.topics import app as topics_app

        runner = CliRunner()
        result = runner.invoke(topics_app, ["list", "--file", str(tmp_path / "missing.yaml")])
        assert result.exit_code != 0

        topics_file = tmp_path / "topics.yaml"
        topics_file.write_text(
            yaml.safe_dump(
                {
                    "topics": [
                        {"id": "ai", "label": "AI", "facet": "domain"},
                        {"id": "ml", "label": "ML", "facet": "domain"},
                    ]
                }
            ),
            encoding="utf-8",
        )
        result = runner.invoke(
            topics_app, ["list", "--file", str(topics_file), "--facet", "domain"]
        )
        assert result.exit_code == 0

    def test_add_feed_source(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.add import app as add_app

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        _minimal_feeds_yaml(feeds)

        with (
            patch("ai_web_feeds.cli.commands.add.load_feeds", return_value={"sources": []}),
            patch("ai_web_feeds.cli.commands.add.save_feeds") as mock_save,
        ):
            result = runner.invoke(
                add_app,
                [
                    "https://new.example/feed.xml",
                    "--title",
                    "New Feed",
                    "--topics",
                    "ai",
                    "--input",
                    str(feeds),
                ],
            )
            assert result.exit_code == 0
            mock_save.assert_called()


@pytest.mark.unit
class TestCLIFinalNinetyPush:
    """Extra CLI tests to cross the 90% coverage threshold."""

    def test_corpus_export_and_refresh_branches(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.corpus import app as corpus_app

        runner = CliRunner()
        out = tmp_path / "corpus.json"
        payload = {
            "metadata": {
                "article_count": 2,
                "feed_count": 1,
                "latest_published_at": "2024-01-01T00:00:00Z",
            }
        }
        with patch("ai_web_feeds.cli.commands.corpus.DatabaseManager") as mdb:
            inst = MagicMock()
            inst.export_articles_corpus.return_value = payload
            mdb.return_value = inst
            result = runner.invoke(corpus_app, ["export", "--output", str(out)])
            assert result.exit_code == 0

        summary = {
            "successful_feeds": 1,
            "attempted_feeds": 2,
            "failed_feeds": 1,
            "failed_feed_ids": ["f-bad"],
            "partial_coverage": {"feeds": []},
        }
        with (
            patch("ai_web_feeds.cli.commands.corpus.DatabaseManager") as mdb,
            patch("ai_web_feeds.cli.commands.corpus.FeedPoller") as mpoll,
            patch("ai_web_feeds.cli.commands.corpus.asyncio.run", return_value=summary),
        ):
            inst = MagicMock()
            inst.export_articles_corpus.return_value = payload
            mdb.return_value = inst
            result = runner.invoke(corpus_app, ["refresh", "--output", str(out)])
            assert result.exit_code == 1

        with patch(
            "ai_web_feeds.cli.commands.corpus.DatabaseManager", side_effect=FileNotFoundError("x")
        ):
            result = runner.invoke(corpus_app, ["export"])
            assert result.exit_code == 1

    def test_topics_list_show_and_filters(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.topics import app as topics_app

        runner = CliRunner()
        topics_file = tmp_path / "topics.yaml"
        topics_file.write_text(
            yaml.safe_dump(
                {
                    "version": "1",
                    "topics": [
                        {
                            "id": "ai",
                            "label": "AI",
                            "facet": "domain",
                            "facet_group": "conceptual",
                            "parents": [],
                            "description": "Artificial intelligence",
                            "aliases": ["artificial-intelligence"],
                            "relations": {"related_to": ["ml"]},
                            "tags": ["core"],
                        },
                        {
                            "id": "ml",
                            "label": "ML",
                            "facet": "domain",
                            "facet_group": "conceptual",
                            "parents": ["ai"],
                        },
                        {"id": "aiml", "label": "AI/ML", "facet": "domain"},
                    ],
                }
            ),
            encoding="utf-8",
        )
        result = runner.invoke(
            topics_app,
            ["list", "--file", str(topics_file), "--group", "conceptual", "--limit", "1"],
        )
        assert result.exit_code == 0

        empty = tmp_path / "empty.yaml"
        empty.write_text(yaml.safe_dump({"topics": []}), encoding="utf-8")
        result = runner.invoke(topics_app, ["list", "--file", str(empty)])
        assert result.exit_code == 0

        result = runner.invoke(topics_app, ["show", "ai", "--file", str(topics_file)])
        assert result.exit_code == 0

        result = runner.invoke(topics_app, ["show", "ai-x", "--file", str(topics_file)])
        assert result.exit_code == 1

    def test_add_cli_helper_and_validation_branches(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.add import (
            _generate_id_from_url,
            _get_data_dir,
            _looks_like_feed_url,
        )
        from ai_web_feeds.cli.commands.add import app as add_app

        assert _looks_like_feed_url("https://example.com/feed.xml")
        assert not _looks_like_feed_url("not-a-url")
        assert _generate_id_from_url("https://example.com/feed.xml")

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        _minimal_feeds_yaml(feeds)

        result = runner.invoke(add_app, ["ftp://bad.example/feed.xml", "--input", str(feeds)])
        assert result.exit_code == 1

        result = runner.invoke(add_app, ["https://example.com/page", "--input", str(feeds)])
        assert result.exit_code == 1

        assert _get_data_dir().name == "data"

    def test_export_cli_remaining_error_paths(self, tmp_path: Path) -> None:
        from ai_web_feeds.cli.commands.export import app as export_app

        runner = CliRunner()
        feeds = tmp_path / "feeds.yaml"
        _minimal_feeds_yaml(feeds)
        with patch(
            "ai_web_feeds.cli.commands.export.load_feeds", side_effect=FileNotFoundError("missing")
        ):
            result = runner.invoke(export_app, ["all", "--input", str(feeds)])
            assert result.exit_code == 1
        with patch(
            "ai_web_feeds.cli.commands.export.canonicalize_catalog",
            side_effect=RuntimeError("csv fail"),
        ):
            result = runner.invoke(
                export_app,
                ["csv", "--input", str(feeds), "--output", str(tmp_path / "out.csv")],
            )
            assert result.exit_code == 1
