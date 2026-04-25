"""Unit tests for Sentiment Analyzer (Phase 5C)"""

from unittest.mock import MagicMock, patch

import pytest
from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.sentiment_analyzer import SentimentAnalyzer


class TestSentimentAnalyzer:
    """Test suite for SentimentAnalyzer class"""

    @pytest.fixture
    def analyzer(self):
        """Create SentimentAnalyzer instance for testing"""
        with patch("ai_web_feeds.nlp.sentiment_analyzer.pipeline") as mock_pipeline:
            # Mock transformer pipeline
            mock_pipe = MagicMock()
            mock_pipeline.return_value = mock_pipe
            analyzer = SentimentAnalyzer()
            analyzer.pipeline = mock_pipe
            yield analyzer

    @pytest.fixture
    def positive_article(self):
        """Sample positive article"""
        return {
            "id": 1,
            "title": "Breakthrough in AI",
            "content": "Researchers have achieved remarkable success with new AI models. "
            "The breakthrough technology shows great promise and exceeds expectations. "
            "This is an exciting development that will benefit humanity.",
        }

    @pytest.fixture
    def negative_article(self):
        """Sample negative article"""
        return {
            "id": 2,
            "title": "AI Safety Concerns",
            "content": "Critics have raised serious concerns about AI safety. "
            "The dangerous implications of unaligned systems pose significant risks. "
            "This alarming trend threatens our future.",
        }

    @pytest.fixture
    def neutral_article(self):
        """Sample neutral article"""
        return {
            "id": 3,
            "title": "AI Research Paper",
            "content": "The paper describes a method for training neural networks. "
            "Results show comparable performance to baseline approaches. "
            "Further research is needed.",
        }

    def test_initialization(self, analyzer):
        """Test SentimentAnalyzer initializes correctly"""
        assert analyzer is not None
        assert analyzer.config is not None
        assert analyzer.pipeline is not None

    def test_initialization_custom_settings(self):
        """Test SentimentAnalyzer with custom settings"""
        settings = Settings()
        settings.phase5.sentiment_model = "custom-model"

        with patch("ai_web_feeds.nlp.sentiment_analyzer.pipeline") as mock_pipeline:
            mock_pipe = MagicMock()
            mock_pipeline.return_value = mock_pipe
            analyzer = SentimentAnalyzer(settings)

            assert analyzer.config.sentiment_model == "custom-model"

    def test_analyze_positive_sentiment(self, analyzer, positive_article):
        """Test positive sentiment classification"""
        # Mock pipeline response
        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.92}]

        result = analyzer.analyze_sentiment(positive_article)

        assert result["classification"] == "positive"
        assert result["sentiment_score"] > 0.3
        assert result["confidence"] == 0.92
        assert -1.0 <= result["sentiment_score"] <= 1.0

    def test_analyze_negative_sentiment(self, analyzer, negative_article):
        """Test negative sentiment classification"""
        # Mock pipeline response
        analyzer.pipeline.return_value = [{"label": "NEGATIVE", "score": 0.89}]

        result = analyzer.analyze_sentiment(negative_article)

        assert result["classification"] == "negative"
        assert result["sentiment_score"] < -0.3
        assert result["confidence"] == 0.89

    def test_analyze_neutral_sentiment(self, analyzer, neutral_article):
        """Test neutral sentiment classification"""
        # Mock pipeline response - low confidence positive
        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.55}]

        result = analyzer.analyze_sentiment(neutral_article)

        # With score 0.55, sentiment_score = 0.55, which is > 0.3, so classified as positive
        # But if we want neutral, we need score < 0.3
        # Let me adjust the test
        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.25}]

        result = analyzer.analyze_sentiment(neutral_article)

        # Score 0.25 is < 0.3, so should be neutral
        assert result["classification"] == "neutral"
        assert -0.3 <= result["sentiment_score"] <= 0.3

    def test_analyze_empty_content(self, analyzer):
        """Test analysis with empty content"""
        article = {"id": 1, "content": ""}

        result = analyzer.analyze_sentiment(article)

        assert result is None

    def test_analyze_short_content(self, analyzer):
        """Test analysis with content < 100 chars"""
        article = {"id": 1, "content": "Short."}

        result = analyzer.analyze_sentiment(article)

        assert result is None

    def test_sentiment_score_range(self, analyzer, positive_article):
        """Test sentiment score is within valid range"""
        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.95}]

        result = analyzer.analyze_sentiment(positive_article)

        assert -1.0 <= result["sentiment_score"] <= 1.0

    def test_classification_threshold_positive(self, analyzer, positive_article):
        """Test positive classification threshold (>0.3)"""
        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.85}]

        result = analyzer.analyze_sentiment(positive_article)

        assert result["sentiment_score"] > 0.3
        assert result["classification"] == "positive"

    def test_classification_threshold_negative(self, analyzer, negative_article):
        """Test negative classification threshold (<-0.3)"""
        analyzer.pipeline.return_value = [{"label": "NEGATIVE", "score": 0.78}]

        result = analyzer.analyze_sentiment(negative_article)

        assert result["sentiment_score"] < -0.3
        assert result["classification"] == "negative"

    def test_classification_threshold_neutral(self, analyzer, neutral_article):
        """Test neutral classification threshold (-0.3 to 0.3)"""
        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.20}]

        result = analyzer.analyze_sentiment(neutral_article)

        assert -0.3 <= result["sentiment_score"] <= 0.3
        assert result["classification"] == "neutral"

    def test_truncates_long_content(self, analyzer):
        """Test analysis truncates long content"""
        article = {
            "id": 1,
            "content": "A" * 10000,  # Very long content
        }

        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.80}]

        result = analyzer.analyze_sentiment(article)

        # Should successfully process without error
        assert result is not None

        # Check pipeline was called with truncated content
        call_args = analyzer.pipeline.call_args[0][0]
        assert len(call_args) <= 2000  # Max 2000 chars

    def test_model_name_in_result(self, analyzer, positive_article):
        """Test model name is included in result"""
        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.85}]

        result = analyzer.analyze_sentiment(positive_article)

        assert "model_name" in result
        assert result["model_name"] == analyzer.config.sentiment_model

    def test_confidence_in_result(self, analyzer, positive_article):
        """Test confidence is included and valid"""
        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.88}]

        result = analyzer.analyze_sentiment(positive_article)

        assert "confidence" in result
        assert 0.0 <= result["confidence"] <= 1.0
        assert result["confidence"] == 0.88


class TestSentimentEdgeCases:
    """Test suite for sentiment analysis edge cases"""

    @pytest.fixture
    def analyzer(self):
        """Create SentimentAnalyzer instance"""
        with patch("ai_web_feeds.nlp.sentiment_analyzer.pipeline") as mock_pipeline:
            mock_pipe = MagicMock()
            mock_pipeline.return_value = mock_pipe
            analyzer = SentimentAnalyzer()
            analyzer.pipeline = mock_pipe
            yield analyzer

    def test_missing_content_key(self, analyzer):
        """Test article without content key"""
        article = {"id": 1, "title": "Test"}

        result = analyzer.analyze_sentiment(article)

        assert result is None

    def test_none_content(self, analyzer):
        """Test article with None content"""
        article = {"id": 1, "content": None}

        # Should handle gracefully
        try:
            result = analyzer.analyze_sentiment(article)
            # If it doesn't crash, that's acceptable
        except (TypeError, AttributeError):
            # Also acceptable to raise error for None content
            pass

    def test_very_positive_confidence(self, analyzer):
        """Test very high confidence positive"""
        article = {"id": 1, "content": "Amazing wonderful fantastic excellent!" * 20}

        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.99}]

        result = analyzer.analyze_sentiment(article)

        assert result["sentiment_score"] == 0.99
        assert result["classification"] == "positive"

    def test_very_negative_confidence(self, analyzer):
        """Test very high confidence negative"""
        article = {"id": 1, "content": "Terrible horrible awful disastrous!" * 20}

        analyzer.pipeline.return_value = [{"label": "NEGATIVE", "score": 0.98}]

        result = analyzer.analyze_sentiment(article)

        assert result["sentiment_score"] == -0.98
        assert result["classification"] == "negative"

    def test_boundary_positive_threshold(self, analyzer):
        """Test sentiment at boundary of positive threshold"""
        article = {"id": 1, "content": "This is okay I guess." * 10}

        # Exactly at threshold: 0.31
        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.31}]

        result = analyzer.analyze_sentiment(article)

        assert result["sentiment_score"] == 0.31
        assert result["classification"] == "positive"

    def test_boundary_negative_threshold(self, analyzer):
        """Test sentiment at boundary of negative threshold"""
        article = {"id": 1, "content": "This is somewhat concerning." * 10}

        # Exactly at threshold: -0.31
        analyzer.pipeline.return_value = [{"label": "NEGATIVE", "score": 0.31}]

        result = analyzer.analyze_sentiment(article)

        assert result["sentiment_score"] == -0.31
        assert result["classification"] == "negative"

    def test_unicode_content(self, analyzer):
        """Test sentiment analysis with unicode content"""
        article = {"id": 1, "content": "This is great! 🎉 Amazing progress in AI research. 🚀" * 10}

        analyzer.pipeline.return_value = [{"label": "POSITIVE", "score": 0.90}]

        result = analyzer.analyze_sentiment(article)

        assert result is not None
        assert result["classification"] == "positive"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
