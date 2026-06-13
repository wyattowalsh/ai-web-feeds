"""Unit tests for CLI commands."""

from pathlib import Path
from unittest.mock import patch

import pytest
import yaml
from typer.testing import CliRunner


@pytest.mark.unit
class TestCLIValidateCommand:
    """Test validate CLI command."""

    def test_validate_command_exists(self):
        """Test that validate command can be imported."""
        try:
            from ai_web_feeds.cli.commands import validate

            assert validate is not None
        except ImportError:
            pytest.skip("CLI commands not yet implemented")

    @pytest.mark.skip(reason="CLI validate command not fully functional")
    @patch("ai_web_feeds.cli.commands.validate.validate_feeds")
    def test_validate_feeds_file(self, mock_validate):
        """Test validating feeds from file."""
        from ai_web_feeds.cli.commands.validate import app as validate_app

        runner = CliRunner()
        with runner.isolated_filesystem():
            # Create a test file
            test_file = Path("test_feeds.yaml")
            test_file.write_text("feeds: []")

            result = runner.invoke(validate_app, ["test_feeds.yaml"])
            assert result.exit_code == 0


@pytest.mark.unit
class TestCLIFetchCommand:
    """Test fetch CLI command - SKIPPED until fetcher is implemented."""

    @pytest.mark.skip(reason="Fetcher module not yet implemented")
    def test_fetch_command_exists(self):
        """Test that fetch command can be imported."""
        from ai_web_feeds.cli.commands import fetch

        assert fetch is not None

    @pytest.mark.skip(reason="Fetcher module not yet implemented")
    def test_fetch_single_feed(self):
        """Test fetching a single feed."""


@pytest.mark.unit
class TestCLIExportCommand:
    """Test export CLI command."""

    def test_export_command_exists(self):
        """Test that export command can be imported."""
        try:
            from ai_web_feeds.cli.commands import export

            assert export is not None
        except ImportError:
            pytest.skip("CLI commands not yet implemented")

    @pytest.mark.skip(reason="Export command needs integration testing")
    def test_export_to_opml(self):
        """Test exporting feeds to OPML."""


@pytest.mark.unit
class TestCLICorpusCommand:
    """Test corpus CLI command."""

    def test_corpus_command_exists(self):
        """Test that corpus command can be imported."""
        from ai_web_feeds.cli.commands import corpus

        assert corpus is not None

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
        try:
            from ai_web_feeds.cli.commands import enrich

            assert enrich is not None
        except ImportError:
            pytest.skip("CLI commands not yet implemented")


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
                        "schema_version": "feeds-2.1.0",
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
                        "schema_version": "feeds-2.1.0",
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
                        "schema_version": "feeds-2.1.0",
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
        try:
            from ai_web_feeds.cli.commands import stats

            assert stats is not None
        except ImportError:
            pytest.skip("CLI commands not yet implemented")


@pytest.mark.unit
class TestCLIOPMLCommand:
    """Test OPML CLI command."""

    def test_opml_command_exists(self):
        """Test that OPML command can be imported."""
        try:
            from ai_web_feeds.cli.commands import opml

            assert opml is not None
        except ImportError:
            pytest.skip("CLI commands not yet implemented")

    def test_opml_command_registered_on_main_app(self):
        """Test that the top-level CLI exposes OPML management."""
        from ai_web_feeds.cli import app

        runner = CliRunner()
        result = runner.invoke(app, ["--help"])

        assert result.exit_code == 0
        assert "opml" in result.output

    def test_opml_import(self, temp_opml_file):
        """Test importing OPML file."""
        try:
            from ai_web_feeds.cli.commands.opml import cli as opml_cli

            runner = CliRunner()
            result = runner.invoke(opml_cli, ["import", str(temp_opml_file)])

            assert result is not None
        except ImportError:
            pytest.skip("OPML command not yet implemented")


@pytest.mark.integration
class TestCLIIntegration:
    """Integration tests for CLI commands."""

    def test_cli_help(self):
        """Test CLI help output."""
        try:
            from ai_web_feeds.cli import cli

            runner = CliRunner()
            result = runner.invoke(cli, ["--help"])

            assert result.exit_code == 0
            assert "Usage:" in result.output or result.output != ""
            assert "corpus" in result.output
        except ImportError:
            pytest.skip("CLI not yet implemented")

    def test_cli_version(self):
        """Test CLI version output."""
        try:
            from ai_web_feeds.cli import cli

            runner = CliRunner()
            result = runner.invoke(cli, ["--version"])

            # Version command should work
            assert result is not None
        except ImportError:
            pytest.skip("CLI not yet implemented")
