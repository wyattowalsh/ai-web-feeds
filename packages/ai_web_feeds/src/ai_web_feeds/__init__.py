"""ai_web_feeds.__init__ -- AIWebFeeds package initialization."""

import ai_web_feeds.logger  # Ensure logger is configured on import
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
    # Load
    "load_feeds",
    "load_topics",
    "save_feeds",
    "save_topics",
    # Validate
    "validate_feeds",
    "validate_topics",
    "ValidationResult",
    # Enrich
    "enrich_all_feeds",
    "enrich_feed_source",
    # Export
    "export_all_formats",
    "export_to_json",
    "export_to_opml",
    # Models
    "FeedSource",
    "FeedEnrichmentData",
    "FeedValidationResult",
    "FeedAnalytics",
    "Topic",
    # Storage
    "DatabaseManager",
    # Config
    "Settings",
]
