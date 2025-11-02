"""Unit tests for NLP Quality Scorer (Phase 5A)."""

import pytest
from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.quality_scorer import QualityScoreComponents, QualityScorer


class TestQualityScorer:
    """Test suite for QualityScorer class."""
    
    def test_initialization(self):
        """Test QualityScorer initialization."""
        scorer = QualityScorer()
        
        assert scorer.settings is not None
        assert scorer.config is not None
        assert scorer.min_words == 100  # Default from config
    
    def test_initialization_custom_settings(self):
        """Test QualityScorer with custom settings."""
        settings = Settings()
        settings.phase5.quality_min_words = 50
        
        scorer = QualityScorer(settings)
        
        assert scorer.min_words == 50
    
    def test_score_article_too_short(self):
        """Test that short articles are skipped."""
        scorer = QualityScorer()
        short_article = {
            "id": 1,
            "title": "Short Article",
            "content": "Too short" * 5,  # Only 10 words
            "url": "https://example.com/article",
        }
        
        result = scorer.score_article(short_article)
        
        assert result is None
    
    def test_score_article_basic(self):
        """Test basic article scoring."""
        scorer = QualityScorer()
        article = {
            "id": 1,
            "title": "Test Article",
            "content": " ".join(["word"] * 200),  # 200 words
            "url": "https://example.com/article",
        }
        
        result = scorer.score_article(article)
        
        assert result is not None
        assert isinstance(result, QualityScoreComponents)
        assert 0 <= result.overall_score <= 100
        assert 0 <= result.depth_score <= 100
        assert 0 <= result.reference_score <= 100
        assert 0 <= result.author_score <= 100
        assert 0 <= result.domain_score <= 100
        assert 0 <= result.engagement_score <= 100
    
    def test_depth_score_word_count(self):
        """Test depth scoring based on word count."""
        scorer = QualityScorer()
        
        # Short article (200 words)
        short = {"content": " ".join(["word"] * 200), "url": "https://example.com"}
        short_result = scorer.score_article(short)
        
        # Long article (1500 words)
        long = {"content": " ".join(["word"] * 1500), "url": "https://example.com"}
        long_result = scorer.score_article(long)
        
        assert short_result is not None
        assert long_result is not None
        assert long_result.depth_score > short_result.depth_score
    
    def test_depth_score_structure(self):
        """Test depth scoring with paragraphs."""
        scorer = QualityScorer()
        
        # No paragraphs
        no_paragraphs = {
            "content": " ".join(["word"] * 200),
            "url": "https://example.com",
        }
        
        # Multiple paragraphs
        with_paragraphs = {
            "content": "\n\n".join([" ".join(["word"] * 40)] * 5),
            "url": "https://example.com",
        }
        
        no_para_result = scorer.score_article(no_paragraphs)
        with_para_result = scorer.score_article(with_paragraphs)
        
        assert no_para_result is not None
        assert with_para_result is not None
        assert with_para_result.depth_score >= no_para_result.depth_score
    
    def test_depth_score_technical_content(self):
        """Test depth scoring with technical indicators."""
        scorer = QualityScorer()
        
        # Plain text
        plain = {
            "content": " ".join(["word"] * 200),
            "url": "https://example.com",
        }
        
        # Technical content with code blocks
        technical = {
            "content": "```python\nprint('hello')\n```\n" + " ".join(["word"] * 200),
            "url": "https://example.com",
        }
        
        plain_result = scorer.score_article(plain)
        technical_result = scorer.score_article(technical)
        
        assert plain_result is not None
        assert technical_result is not None
        assert technical_result.depth_score >= plain_result.depth_score
    
    def test_reference_score_no_links(self):
        """Test reference scoring with no links."""
        scorer = QualityScorer()
        article = {
            "content": " ".join(["word"] * 200),
            "url": "https://example.com",
        }
        
        result = scorer.score_article(article)
        
        assert result is not None
        assert result.reference_score == 0
    
    def test_reference_score_with_links(self):
        """Test reference scoring with external links."""
        scorer = QualityScorer()
        
        # No links
        no_links = {
            "content": " ".join(["word"] * 200),
            "url": "https://example.com",
        }
        
        # With external links
        with_links = {
            "content": (
                " ".join(["word"] * 100) +
                " https://arxiv.org/abs/123 " +
                " https://github.com/project " +
                " https://doi.org/10.1234 " +
                " ".join(["word"] * 100)
            ),
            "url": "https://example.com",
        }
        
        no_links_result = scorer.score_article(no_links)
        with_links_result = scorer.score_article(with_links)
        
        assert no_links_result is not None
        assert with_links_result is not None
        assert with_links_result.reference_score > no_links_result.reference_score
    
    def test_reference_score_quality_domains(self):
        """Test reference scoring prioritizes quality domains."""
        scorer = QualityScorer()
        
        # Regular external links
        regular = {
            "content": (
                " ".join(["word"] * 100) +
                " https://random.com " +
                " https://another.com " +
                " ".join(["word"] * 100)
            ),
            "url": "https://example.com",
        }
        
        # Academic links
        academic = {
            "content": (
                " ".join(["word"] * 100) +
                " https://arxiv.org/abs/123 " +
                " https://doi.org/10.1234 " +
                " ".join(["word"] * 100)
            ),
            "url": "https://example.com",
        }
        
        regular_result = scorer.score_article(regular)
        academic_result = scorer.score_article(academic)
        
        assert regular_result is not None
        assert academic_result is not None
        assert academic_result.reference_score >= regular_result.reference_score
    
    def test_author_score_no_author(self):
        """Test author scoring with no author."""
        scorer = QualityScorer()
        article = {
            "content": " ".join(["word"] * 200),
            "url": "https://example.com",
        }
        
        result = scorer.score_article(article)
        
        assert result is not None
        assert result.author_score == 0
    
    def test_author_score_with_author(self):
        """Test author scoring with author name."""
        scorer = QualityScorer()
        article = {
            "content": " ".join(["word"] * 200),
            "url": "https://example.com",
            "author": "John Doe",
        }
        
        result = scorer.score_article(article)
        
        assert result is not None
        assert result.author_score > 0
    
    def test_author_score_with_details(self):
        """Test author scoring with author details."""
        scorer = QualityScorer()
        
        # Author with no details
        no_details = {
            "content": " ".join(["word"] * 200),
            "url": "https://example.com",
            "author": "John Doe",
        }
        
        # Author with bio and email
        with_details = {
            "content": " ".join(["word"] * 200),
            "url": "https://example.com",
            "author": "John Doe",
            "author_detail": {
                "bio": "PhD in Computer Science",
                "email": "john@example.com"
            }
        }
        
        no_details_result = scorer.score_article(no_details)
        with_details_result = scorer.score_article(with_details)
        
        assert no_details_result is not None
        assert with_details_result is not None
        assert with_details_result.author_score > no_details_result.author_score
    
    def test_domain_score_default(self):
        """Test domain scoring returns default for unknown feeds."""
        scorer = QualityScorer()
        article = {
            "content": " ".join(["word"] * 200),
            "url": "https://example.com",
        }
        
        result = scorer.score_article(article)
        
        assert result is not None
        assert result.domain_score == 50  # Default neutral score
    
    def test_domain_score_with_feed(self):
        """Test domain scoring uses feed reputation."""
        scorer = QualityScorer()
        
        article = {
            "content": " ".join(["word"] * 200),
            "url": "https://example.com",
        }
        
        feed = {"quality_score": 85}
        
        result = scorer.score_article(article, feed=feed)
        
        assert result is not None
        assert result.domain_score == 85
    
    def test_engagement_score_read_time(self):
        """Test engagement scoring based on read time."""
        scorer = QualityScorer()
        
        # Very short (< 5 min read)
        short = {
            "content": " ".join(["word"] * 300),  # ~1.5 min read
            "url": "https://example.com",
        }
        
        # Ideal length (5-15 min read)
        ideal = {
            "content": " ".join(["word"] * 2000),  # ~10 min read
            "url": "https://example.com",
        }
        
        # Very long (> 15 min read)
        long = {
            "content": " ".join(["word"] * 8000),  # ~40 min read
            "url": "https://example.com",
        }
        
        short_result = scorer.score_article(short)
        ideal_result = scorer.score_article(ideal)
        long_result = scorer.score_article(long)
        
        assert short_result is not None
        assert ideal_result is not None
        assert long_result is not None
        
        # Ideal length should score highest
        assert ideal_result.engagement_score >= short_result.engagement_score
        assert ideal_result.engagement_score >= long_result.engagement_score
    
    def test_overall_score_weighted(self):
        """Test that overall score is properly weighted."""
        scorer = QualityScorer()
        
        # Create article with known component scores
        article = {
            "content": "\n\n".join([
                "```python\ncode\n```\n" + " ".join(["word"] * 500)
                for _ in range(3)
            ]),
            "url": "https://example.com/article",
            "author": "Dr. Jane Smith",
            "author_detail": {
                "bio": "PhD in AI",
                "email": "jane@example.edu"
            },
        }
        
        feed = {"quality_score": 90}
        
        result = scorer.score_article(article, feed=feed)
        
        assert result is not None
        
        # Overall score should be weighted average
        expected = int(
            result.depth_score * 0.35 +
            result.reference_score * 0.20 +
            result.author_score * 0.15 +
            result.domain_score * 0.20 +
            result.engagement_score * 0.10
        )
        
        assert result.overall_score == expected
    
    def test_get_content_from_summary(self):
        """Test content extraction falls back to summary."""
        scorer = QualityScorer()
        article = {
            "summary": " ".join(["word"] * 200),
            "url": "https://example.com",
        }
        
        result = scorer.score_article(article)
        
        assert result is not None
    
    def test_get_content_from_list(self):
        """Test content extraction from list format."""
        scorer = QualityScorer()
        article = {
            "content": [
                {"value": " ".join(["word"] * 100)},
                {"value": " ".join(["word"] * 100)},
            ],
            "url": "https://example.com",
        }
        
        result = scorer.score_article(article)
        
        assert result is not None
    
    def test_score_article_error_handling(self):
        """Test error handling in article scoring."""
        scorer = QualityScorer()
        
        # Invalid article format
        invalid = {}
        
        result = scorer.score_article(invalid)
        
        # Should return None on error, not raise
        assert result is None


class TestQualityScoreComponents:
    """Test suite for QualityScoreComponents model."""
    
    def test_valid_scores(self):
        """Test valid score components."""
        scores = QualityScoreComponents(
            depth_score=80,
            reference_score=60,
            author_score=70,
            domain_score=90,
            engagement_score=50,
            overall_score=75,
        )
        
        assert scores.depth_score == 80
        assert scores.reference_score == 60
        assert scores.author_score == 70
        assert scores.domain_score == 90
        assert scores.engagement_score == 50
        assert scores.overall_score == 75
    
    def test_score_validation_min(self):
        """Test score validation for minimum values."""
        with pytest.raises(ValueError):
            QualityScoreComponents(
                depth_score=-1,  # Invalid: below 0
                reference_score=50,
                author_score=50,
                domain_score=50,
                engagement_score=50,
                overall_score=50,
            )
    
    def test_score_validation_max(self):
        """Test score validation for maximum values."""
        with pytest.raises(ValueError):
            QualityScoreComponents(
                depth_score=101,  # Invalid: above 100
                reference_score=50,
                author_score=50,
                domain_score=50,
                engagement_score=50,
                overall_score=50,
            )
    
    def test_all_scores_zero(self):
        """Test components with all zero scores."""
        scores = QualityScoreComponents(
            depth_score=0,
            reference_score=0,
            author_score=0,
            domain_score=0,
            engagement_score=0,
            overall_score=0,
        )
        
        assert scores.overall_score == 0
    
    def test_all_scores_max(self):
        """Test components with all maximum scores."""
        scores = QualityScoreComponents(
            depth_score=100,
            reference_score=100,
            author_score=100,
            domain_score=100,
            engagement_score=100,
            overall_score=100,
        )
        
        assert scores.overall_score == 100

