"""Regression tests for NLP job/runtime contract alignment."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.jobs.entity_job import EntityBatchJob
from ai_web_feeds.nlp.jobs.quality_job import QualityBatchJob
from ai_web_feeds.nlp.jobs.sentiment_job import SentimentBatchJob
from ai_web_feeds.nlp.jobs.topic_job import TopicModelingJob


def _result(items):
    wrapper = MagicMock()
    wrapper.all.return_value = items
    return wrapper


def _mock_db_session(*exec_results):
    session = MagicMock()
    session.exec.side_effect = list(exec_results)
    db_manager = MagicMock()
    db_manager.get_session.return_value.__enter__.return_value = session
    return db_manager, session


def test_entity_batch_job_imports():
    """EntityBatchJob should import cleanly (including Session type import)."""
    assert EntityBatchJob is not None


def test_quality_job_uses_content_html():
    """Quality job should read FeedEntry.content_html, not removed content."""
    article = SimpleNamespace(
        id=1,
        title="Quality Article",
        content_html="word " * 150,
        summary=None,
        link="https://example.com/a",
        feed_id="feed-1",
        quality_processed=False,
        quality_processed_at=None,
        last_failure_reason=None,
    )
    db_manager, _ = _mock_db_session(_result([article]))
    job = QualityBatchJob(settings=Settings(), db_manager=db_manager)
    job.scorer = MagicMock()
    job.scorer.score_article.return_value = SimpleNamespace(
        overall_score=80,
        depth_score=80,
        reference_score=70,
        author_score=60,
        domain_score=75,
        engagement_score=65,
    )

    stats = job.run(batch_size=1)

    scored_article = job.scorer.score_article.call_args[0][0]
    assert scored_article["content"] == article.content_html
    assert stats["failed"] == 0


def test_entity_job_uses_content_html():
    """Entity job should read FeedEntry.content_html, not removed content."""
    article = SimpleNamespace(
        id=2,
        title="Entity Article",
        content_html="entity-rich text " * 30,
        summary=None,
        entities_processed=False,
        entities_processed_at=None,
        last_failure_reason=None,
    )
    db_manager, _ = _mock_db_session(_result([article]), _result([]))
    with patch("ai_web_feeds.nlp.jobs.entity_job.EntityExtractor") as mock_extractor_cls:
        mock_extractor = MagicMock()
        mock_extractor.extract_entities.return_value = []
        mock_extractor_cls.return_value = mock_extractor
        job = EntityBatchJob(settings=Settings(), db_manager=db_manager)

    stats = job.run(batch_size=1)

    extracted_article = mock_extractor.extract_entities.call_args[0][0]
    assert extracted_article["content"] == article.content_html
    assert stats["failed"] == 0


def test_sentiment_job_uses_content_html():
    """Sentiment job should read FeedEntry.content_html, not removed content."""
    article = SimpleNamespace(
        id=3,
        title="Sentiment Article",
        content_html="sentiment text " * 30,
        summary=None,
        sentiment_processed=False,
        sentiment_processed_at=None,
        last_failure_reason=None,
    )
    db_manager, _ = _mock_db_session(_result([article]))
    job = SentimentBatchJob(settings=Settings(), db_manager=db_manager)
    job.analyzer = MagicMock()
    job.analyzer.analyze_sentiment.return_value = SimpleNamespace(
        sentiment_score=0.7,
        classification="positive",
        model_name="test-model",
        confidence=0.9,
    )

    stats = job.run(batch_size=1)

    analyzed_article = job.analyzer.analyze_sentiment.call_args[0][0]
    assert analyzed_article["content"] == article.content_html
    assert stats["failed"] == 0


def test_topic_job_uses_content_html():
    """Topic job should read FeedEntry.content_html, not removed content."""
    article = SimpleNamespace(
        id=4,
        title="Topic Article",
        content_html="topic text " * 40,
        summary=None,
        topics_processed=False,
    )
    db_manager, _ = _mock_db_session(_result([article]))
    job = TopicModelingJob(settings=Settings(), db_manager=db_manager)
    job.modeler = MagicMock()
    job.modeler.discover_subtopics.return_value = []

    stats = job.run(topic="AI", min_articles=1)

    modeled_articles = job.modeler.discover_subtopics.call_args[0][1]
    modeled_kwargs = job.modeler.discover_subtopics.call_args.kwargs
    assert modeled_articles[0]["content"] == article.content_html
    assert modeled_kwargs["min_articles"] == 1
    assert stats["failed"] == 0
