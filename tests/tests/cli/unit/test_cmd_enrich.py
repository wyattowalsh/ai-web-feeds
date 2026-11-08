"""Characterization tests for the enrich CLI."""

from __future__ import annotations

import builtins
import importlib
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from ai_web_feeds.models import FeedSource
from typer.testing import CliRunner

enrich_app: Any = vars(importlib.import_module("ai_web_feeds.cli.commands.enrich"))["app"]

_ML_IMPORT_ROOTS: frozenset[str] = frozenset(
    {
        "fastembed",
        "huggingface_hub",
        "nltk",
        "onnxruntime",
        "sentence_transformers",
        "spacy",
        "torch",
        "transformers",
    }
)

_SOURCE: dict[str, Any] = {
    "id": "example-source",
    "title": "Example Source",
    "url": "https://example.com",
    "topics": ["ai"],
}

_CATALOG: dict[str, Any] = {
    "document_meta": {"notes": "catalog"},
    "sources": [_SOURCE],
}

_ENRICHED: dict[str, Any] = {
    "id": "example-source",
    "title": "Example Source",
    "feed": "https://example.com/feed.xml",
    "site": "https://example.com",
    "source_type": "blog",
    "mediums": ["text"],
    "tags": ["ai"],
    "topics": ["ai"],
    "topic_weights": {"ai": 1.0},
    "meta": {
        "language": "en",
        "format": "rss",
        "verified": True,
        "contributor": "tester",
    },
    "curation": {
        "status": "verified",
        "quality_score": 0.9,
        "notes": "reviewed",
    },
    "provenance": {
        "source": "manual",
        "from": "catalog",
        "license": "Apache-2.0",
    },
    "relations": {},
    "mappings": {},
    "notes": "enriched offline",
}

_SCHEMA: dict[str, str] = {"title": "Enriched Feeds Schema"}

_DATABASE_URL = "sqlite:///:memory:"


def _block_ml_imports(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Record and reject model-runtime imports so weights are never fetched."""
    calls: list[str] = []
    original_import = builtins.__import__

    def guarded_import(
        name: str,
        globals: Mapping[str, object] | None = None,  # noqa: A002
        locals: Mapping[str, object] | None = None,  # noqa: A002
        fromlist: Sequence[str] = (),
        level: int = 0,
    ) -> object:
        root = name.partition(".")[0]
        if root in _ML_IMPORT_ROOTS:
            calls.append(name)
            message = f"enrich command imported {name}"
            raise AssertionError(message)
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", guarded_import)
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("HF_HUB_DISABLE_TELEMETRY", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
    return calls


@contextmanager
def _boundary_guards() -> Iterator[dict[str, MagicMock]]:
    """Patch network entry points and pytest re-entry."""
    with (
        patch("socket.create_connection") as create_connection,
        patch("socket.getaddrinfo") as getaddrinfo,
        patch("urllib.request.urlopen") as urlopen,
        patch("http.client.HTTPConnection.request") as http_request,
        patch("http.client.HTTPSConnection.connect") as https_connect,
        patch("httpx.AsyncClient") as async_client,
        patch("httpx.Client") as sync_client,
        patch("pytest.main") as pytest_main,
    ):
        yield {
            "create_connection": create_connection,
            "getaddrinfo": getaddrinfo,
            "urlopen": urlopen,
            "http_request": http_request,
            "https_connect": https_connect,
            "async_client": async_client,
            "sync_client": sync_client,
            "pytest_main": pytest_main,
        }


def _assert_boundaries_idle(guards: Mapping[str, MagicMock]) -> None:
    for guard in guards.values():
        guard.assert_not_called()


@pytest.mark.unit
def test_enrich_help_does_not_call_network_or_pytest(monkeypatch: pytest.MonkeyPatch) -> None:
    """`--help` lists subcommands and does not enrich, open a socket, or re-enter pytest."""
    ml_imports = _block_ml_imports(monkeypatch)
    runner = CliRunner()

    with (
        _boundary_guards() as guards,
        patch("ai_web_feeds.cli.commands.enrich.load_feeds_yaml") as load_feeds_yaml,
        patch("ai_web_feeds.cli.commands.enrich.enrich_feed_source") as enrich_feed_source,
        patch("ai_web_feeds.cli.commands.enrich.save_feeds_yaml") as save_feeds_yaml,
        patch("ai_web_feeds.cli.commands.enrich.generate_enriched_schema") as generate_schema,
        patch("ai_web_feeds.cli.commands.enrich.save_json_schema") as save_json_schema,
        patch("ai_web_feeds.cli.commands.enrich.upgrade_database_to_head") as upgrade_database,
        patch("ai_web_feeds.cli.commands.enrich.DatabaseManager") as database_manager,
    ):
        result = runner.invoke(enrich_app, ["--help"])

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert "Enrich feed sources with metadata" in result.output
    assert "all" in result.output
    assert "one" in result.output
    assert ml_imports == []
    _assert_boundaries_idle(guards)
    load_feeds_yaml.assert_not_called()
    enrich_feed_source.assert_not_called()
    save_feeds_yaml.assert_not_called()
    generate_schema.assert_not_called()
    save_json_schema.assert_not_called()
    upgrade_database.assert_not_called()
    database_manager.assert_not_called()


@pytest.mark.unit
def test_enrich_all_happy_path_is_mocked(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """`all` persists one mocked source without HTTP, model weights, or pytest."""
    ml_imports = _block_ml_imports(monkeypatch)
    runner = CliRunner()
    input_file = tmp_path / "feeds.yaml"
    output_file = tmp_path / "feeds.enriched.yaml"
    schema_file = tmp_path / "feeds.enriched.schema.json"
    database = MagicMock()

    with (
        _boundary_guards() as guards,
        patch(
            "ai_web_feeds.cli.commands.enrich.load_feeds_yaml",
            return_value=_CATALOG,
        ) as load_feeds_yaml,
        patch(
            "ai_web_feeds.cli.commands.enrich.enrich_feed_source",
            new_callable=AsyncMock,
            return_value=_ENRICHED,
        ) as enrich_feed_source,
        patch("ai_web_feeds.cli.commands.enrich.save_feeds_yaml") as save_feeds_yaml,
        patch(
            "ai_web_feeds.cli.commands.enrich.generate_enriched_schema",
            return_value=_SCHEMA,
        ) as generate_schema,
        patch("ai_web_feeds.cli.commands.enrich.save_json_schema") as save_json_schema,
        patch("ai_web_feeds.cli.commands.enrich.upgrade_database_to_head") as upgrade_database,
        patch(
            "ai_web_feeds.cli.commands.enrich.DatabaseManager",
            return_value=database,
        ) as database_manager,
    ):
        result = runner.invoke(
            enrich_app,
            [
                "all",
                "--input",
                str(input_file),
                "--output",
                str(output_file),
                "--schema",
                str(schema_file),
                "--database",
                _DATABASE_URL,
            ],
        )

    assert result.exit_code == 0, result.output
    assert result.exception is None
    assert "Enrichment complete: 1 sources processed" in result.output
    assert ml_imports == []
    _assert_boundaries_idle(guards)
    assert not output_file.exists()
    assert not schema_file.exists()

    load_feeds_yaml.assert_called_once_with(input_file)
    enrich_feed_source.assert_awaited_once_with(_SOURCE)
    save_feeds_yaml.assert_called_once()
    saved_payload, saved_path = save_feeds_yaml.call_args.args
    assert saved_path == output_file
    assert saved_payload["schema_version"] == "feeds.enriched-3.0.0"
    assert saved_payload["sources"] == [_ENRICHED]
    assert saved_payload["document_meta"]["notes"] == "catalog"
    assert saved_payload["document_meta"]["total_sources"] == 1
    assert isinstance(saved_payload["document_meta"]["enriched_at"], str)
    assert saved_payload["document_meta"]["enriched_at"]

    generate_schema.assert_called_once_with()
    save_json_schema.assert_called_once_with(_SCHEMA, schema_file)
    upgrade_database.assert_called_once_with(_DATABASE_URL)
    database_manager.assert_called_once_with(_DATABASE_URL)
    database.add_feed_source.assert_called_once()
    saved_source = database.add_feed_source.call_args.args[0]
    assert isinstance(saved_source, FeedSource)
    assert saved_source.id == "example-source"
    assert saved_source.title == "Example Source"
    assert saved_source.feed == "https://example.com/feed.xml"
    assert saved_source.site == "https://example.com"
    assert saved_source.topics == ["ai"]
    assert saved_source.language == "en"
    assert saved_source.verified is True
    assert saved_source.quality_score == 0.9
