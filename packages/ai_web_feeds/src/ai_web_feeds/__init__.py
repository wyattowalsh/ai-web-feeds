"""ai_web_feeds.__init__ -- ai-web-feeds package initialization."""

import ai_web_feeds.logger  # noqa: F401
from ai_web_feeds.config import Settings
from ai_web_feeds.enrich import enrich_all_feeds, enrich_feed_source
from ai_web_feeds.export import export_all_formats, export_to_json, export_to_opml

# Export main modules for simplified API
from ai_web_feeds.load import load_feeds, load_topics, save_feeds, save_topics
from ai_web_feeds.models import (
    FeedAnalytics,
    FeedEnrichmentData,
    FeedSource,
    FeedValidationResult,
    Topic,
)
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.validate import ValidationResult, validate_feeds, validate_topics

__all__ = [
    "DatabaseManager",
    "FeedAnalytics",
    "FeedEnrichmentData",
    "FeedSource",
    "FeedValidationResult",
    "Settings",
    "Topic",
    "ValidationResult",
    "enrich_all_feeds",
    "enrich_feed_source",
    "export_all_formats",
    "export_to_json",
    "export_to_opml",
    "load_feeds",
    "load_topics",
    "save_feeds",
    "save_topics",
    "validate_feeds",
    "validate_topics",
]
