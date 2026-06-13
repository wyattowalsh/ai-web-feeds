"""Integration tests for CLI commands."""

import json
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


@pytest.mark.integration
class TestCLIWorkflows:
    """Test complete CLI workflows."""

    def test_validate_export_workflow(self):
        """Test validate then export workflow."""
        from ai_web_feeds.cli.commands.export import app as export_app
        from ai_web_feeds.cli.commands.validate import app as validate_app

        runner = CliRunner()
        with runner.isolated_filesystem():
            catalog = Path("feeds.yaml")
            schema = Path("feeds.schema.json")
            json_output = Path("feeds.json")
            opml_output = Path("feeds.opml")
            _write_catalog(catalog)
            schema.write_text(
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

            validate_result = runner.invoke(
                validate_app,
                ["feeds", "--file", str(catalog), "--schema", str(schema)],
            )
            assert validate_result.exit_code == 0, validate_result.output

            json_result = runner.invoke(
                export_app,
                ["json", "--input", str(catalog), "--output", str(json_output)],
            )
            assert json_result.exit_code == 0, json_result.output
            assert (
                json.loads(json_output.read_text(encoding="utf-8"))["sources"][0]["id"]
                == "test-feed"
            )

            opml_result = runner.invoke(
                export_app,
                ["opml", "--input", str(catalog), "--output", str(opml_output)],
            )
            assert opml_result.exit_code == 0, opml_result.output
            assert "<opml" in opml_output.read_text(encoding="utf-8")

    def test_fetch_enrich_command_surfaces(self):
        """Test fetch and enrich command help without network access."""
        from ai_web_feeds.cli.commands.enrich import app as enrich_app
        from ai_web_feeds.cli.commands.fetch import app as fetch_app

        runner = CliRunner()
        fetch_result = runner.invoke(fetch_app, ["--help"])
        enrich_result = runner.invoke(enrich_app, ["--help"])

        assert fetch_result.exit_code == 0
        assert "one" in fetch_result.output
        assert "all" in fetch_result.output
        assert enrich_result.exit_code == 0


@pytest.mark.integration
class TestCLIWithDatabase:
    """Test CLI commands with database integration."""

    def test_cli_database_workflow(self, temp_db_path):
        """Test top-level process command against a temporary SQLite database."""
        from ai_web_feeds.cli import app

        runner = CliRunner()
        with runner.isolated_filesystem():
            catalog = Path("feeds.yaml")
            output = Path("feeds.enriched.yaml")
            _write_catalog(catalog)

            result = runner.invoke(
                app,
                [
                    "process",
                    "--input",
                    str(catalog),
                    "--output",
                    str(output),
                    "--database",
                    f"sqlite:///{temp_db_path}",
                    "--skip-validation",
                    "--skip-enrichment",
                    "--no-export",
                ],
            )

            assert result.exit_code == 0, result.output
            assert output.exists()
