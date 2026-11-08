"""Characterization of the current sentiment batch job.

Importing the job must not construct a transformers pipeline or download
weights. A model may be injected; otherwise the optional ml pipeline is loaded
when the analyzer is constructed. When that extra is missing, or scoring raises
ImportError, the analyzer returns no result, the row is skipped, and a warning
is logged. No live HTTP.
"""

from __future__ import annotations

import http.client
import importlib
import inspect
import socket
import sys
import urllib.request
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, NamedTuple, Protocol, cast

import pytest
from ai_web_feeds.config import Phase5Settings, Settings
from ai_web_feeds.models import ArticleEntry, ArticleSentiment, FeedSource
from ai_web_feeds.storage import DatabaseManager
from loguru import logger
from sqlmodel import select

pytestmark = pytest.mark.unit

_JOB_MODULE = "ai_web_feeds.nlp.jobs.sentiment_job"
_ANALYZER_MODULE = "ai_web_feeds.nlp.sentiment_analyzer"
_DEFAULT_MODEL = "distilbert-base-uncased-finetuned-sst-2-english"
_HTML_NOT_SCORED = "LONG_HTML_NOT_SCORED " * 4
_MISSING_EXTRA = "optional ml extra is missing"
_WEIGHT_ROOTS = frozenset(
    {
        "bertopic",
        "gensim",
        "huggingface_hub",
        "sentence_transformers",
        "spacy",
        "tokenizers",
        "torch",
        "transformers",
    }
)


class _BatchJob(Protocol):
    """Sentiment batch job surface exercised by these tests."""

    def __init__(
        self,
        settings: Settings | None = None,
        db_manager: DatabaseManager | None = None,
        *,
        model: Callable[[str], list[dict[str, object]]] | None = None,
    ) -> None:
        """Bind settings, stored article text, and an optional injected model."""

    def run(
        self,
        batch_size: int | None = None,
        force: bool = False,
    ) -> dict[str, Any]:
        """Score one batch and return the job statistics."""
        ...


class _Stored(NamedTuple):
    """Persisted article flag plus optional sentiment columns."""

    processed: bool
    stamped: bool
    failure: str | None
    score: float | None
    classification: str | None
    model_name: str | None
    confidence: float | None


class _RecordingPipeline:
    """Stand-in for ``transformers.pipeline`` so weights are never fetched."""

    def __init__(self) -> None:
        self.factory_calls: list[tuple[tuple[object, ...], dict[str, object]]] = []
        self.texts: list[str] = []
        self.infer: Callable[[str], list[dict[str, object]]] | None = None
        self.imported: frozenset[str] = frozenset()

    def __call__(self, *args: object, **kwargs: object) -> Callable[[str], list[dict[str, object]]]:
        self.factory_calls.append((args, kwargs))
        recorder = self

        def _infer(text: str) -> list[dict[str, object]]:
            recorder.texts.append(text)
            if recorder.infer is None:
                message = "sentiment pipeline scored text without a scripted result"
                raise AssertionError(message)
            return recorder.infer(text)

        return _infer


def _refuse(channel: str) -> Callable[..., None]:
    def _blocked(*_args: object, **_kwargs: object) -> None:
        message = f"sentiment job opened {channel}"
        raise AssertionError(message)

    return _blocked


def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("HF_HUB_DISABLE_TELEMETRY", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
    monkeypatch.setenv("HF_DATASETS_OFFLINE", "1")
    monkeypatch.setenv("TOKENIZERS_PARALLELISM", "false")


def _block_network(monkeypatch: pytest.MonkeyPatch) -> None:
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


def _drop_cached_module(name: str) -> None:
    """Drop a module and its parent attribute so the next import re-executes it."""
    sys.modules.pop(name, None)
    parent_name, _, child = name.rpartition(".")
    parent = sys.modules.get(parent_name)
    if parent is not None and child in parent.__dict__:
        del parent.__dict__[child]


def _weight_imports(imported: frozenset[str]) -> list[str]:
    """Return weight-package names introduced by importing the sentiment job."""
    found: list[str] = []
    for name in imported:
        if name.split(".", 1)[0] in _WEIGHT_ROOTS:
            found.append(name)
    return sorted(found)


def _bind_pipeline(monkeypatch: pytest.MonkeyPatch, pipeline: _RecordingPipeline) -> None:
    """Import the job, then point its pipeline global at a recorder.

    The analyzer binds ``pipeline`` lazily. Patching ``transformers.pipeline``
    would not replace that global. Import itself must not call it or import
    weight packages; weights are fetched only when the global is called.
    """
    _drop_cached_module(_JOB_MODULE)
    _drop_cached_module(_ANALYZER_MODULE)
    before = set(sys.modules)
    importlib.import_module(_JOB_MODULE)
    pipeline.imported = frozenset(set(sys.modules) - before)
    analyzer = importlib.import_module(_ANALYZER_MODULE)
    monkeypatch.setattr(analyzer, "pipeline", pipeline)


def _capture_warnings() -> tuple[int, list[str]]:
    """Record loguru warnings until the caller removes the sink."""
    found: list[str] = []

    def _sink(message: object) -> None:
        found.append(str(message))

    return logger.add(_sink, level="WARNING"), found


@pytest.fixture
def sentiment_pipeline(monkeypatch: pytest.MonkeyPatch) -> Iterator[_RecordingPipeline]:
    """Import the job offline, with pipeline construction recorded and refused."""
    pipeline = _RecordingPipeline()
    _offline(monkeypatch)
    _block_network(monkeypatch)
    _bind_pipeline(monkeypatch, pipeline)
    try:
        yield pipeline
    finally:
        sys.modules.pop(_JOB_MODULE, None)
        sys.modules.pop(_ANALYZER_MODULE, None)


@pytest.fixture
def sentiment_db(
    tmp_path: Path,
    sample_feed_source: FeedSource,
) -> Iterator[tuple[DatabaseManager, str]]:
    """SQLite database with one feed and no network dependency."""
    feed_id = sample_feed_source.id
    db = DatabaseManager(database_url=f"sqlite:///{tmp_path / 'sentiment-job.db'}")
    try:
        db.create_db_and_tables()
        db.add_feed_source(sample_feed_source)
        yield db, feed_id
    finally:
        db.close()


def _job_class() -> type[_BatchJob]:
    job_cls = importlib.import_module(_JOB_MODULE).SentimentBatchJob
    if not isinstance(job_cls, type):
        message = "SentimentBatchJob export is missing"
        raise AssertionError(message)
    return cast(type[_BatchJob], job_cls)


def _assert_factory(pipeline: _RecordingPipeline, settings: Settings) -> None:
    assert len(pipeline.factory_calls) == 1
    args, kwargs = pipeline.factory_calls[0]
    assert args == ("sentiment-analysis",)
    assert kwargs == {"model": settings.phase5.sentiment_model, "device": -1}


def _make_job(
    pipeline: _RecordingPipeline,
    db: DatabaseManager,
    settings: Settings | None = None,
) -> tuple[_BatchJob, Settings]:
    resolved = settings or Settings()
    job = _job_class()(settings=resolved, db_manager=db)
    _assert_factory(pipeline, resolved)
    return job, resolved


def _words(marker: str) -> str:
    return f"{marker} " + ("token " * 8)


def _add(
    db: DatabaseManager,
    feed_id: str,
    guid: str,
    title: str,
    summary: str | None,
    content_html: str | None = None,
) -> None:
    db.add_article(
        ArticleEntry(
            feed_id=feed_id,
            guid=guid,
            link=f"https://example.com/{guid}",
            title=title,
            summary=summary,
            content_html=content_html,
            pub_date=datetime(2024, 6, 1, tzinfo=UTC),
        )
    )


def _stored(db: DatabaseManager) -> dict[str, _Stored]:
    with db.get_session() as session:
        articles = session.exec(select(ArticleEntry)).all()
        sentiments = {row.article_id: row for row in session.exec(select(ArticleSentiment)).all()}
        stored: dict[str, _Stored] = {}
        for article in articles:
            if article.id is None:
                message = f"article {article.guid} was not persisted"
                raise AssertionError(message)
            sentiment = sentiments.get(article.id)
            stored[article.guid] = _Stored(
                processed=article.sentiment_processed,
                stamped=article.sentiment_processed_at is not None,
                failure=article.last_failure_reason,
                score=None if sentiment is None else sentiment.sentiment_score,
                classification=None if sentiment is None else sentiment.classification,
                model_name=None if sentiment is None else sentiment.model_name,
                confidence=None if sentiment is None else sentiment.confidence,
            )
        return stored


def _count_sentiments(db: DatabaseManager) -> int:
    with db.get_session() as session:
        return len(list(session.exec(select(ArticleSentiment)).all()))


def _label(label: str, score: float) -> Callable[[str], list[dict[str, object]]]:
    def _infer(_text: str) -> list[dict[str, object]]:
        return [{"label": label, "score": score}]

    return _infer


def _skipped(row: _Stored) -> None:
    assert row.processed is True
    assert row.stamped is True
    assert row.failure is None
    assert row.score is None
    assert row.classification is None
    assert row.model_name is None
    assert row.confidence is None


def test_import_does_not_download_weights(sentiment_pipeline: _RecordingPipeline) -> None:
    """Import binds the analyzer class and does not construct a model pipeline."""
    module = importlib.import_module(_JOB_MODULE)
    analyzer = importlib.import_module(_ANALYZER_MODULE)
    analyzer_cls = module.SentimentAnalyzer
    init_params = inspect.signature(module.SentimentBatchJob.__init__).parameters
    analyzer_params = inspect.signature(analyzer_cls.__init__).parameters

    assert analyzer_cls.__name__ == "SentimentAnalyzer"
    assert module.SentimentAnalyzer is analyzer.SentimentAnalyzer
    assert analyzer.pipeline is sentiment_pipeline
    assert sentiment_pipeline.factory_calls == []
    assert sentiment_pipeline.texts == []
    assert _weight_imports(sentiment_pipeline.imported) == []
    assert Phase5Settings.model_fields["sentiment_model"].default == _DEFAULT_MODEL
    assert tuple(init_params)[:3] == ("self", "settings", "db_manager")
    assert init_params["model"].default is None
    assert init_params["model"].kind is inspect.Parameter.KEYWORD_ONLY
    assert analyzer_params["model"].default is None
    assert analyzer_params["model"].kind is inspect.Parameter.KEYWORD_ONLY
    assert tuple(inspect.signature(module.SentimentBatchJob.run).parameters) == (
        "self",
        "batch_size",
        "force",
    )


def test_empty_batch_returns_zero_stats(
    sentiment_pipeline: _RecordingPipeline,
    sentiment_db: tuple[DatabaseManager, str],
) -> None:
    """No articles returns the zero stat dict before a duration is measured."""
    db, _feed_id = sentiment_db
    job, _settings = _make_job(sentiment_pipeline, db)

    stats = job.run()

    assert stats == {
        "processed": 0,
        "analyzed": 0,
        "positive": 0,
        "neutral": 0,
        "negative": 0,
        "failed": 0,
        "duration_seconds": 0.0,
    }
    assert sentiment_pipeline.texts == []


def test_missing_optional_dependency_skips_row(
    sentiment_pipeline: _RecordingPipeline,
    sentiment_db: tuple[DatabaseManager, str],
) -> None:
    """ImportError while scoring skips that row and still stores a later one."""
    db, feed_id = sentiment_db
    _add(db, feed_id, "missing-dep", "Dep", _words("missing-optional-dependency"))
    _add(db, feed_id, "positive-row", "Positive", None, _words("positive-marker"))

    def _infer(text: str) -> list[dict[str, object]]:
        if "missing-optional-dependency" in text:
            raise ImportError("No module named 'transformers'")
        return [{"label": "POSITIVE", "score": 0.75}]

    sentiment_pipeline.infer = _infer
    job, settings = _make_job(sentiment_pipeline, db)
    sink_id, warnings = _capture_warnings()
    try:
        stats = job.run(batch_size=10)
    finally:
        logger.remove(sink_id)
    stored = _stored(db)
    model_name = settings.phase5.sentiment_model

    assert stats["processed"] == 2
    assert stats["analyzed"] == 1
    assert stats["positive"] == 1
    assert stats["neutral"] == 0
    assert stats["negative"] == 0
    assert stats["failed"] == 0
    assert "skipped" not in stats
    assert stats["duration_seconds"] >= 0
    _skipped(stored["missing-dep"])
    assert stored["positive-row"] == _Stored(
        processed=True,
        stamped=True,
        failure=None,
        score=0.75,
        classification="positive",
        model_name=model_name,
        confidence=0.75,
    )
    joined = "\n".join(sentiment_pipeline.texts)
    assert "missing-optional-dependency" in joined
    assert "positive-marker" in joined
    assert len(sentiment_pipeline.texts) == 2
    assert any(_MISSING_EXTRA in message for message in warnings)


def test_missing_ml_extra_skips_row_and_logs(
    sentiment_pipeline: _RecordingPipeline,
    sentiment_db: tuple[DatabaseManager, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A missing transformers extra skips the stored row and logs a warning."""
    db, feed_id = sentiment_db
    _add(db, feed_id, "missing-extra", "Missing", _words("missing-extra-marker"))
    analyzer = importlib.import_module(_ANALYZER_MODULE)

    def _missing(*_args: object, **_kwargs: object) -> None:
        message = "No module named 'transformers'"
        raise ImportError(message)

    monkeypatch.setattr(analyzer, "pipeline", _missing)
    sink_id, warnings = _capture_warnings()
    try:
        job = _job_class()(settings=Settings(), db_manager=db)
        stats = job.run(batch_size=5)
    finally:
        logger.remove(sink_id)
    stored = _stored(db)

    assert stats["processed"] == 1
    assert stats["analyzed"] == 0
    assert stats["positive"] == 0
    assert stats["neutral"] == 0
    assert stats["negative"] == 0
    assert stats["failed"] == 0
    assert stats["duration_seconds"] >= 0
    _skipped(stored["missing-extra"])
    assert _count_sentiments(db) == 0
    assert sentiment_pipeline.factory_calls == []
    assert sentiment_pipeline.texts == []
    assert any(_MISSING_EXTRA in message for message in warnings)


def test_injected_model_does_not_load_pipeline(
    sentiment_pipeline: _RecordingPipeline,
    sentiment_db: tuple[DatabaseManager, str],
) -> None:
    """An injected scorer is used and the transformers factory is not called."""
    db, feed_id = sentiment_db
    _add(db, feed_id, "injected-row", "Injected", _words("injected-marker"))
    seen: list[str] = []

    def _scorer(text: str) -> list[dict[str, object]]:
        seen.append(text)
        return [{"label": "NEGATIVE", "score": 0.8}]

    job = _job_class()(settings=Settings(), db_manager=db, model=_scorer)
    assert sentiment_pipeline.factory_calls == []
    stats = job.run(batch_size=5)
    stored = _stored(db)
    model_name = Settings().phase5.sentiment_model

    assert stats["processed"] == 1
    assert stats["analyzed"] == 1
    assert stats["negative"] == 1
    assert stats["failed"] == 0
    assert stored["injected-row"] == _Stored(
        True,
        True,
        None,
        -0.8,
        "negative",
        model_name,
        0.8,
    )
    assert sentiment_pipeline.factory_calls == []
    assert sentiment_pipeline.texts == []
    assert len(seen) == 1
    assert "injected-marker" in seen[0]


def test_short_summary_skips_row_without_scoring(
    sentiment_pipeline: _RecordingPipeline,
    sentiment_db: tuple[DatabaseManager, str],
) -> None:
    """A short summary is skipped even when HTML content is long."""
    db, feed_id = sentiment_db
    _add(db, feed_id, "short-html", "HTML", "tiny", _HTML_NOT_SCORED)
    sentiment_pipeline.infer = _label("POSITIVE", 0.75)
    job, _settings = _make_job(sentiment_pipeline, db)

    stats = job.run(batch_size=10)
    stored = _stored(db)

    assert stats["processed"] == 1
    assert stats["analyzed"] == 0
    assert stats["failed"] == 0
    assert stats["positive"] == 0
    _skipped(stored["short-html"])
    assert sentiment_pipeline.texts == []
    assert _count_sentiments(db) == 0


def test_classifications_are_stored_and_not_revisited(
    sentiment_pipeline: _RecordingPipeline,
    sentiment_db: tuple[DatabaseManager, str],
) -> None:
    """Positive, negative, and neutral labels are stored; a later run is a no-op."""
    db, feed_id = sentiment_db
    _add(db, feed_id, "positive-row", "Positive", None, _words("positive-marker"))
    _add(db, feed_id, "negative-row", "Negative", _words("negative-marker"))
    _add(db, feed_id, "neutral-row", "Neutral", _words("neutral-marker"))

    def _infer(text: str) -> list[dict[str, object]]:
        if "negative-marker" in text:
            return [{"label": "NEGATIVE", "score": 0.8}]
        if "neutral-marker" in text:
            return [{"label": "NEUTRAL", "score": 0.25}]
        return [{"label": "POSITIVE", "score": 0.75}]

    sentiment_pipeline.infer = _infer
    job, settings = _make_job(sentiment_pipeline, db)
    stats = job.run(batch_size=10)
    stored = _stored(db)
    model_name = settings.phase5.sentiment_model

    assert stats["processed"] == 3
    assert stats["analyzed"] == 3
    assert stats["positive"] == 1
    assert stats["negative"] == 1
    assert stats["neutral"] == 1
    assert stats["failed"] == 0
    assert stored["positive-row"] == _Stored(True, True, None, 0.75, "positive", model_name, 0.75)
    assert stored["negative-row"] == _Stored(True, True, None, -0.8, "negative", model_name, 0.8)
    assert stored["neutral-row"] == _Stored(True, True, None, 0.0, "neutral", model_name, 0.25)
    assert _count_sentiments(db) == 3

    sentiment_pipeline.texts.clear()
    again = job.run(batch_size=10)
    assert again["processed"] == 0
    assert again["analyzed"] == 0
    assert again["duration_seconds"] == 0.0
    assert sentiment_pipeline.texts == []


def test_batch_size_defaults_to_phase5_setting(
    sentiment_pipeline: _RecordingPipeline,
    sentiment_db: tuple[DatabaseManager, str],
) -> None:
    """Omitting batch_size uses phase5.sentiment_batch_size as the query limit."""
    db, feed_id = sentiment_db
    for index in range(3):
        _add(db, feed_id, f"row-{index}", f"Row {index}", _words(f"row-{index}"))
    settings = Settings()
    settings.phase5.sentiment_batch_size = 1
    sentiment_pipeline.infer = _label("POSITIVE", 0.75)
    job, _settings = _make_job(sentiment_pipeline, db, settings)

    stats = job.run()
    stored = _stored(db)

    assert stats["processed"] == 1
    assert stats["analyzed"] == 1
    assert stats["positive"] == 1
    assert sum(1 for row in stored.values() if row.processed) == 1
    assert _count_sentiments(db) == 1
    assert len(sentiment_pipeline.texts) == 1


def test_force_reprocess_replaces_sentiment_row(
    sentiment_pipeline: _RecordingPipeline,
    sentiment_db: tuple[DatabaseManager, str],
) -> None:
    """force=True scores an already processed article and replaces its row."""
    db, feed_id = sentiment_db
    _add(db, feed_id, "force-row", "Force", _words("force-marker"))
    sentiment_pipeline.infer = _label("POSITIVE", 0.75)
    job, settings = _make_job(sentiment_pipeline, db)
    first = job.run(batch_size=5)
    assert first["positive"] == 1

    sentiment_pipeline.infer = _label("NEGATIVE", 0.8)
    sentiment_pipeline.texts.clear()
    second = job.run(batch_size=5, force=True)
    stored = _stored(db)

    assert second["processed"] == 1
    assert second["analyzed"] == 1
    assert second["positive"] == 0
    assert second["negative"] == 1
    assert second["failed"] == 0
    assert stored["force-row"] == _Stored(
        True,
        True,
        None,
        -0.8,
        "negative",
        settings.phase5.sentiment_model,
        0.8,
    )
    assert _count_sentiments(db) == 1
    assert len(sentiment_pipeline.texts) == 1
    assert "force-marker" in sentiment_pipeline.texts[0]


def test_storage_failure_leaves_row_unprocessed(
    sentiment_pipeline: _RecordingPipeline,
    sentiment_db: tuple[DatabaseManager, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A write error increments failed and does not mark the article processed."""
    db, feed_id = sentiment_db
    _add(db, feed_id, "boom-row", "Boom", _words("boom-marker"))
    sentiment_pipeline.infer = _label("POSITIVE", 0.75)

    class _BoomSentiment:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            message = "boom"
            raise RuntimeError(message)

    monkeypatch.setattr(
        importlib.import_module(_JOB_MODULE),
        "ArticleSentiment",
        _BoomSentiment,
    )
    job, _settings = _make_job(sentiment_pipeline, db)
    stats = job.run(batch_size=5)
    stored = _stored(db)

    assert stats["processed"] == 1
    assert stats["analyzed"] == 0
    assert stats["failed"] == 1
    assert stats["positive"] == 0
    assert stored["boom-row"] == _Stored(
        processed=False,
        stamped=False,
        failure="sentiment_analysis: boom",
        score=None,
        classification=None,
        model_name=None,
        confidence=None,
    )
    assert _count_sentiments(db) == 0
