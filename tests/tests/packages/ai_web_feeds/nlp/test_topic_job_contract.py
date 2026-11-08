"""Characterization of the current topic modeling job.

Importing the job must not download model weights. No live HTTP.
A missing gensim extra skips the test row instead of failing collection.
"""

from __future__ import annotations

import http.client
import importlib
import inspect
import socket
import sys
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from types import ModuleType
from typing import Any, NamedTuple

import pytest
from ai_web_feeds.models import ArticleEntry, FeedSource, Subtopic
from ai_web_feeds.storage import DatabaseManager
from loguru import logger
from sqlmodel import select

_JOB_MODULE = "ai_web_feeds.nlp.jobs.topic_job"
_MODELER_MODULE = "ai_web_feeds.nlp.topic_modeler"
_MISSING_EXTRA = "optional ml extra is missing"
_DEFAULT_TOPICS = ("Machine Learning", "AI", "Deep Learning")
_COUNTERS = ("topics_processed", "subtopics_discovered", "articles_analyzed", "failed")
_WEIGHT_ROOTS = frozenset(
    {
        "bertopic",
        "huggingface_hub",
        "sentence_transformers",
        "spacy",
        "torch",
        "transformers",
    }
)
_SOURCE_ID = "topic-source"
_PUBLISHED = datetime(2024, 6, 1, tzinfo=UTC)


class LoadedJob(NamedTuple):
    """Topic job module plus the names its import loaded."""

    module: ModuleType
    imported: frozenset[str]


class _Discovered:
    """Shape TopicModelingJob reads off each modeler result."""

    def __init__(
        self,
        name: str,
        keywords: tuple[str, ...],
        coherence_score: float,
        article_count: int,
    ) -> None:
        self.name = name
        self.keywords = keywords
        self.coherence_score = coherence_score
        self.article_count = article_count


def _refuse_network(*_args: object, **_kwargs: object) -> None:
    message = "topic job opened a network socket"
    raise AssertionError(message)


def _block_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(socket, "create_connection", _refuse_network)
    monkeypatch.setattr(socket, "getaddrinfo", _refuse_network)
    monkeypatch.setattr(urllib.request, "urlopen", _refuse_network)
    monkeypatch.setattr(http.client.HTTPConnection, "request", _refuse_network)
    monkeypatch.setattr(http.client.HTTPConnection, "connect", _refuse_network)
    monkeypatch.setattr(http.client.HTTPSConnection, "request", _refuse_network)
    monkeypatch.setattr(http.client.HTTPSConnection, "connect", _refuse_network)


def _weight_imports(imported: frozenset[str]) -> list[str]:
    found: list[str] = []
    for name in imported:
        root = name.split(".", 1)[0]
        if (
            root in _WEIGHT_ROOTS
            or name == "gensim.downloader"
            or name.startswith("gensim.downloader.")
        ):
            found.append(name)
    return sorted(found)


@pytest.fixture
def loaded_topic_job(monkeypatch: pytest.MonkeyPatch) -> LoadedJob:
    """Import the job offline. Skip the row when gensim is not installed."""

    pytest.importorskip("gensim", reason="optional ml extra (gensim) is not installed")
    _block_network(monkeypatch)
    already_loaded = _JOB_MODULE in sys.modules
    before = set(sys.modules)
    module = importlib.import_module(_JOB_MODULE)
    imported = frozenset() if already_loaded else frozenset(set(sys.modules) - before)
    return LoadedJob(module, imported)


def _database(tmp_path: Path) -> DatabaseManager:
    return DatabaseManager(f"sqlite:///{tmp_path / 'topic-job.db'}")


def _job(loaded: LoadedJob, db: DatabaseManager) -> Any:
    job_cls: Any = loaded.module.TopicModelingJob
    return job_cls(db_manager=db)


def _insert(db: DatabaseManager, articles: list[tuple[str, str | None, str | None, bool]]) -> None:
    db.add_feed_source(
        FeedSource(
            id=_SOURCE_ID,
            title="Topic Source",
            feed="https://example.com/feed.xml",
            site="https://example.com",
        )
    )
    with db.get_session() as session:
        for index, (guid, html, summary, processed) in enumerate(articles):
            session.add(
                ArticleEntry(
                    feed_id=_SOURCE_ID,
                    guid=guid,
                    link=f"https://example.com/articles/{index}",
                    title=guid,
                    summary=summary,
                    content_html=html,
                    pub_date=_PUBLISHED,
                    topics_processed=processed,
                )
            )
        session.commit()


def _assert_counters(stats: dict[str, Any], **expected: int) -> None:
    assert set(stats) == {
        "topics_processed",
        "subtopics_discovered",
        "articles_analyzed",
        "failed",
        "duration_seconds",
    }
    for key in _COUNTERS:
        assert stats[key] == expected.get(key, 0)
    duration = stats["duration_seconds"]
    assert isinstance(duration, float)
    assert duration >= 0


def _flags(db: DatabaseManager) -> dict[str, bool]:
    with db.get_session() as session:
        rows = session.exec(select(ArticleEntry)).all()
        return {row.guid: row.topics_processed for row in rows}


@pytest.mark.unit
def test_import_empty_run_stays_offline(
    loaded_topic_job: LoadedJob,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty run returns the current stat keys and does not load weight packages."""

    job_cls: Any = loaded_topic_job.module.TopicModelingJob
    signature = inspect.signature(job_cls.run)
    assert tuple(signature.parameters) == ("self", "topic", "force", "min_articles")
    assert signature.parameters["topic"].default is None
    assert signature.parameters["force"].default is False
    assert signature.parameters["min_articles"].default == 10
    assert _weight_imports(loaded_topic_job.imported) == []
    assert "gensim.downloader" not in sys.modules

    def _unexpected(*_args: object, **_kwargs: object) -> list[object]:
        message = "discover_subtopics called"
        raise AssertionError(message)

    with _database(tmp_path) as db:
        db.create_db_and_tables()
        job = _job(loaded_topic_job, db)
        monkeypatch.setattr(job.modeler, "discover_subtopics", _unexpected)
        stats = job.run()

    _assert_counters(stats)


@pytest.mark.unit
def test_below_minimum_skips_topic_without_failure(
    loaded_topic_job: LoadedJob,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Too few unprocessed articles skips every default topic and leaves rows alone."""

    def _unexpected(*_args: object, **_kwargs: object) -> list[object]:
        message = "discover_subtopics called"
        raise AssertionError(message)

    with _database(tmp_path) as db:
        db.create_db_and_tables()
        _insert(
            db,
            [
                ("pending", "<p>body</p>", "summary", False),
                ("done-1", "<p>done</p>", "done", True),
                ("done-2", "<p>done</p>", "done", True),
            ],
        )
        job = _job(loaded_topic_job, db)
        monkeypatch.setattr(job.modeler, "discover_subtopics", _unexpected)
        stats = job.run(min_articles=2)
        flags = _flags(db)

    _assert_counters(stats)
    assert flags == {"pending": False, "done-1": True, "done-2": True}


@pytest.mark.unit
def test_explicit_topic_persists_subtopics_and_content_fallback(
    loaded_topic_job: LoadedJob,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One named topic stores modeler results and marks only the unprocessed rows."""

    seen: list[tuple[str, int, dict[str, str]]] = []

    def _discover(
        parent: str,
        articles: list[dict[str, Any]],
        num_topics: int = 5,
    ) -> list[_Discovered]:
        seen.append(
            (
                parent,
                num_topics,
                {str(article["title"]): str(article["content"]) for article in articles},
            )
        )
        return [
            _Discovered("Sub A", ("alpha", "beta"), 0.5, 4),
            _Discovered("Sub B", ("gamma",), 1.0, 2),
        ]

    with _database(tmp_path) as db:
        db.create_db_and_tables()
        _insert(
            db,
            [
                ("g-html", "<p>html</p>", "summary", False),
                ("g-summary", None, "only summary", False),
                ("g-blank", None, None, False),
                ("g-done", "<p>done</p>", "done", True),
            ],
        )
        job = _job(loaded_topic_job, db)
        monkeypatch.setattr(job.modeler, "discover_subtopics", _discover)
        stats = job.run(topic="Custom", force=True, min_articles=3)
        flags = _flags(db)
        with db.get_session() as session:
            stored = sorted(session.exec(select(Subtopic)).all(), key=lambda row: row.name)

    _assert_counters(stats, topics_processed=1, subtopics_discovered=2, articles_analyzed=3)
    assert seen == [
        (
            "Custom",
            5,
            {"g-html": "<p>html</p>", "g-summary": "only summary", "g-blank": ""},
        )
    ]
    assert flags == {"g-html": True, "g-summary": True, "g-blank": True, "g-done": True}
    assert [row.name for row in stored] == ["Sub A", "Sub B"]
    assert [row.parent_topic for row in stored] == ["Custom", "Custom"]
    assert [row.keywords for row in stored] == [["alpha", "beta"], ["gamma"]]
    assert [row.article_count for row in stored] == [4, 2]
    assert [row.description for row in stored] == [
        "Auto-discovered subtopic with coherence 0.50",
        "Auto-discovered subtopic with coherence 1.00",
    ]
    assert [row.approved for row in stored] == [False, False]
    assert [row.created_by for row in stored] == ["system", "system"]
    assert all(isinstance(row.id, str) and row.id for row in stored)
    assert all(isinstance(row.detected_at, datetime) for row in stored)


@pytest.mark.unit
def test_default_topics_stop_after_articles_are_marked(
    loaded_topic_job: LoadedJob,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Successful modeling marks articles, so later default topics see none left."""

    parents: list[str] = []

    def _discover(
        parent: str,
        articles: list[dict[str, Any]],
        num_topics: int = 5,
    ) -> list[_Discovered]:
        parents.append(parent)
        assert num_topics == 5
        assert len(articles) == 4
        return [_Discovered("Only", ("ml",), 0.25, 4)]

    with _database(tmp_path) as db:
        db.create_db_and_tables()
        _insert(
            db,
            [(f"g{index}", f"<p>{index}</p>", "summary", False) for index in range(4)],
        )
        job = _job(loaded_topic_job, db)
        monkeypatch.setattr(job.modeler, "discover_subtopics", _discover)
        stats = job.run(min_articles=2)
        flags = _flags(db)
        with db.get_session() as session:
            stored = list(session.exec(select(Subtopic)).all())

    assert parents == ["Machine Learning"]
    _assert_counters(stats, topics_processed=1, subtopics_discovered=1, articles_analyzed=4)
    assert flags == {f"g{index}": True for index in range(4)}
    assert len(stored) == 1
    assert stored[0].parent_topic == "Machine Learning"
    assert stored[0].description == "Auto-discovered subtopic with coherence 0.25"


@pytest.mark.unit
def test_discover_errors_count_failed_and_continue(
    loaded_topic_job: LoadedJob,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A modeler error fails that topic and still attempts the remaining defaults."""

    parents: list[str] = []

    def _boom(
        parent: str,
        articles: list[dict[str, Any]],
        num_topics: int = 5,
    ) -> list[object]:
        parents.append(parent)
        assert num_topics == 5
        assert len(articles) == 2
        message = "discover failed"
        raise RuntimeError(message)

    with _database(tmp_path) as db:
        db.create_db_and_tables()
        _insert(
            db,
            [
                ("a", "<p>a</p>", "a", False),
                ("b", "<p>b</p>", "b", False),
            ],
        )
        job = _job(loaded_topic_job, db)
        monkeypatch.setattr(job.modeler, "discover_subtopics", _boom)
        stats = job.run(min_articles=2)
        flags = _flags(db)
        with db.get_session() as session:
            stored = list(session.exec(select(Subtopic)).all())

    assert parents == list(_DEFAULT_TOPICS)
    _assert_counters(stats, topics_processed=3, articles_analyzed=6, failed=3)
    assert flags == {"a": False, "b": False}
    assert stored == []


@pytest.mark.unit
def test_force_does_not_reopen_processed_articles(
    loaded_topic_job: LoadedJob,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """force is accepted and still ignores articles already marked processed."""

    def _unexpected(*_args: object, **_kwargs: object) -> list[object]:
        message = "discover_subtopics called"
        raise AssertionError(message)

    with _database(tmp_path) as db:
        db.create_db_and_tables()
        _insert(
            db,
            [
                ("done-1", "<p>done</p>", "done", True),
                ("done-2", "<p>done</p>", "done", True),
            ],
        )
        job = _job(loaded_topic_job, db)
        monkeypatch.setattr(job.modeler, "discover_subtopics", _unexpected)
        stats = job.run(topic="Machine Learning", force=True, min_articles=1)
        flags = _flags(db)

    _assert_counters(stats)
    assert flags == {"done-1": True, "done-2": True}


def _drop_cached_module(name: str) -> None:
    """Drop a module so the next import executes it again."""
    sys.modules.pop(name, None)
    parent_name, _, child = name.rpartition(".")
    parent = sys.modules.get(parent_name)
    if parent is not None and child in parent.__dict__:
        del parent.__dict__[child]


def _capture_warnings() -> tuple[int, list[str]]:
    """Record loguru warnings until the caller removes the sink."""
    found: list[str] = []

    def _sink(message: object) -> None:
        found.append(str(message))

    return logger.add(_sink, level="WARNING"), found


def _job_module() -> Any:
    return importlib.import_module(_JOB_MODULE)


def _modeler_module() -> Any:
    return importlib.import_module(_MODELER_MODULE)


@pytest.mark.unit
def test_import_does_not_load_gensim_or_open_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Importing the job and modeler must not import gensim or touch the network."""

    _block_network(monkeypatch)
    _drop_cached_module(_JOB_MODULE)
    _drop_cached_module(_MODELER_MODULE)
    before = set(sys.modules)
    job_module = importlib.import_module(_JOB_MODULE)
    modeler_module = importlib.import_module(_MODELER_MODULE)
    imported = set(sys.modules) - before
    loaded_gensim = sorted(
        name for name in imported if name == "gensim" or name.startswith("gensim.")
    )
    loaded_weights = _weight_imports(frozenset(imported))

    job_init = inspect.signature(job_module.TopicModelingJob.__init__)
    run_signature = inspect.signature(job_module.TopicModelingJob.run)
    modeler_init = inspect.signature(modeler_module.TopicModeler.__init__)
    modeler = modeler_module.TopicModeler()

    assert loaded_gensim == []
    assert loaded_weights == []
    assert "gensim" not in sys.modules
    assert "gensim.downloader" not in sys.modules
    assert tuple(job_init.parameters)[:3] == ("self", "settings", "db_manager")
    assert job_init.parameters["model"].default is None
    assert job_init.parameters["model"].kind is inspect.Parameter.KEYWORD_ONLY
    assert modeler_init.parameters["model"].default is None
    assert modeler_init.parameters["model"].kind is inspect.Parameter.KEYWORD_ONLY
    assert tuple(run_signature.parameters) == ("self", "batch_size", "force")
    assert run_signature.parameters["batch_size"].default is None
    assert run_signature.parameters["force"].default is False
    assert modeler.model is None


@pytest.mark.unit
def test_empty_run_returns_zero_stats(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No stored articles returns zero counters and does not score."""

    _block_network(monkeypatch)
    job_cls = _job_module().TopicModelingJob
    with _database(tmp_path) as db:
        db.create_db_and_tables()
        job = job_cls(db_manager=db)
        stats = job.run()

    assert stats == {
        "processed": 0,
        "skipped": 0,
        "topics_processed": 0,
        "subtopics_discovered": 0,
        "articles_analyzed": 0,
        "failed": 0,
        "duration_seconds": 0.0,
    }


@pytest.mark.unit
def test_missing_ml_extra_skips_row_and_logs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Without gensim, each stored row is skipped, logged, and left unprocessed."""

    if importlib.util.find_spec("gensim") is not None:
        pytest.skip("gensim is installed; missing-extra path is covered by the injected model")

    _block_network(monkeypatch)
    job_cls = _job_module().TopicModelingJob
    sink_id, warnings = _capture_warnings()
    try:
        with _database(tmp_path) as db:
            db.create_db_and_tables()
            _insert(db, [("pending", "<p>stored body</p>", "stored summary", False)])
            job = job_cls(db_manager=db)
            stats = job.run(batch_size=10, force=False)
            flags = _flags(db)
            with db.get_session() as session:
                stored = list(session.exec(select(Subtopic)).all())
                article = session.exec(select(ArticleEntry)).one()
                failure = article.last_failure_reason
    finally:
        logger.remove(sink_id)

    assert stats["processed"] == 1
    assert stats["skipped"] == 1
    assert stats["failed"] == 0
    assert stats["topics_processed"] == 0
    assert stats["subtopics_discovered"] == 0
    assert stats["articles_analyzed"] == 0
    assert stats["duration_seconds"] >= 0
    assert flags == {"pending": False}
    assert failure is None
    assert stored == []
    assert any(_MISSING_EXTRA in message for message in warnings)
    assert "gensim" not in sys.modules


@pytest.mark.unit
def test_injected_model_scores_stored_text_only(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An injected model scores database text and does not load gensim."""

    _block_network(monkeypatch)
    seen: list[str] = []

    def _model(text: str) -> list[dict[str, object]]:
        seen.append(text)
        return [
            {
                "name": "Stored Topic",
                "keywords": ["stored", "body"],
                "coherence_score": 0.8,
                "article_count": 1,
            }
        ]

    job_cls = _job_module().TopicModelingJob
    modeler_cls = _modeler_module().TopicModeler
    direct = modeler_cls(model=_model)
    direct_rows = direct.discover_subtopics(
        "Ignored",
        [
            {
                "title": "Direct",
                "summary": "direct-summary",
                "content": "<p>direct-body</p>",
                "link": "https://example.com/do-not-fetch",
            }
        ],
        num_topics=3,
    )
    assert [row.name for row in direct_rows] == ["Stored Topic"]
    assert seen == ["Direct direct-summary <p>direct-body</p>"]
    assert "https://example.com/do-not-fetch" not in seen[0]
    seen.clear()

    with _database(tmp_path) as db:
        db.create_db_and_tables()
        _insert(
            db,
            [
                ("scored", "<p>stored-body</p>", "stored-summary", False),
                ("done", "<p>done</p>", "done", True),
            ],
        )
        job = job_cls(db_manager=db, model=_model)
        assert job.modeler.model is _model
        stats = job.run(batch_size=10, force=False)
        flags = _flags(db)
        with db.get_session() as session:
            stored = list(session.exec(select(Subtopic)).all())

    assert stats["processed"] == 1
    assert stats["skipped"] == 0
    assert stats["failed"] == 0
    assert stats["articles_analyzed"] == 1
    assert stats["subtopics_discovered"] == 1
    assert flags == {"scored": True, "done": True}
    assert len(seen) == 1
    assert "scored" in seen[0]
    assert "stored-summary" in seen[0]
    assert "<p>stored-body</p>" in seen[0]
    assert "https://example.com/articles" not in seen[0]
    assert len(stored) == 1
    assert stored[0].name == "Stored Topic"
    assert stored[0].parent_topic == "general"
    assert stored[0].keywords == ["stored", "body"]
    assert stored[0].article_count == 1
    assert stored[0].description == "Auto-discovered subtopic with coherence 0.80"
    assert stored[0].approved is False
    assert stored[0].created_by == "system"
    assert "gensim" not in sys.modules


@pytest.mark.unit
def test_import_error_skips_one_row_and_continues(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A missing extra on one row does not fail the job or skip the next row."""

    _block_network(monkeypatch)

    def _model(text: str) -> list[dict[str, object]]:
        if "skip-marker" in text:
            message = "No module named 'gensim'"
            raise ImportError(message)
        return [
            {
                "name": "Kept",
                "keywords": ["kept"],
                "coherence_score": 1.0,
                "article_count": 2,
            }
        ]

    job_cls = _job_module().TopicModelingJob
    sink_id, warnings = _capture_warnings()
    try:
        with _database(tmp_path) as db:
            db.create_db_and_tables()
            _insert(
                db,
                [
                    ("skip-row", "<p>skip-marker</p>", "skip-marker", False),
                    ("keep-row", "<p>keep-marker</p>", "keep-marker", False),
                ],
            )
            job = job_cls(db_manager=db, model=_model)
            stats = job.run(batch_size=10, force=False)
            flags = _flags(db)
            with db.get_session() as session:
                rows = list(session.exec(select(ArticleEntry)).all())
                failures = {row.guid: row.last_failure_reason for row in rows}
                stored = list(session.exec(select(Subtopic)).all())
    finally:
        logger.remove(sink_id)

    assert stats["processed"] == 2
    assert stats["skipped"] == 1
    assert stats["failed"] == 0
    assert stats["articles_analyzed"] == 1
    assert stats["subtopics_discovered"] == 1
    assert flags == {"skip-row": False, "keep-row": True}
    assert failures == {"skip-row": None, "keep-row": None}
    assert [row.name for row in stored] == ["Kept"]
    assert any(_MISSING_EXTRA in message for message in warnings)
