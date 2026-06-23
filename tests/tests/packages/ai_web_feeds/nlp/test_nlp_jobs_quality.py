"""Unit tests for NLP quality job (Spec 005 TODOs)."""

from unittest.mock import MagicMock, patch

import pytest
from ai_web_feeds.nlp.jobs.quality_job import QualityBatchJob
from ai_web_feeds.nlp.quality_scorer import QualityScorer


class TestQualityJobAuthorDetailAndJson:
    """Tests for author_detail extraction and JSON field update logic."""

    @pytest.fixture
    def mock_settings(self):
        settings = MagicMock()
        settings.phase5.quality_batch_size = 10
        settings.phase5.quality_min_words = 1
        settings.database_url = "sqlite:///:memory:"
        return settings

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        # Support context manager for get_session
        session = MagicMock()
        session.exec.return_value.all.return_value = []
        cm = MagicMock()
        cm.__enter__.return_value = session
        cm.__exit__.return_value = False
        db.get_session.return_value = cm
        db.get_feed_source.return_value = None
        db.get_enrichment_data.return_value = None
        return db

    def test_extract_author_detail_from_feed_contributor(self, mock_settings, mock_db):
        """Extract author_detail from feed contributor (feed metadata)."""
        job = QualityBatchJob(settings=mock_settings, db_manager=mock_db)

        # Mock a feed source with contributor
        feed = MagicMock()
        feed.id = "test-feed"
        feed.contributor = "Dr. Jane Doe"
        feed.site = "https://example.com"
        feed.url = None
        mock_db.get_feed_source.return_value = feed
        mock_db.get_enrichment_data.return_value = None

        # We test the internal logic by patching run's query results
        article = MagicMock()
        article.id = 42
        article.title = "Test"
        article.content_html = "word " * 200  # enough words
        article.summary = None
        article.link = "https://ex.com/a"
        article.feed_id = "test-feed"
        article.author = "Jane"
        article.quality_processed = False
        article.nlp_failures = {}

        # Setup session to return the article
        session = mock_db.get_session.return_value.__enter__.return_value
        session.exec.return_value.all.return_value = [article]

        # Mock scorer to avoid real work and return success
        with patch.object(job, "scorer") as mock_scorer:
            mock_result = MagicMock()
            mock_result.overall_score = 80
            mock_result.depth_score = 70
            mock_result.reference_score = 60
            mock_result.author_score = 50
            mock_result.domain_score = 60
            mock_result.engagement_score = 40
            mock_scorer.score_article.return_value = mock_result

            stats = job.run(batch_size=1)

            assert stats["scored"] == 1
            # Verify author_detail was passed
            call_args = mock_scorer.score_article.call_args[0][0]
            assert call_args["author_detail"] is not None
            assert call_args["author_detail"].get("name") == "Dr. Jane Doe"
            assert call_args["author_detail"].get("href") == "https://example.com"

    def test_extract_author_detail_from_enrichment(self, mock_settings, mock_db):
        """Fallback to enrichment discovered_author for author_detail."""
        job = QualityBatchJob(settings=mock_settings, db_manager=mock_db)

        mock_db.get_feed_source.return_value = None
        enrich = MagicMock()
        enrich.discovered_author = "Prof. John Smith"
        mock_db.get_enrichment_data.return_value = enrich

        article = MagicMock()
        article.id = 43
        article.title = "T2"
        article.content_html = "content " * 150
        article.summary = None
        article.link = "u"
        article.feed_id = "f"
        article.author = None
        article.quality_processed = False

        session = mock_db.get_session.return_value.__enter__.return_value
        session.exec.return_value.all.return_value = [article]

        with patch.object(job, "scorer") as mock_scorer:
            mock_result = MagicMock()
            mock_result.overall_score = 75
            mock_result.depth_score = 70
            mock_result.reference_score = 50
            mock_result.author_score = 40
            mock_result.domain_score = 50
            mock_result.engagement_score = 30
            mock_scorer.score_article.return_value = mock_result

            job.run(batch_size=1)

            call_args = mock_scorer.score_article.call_args[0][0]
            assert call_args["author_detail"] == {"name": "Prof. John Smith"}

    def test_json_nlp_failures_update_on_error(self, mock_settings, mock_db):
        """On scoring failure, nlp_failures counter is incremented via proper merge."""
        job = QualityBatchJob(settings=mock_settings, db_manager=mock_db)

        article = MagicMock()
        article.id = 99
        article.title = "Bad"
        article.content_html = "short"  # will be skipped? wait, use scorer to raise
        article.summary = None
        article.link = "u"
        article.feed_id = "f"
        article.author = None
        article.quality_processed = False
        article.nlp_failures = {"other": 1}
        article.last_failure_reason = None

        session = mock_db.get_session.return_value.__enter__.return_value
        session.exec.return_value.all.return_value = [article]

        with patch.object(job, "scorer") as mock_scorer:
            mock_scorer.score_article.side_effect = RuntimeError("boom")

            stats = job.run(batch_size=1, force=False)

            assert stats["failed"] == 1
            # The json logic should have run
            assert article.last_failure_reason and "quality_scoring" in article.last_failure_reason
            # nlp_failures reassigned
            assert article.nlp_failures.get("quality_scoring") == 1
            assert article.nlp_failures.get("other") == 1  # preserved
            session.add.assert_called()  # at least called

    def test_quality_job_passes_feed_dict(self, mock_settings, mock_db):
        """Ensure feed metadata is passed to scorer for domain score."""
        job = QualityBatchJob(settings=mock_settings, db_manager=mock_db)

        feed = MagicMock()
        feed.quality_score = 88
        mock_db.get_feed_source.return_value = feed
        mock_db.get_enrichment_data.return_value = None

        article = MagicMock()
        article.id = 7
        article.title = "FeedTest"
        article.content_html = "w " * 120
        article.summary = None
        article.link = "u"
        article.feed_id = "ff"
        article.author = None
        article.quality_processed = False

        session = mock_db.get_session.return_value.__enter__.return_value
        session.exec.return_value.all.return_value = [article]

        with patch.object(job, "scorer") as mock_scorer:
            mock_result = MagicMock()
            for k in ["overall_score", "depth_score", "reference_score", "author_score", "domain_score", "engagement_score"]:
                setattr(mock_result, k, 60)
            mock_scorer.score_article.return_value = mock_result

            job.run(batch_size=1)

            # second arg should be the feed kw
            call_kwargs = mock_scorer.score_article.call_args[1]
            assert call_kwargs.get("feed") is not None
            assert call_kwargs["feed"].get("quality_score") == 88
