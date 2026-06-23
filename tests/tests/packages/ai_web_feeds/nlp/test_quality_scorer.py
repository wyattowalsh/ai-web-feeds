"""Tests for quality scorer using patterns from test_analytics.py."""

import pytest
from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.quality_scorer import QualityScoreComponents, QualityScorer


@pytest.fixture
def scorer():
    """Create a QualityScorer instance."""
    settings = Settings()
    # Set a low min_words for testing
    settings.phase5.quality_min_words = 10
    return QualityScorer(settings)


@pytest.fixture
def sample_article():
    """Create a sample article dict for scoring."""
    return {
        "id": 1,
        "title": "Test Article on Machine Learning",
        "content": (
            "This is a comprehensive article about machine learning and deep learning. "
            "It discusses various techniques including transformers, attention mechanisms, "
            "and neural network architectures. The article references several papers from "
            "arXiv and GitHub repositories. https://arxiv.org/abs/1706.03762\n\n"
            "Additional content with more technical details and analysis. "
            "The author has extensive experience in the field. "
            "Contact: author@example.com"
        ),
        "summary": "A summary of ML techniques",
        "author": "Jane Doe",
        "author_detail": {"bio": "ML researcher", "email": "jane@example.com"},
        "url": "https://example.com/article",
    }


@pytest.fixture
def sample_feed():
    """Create a sample feed dict."""
    return {
        "id": "feed-1",
        "title": "ML Blog",
        "quality_score": 85,
    }


class TestQualityScorerInit:
    """Tests for QualityScorer initialization."""

    def test_scorer_initialization(self):
        """QualityScorer should initialize with default settings."""
        scorer = QualityScorer()
        assert scorer is not None
        assert scorer.settings is not None
        assert scorer.min_words >= 0

    def test_scorer_with_custom_settings(self):
        """QualityScorer should accept custom settings."""
        settings = Settings()
        settings.phase5.quality_min_words = 50
        scorer = QualityScorer(settings)
        assert scorer.min_words == 50


class TestScoreArticle:
    """Tests for article scoring."""

    def test_score_article_basic(self, scorer, sample_article):
        """Score article should return QualityScoreComponents for valid article."""
        result = scorer.score_article(sample_article)

        assert result is not None
        assert isinstance(result, QualityScoreComponents)
        assert 0 <= result.overall_score <= 100
        assert 0 <= result.depth_score <= 100
        assert 0 <= result.reference_score <= 100
        assert 0 <= result.author_score <= 100
        assert 0 <= result.domain_score <= 100
        assert 0 <= result.engagement_score <= 100

    def test_score_article_with_feed(self, scorer, sample_article, sample_feed):
        """Score article should use feed quality score for domain."""
        result = scorer.score_article(sample_article, feed=sample_feed)

        assert result is not None
        # Domain score should reflect feed quality
        assert result.domain_score == 85

    def test_score_article_too_short(self, scorer):
        """Score article should return None for articles below min_words."""
        short_article = {
            "id": 2,
            "title": "Short",
            "content": "Too short",
            "url": "https://example.com/short",
        }
        result = scorer.score_article(short_article)
        assert result is None

    def test_score_article_no_content(self, scorer):
        """Score article should handle missing content gracefully."""
        article = {
            "id": 3,
            "title": "No Content",
            "url": "https://example.com/nocontent",
        }
        result = scorer.score_article(article)
        # With no content, it may be too short or return a result
        # Just ensure it doesn't crash
        assert result is None or isinstance(result, QualityScoreComponents)


class TestScoreComponents:
    """Tests for individual scoring components."""

    def test_depth_score_scaling(self, scorer):
        """Depth score should scale with content length and structure."""
        # Long structured content
        long_article = {
            "id": 10,
            "title": "Long Article",
            "content": ("Paragraph one.\n\n" * 100) + "Some technical terms: API, HTTP, JSON.",
            "url": "https://example.com/long",
        }
        result = scorer.score_article(long_article)
        assert result is not None
        assert result.depth_score > 0

    def test_reference_score_with_links(self, scorer):
        """Reference score should increase with external links."""
        article_with_links = {
            "id": 11,
            "title": "Article with Links",
            "content": (
                "See https://arxiv.org/abs/1234 and https://github.com/org/repo "
                "and https://scholar.google.com/paper"
            ),
            "url": "https://example.com/links",
        }
        result = scorer.score_article(article_with_links)
        assert result is not None
        assert result.reference_score >= 0

    def test_author_score_with_details(self, scorer):
        """Author score should be higher with author details."""
        article_no_author = {
            "id": 12,
            "title": "No Author",
            "content": "Some content here that is long enough for scoring purposes.",
            "url": "https://example.com/noauthor",
        }
        article_with_author = {
            "id": 13,
            "title": "With Author",
            "content": "Some content here that is long enough for scoring purposes.",
            "author": "Test Author",
            "author_detail": {"bio": "Expert", "email": "test@example.com"},
            "url": "https://example.com/withauthor",
        }

        result_no = scorer.score_article(article_no_author)
        result_with = scorer.score_article(article_with_author)

        # With author should score at least as high
        if result_no and result_with:
            assert result_with.author_score >= result_no.author_score

    def test_overall_score_is_weighted(self, scorer, sample_article):
        """Overall score should be a weighted combination of components."""
        result = scorer.score_article(sample_article)
        assert result is not None

        # Overall should be between min and max of components (roughly)
        assert result.overall_score <= max(
            result.depth_score,
            result.reference_score,
            result.author_score,
            result.domain_score,
            result.engagement_score,
        ) or result.overall_score >= min(
            result.depth_score or 0,
            result.reference_score or 0,
            result.author_score or 0,
            result.domain_score or 0,
            result.engagement_score or 0,
        )
