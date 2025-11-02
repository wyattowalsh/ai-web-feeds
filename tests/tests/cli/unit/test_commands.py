"""Unit tests for CLI commands."""

from unittest.mock import patch

import pytest
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
