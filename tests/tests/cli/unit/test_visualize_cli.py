"""CLI integration tests for taxonomy visualize commands."""

from __future__ import annotations

from pathlib import Path

import pytest
from ai_web_feeds.cli.commands.visualize import app as visualize_app
from typer.testing import CliRunner


@pytest.mark.unit
def test_visualize_stats_exits_zero() -> None:
    runner = CliRunner()
    result = runner.invoke(visualize_app, ["stats"])
    assert result.exit_code == 0, result.stdout
    output = result.stdout.lower()
    assert "topic" in output or "taxonomy" in output


@pytest.mark.unit
def test_visualize_mermaid_writes_file(tmp_path: Path) -> None:
    runner = CliRunner()
    output_file = tmp_path / "taxonomy-test.mermaid"
    result = runner.invoke(
        visualize_app,
        ["mermaid", "--output", str(output_file), "--no-preview"],
    )
    assert result.exit_code == 0, result.stdout
    assert output_file.exists()
    content = output_file.read_text(encoding="utf-8")
    assert "graph" in content
