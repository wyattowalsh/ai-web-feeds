"""NLP processing modules for Phase 5: Advanced AI/NLP

This package contains modules for:
- Quality scoring: Heuristic-based article quality assessment
- Entity extraction: Named entity recognition and normalization
- Sentiment analysis: Transformer-based classification
- Topic modeling: LDA-based topic discovery and evolution tracking
"""

from typing import TYPE_CHECKING

__all__ = [
    "EntityExtractor",
    "QualityScorer",
    "SentimentAnalyzer",
    "TopicModeler",
]

if TYPE_CHECKING:
    from ai_web_feeds.nlp.entity_extractor import EntityExtractor
    from ai_web_feeds.nlp.quality_scorer import QualityScorer
    from ai_web_feeds.nlp.sentiment_analyzer import SentimentAnalyzer
    from ai_web_feeds.nlp.topic_modeler import TopicModeler


def __getattr__(name: str):
    if name == "EntityExtractor":
        from ai_web_feeds.nlp.entity_extractor import EntityExtractor

        return EntityExtractor
    if name == "QualityScorer":
        from ai_web_feeds.nlp.quality_scorer import QualityScorer

        return QualityScorer
    if name == "SentimentAnalyzer":
        from ai_web_feeds.nlp.sentiment_analyzer import SentimentAnalyzer

        return SentimentAnalyzer
    if name == "TopicModeler":
        from ai_web_feeds.nlp.topic_modeler import TopicModeler

        return TopicModeler
    msg = f"module {__name__!r} has no attribute {name!r}"
    raise AttributeError(msg)
