"""Batch job for topic modeling (Phase 5D).

Importing this module does not import gensim, download weights, or open a
network connection. Pass ``model`` to score stored article text. A missing
optional ml extra skips each row and logs; it does not fail the job.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import ArticleEntry, Subtopic
from ai_web_feeds.nlp.topic_modeler import TopicModel, TopicModeler
from ai_web_feeds.storage import DatabaseManager

_DEFAULT_BATCH_SIZE = 100
_MIN_ARTICLES = 10


def _utc_now() -> datetime:
    """Return the current UTC timestamp as a timezone-aware datetime."""
    return datetime.now(UTC)


class TopicModelingJob:
    """Batch process articles for topic modeling and subtopic discovery.

    Groups articles by parent topic, discovers subtopics using LDA,
    and stores results for hierarchical taxonomy and evolution tracking.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        db_manager: DatabaseManager | None = None,
        *,
        model: TopicModel | None = None,
    ):
        """Initialize topic modeling job.

        Args:
            settings: Application settings (uses defaults if None)
            db_manager: Database holding stored article text
            model: Injected scorer forwarded to the modeler. When omitted, the
                modeler loads gensim at run time. A missing extra skips rows.
        """
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.model = model
        self.modeler = TopicModeler(self.settings, model=model)
        self.db_manager = db_manager or DatabaseManager(self.settings.database_url)

    def run(self, batch_size: int | None = None, force: bool = False) -> dict[str, Any]:
        """Score a batch of stored articles.

        Args:
            batch_size: Number of articles to process. Defaults to 100.
            force: If True, include articles already marked processed.

        Returns:
            Dict with processed, skipped, failed, topic counters, and duration.
        """
        start_time = _utc_now()
        limit = batch_size if batch_size is not None else _DEFAULT_BATCH_SIZE
        stats = _empty_stats()

        logger.info(f"Starting topic modeling batch job (batch_size={limit}, force={force})")

        with self.db_manager.get_session() as session:
            query = select(ArticleEntry)
            if not force:
                query = query.where(ArticleEntry.topics_processed.is_(False))
            query = query.order_by(ArticleEntry.id).limit(limit)
            articles = list(session.exec(query).all())

            if not articles:
                logger.info("No articles to process")
                return stats

            if self.modeler.model is None:
                self._run_gensim(session, articles, stats)
            else:
                self._run_injected(session, articles, stats)

            session.commit()

        stats["duration_seconds"] = (_utc_now() - start_time).total_seconds()
        logger.info(
            "Topic modeling batch job completed: "
            f"processed={stats['processed']}, skipped={stats['skipped']}, "
            f"topics={stats['topics_processed']}, subtopics={stats['subtopics_discovered']}, "
            f"articles={stats['articles_analyzed']}, failed={stats['failed']}, "
            f"duration={stats['duration_seconds']:.2f}s"
        )
        return stats

    def _run_gensim(
        self,
        session: Session,
        articles: list[ArticleEntry],
        stats: dict[str, Any],
    ) -> None:
        """Train LDA on stored text, or skip every row when gensim is absent."""
        try:
            self.modeler.ensure_ml()
        except ImportError as exc:
            for article in articles:
                stats["processed"] += 1
                _skip_missing(stats, article.id, exc)
            return

        grouped: dict[str, list[ArticleEntry]] = {}
        for article in articles:
            grouped.setdefault(_parent_topic(article), []).append(article)

        for parent_topic, group in grouped.items():
            stats["processed"] += len(group)
            if len(group) < _MIN_ARTICLES:
                logger.info(
                    f"Skipping '{parent_topic}': insufficient articles "
                    f"({len(group)} < {_MIN_ARTICLES})"
                )
                continue
            try:
                article_dicts = [_article_dict(article) for article in group]
                subtopics = self.modeler.discover_subtopics(
                    parent_topic, article_dicts, num_topics=5
                )
            except ImportError as exc:
                for article in group:
                    _skip_missing(stats, article.id, exc)
                continue
            except Exception as exc:
                stats["failed"] += 1
                logger.error(f"Failed to process topic '{parent_topic}': {exc}")
                for article in group:
                    article.last_failure_reason = f"topic_modeling: {exc}"
                    session.add(article)
                continue

            _store_subtopics(session, parent_topic, subtopics, stats)
            for article in group:
                article.topics_processed = True
                session.add(article)
            stats["topics_processed"] += 1
            stats["articles_analyzed"] += len(group)
            logger.info(
                f"Discovered {len(subtopics)} subtopics for '{parent_topic}' "
                f"from {len(group)} articles"
            )

    def _run_injected(
        self,
        session: Session,
        articles: list[ArticleEntry],
        stats: dict[str, Any],
    ) -> None:
        """Score each stored row with the injected model."""
        for article in articles:
            stats["processed"] += 1
            article_dict = _article_dict(article)
            parent_topic = str(article_dict["topic"])
            try:
                subtopics = self.modeler.score_stored(article_dict)
            except ImportError as exc:
                _skip_missing(stats, article.id, exc)
                continue
            except Exception as exc:
                stats["failed"] += 1
                logger.error(f"Failed to score article {article.id}: {exc}")
                article.last_failure_reason = f"topic_modeling: {exc}"
                session.add(article)
                continue

            _store_subtopics(session, parent_topic, subtopics, stats)
            article.topics_processed = True
            session.add(article)
            stats["topics_processed"] += 1
            stats["articles_analyzed"] += 1


def _empty_stats() -> dict[str, Any]:
    """Return a zeroed job result. Duration stays 0 until the run finishes."""
    return {
        "processed": 0,
        "skipped": 0,
        "topics_processed": 0,
        "subtopics_discovered": 0,
        "articles_analyzed": 0,
        "failed": 0,
        "duration_seconds": 0.0,
    }


def _skip_missing(stats: dict[str, Any], article_id: object, exc: BaseException) -> None:
    """Count one row as skipped and log the missing optional extra."""
    stats["skipped"] += 1
    logger.warning(f"Skipping article {article_id}; optional ml extra is missing: {exc}")


def _parent_topic(article: ArticleEntry) -> str:
    """Use the article's stored topic label, otherwise a generic parent."""
    topics = article.topics or []
    if topics:
        return str(topics[0])
    return "general"


def _article_dict(article: ArticleEntry) -> dict[str, Any]:
    """Copy stored text fields. The article URL is not scored."""
    return {
        "id": article.id,
        "title": article.title,
        "content": article.content_html or article.summary or "",
        "summary": article.summary,
        "topic": _parent_topic(article),
    }


def _store_subtopics(
    session: Session,
    parent_topic: str,
    subtopics: list[Any],
    stats: dict[str, Any],
) -> None:
    """Persist discovered subtopics for one parent topic."""
    for discovered in subtopics:
        session.add(
            Subtopic(
                id=str(uuid4()),
                parent_topic=parent_topic,
                name=discovered.name,
                keywords=list(discovered.keywords),
                description=(
                    f"Auto-discovered subtopic with coherence {discovered.coherence_score:.2f}"
                ),
                article_count=discovered.article_count,
                detected_at=_utc_now(),
                approved=False,
                created_by="system",
            )
        )
        stats["subtopics_discovered"] += 1
