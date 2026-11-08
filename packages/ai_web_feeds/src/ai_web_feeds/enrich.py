"""ai_web_feeds.enrich -- Enrich feeds with metadata"""

import asyncio

import feedparser
import httpx
from loguru import logger

from ai_web_feeds.enrich_pkg import (
    AdvancedEnricher,
    FeedEnrichment,
    _enrich_all_feeds_async,
    enrich_all_feeds,
    enrich_feed_source,
)
from ai_web_feeds.utils import detect_feed_format, detect_platform

# These bindings are the patch surface. Implementation looks them up by name.
__all__ = [
    "AdvancedEnricher",
    "FeedEnrichment",
    "_enrich_all_feeds_async",
    "asyncio",
    "detect_feed_format",
    "detect_platform",
    "enrich_all_feeds",
    "enrich_feed_source",
    "feedparser",
    "httpx",
    "logger",
]
