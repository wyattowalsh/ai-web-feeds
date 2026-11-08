"""Characterization tests for the NLP CLI."""

from __future__ import annotations

import http.client
import importlib
import socket
import subprocess
import sys
import urllib.request
from unittest.mock import MagicMock, patch

import pytest
from typer.testing import CliRunner

nlp_app = importlib.import_module("ai_web_feeds.cli.commands.nlp").app

_WEIGHT_ROOTS: frozenset[str] = frozenset(
    {
        "bertopic",
        "en_core_web_sm",
        "gensim",
        "huggingface_hub",
        "sentence_transformers",
        "spacy",
        "torch",
        "transformers",
    }
)
_HEAVY_NLP_MODULES: tuple[str, ...] = (
    "ai_web_feeds.nlp.entity_extractor",
    "ai_web_feeds.nlp.jobs.entity_job",
    "ai_web_feeds.nlp.jobs.sentiment_job",
    "ai_web_feeds.nlp.jobs.topic_job",
    "ai_web_feeds.nlp.scheduler",
    "ai_web_feeds.nlp.sentiment_analyzer",
    "ai_web_feeds.nlp.topic_modeler",
)


def _guard_network_and_pytest(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Record and refuse live HTTP and a nested pytest run."""
    calls: list[str] = []

    def _refuse(channel: str):
        def _blocked(*_args: object, **_kwargs: object) -> None:
            calls.append(channel)
            raise AssertionError(f"nlp command attempted guarded access via {channel}")

        return _blocked

    monkeypatch.setattr(socket, "create_connection", _refuse("socket.create_connection"))
    monkeypatch.setattr(socket, "getaddrinfo", _refuse("socket.getaddrinfo"))
    monkeypatch.setattr(urllib.request, "urlopen", _refuse("urllib.request.urlopen"))
    monkeypatch.setattr(
        http.client.HTTPConnection,
        "request",
        _refuse("http.client.HTTPConnection.request"),
    )
    monkeypatch.setattr(
        http.client.HTTPSConnection,
        "connect",
        _refuse("http.client.HTTPSConnection.connect"),
    )
    monkeypatch.setattr(subprocess, "run", _refuse("subprocess.run"))
    monkeypatch.setattr(pytest, "main", _refuse("pytest.main"))
    return calls


def _imported_since(before: set[str]) -> set[str]:
    return set(sys.modules) - before


def _weight_imports(imported: set[str]) -> list[str]:
    """Modules that would download or score with optional ML weights."""
    return sorted(
        name
        for name in imported
        if name.split(".", 1)[0] in _WEIGHT_ROOTS or name in _HEAVY_NLP_MODULES
    )


@pytest.mark.unit
def test_nlp_help_does_not_call_network_or_pytest(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--help` lists subcommands and does not open a socket, load weights, or run pytest."""
    guarded_calls = _guard_network_and_pytest(monkeypatch)
    before = set(sys.modules)
    runner = CliRunner()

    result = runner.invoke(nlp_app, ["--help"])

    imported = _imported_since(before)
    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert guarded_calls == []
    assert _weight_imports(imported) == []
    assert "ai_web_feeds.nlp.jobs.quality_job" not in imported
    assert "Advanced AI/NLP features" in result.output
    for name in ("quality", "entities", "sentiment", "topics", "scheduler", "stats"):
        assert name in result.output


@pytest.mark.unit
def test_nlp_quality_mocked_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    """Quality scoring prints mocked job counts and does not load models or call pytest."""
    guarded_calls = _guard_network_and_pytest(monkeypatch)
    before = set(sys.modules)
    settings = MagicMock()
    settings.phase5.quality_batch_size = 100
    job = MagicMock()
    job.run.return_value = {
        "processed": 4,
        "scored": 3,
        "skipped": 1,
        "failed": 0,
        "duration_seconds": 1.25,
    }
    runner = CliRunner()

    with (
        patch(
            "ai_web_feeds.cli.commands.nlp.Settings",
            return_value=settings,
        ) as settings_cls,
        patch(
            "ai_web_feeds.nlp.jobs.quality_job.QualityBatchJob",
            return_value=job,
        ) as job_cls,
    ):
        result = runner.invoke(nlp_app, ["quality", "--batch-size", "10", "--force"])

    assert guarded_calls == [], guarded_calls
    assert _weight_imports(_imported_since(before)) == []
    assert result.exit_code == 0, result.output
    assert result.exception is None
    output = result.output
    collapsed = " ".join(output.split())
    assert "Quality Scoring Batch Job" in output
    assert "Processing articles (batch_size=10)..." in output
    assert "Quality Scoring Results" in collapsed
    assert "Processed" in output
    assert "Scored" in output
    assert "Skipped" in output
    assert "Failed" in output
    assert "1.25s" in output
    assert "Quality scoring completed successfully" in output
    assert "failed to process" not in output
    settings_cls.assert_called_once_with()
    job_cls.assert_called_once_with(settings)
    job.run.assert_called_once_with(batch_size=10, force=True)
