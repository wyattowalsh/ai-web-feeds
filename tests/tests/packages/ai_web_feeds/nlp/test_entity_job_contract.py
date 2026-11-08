"""Characterization of the entity batch job.

Importing the job must not download model weights or open a socket. The model
is injected. Stored article text is scored when a model is injected or when
spaCy and its configured model are already installed. A missing optional ml
extra skips the row, logs, and leaves that row unprocessed.
"""

from __future__ import annotations

import http.client
import importlib
import importlib.util
import inspect
import socket
import subprocess
import sys
import urllib.request
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, NamedTuple, Protocol

import pytest
from ai_web_feeds.config import Settings
from ai_web_feeds.models import ArticleEntry, Entity, EntityMention, FeedSource
from ai_web_feeds.storage import DatabaseManager
from loguru import logger
from sqlmodel import select

_WEIGHT_ROOTS = frozenset(
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


class StoredArticle(NamedTuple):
    """Article text persisted before the entity job runs."""

    article_id: int
    title: str
    summary: str
    content_html: str

    @property
    def text(self) -> str:
        """Return the same fields the extractor concatenates, joined by spaces."""
        return f"{self.title} {self.summary} {self.content_html}"


def _guard_network(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Refuse sockets, URL opens, and subprocess downloads."""
    calls: list[str] = []

    def _refuse(channel: str):
        def _blocked(*_args: object, **_kwargs: object) -> None:
            calls.append(channel)
            message = f"entity job attempted live access via {channel}"
            raise AssertionError(message)

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
    return calls


def _force_offline(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep optional model libraries from fetching weights."""
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("HF_HUB_DISABLE_TELEMETRY", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
    monkeypatch.setenv("HF_DATASETS_OFFLINE", "1")


def _seed_stored_article(tmp_path: Path) -> tuple[DatabaseManager, StoredArticle]:
    """Insert one feed article whose text exists only in SQLite."""
    title = "Barack Obama meets Tim Cook"
    summary = "Apple hosted the meeting in California."
    content_html = (
        "Barack Obama met Tim Cook at Apple in California to discuss research. "
        "Google Brain and OpenAI were not part of the meeting."
    )
    database = DatabaseManager(database_url=f"sqlite:///{tmp_path / 'entity-job.db'}")
    database.create_db_and_tables()
    with database.get_session() as session:
        session.add(
            FeedSource(
                id="entity-contract-feed",
                title="Entity Contract Feed",
                feed="https://example.test/feed.xml",
                site="https://example.test",
                topics=["ai"],
            )
        )
        article = ArticleEntry(
            feed_id="entity-contract-feed",
            guid="entity-contract-guid",
            link="https://example.test/obama-cook",
            title=title,
            summary=summary,
            content_html=content_html,
            pub_date=datetime(2024, 6, 1, 12, 0, tzinfo=UTC),
            entities_processed=False,
        )
        session.add(article)
        session.commit()
        session.refresh(article)
        assert article.id is not None
        stored = StoredArticle(
            article_id=article.id,
            title=title,
            summary=summary,
            content_html=content_html,
        )
    return database, stored


def _missing_optional_dependency() -> str | None:
    """Return the missing spaCy package or model name, else None.

    ``find_spec`` and ``spacy.util.is_package`` only check the local install.
    Neither one downloads model weights.
    """
    if importlib.util.find_spec("spacy") is None:
        return "spacy"
    # Imported only after the job import is proven not to load spaCy.
    spacy_util = importlib.import_module("spacy.util")
    model_name = Settings().phase5.spacy_model
    is_package = getattr(spacy_util, "is_package", None)
    installed = Path(model_name).exists() or (callable(is_package) and is_package(model_name))
    if installed:
        return None
    return model_name


class _Span:
    """Entity span the extractor reads off an injected model."""

    def __init__(self, text: str, label: str, start: int, end: int) -> None:
        self.text = text
        self.label_ = label
        self.start_char = start
        self.end_char = end


class _Doc:
    """Document returned by the injected model."""

    def __init__(self, text: str, ents: list[_Span]) -> None:
        self.text = text
        self.ents = ents


def _injected_nlp(text: str) -> _Doc:
    """Score one stored name without loading spaCy weights."""
    needle = "OpenAI"
    start = text.find(needle)
    if start < 0:
        return _Doc(text, [])
    return _Doc(text, [_Span(needle, "ORG", start, start + len(needle))])


@contextmanager
def _warning_lines() -> Iterator[list[str]]:
    """Capture loguru warnings emitted while the job skips a row."""
    lines: list[str] = []

    def _sink(message: object) -> None:
        lines.append(str(message))

    handle = logger.add(_sink, level="WARNING")
    try:
        yield lines
    finally:
        logger.remove(handle)


def _assert_row_skipped(database: DatabaseManager, stored: StoredArticle) -> None:
    """The stored row was not scored and its text was not replaced."""
    with database.get_session() as session:
        article = session.get(ArticleEntry, stored.article_id)
        assert article is not None
        assert article.entities_processed is False
        assert article.entities_processed_at is None
        assert article.last_failure_reason is None
        assert article.title == stored.title
        assert article.summary == stored.summary
        assert article.content_html == stored.content_html
        assert list(session.exec(select(Entity)).all()) == []
        assert list(session.exec(select(EntityMention)).all()) == []


def _assert_missing_dependency_skips(
    database: DatabaseManager,
    stored: StoredArticle,
    job_cls: type,
) -> None:
    """A missing ml extra logs, skips the row, and does not score it."""
    settings = Settings(database_url=database.database_url)
    job = job_cls(settings=settings, db_manager=database)
    with _warning_lines() as lines:
        stats = job.run(batch_size=1, force=False)

    assert stats["processed"] == 1
    assert stats["skipped"] == 1
    assert stats["failed"] == 0
    assert stats["entities_found"] == 0
    assert stats["unique_entities"] == 0
    assert stats["duration_seconds"] >= 0
    assert any("optional ml extra is missing" in line for line in lines)
    _assert_row_skipped(database, stored)


def _assert_scores_stored_text(
    database: DatabaseManager,
    stored: StoredArticle,
    job_cls: type,
    nlp: Callable[[str], _Doc] | None = None,
) -> None:
    """Score only the SQLite text and persist mention confidence from it."""
    settings = Settings(database_url=database.database_url)
    job = job_cls(settings=settings, db_manager=database, nlp=nlp)
    if nlp is not None:
        assert job.extractor.nlp is nlp
    stats = job.run(batch_size=1, force=False)

    assert stats["processed"] == 1
    assert stats["skipped"] == 0
    assert stats["failed"] == 0
    assert stats["duration_seconds"] >= 0
    assert stats["entities_found"] >= 0
    assert stats["unique_entities"] >= 0

    with database.get_session() as session:
        article = session.get(ArticleEntry, stored.article_id)
        assert article is not None
        assert article.entities_processed is True
        assert article.entities_processed_at is not None
        assert article.last_failure_reason is None
        assert article.title == stored.title
        assert article.summary == stored.summary
        assert article.content_html == stored.content_html
        entities = list(session.exec(select(Entity)).all())
        mentions = list(session.exec(select(EntityMention)).all())
        entity_rows = [
            (entity.canonical_name, entity.entity_type, entity.frequency_count)
            for entity in entities
        ]
        mention_rows = [
            (mention.article_id, mention.extraction_method, mention.confidence, mention.context)
            for mention in mentions
        ]

    assert stats["entities_found"] == len(mention_rows)
    for canonical_name, entity_type, frequency_count in entity_rows:
        assert canonical_name in stored.text
        assert entity_type
        assert frequency_count >= 1
    for article_id, extraction_method, confidence, context in mention_rows:
        assert article_id == stored.article_id
        assert extraction_method == "spacy_ner"
        assert 0.0 <= confidence <= 1.0
        if context:
            assert context in stored.content_html
    if nlp is not None or settings.phase5.spacy_model == "en_core_web_sm":
        assert stats["entities_found"] >= 1
        assert entity_rows
        assert mention_rows


class _RunnableJob(Protocol):
    """Batch job class surface checked by signature, not by a loaded model."""

    def run(self, batch_size: int | None = None, force: bool = False) -> dict[str, Any]:
        """Run one batch."""


def _assert_public_entry_points(job_cls: type[_RunnableJob]) -> None:
    """Callers keep constructing the job and running a batch without a model."""
    init_signature = inspect.signature(job_cls.__init__)
    run_signature = inspect.signature(job_cls.run)
    assert tuple(init_signature.parameters) == ("self", "settings", "db_manager", "nlp")
    assert init_signature.parameters["settings"].default is None
    assert init_signature.parameters["db_manager"].default is None
    assert init_signature.parameters["nlp"].default is None
    assert tuple(run_signature.parameters) == ("self", "batch_size", "force")
    assert run_signature.parameters["batch_size"].default is None
    assert run_signature.parameters["force"].default is False


@pytest.mark.unit
def test_entity_job_scores_stored_text_or_skips_without_dependency(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Score stored text when a model is available; otherwise skip and log."""
    database, stored = _seed_stored_article(tmp_path)
    try:
        guarded_calls = _guard_network(monkeypatch)
        _force_offline(monkeypatch)
        before = set(sys.modules)
        job_cls = importlib.import_module("ai_web_feeds.nlp.jobs.entity_job").EntityBatchJob
        imported = set(sys.modules) - before
        loaded_weights = sorted(name for name in imported if name.split(".", 1)[0] in _WEIGHT_ROOTS)
        assert loaded_weights == []
        _assert_public_entry_points(job_cls)
        missing = _missing_optional_dependency()
        if missing is None:
            _assert_scores_stored_text(database, stored, job_cls)
        else:
            _assert_missing_dependency_skips(database, stored, job_cls)
            _assert_scores_stored_text(database, stored, job_cls, nlp=_injected_nlp)
        assert guarded_calls == []
    finally:
        database.close()
