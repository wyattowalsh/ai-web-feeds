"""NLP processing modules for Phase 5: Advanced AI/NLP

This package contains modules for:
- Quality scoring: Heuristic-based article quality assessment
- Entity extraction: Named entity recognition and normalization
- Sentiment analysis: Transformer-based sentiment classification
- Topic modeling: LDA-based topic discovery and evolution tracking
"""

from ai_web_feeds.nlp.entity_extractor import EntityExtractor
from ai_web_feeds.nlp.quality_scorer import QualityScorer
from ai_web_feeds.nlp.sentiment_analyzer import SentimentAnalyzer
from ai_web_feeds.nlp.topic_modeler import TopicModeler

__all__ = [
    "EntityExtractor",
    "QualityScorer",
    "SentimentAnalyzer",
    "TopicModeler",
]
