"""NLP processing modules for Phase 5: Advanced AI/NLP."""

from ai_web_feeds.nlp.content import (
    build_article_payload,
    extract_article_body,
    extract_article_text,
    normalize_article_text,
)
from ai_web_feeds.nlp.entity_extractor import EntityExtractor, ExtractedEntity
from ai_web_feeds.nlp.quality_scorer import QualityScorer
from ai_web_feeds.nlp.sentiment_analyzer import SentimentAnalyzer, SentimentResult
from ai_web_feeds.nlp.topic_modeler import (
    DiscoveredSubtopic,
    TopicModeler,
    detect_evolution,
    discover_subtopics,
    extract_subtopics,
    track_evolution,
)

__all__ = [
    "DiscoveredSubtopic",
    "EntityExtractor",
    "ExtractedEntity",
    "QualityScorer",
    "SentimentAnalyzer",
    "SentimentResult",
    "TopicModeler",
    "build_article_payload",
    "detect_evolution",
    "discover_subtopics",
    "extract_article_body",
    "extract_article_text",
    "extract_subtopics",
    "normalize_article_text",
    "track_evolution",
]
