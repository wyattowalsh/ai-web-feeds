"""Sentiment analysis using Hugging Face transformers (Phase 5C)."""

import os
from pathlib import Path

from loguru import logger
from pydantic import BaseModel, Field
from transformers import pipeline

from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.content import article_value, extract_article_body, extract_article_text

MIN_SENTIMENT_BODY_CHARS = 100
MAX_SENTIMENT_TEXT_CHARS = 2000
OFFLINE_ENV_VARS = ("AIWF_OFFLINE", "HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE")


class SentimentResult(BaseModel):
    """Sentiment analysis result."""

    sentiment_score: float = Field(
        ge=-1.0, le=1.0, description="Sentiment score: -1 (negative) to +1 (positive)"
    )
    classification: str = Field(description="Classification: positive, neutral, negative")
    confidence: float = Field(ge=0.0, le=1.0, description="Model confidence score")
    model_name: str = Field(description="Hugging Face model identifier")

    def __getitem__(self, key: str):
        return getattr(self, key)

    def __contains__(self, key: str) -> bool:
        return key in {"sentiment_score", "classification", "confidence", "model_name"}


class SentimentAnalyzer:
    """Classify article sentiment using transformer models.

    Uses Hugging Face's DistilBERT fine-tuned on SST-2 for sentiment analysis.
    Converts binary positive/negative to -1 to +1 scale with neutral zone.

    Sentiment scores:
    - Negative: < -0.3
    - Neutral: -0.3 to +0.3
    - Positive: > +0.3
    """

    def __init__(self, settings: Settings | None = None):
        """Initialize sentiment analyzer with transformer model.

        Args:
            settings: Application settings (uses defaults if None)
        """
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.model_name = self.config.sentiment_model
        model_kwargs = {"cache_dir": str(Path(self.config.model_cache_dir).expanduser())}
        if self._offline_mode_enabled():
            model_kwargs["local_files_only"] = True

        # Initialize Hugging Face pipeline
        try:
            self.pipeline = pipeline(
                "sentiment-analysis",
                model=self.model_name,
                device=-1,  # CPU (-1), use 0 for GPU
                model_kwargs=model_kwargs,
            )
            logger.info(f"Loaded sentiment model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to load sentiment model {self.model_name}: {e}")
            raise

    @staticmethod
    def _offline_mode_enabled() -> bool:
        """Return True when local-only model loading should be enforced."""
        return any(
            os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}
            for name in OFFLINE_ENV_VARS
        )

    @staticmethod
    def _normalize_sentiment_score(label: str, score: float) -> float:
        """Convert model output confidence into a symmetric ``[-1.0, 1.0]`` score."""
        normalized = max(0.0, min(score, 1.0))
        if label == "POSITIVE":
            return normalized
        if label == "NEGATIVE":
            return -normalized
        return 0.0

    def analyze_sentiment(self, article: dict) -> SentimentResult | None:
        """Analyze article sentiment.

        Args:
            article: Article dict with keys: content, summary, title

        Returns:
            SentimentResult with score, classification, and confidence, or None on error
        """
        article_id = article_value(article, "id")
        try:
            body = self._get_body_content(article)
            if not body or len(body.strip()) < MIN_SENTIMENT_BODY_CHARS:
                logger.debug(f"No content to analyze sentiment: {article_id}")
                return None

            text = self._get_content(article)[:MAX_SENTIMENT_TEXT_CHARS]

            # Run sentiment analysis
            result = self.pipeline(text)[0]
            if not isinstance(result, dict) or "label" not in result or "score" not in result:
                raise ValueError("Sentiment pipeline returned an invalid result payload")

            # Convert to our sentiment scale
            label = str(result["label"]).upper()
            score = float(result["score"])

            sentiment_score = self._normalize_sentiment_score(label, score)

            # Classify based on threshold
            if sentiment_score < -0.3:
                classification = "negative"
            elif sentiment_score > 0.3:
                classification = "positive"
            else:
                classification = "neutral"

            return SentimentResult(
                sentiment_score=sentiment_score,
                classification=classification,
                confidence=score,
                model_name=self.model_name,
            )

        except Exception as e:
            logger.error(f"Failed to analyze sentiment for article {article_id}: {e}")
            return None

    def _get_content(self, article: dict) -> str:
        """Extract text content from article."""
        return extract_article_text(article, require_body_for_title=True)

    def _get_body_content(self, article: dict) -> str:
        """Extract body text used for minimum-length gating."""
        return extract_article_body(article)
