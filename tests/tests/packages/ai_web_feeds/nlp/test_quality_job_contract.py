"""Contract for the quality batch job.

Importing and running the job must not download model weights or open the
network. The model is injected. Heuristics score stored rows when no model is
injected. An import error while scoring means the optional ml extra is missing:
the row is skipped, logged, and left retryable. An exception that escapes
``score_article`` is a failure, not a skip. Share counts and author h-index
are not quality signals.
"""

from __future__ import annotations

import builtins
import importlib
import inspect
import socket
import sys
import urllib.request
from collections.abc import Iterator, Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast
from unittest.mock import MagicMock, patch

import pytest
from ai_web_feeds.config import Settings
from ai_web_feeds.models import ArticleEntry, ArticleQualityScore, FeedEnrichmentData, FeedSource
from ai_web_feeds.nlp.quality_scorer import QualityScoreComponents, QualityScorer
from ai_web_feeds.storage import DatabaseManager
from loguru import logger
from sqlmodel import select

_OPTIONAL_ML = frozenset(
    {
        "bertopic",
        "gensim",
        "huggingface_hub",
        "nltk",
        "sentence_transformers",
        "spacy",
        "torch",
        "transformers",
    }
)
_WEIGHT_MARKERS = (
    "from_pretrained",
    "hf_hub_download",
    "nltk.download",
    "snapshot_download",
    "spacy.load",
    "torch.hub",
    "urllib.request",
)


def _settings() -> Settings:
    """Settings that cannot point the job at the developer database."""
    settings = Settings(database_url="sqlite:///:memory:")
    settings.phase5.quality_min_words = 100
    settings.phase5.quality_batch_size = 10
    return settings


def _words(count: int) -> str:
    return " ".join(["word"] * count)


def _source(
    feed_id: str,
    *,
    contributor: str | None = None,
    site: str | None = None,
    url: str | None = None,
    quality_score: float | None = None,
) -> FeedSource:
    return FeedSource(
        id=feed_id,
        title=f"Feed {feed_id}",
        contributor=contributor,
        site=site,
        url=url,
        quality_score=quality_score,
    )


def _article_payload(captured: dict[str, object]) -> dict[str, Any]:
    """Return the article dict passed into the scorer."""
    article = captured["article"]
    if not isinstance(article, dict):
        message = "scorer article payload was not a dict"
        raise AssertionError(message)
    return cast(dict[str, Any], article)


def _article(
    feed_id: str,
    guid: str,
    *,
    words: int = 200,
    author: str | None = "Ada Lovelace",
    content_html: str | None = None,
    summary: str | None = None,
    quality_processed: bool = False,
    nlp_failures: dict[str, int] | None = None,
) -> ArticleEntry:
    return ArticleEntry(
        feed_id=feed_id,
        guid=guid,
        title=f"Article {guid}",
        link=f"https://example.com/{guid}",
        pub_date=datetime(2024, 6, 1, tzinfo=UTC),
        author=author,
        content_html=_words(words) if content_html is None else content_html,
        summary=summary,
        quality_processed=quality_processed,
        nlp_failures={} if nlp_failures is None else nlp_failures,
    )


def _insert(
    db: DatabaseManager,
    article: ArticleEntry,
    source: FeedSource | None = None,
    enrichment: FeedEnrichmentData | None = None,
) -> int:
    with db.get_session() as session:
        if source is not None:
            session.add(source)
        if enrichment is not None:
            session.add(enrichment)
        session.add(article)
        session.commit()
        session.refresh(article)
        article_id = article.id
    if article_id is None:
        message = "article id was not assigned"
        raise RuntimeError(message)
    return article_id


def _stored(
    db: DatabaseManager, article_id: int
) -> tuple[ArticleEntry, ArticleQualityScore | None]:
    with db.get_session() as session:
        article = session.get(ArticleEntry, article_id)
        score = session.get(ArticleQualityScore, article_id)
        if article is None:
            message = f"article {article_id} disappeared"
            raise AssertionError(message)
        session.expunge(article)
        if score is not None:
            session.expunge(score)
    return article, score


def _score_rows(db: DatabaseManager) -> int:
    with db.get_session() as session:
        return len(session.exec(select(ArticleQualityScore)).all())


@pytest.fixture(autouse=True)
def _no_live_http(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail if the quality job resolves a host or opens a client socket."""

    def _refuse(channel: str):
        def _blocked(*_args: object, **_kwargs: object) -> None:
            message = f"quality job opened the network via {channel}"
            raise AssertionError(message)

        return _blocked

    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("HF_HUB_DISABLE_TELEMETRY", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
    monkeypatch.setattr(socket, "create_connection", _refuse("socket.create_connection"))
    monkeypatch.setattr(socket, "getaddrinfo", _refuse("socket.getaddrinfo"))
    monkeypatch.setattr(urllib.request, "urlopen", _refuse("urllib.request.urlopen"))


@pytest.fixture
def db(tmp_path: Path) -> Iterator[DatabaseManager]:
    manager = DatabaseManager(f"sqlite:///{tmp_path / 'quality.db'}")
    manager.create_db_and_tables()
    try:
        yield manager
    finally:
        manager.close()


def _job(db: DatabaseManager, settings: Settings | None = None):
    from ai_web_feeds.nlp.jobs.quality_job import QualityBatchJob

    return QualityBatchJob(settings=settings or _settings(), db_manager=db)


@pytest.mark.unit
def test_import_does_not_download_weights() -> None:
    """Importing the job must not pull ML stacks or weight-download APIs."""
    before = set(sys.modules)
    quality_job = importlib.import_module("ai_web_feeds.nlp.jobs.quality_job")
    reloaded = importlib.reload(quality_job)
    added = set(sys.modules) - before
    loaded_ml = sorted(
        name for name in added if name in _OPTIONAL_ML or name.split(".", 1)[0] in _OPTIONAL_ML
    )
    assert loaded_ml == []

    scorer_module = importlib.import_module("ai_web_feeds.nlp.quality_scorer")
    source = inspect.getsource(reloaded) + inspect.getsource(scorer_module)
    for marker in _WEIGHT_MARKERS:
        assert marker not in source
    assert "share_count" not in source
    assert "h_index" not in source
    assert "h-index" not in source

    job = reloaded.QualityBatchJob(settings=_settings(), db_manager=MagicMock())
    assert job.model is None
    assert isinstance(job.scorer, QualityScorer)
    assert job.scorer.model is None
    assert job.scorer.min_words == 100
    assert job.scorer.WEIGHTS == {
        "depth": 0.35,
        "reference": 0.20,
        "author": 0.15,
        "domain": 0.20,
        "engagement": 0.10,
    }


@pytest.mark.unit
def test_empty_batch_returns_zero_stats_without_commit(
    db: DatabaseManager, monkeypatch: pytest.MonkeyPatch
) -> None:
    """No articles: zero counters, duration left at 0, and no commit."""
    commits: list[bool] = []
    real_get_session = db.get_session

    def _track_session():
        session = real_get_session()
        original_commit = session.commit

        def _commit() -> None:
            commits.append(True)
            original_commit()

        session.commit = cast(Any, _commit)
        return session

    monkeypatch.setattr(db, "get_session", _track_session)
    stats = _job(db).run(batch_size=4)

    assert stats == {
        "processed": 0,
        "scored": 0,
        "skipped": 0,
        "failed": 0,
        "duration_seconds": 0.0,
    }
    assert commits == []


@pytest.mark.unit
def test_long_article_is_scored_with_feed_author_detail(db: DatabaseManager) -> None:
    """Contributor name and site become author_detail; missing feed quality is 50."""
    article_id = _insert(
        db,
        _article("feed-score", "long"),
        _source(
            "feed-score",
            contributor="Dr. Jane Doe",
            site="https://example.com",
            url="https://feeds.example.com/rss",
        ),
    )
    job = _job(db)
    captured: dict[str, object] = {}
    real_score = job.scorer.score_article

    def _spy(article: dict, feed: dict | None = None):
        captured["article"] = article
        captured["feed"] = feed
        return real_score(article, feed=feed)

    with patch.object(job.scorer, "score_article", side_effect=_spy):
        stats = job.run(batch_size=5)

    stored, score = _stored(db, article_id)
    assert stats["processed"] == 1
    assert stats["scored"] == 1
    assert stats["skipped"] == 0
    assert stats["failed"] == 0
    assert stats["duration_seconds"] >= 0
    assert stored.quality_processed is True
    assert stored.quality_processed_at is not None
    assert captured["feed"] == {"quality_score": 50}
    article_payload = _article_payload(captured)
    assert article_payload["author_detail"] == {
        "name": "Dr. Jane Doe",
        "href": "https://example.com",
    }
    assert article_payload["author"] == "Ada Lovelace"
    assert "share_count" not in article_payload
    assert article_payload["content"] == _words(200)
    assert article_payload["url"] == "https://example.com/long"
    assert score is not None
    assert score.depth_score == 25
    assert score.reference_score == 0
    assert score.author_score == 70
    assert score.domain_score == 50
    assert score.engagement_score == 10
    assert score.overall_score == 30
    assert score.computed_at is not None


@pytest.mark.unit
def test_short_article_is_skipped_and_marked_processed(db: DatabaseManager) -> None:
    """Below quality_min_words the scorer returns None and the row is not retried."""
    article_id = _insert(db, _article("feed-short", "tiny", words=3), _source("feed-short"))

    stats = _job(db).run(batch_size=5)
    stored, score = _stored(db, article_id)

    assert stats == {
        "processed": 1,
        "scored": 0,
        "skipped": 1,
        "failed": 0,
        "duration_seconds": stats["duration_seconds"],
    }
    assert stats["duration_seconds"] >= 0
    assert stored.quality_processed is True
    assert stored.quality_processed_at is not None
    assert stored.last_failure_reason is None
    assert score is None


@pytest.mark.unit
def test_missing_optional_dependency_skips_row(db: DatabaseManager) -> None:
    """ImportError while scoring skips the row and logs it.

    The article stays unprocessed so a later run can score it. It is not a
    failure and no score row is written.
    """
    article_id = _insert(
        db,
        _article("feed-missing", "needs-extra", words=180),
        _source("feed-missing", contributor="Editor"),
    )
    warnings: list[str] = []
    sink = logger.add(lambda message: warnings.append(str(message)), level="WARNING")
    try:
        with patch.object(
            QualityScorer,
            "_score_depth",
            side_effect=ModuleNotFoundError("textstat"),
        ):
            stats = _job(db).run(batch_size=5)
    finally:
        logger.remove(sink)

    stored, score = _stored(db, article_id)
    assert stats["processed"] == 1
    assert stats["scored"] == 0
    assert stats["skipped"] == 1
    assert stats["failed"] == 0
    assert stored.quality_processed is False
    assert stored.quality_processed_at is None
    assert stored.last_failure_reason is None
    assert stored.nlp_failures == {}
    assert score is None
    assert any("optional ml extra is missing" in message for message in warnings)


@pytest.mark.unit
def test_share_counts_and_author_h_index_are_not_scored() -> None:
    """Those signals are out of scope and must not change the heuristic score."""
    scorer = QualityScorer(_settings())
    content = _words(200)
    url = "https://example.com/plain"
    base = scorer.score_article({"content": content, "url": url, "author": "Ada"})
    with_signals = scorer.score_article(
        {
            "content": content,
            "url": url,
            "author": "Ada",
            "share_count": 40,
            "author_detail": {"h_index": 80, "h-index": 80},
        }
    )

    assert base is not None
    assert with_signals is not None
    assert with_signals.author_score == base.author_score == 40
    assert with_signals.engagement_score == base.engagement_score
    assert with_signals.overall_score == base.overall_score


@pytest.mark.unit
def test_injected_model_scores_stored_text(db: DatabaseManager) -> None:
    """An injected model scores the stored row and is not called at import."""
    content = _words(180)
    article_id = _insert(
        db,
        _article("feed-model", "stored", words=180),
        _source("feed-model", contributor="Editor", site="https://example.com"),
    )
    seen: dict[str, object] = {}

    def _model(article: dict, feed: dict | None) -> QualityScoreComponents:
        seen["article"] = article
        seen["feed"] = feed
        return QualityScoreComponents(
            depth_score=11,
            reference_score=12,
            author_score=13,
            domain_score=14,
            engagement_score=15,
            overall_score=16,
        )

    from ai_web_feeds.nlp.jobs.quality_job import QualityBatchJob

    job = QualityBatchJob(settings=_settings(), db_manager=db, model=_model)
    assert job.model is _model
    assert job.scorer.model is _model
    stats = job.run(batch_size=1)
    stored, score = _stored(db, article_id)
    payload = seen["article"]

    assert stats["scored"] == 1
    assert stats["skipped"] == 0
    assert stats["failed"] == 0
    assert stored.quality_processed is True
    assert isinstance(payload, dict)
    article = cast(dict[str, object], payload)
    assert article["content"] == content
    assert "share_count" not in article
    assert seen["feed"] == {"quality_score": 50}
    assert score is not None
    assert score.overall_score == 16
    assert score.depth_score == 11
    assert score.author_score == 13
    assert score.domain_score == 14
    assert score.engagement_score == 15


@pytest.mark.unit
def test_injected_model_missing_extra_skips_and_logs(db: DatabaseManager) -> None:
    """A model that cannot import the ml extra skips the stored row."""
    article_id = _insert(
        db,
        _article("feed-inject", "missing-model", words=160),
        _source("feed-inject"),
    )

    def _model(_article: dict, _feed: dict | None) -> None:
        message = "transformers"
        raise ModuleNotFoundError(message)

    warnings: list[str] = []
    sink = logger.add(lambda message: warnings.append(str(message)), level="WARNING")
    try:
        from ai_web_feeds.nlp.jobs.quality_job import QualityBatchJob

        job = QualityBatchJob(settings=_settings(), db_manager=db, model=_model)
        stats = job.run(batch_size=1)
    finally:
        logger.remove(sink)

    stored, score = _stored(db, article_id)
    assert stats["processed"] == 1
    assert stats["scored"] == 0
    assert stats["skipped"] == 1
    assert stats["failed"] == 0
    assert stored.quality_processed is False
    assert stored.quality_processed_at is None
    assert stored.last_failure_reason is None
    assert score is None
    assert any("optional ml extra is missing" in message for message in warnings)


@pytest.mark.unit
def test_injected_model_none_falls_through_to_heuristics(db: DatabaseManager) -> None:
    """A model that returns None does not replace the heuristic score."""

    def _model(_article: dict, _feed: dict | None) -> None:
        return None

    article_id = _insert(
        db,
        _article("feed-fall", "heuristic", words=200),
        _source("feed-fall", contributor="Dr. Jane Doe", site="https://example.com"),
    )
    from ai_web_feeds.nlp.jobs.quality_job import QualityBatchJob

    stats = QualityBatchJob(settings=_settings(), db_manager=db, model=_model).run(batch_size=1)
    _stored_article, score = _stored(db, article_id)
    assert stats["scored"] == 1
    assert score is not None
    assert score.depth_score == 25
    assert score.author_score == 70
    assert score.engagement_score == 10
    assert score.overall_score == 30


@pytest.mark.unit
def test_blocking_optional_ml_imports_still_scores(
    db: DatabaseManager, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The heuristic job does not import the ml extra while scoring a row."""
    article_id = _insert(db, _article("feed-ml", "plain", words=120), _source("feed-ml"))
    real_import = builtins.__import__

    def _import(
        name: str,
        import_globals: Mapping[str, object] | None = None,
        import_locals: Mapping[str, object] | None = None,
        fromlist: Sequence[str] = (),
        level: int = 0,
    ) -> Any:
        root = name.split(".", 1)[0]
        if root in _OPTIONAL_ML:
            message = f"optional dependency is missing: {name}"
            raise ModuleNotFoundError(message)
        return real_import(name, import_globals, import_locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", _import)
    stats = _job(db).run(batch_size=5)
    stored, score = _stored(db, article_id)

    assert stats["scored"] == 1
    assert stats["skipped"] == 0
    assert stats["failed"] == 0
    assert stored.quality_processed is True
    assert score is not None
    assert score.depth_score == 17


@pytest.mark.unit
def test_fractional_feed_quality_skips_row(db: DatabaseManager) -> None:
    """A 0-1 feed quality that is not a whole number fails score validation.

    The scorer returns None and today's job skips the row instead of failing it.
    """
    article_id = _insert(
        db,
        _article("feed-frac", "fraction"),
        _source("feed-frac", quality_score=0.85),
    )

    stats = _job(db).run(batch_size=5)
    stored, score = _stored(db, article_id)

    assert stats["skipped"] == 1
    assert stats["failed"] == 0
    assert stats["scored"] == 0
    assert stored.quality_processed is True
    assert score is None


@pytest.mark.unit
def test_zero_feed_quality_falls_through_to_neutral_fifty(db: DatabaseManager) -> None:
    """Falsy 0.0 quality is replaced by the hard-coded neutral domain score."""
    article_id = _insert(
        db,
        _article("feed-zero", "zero"),
        _source("feed-zero", quality_score=0.0, contributor="Pat"),
    )
    job = _job(db)
    captured: dict[str, object] = {}
    real_score = job.scorer.score_article

    def _spy(article: dict, feed: dict | None = None):
        captured["feed"] = feed
        return real_score(article, feed=feed)

    with patch.object(job.scorer, "score_article", side_effect=_spy):
        stats = job.run(batch_size=5)

    _stored_article, score = _stored(db, article_id)
    assert stats["scored"] == 1
    assert captured["feed"] == {"quality_score": 50}
    assert score is not None
    assert score.domain_score == 50


@pytest.mark.unit
def test_enrichment_author_and_whole_number_quality(db: DatabaseManager) -> None:
    """Without a contributor, discovered_author is the detail and 1.0 is domain 1."""
    article_id = _insert(
        db,
        _article("feed-enrich", "enriched", author="Grace Hopper"),
        _source("feed-enrich", site="https://example.com", quality_score=0.25),
        FeedEnrichmentData(
            feed_source_id="feed-enrich",
            discovered_author="Prof. John Smith",
            quality_score=1.0,
        ),
    )
    job = _job(db)
    captured: dict[str, object] = {}
    real_score = job.scorer.score_article

    def _spy(article: dict, feed: dict | None = None):
        captured["article"] = article
        captured["feed"] = feed
        return real_score(article, feed=feed)

    with patch.object(job.scorer, "score_article", side_effect=_spy):
        stats = job.run(batch_size=5)

    _stored_article, score = _stored(db, article_id)
    article_payload = _article_payload(captured)
    assert stats["scored"] == 1
    assert article_payload["author_detail"] == {"name": "Prof. John Smith"}
    assert captured["feed"] == {"quality_score": 1.0}
    assert score is not None
    assert score.domain_score == 1
    assert score.author_score == 40


@pytest.mark.unit
def test_empty_html_uses_summary_and_missing_feed_still_scores(db: DatabaseManager) -> None:
    """Blank HTML falls back to summary. No feed row still scores with domain 50."""
    summary = _words(150)
    article_id = _insert(
        db,
        _article(
            "missing-feed",
            "summary-only",
            content_html="",
            summary=summary,
            author=None,
        ),
    )
    job = _job(db)
    captured: dict[str, object] = {}
    real_score = job.scorer.score_article

    def _spy(article: dict, feed: dict | None = None):
        captured["article"] = article
        captured["feed"] = feed
        return real_score(article, feed=feed)

    with patch.object(job.scorer, "score_article", side_effect=_spy):
        stats = job.run(batch_size=5)

    stored, score = _stored(db, article_id)
    article_payload = _article_payload(captured)
    assert stats["scored"] == 1
    assert captured["feed"] is None
    assert article_payload["content"] == summary
    assert article_payload["author_detail"] is None
    assert stored.quality_processed is True
    assert score is not None
    assert score.depth_score == 20
    assert score.author_score == 0
    assert score.domain_score == 50


@pytest.mark.unit
def test_feed_metadata_errors_are_ignored(db: DatabaseManager) -> None:
    """Lookup failures are logged and the article is still scored."""
    article_id = _insert(db, _article("feed-down", "still"), _source("feed-down"))

    class _MetadataDown(DatabaseManager):
        def get_feed_source(self, feed_id: str) -> FeedSource | None:
            message = "feed metadata unavailable"
            raise RuntimeError(message)

        def get_enrichment_data(self, feed_source_id: str) -> FeedEnrichmentData | None:
            message = "enrichment unavailable"
            raise RuntimeError(message)

    down = _MetadataDown(db.database_url)
    try:
        stats = _job(down).run(batch_size=5)
    finally:
        down.close()

    stored, score = _stored(db, article_id)
    assert stats["scored"] == 1
    assert stats["failed"] == 0
    assert stored.quality_processed is True
    assert score is not None
    assert score.domain_score == 50
    assert score.author_score == 40


@pytest.mark.unit
def test_escaped_scoring_error_counts_failure_and_retries(db: DatabaseManager) -> None:
    """An exception from score_article increments nlp_failures and stays unprocessed."""
    article_id = _insert(
        db,
        _article("feed-fail", "bad", nlp_failures={"entities": 2}),
        _source("feed-fail"),
    )
    job = _job(db)

    with patch.object(job.scorer, "score_article", side_effect=RuntimeError("boom")):
        first = job.run(batch_size=5)
        second = job.run(batch_size=5)

    stored, score = _stored(db, article_id)
    assert first["failed"] == 1
    assert first["scored"] == 0
    assert first["skipped"] == 0
    assert second["failed"] == 1
    assert second["processed"] == 1
    assert stored.quality_processed is False
    assert stored.quality_processed_at is None
    assert stored.nlp_failures == {"entities": 2, "quality_scoring": 2}
    assert stored.last_failure_reason == "quality_scoring: boom"
    assert score is None


@pytest.mark.unit
def test_batch_size_limit_and_falsy_batch_size(db: DatabaseManager) -> None:
    """Explicit batch size limits rows. 0 is falsy and falls back to config."""
    for index in range(3):
        _insert(
            db,
            _article("feed-batch", f"item-{index}", words=110),
            _source("feed-batch") if index == 0 else None,
        )

    limited = _job(db).run(batch_size=1)
    assert limited["processed"] == 1
    assert _score_rows(db) == 1

    settings = _settings()
    settings.phase5.quality_batch_size = 2
    fallback = _job(db, settings).run(batch_size=0)
    assert fallback["processed"] == 2
    assert _score_rows(db) == 3


@pytest.mark.unit
def test_unprocessed_filter_and_force_replaces_score(db: DatabaseManager) -> None:
    """force=False ignores processed rows. force=True deletes and rewrites the score."""
    done_id = _insert(
        db,
        _article("feed-force", "done", quality_processed=True),
        _source("feed-force", contributor="Curator", site="https://example.com"),
    )
    fresh_id = _insert(db, _article("feed-force", "fresh", words=200))

    first = _job(db).run(batch_size=10)
    done, done_score = _stored(db, done_id)
    _fresh, fresh_score = _stored(db, fresh_id)
    assert first["processed"] == 1
    assert done.quality_processed is True
    assert done_score is None
    assert fresh_score is not None
    assert fresh_score.overall_score == 30

    with db.get_session() as session:
        fresh_row = session.get(ArticleEntry, fresh_id)
        if fresh_row is None:
            message = "fresh article missing"
            raise AssertionError(message)
        fresh_row.content_html = _words(500)
        session.add(fresh_row)
        session.commit()

    untouched = _job(db).run(batch_size=10, force=False)
    _fresh_again, still_old = _stored(db, fresh_id)
    assert untouched["processed"] == 0
    assert still_old is not None
    assert still_old.overall_score == 30

    replaced = _job(db).run(batch_size=10, force=True)
    _done_again, done_after = _stored(db, done_id)
    _fresh_after, fresh_after = _stored(db, fresh_id)
    assert replaced["processed"] == 2
    assert replaced["scored"] == 2
    assert _score_rows(db) == 2
    assert done_after is not None
    assert fresh_after is not None
    assert fresh_after.depth_score == 55
    assert fresh_after.engagement_score == 25
    assert fresh_after.overall_score == 42
    assert fresh_after.author_score == 70
