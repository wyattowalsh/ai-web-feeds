"""Unit tests for CLI commands."""

import builtins
import importlib
import json
import sys
from pathlib import Path

import pytest
import yaml
from typer.testing import CliRunner


def _write_catalog(path: Path) -> None:
    path.write_text(
        yaml.safe_dump(
            {
                "schema_version": "feeds-3.0.0",
                "sources": [
                    {
                        "id": "test-feed",
                        "url": "https://example.com/feed.xml",
                        "title": "Test Feed",
                        "topics": ["testing"],
                        "tags": ["cli"],
                    }
                ],
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )


@pytest.mark.unit
def test_cli_startup_does_not_import_optional_nlp_dependencies(monkeypatch):
    """The base CLI must start without optional NLP packages such as spaCy."""
    original_import = builtins.__import__

    def guarded_import(name, global_vars=None, local_vars=None, fromlist=(), level=0):
        if name == "spacy" or name.startswith("spacy."):
            raise AssertionError("spacy was imported during CLI startup")
        return original_import(name, global_vars, local_vars, fromlist, level)

    for module_name in list(sys.modules):
        if module_name == "ai_web_feeds.cli" or module_name.startswith("ai_web_feeds.cli."):
            monkeypatch.delitem(sys.modules, module_name, raising=False)

    monkeypatch.setattr(builtins, "__import__", guarded_import)

    cli_module = importlib.import_module("ai_web_feeds.cli")

    assert cli_module.app is not None


@pytest.mark.unit
class TestCLIValidateCommand:
    """Test validate CLI command."""

    def test_validate_command_exists(self):
        """Test that validate command can be imported."""
        from ai_web_feeds.cli.commands import validate

        assert validate.app is not None

    def test_validate_feeds_file(self):
        """Test validating feeds from file."""
        from ai_web_feeds.cli.commands.validate import app as validate_app

        runner = CliRunner()
        with runner.isolated_filesystem():
            test_file = Path("test_feeds.yaml")
            schema_file = Path("feeds.schema.json")
            _write_catalog(test_file)
            schema_file.write_text(
                json.dumps(
                    {
                        "type": "object",
                        "required": ["schema_version", "sources"],
                        "properties": {
                            "schema_version": {"const": "feeds-3.0.0"},
                            "sources": {"type": "array"},
                        },
                    }
                ),
                encoding="utf-8",
            )

            result = runner.invoke(
                validate_app,
                ["feeds", "--file", str(test_file), "--schema", str(schema_file)],
            )

            assert result.exit_code == 0, result.output

    def test_validate_all_uses_default_data_paths(self):
        """Test aggregate validation invokes subcommands with real defaults."""
        from ai_web_feeds.cli.commands.validate import app as validate_app

        runner = CliRunner()
        result = runner.invoke(validate_app, ["all", "--strict"])

        assert result.exit_code == 0, result.output
        assert "All validations passed" in result.output


@pytest.mark.unit
class TestCLIFetchCommand:
    """Test fetch CLI command."""

    def test_fetch_command_exists(self):
        """Test that fetch command can be imported."""
        from ai_web_feeds.cli.commands import fetch

        assert fetch.app is not None

    def test_fetch_help_lists_supported_commands(self):
        """Test fetch command help without network access."""
        from ai_web_feeds.cli.commands.fetch import app as fetch_app

        runner = CliRunner()
        result = runner.invoke(fetch_app, ["--help"])

        assert result.exit_code == 0
        assert "one" in result.output
        assert "all" in result.output


@pytest.mark.unit
class TestCLIExportCommand:
    """Test export CLI command."""

    def test_export_command_exists(self):
        """Test that export command can be imported."""
        from ai_web_feeds.cli.commands import export

        assert export.app is not None

    def test_export_to_opml(self):
        """Test exporting feeds to OPML."""
        from ai_web_feeds.cli.commands.export import app as export_app

        runner = CliRunner()
        with runner.isolated_filesystem():
            input_file = Path("feeds.yaml")
            output_file = Path("feeds.opml")
            _write_catalog(input_file)

            result = runner.invoke(
                export_app,
                ["opml", "--input", str(input_file), "--output", str(output_file)],
            )

            assert result.exit_code == 0, result.output
            assert output_file.exists()
            assert "<opml" in output_file.read_text(encoding="utf-8")

    def test_export_to_csv(self):
        """Test exporting feeds to CSV."""
        from ai_web_feeds.cli.commands.export import app as export_app

        runner = CliRunner()
        with runner.isolated_filesystem():
            input_file = Path("feeds.yaml")
            output_file = Path("feeds.csv")
            _write_catalog(input_file)

            result = runner.invoke(
                export_app,
                ["csv", "--input", str(input_file), "--output", str(output_file)],
            )

            assert result.exit_code == 0, result.output
            csv_text = output_file.read_text(encoding="utf-8")
            assert "id,title,url" in csv_text
            assert "test-feed" in csv_text


@pytest.mark.unit
class TestCLICorpusCommand:
    """Test corpus CLI command."""

    def test_corpus_command_exists(self):
        """Test that corpus command can be imported."""
        from ai_web_feeds.cli.commands import corpus

        assert corpus.app is not None

    def test_corpus_command_help(self):
        """Test corpus command help output."""
        from ai_web_feeds.cli.commands.corpus import app as corpus_app

        runner = CliRunner()
        result = runner.invoke(corpus_app, ["--help"])

        assert result.exit_code == 0
        assert "refresh" in result.output
        assert "export" in result.output


@pytest.mark.unit
class TestCLIEnrichCommand:
    """Test enrich CLI command."""

    def test_enrich_command_exists(self):
        """Test that enrich command can be imported."""
        from ai_web_feeds.cli.commands import enrich

        assert enrich.app is not None


@pytest.mark.unit
class TestCLIProcessCommand:
    """Test the top-level process command."""

    def test_process_skip_enrichment_writes_schema_valid_source_type(self):
        """Skipped enrichment still writes generated enriched catalog fields."""
        from ai_web_feeds.cli import app

        runner = CliRunner()

        with runner.isolated_filesystem():
            input_file = Path("feeds.yaml")
            output_file = Path("feeds.enriched.yaml")
            input_file.write_text(
                yaml.safe_dump(
                    {
                        "schema_version": "feeds-3.0.0",
                        "sources": [
                            {
                                "url": "https://www.youtube.com/feeds/videos.xml?channel_id=test",
                                "topics": ["video"],
                            }
                        ],
                    },
                    sort_keys=False,
                ),
                encoding="utf-8",
            )

            result = runner.invoke(
                app,
                [
                    "process",
                    "--input",
                    str(input_file),
                    "--output",
                    str(output_file),
                    "--database",
                    "sqlite:///feeds.db",
                    "--skip-enrichment",
                    "--no-export",
                ],
            )

            assert result.exit_code == 0, result.output
            output = yaml.safe_load(output_file.read_text(encoding="utf-8"))
            assert output["document_meta"]["total_sources"] == 1
            assert output["sources"][0]["source_type"] == "youtube"

    def test_process_skip_enrichment_preserves_existing_generated_metadata(self):
        """Skipped enrichment reuses existing output-only generated metadata."""
        from ai_web_feeds.cli import app

        runner = CliRunner()

        with runner.isolated_filesystem():
            input_file = Path("feeds.yaml")
            output_file = Path("feeds.enriched.yaml")
            feed_url = "https://example.com/feed.xml"
            input_file.write_text(
                yaml.safe_dump(
                    {
                        "schema_version": "feeds-3.0.0",
                        "sources": [
                            {
                                "url": feed_url,
                                "topics": ["research"],
                            }
                        ],
                    },
                    sort_keys=False,
                ),
                encoding="utf-8",
            )
            output_file.write_text(
                yaml.safe_dump(
                    {
                        "schema_version": "feeds-3.0.0",
                        "sources": [
                            {
                                "url": feed_url,
                                "topics": ["old-topic"],
                                "id": "src-stable",
                                "title": "Example Research Feed",
                                "feed": "https://feeds.example.com/rss.xml",
                                "source_type": "newsletter",
                                "tags": ["curated"],
                            }
                        ],
                    },
                    sort_keys=False,
                ),
                encoding="utf-8",
            )

            result = runner.invoke(
                app,
                [
                    "process",
                    "--input",
                    str(input_file),
                    "--output",
                    str(output_file),
                    "--database",
                    "sqlite:///feeds.db",
                    "--skip-enrichment",
                    "--no-export",
                ],
            )

            assert result.exit_code == 0, result.output
            output = yaml.safe_load(output_file.read_text(encoding="utf-8"))
            source = output["sources"][0]
            assert source["url"] == feed_url
            assert source["topics"] == ["research"]
            assert source["id"] == "src-stable"
            assert source["title"] == "Example Research Feed"
            assert source["feed"] == "https://feeds.example.com/rss.xml"
            assert source["source_type"] == "newsletter"
            assert source["tags"] == ["curated"]


@pytest.mark.unit
class TestCLIStatsCommand:
    """Test stats CLI command."""

    def test_stats_command_exists(self):
        """Test that stats command can be imported."""
        from ai_web_feeds.cli.commands import stats

        assert stats.app is not None


@pytest.mark.unit
class TestCLIOPMLCommand:
    """Test OPML CLI command."""

    def test_opml_command_exists(self):
        """Test that OPML command can be imported."""
        from ai_web_feeds.cli.commands import opml

        assert opml.app is not None

    def test_opml_command_registered_on_main_app(self):
        """Test that the top-level CLI exposes OPML management."""
        from ai_web_feeds.cli import app

        runner = CliRunner()
        result = runner.invoke(app, ["--help"])

        assert result.exit_code == 0
        assert "opml" in result.output

    def test_opml_command_help(self):
        """Test OPML command help output."""
        from ai_web_feeds.cli.commands.opml import app as opml_app

        runner = CliRunner()
        result = runner.invoke(opml_app, ["--help"])

        assert result.exit_code == 0
        assert "all" in result.output
        assert "categorized" in result.output
        assert "filtered" in result.output


@pytest.mark.integration
class TestCLIIntegration:
    """Integration tests for CLI commands."""

    def test_cli_help(self):
        """Test CLI help output."""
        from ai_web_feeds.cli import app

        runner = CliRunner()
        result = runner.invoke(app, ["--help"])

        assert result.exit_code == 0
        assert "Usage:" in result.output or result.output != ""
        assert "corpus" in result.output
        assert "export" in result.output

    def test_cli_export_group_help(self):
        """Test top-level export command group output."""
        from ai_web_feeds.cli import app

        runner = CliRunner()
        result = runner.invoke(app, ["export", "--help"])

        assert result.exit_code == 0
        assert "json" in result.output
        assert "opml" in result.output
        assert "csv" in result.output


@pytest.mark.unit
class TestCLITopicsCommand:
    """Test topics CLI command."""

    def test_topics_command_exists(self):
        """Test that topics command can be imported."""
        from ai_web_feeds.cli.commands import topics

        assert topics.app is not None

    def test_topics_list_with_file(self, tmp_path: Path):
        """Test topics list command against a temp topics file."""
        from ai_web_feeds.cli.commands.topics import app as topics_app

        topics_file = tmp_path / "topics.yaml"
        topics_file.write_text(
            yaml.safe_dump(
                {
                    "topics": [
                        {
                            "id": "ai",
                            "label": "Artificial Intelligence",
                            "facet": "domain",
                            "facet_group": "conceptual",
                            "parents": [],
                        },
                        {
                            "id": "ml",
                            "label": "Machine Learning",
                            "facet": "domain",
                            "facet_group": "conceptual",
                            "parents": ["ai"],
                        },
                    ]
                },
                sort_keys=False,
            ),
            encoding="utf-8",
        )

        runner = CliRunner()
        result = runner.invoke(topics_app, ["list", "--file", str(topics_file)])

        assert result.exit_code == 0, result.output
        assert "ai" in result.output
        assert "Machine Learning" in result.output

    def test_topics_list_registered_on_main_app(self):
        """Test that the top-level CLI exposes topics command."""
        from ai_web_feeds.cli import app

        runner = CliRunner()
        result = runner.invoke(app, ["--help"])

        assert result.exit_code == 0
        assert "topics" in result.output

    def test_topics_show(self, tmp_path: Path):
        """Test topics show subcommand."""
        from ai_web_feeds.cli.commands.topics import app as topics_app

        topics_file = tmp_path / "topics.yaml"
        topics_file.write_text(
            yaml.safe_dump(
                {
                    "topics": [
                        {
                            "id": "genai",
                            "label": "Generative AI",
                            "description": "Gen models",
                            "facet": "subfield",
                        }
                    ]
                },
                sort_keys=False,
            ),
            encoding="utf-8",
        )

        runner = CliRunner()
        result = runner.invoke(topics_app, ["show", "genai", "--file", str(topics_file)])

        assert result.exit_code == 0, result.output
        assert "Generative AI" in result.output


@pytest.mark.unit
class TestCLIAddCommand:
    """Test add CLI command."""

    def test_add_command_exists(self):
        """Test that add command can be imported."""
        from ai_web_feeds.cli.commands import add

        assert add.app is not None

    def test_add_command_registered_on_main_app(self):
        """Test that the top-level CLI exposes add command."""
        from ai_web_feeds.cli import app

        runner = CliRunner()
        result = runner.invoke(app, ["--help"])

        assert result.exit_code == 0
        assert "add" in result.output

    def test_add_feed_url_to_catalog(self, tmp_path: Path):
        """Test adding a feed URL creates an entry in feeds.yaml."""
        from ai_web_feeds.cli.commands.add import app as add_app

        runner = CliRunner()
        with runner.isolated_filesystem(temp_dir=tmp_path):
            feeds_file = Path("feeds.yaml")
            feeds_file.write_text(
                yaml.safe_dump(
                    {"schema_version": "feeds-3.0.0", "sources": []},
                    sort_keys=False,
                ),
                encoding="utf-8",
            )

            result = runner.invoke(
                add_app,
                [
                    "https://example.com/feed.xml",
                    "--title",
                    "Example Feed",
                    "--topics",
                    "ai,research",
                    "--input",
                    str(feeds_file),
                ],
            )

            assert result.exit_code == 0, result.output
            data = yaml.safe_load(feeds_file.read_text(encoding="utf-8"))
            assert len(data["sources"]) == 1
            src = data["sources"][0]
            assert src["url"] == "https://example.com/feed.xml"
            assert src["title"] == "Example Feed"
            assert "ai" in src.get("topics", [])

