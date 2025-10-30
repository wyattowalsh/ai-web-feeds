"""Sentiment analysis using Hugging Face transformers (Phase 5C)."""

from datetime import datetime
from typing import Optional

from loguru import logger
from pydantic import BaseModel, Field
from transformers import pipeline

from ai_web_feeds.config import Settings


class SentimentResult(BaseModel):
    """Sentiment analysis result."""
    
    sentiment_score: float = Field(ge=-1.0, le=1.0, description="Sentiment score: -1 (negative) to +1 (positive)")
    classification: str = Field(description="Classification: positive, neutral, negative")
    confidence: float = Field(ge=0.0, le=1.0, description="Model confidence score")
    model_name: str = Field(description="Hugging Face model identifier")


class SentimentAnalyzer:
    """Classify article sentiment using transformer models.
    
    Uses Hugging Face's DistilBERT fine-tuned on SST-2 for sentiment analysis.
    Converts binary positive/negative to -1 to +1 scale with neutral zone.
    
    Sentiment scores:
    - Negative: < -0.3
    - Neutral: -0.3 to +0.3
    - Positive: > +0.3
    """
    
    def __init__(self, settings: Optional[Settings] = None):
        """Initialize sentiment analyzer with transformer model.
        
        Args:
            settings: Application settings (uses defaults if None)
        """
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.model_name = self.config.sentiment_model
        
        # Initialize Hugging Face pipeline
        try:
            self.pipeline = pipeline(
                "sentiment-analysis",
                model=self.model_name,
                device=-1,  # CPU (-1), use 0 for GPU
            )
            logger.info(f"Loaded sentiment model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to load sentiment model {self.model_name}: {e}")
            raise
    
    def analyze_sentiment(self, article: dict) -> Optional[SentimentResult]:
        """Analyze article sentiment.
        
        Args:
            article: Article dict with keys: content, summary, title
            
        Returns:
            SentimentResult with score, classification, and confidence, or None on error
        """
        try:
            # Extract text content
            content = self._get_content(article)
            if not content:
                logger.debug(f"No content to analyze sentiment: {article.get('id')}")
                return None
            
            # Truncate to model's max length (512 tokens for DistilBERT)
            # Approximate: 1 token ≈ 4 characters
            max_chars = 512 * 4
            text = content[:max_chars]
            
            # Run sentiment analysis
            result = self.pipeline(text)[0]
            
            # Convert to our sentiment scale
            label = result["label"].upper()
            score = result["score"]
            
            # Map to -1 to +1 scale
            if label == "POSITIVE":
                sentiment_score = score  # 0.5 to 1.0
            elif label == "NEGATIVE":
                sentiment_score = -score  # -1.0 to -0.5
            else:
                sentiment_score = 0.0  # Neutral (some models have NEUTRAL label)
            
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
            logger.error(f"Failed to analyze sentiment for article {article.get('id')}: {e}")
            return None
    
    def _get_content(self, article: dict) -> str:
        """Extract text content from article."""
        # Prioritize: title + summary > content
        parts = []
        
        if article.get("title"):
            parts.append(article["title"])
        
        if article.get("summary"):
            parts.append(article["summary"])
        elif article.get("content"):
            # Use content if no summary
            content = article["content"]
            if isinstance(content, list):
                content = " ".join(
                    item.get("value", "") for item in content if isinstance(item, dict)
                )
            parts.append(content)
        
        return " ".join(parts)
