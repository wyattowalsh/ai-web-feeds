"""ai_web_feeds.utils -- Utility functions for enrichment, OPML, and schema generation.

Implementations live in :mod:`ai_web_feeds.util_pkg`. This module re-exports them
so existing imports, including ``generate_opml``, keep working.
"""

import json
import re
import xml.etree.ElementTree as ET  # nosec B405
from collections.abc import Callable
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, ClassVar, cast
from urllib.parse import parse_qs, quote, urljoin, urlparse

import httpx
import yaml
from defusedxml.minidom import parseString
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from ai_web_feeds.models import FeedFormat, FeedSource
from ai_web_feeds.util_pkg.discovery import (  # noqa: F401
    _extract_feed_links,
    _FeedLinkParser,
    detect_feed_format,
    discover_feed_url,
    enrich_feed_source,
)
from ai_web_feeds.util_pkg.opml import (
    generate_categorized_opml,
    generate_filtered_opml,
    generate_opml,
    save_opml,
)
from ai_web_feeds.util_pkg.platforms import (
    detect_platform,
    generate_arxiv_feed_url,
    generate_devto_feed_url,
    generate_github_feed_url,
    generate_hackernews_feed_url,
    generate_medium_feed_url,
    generate_platform_feed_url,
    generate_reddit_feed_url,
    generate_substack_feed_url,
    generate_twitter_feed_url,
    generate_youtube_feed_url,
)
from ai_web_feeds.util_pkg.rsshub import generate_rsshub_url
from ai_web_feeds.util_pkg.schema import generate_enriched_schema, save_json_schema
from ai_web_feeds.util_pkg.text import (
    generate_feed_id,
    is_valid_url,
    parse_datetime,
    sanitize_text,
    sanitize_url,
)
from ai_web_feeds.util_pkg.yaml_io import load_feeds_yaml, save_feeds_yaml

__all__ = [
    "ET",
    "UTC",
    "Any",
    "Callable",
    "ClassVar",
    "FeedFormat",
    "FeedSource",
    "HTMLParser",
    "Path",
    "cast",
    "datetime",
    "detect_feed_format",
    "detect_platform",
    "discover_feed_url",
    "enrich_feed_source",
    "generate_arxiv_feed_url",
    "generate_categorized_opml",
    "generate_devto_feed_url",
    "generate_enriched_schema",
    "generate_feed_id",
    "generate_filtered_opml",
    "generate_github_feed_url",
    "generate_hackernews_feed_url",
    "generate_medium_feed_url",
    "generate_opml",
    "generate_platform_feed_url",
    "generate_reddit_feed_url",
    "generate_rsshub_url",
    "generate_substack_feed_url",
    "generate_twitter_feed_url",
    "generate_youtube_feed_url",
    "httpx",
    "is_valid_url",
    "json",
    "load_feeds_yaml",
    "logger",
    "parseString",
    "parse_datetime",
    "parse_qs",
    "parsedate_to_datetime",
    "quote",
    "re",
    "retry",
    "sanitize_text",
    "sanitize_url",
    "save_feeds_yaml",
    "save_json_schema",
    "save_opml",
    "sha256",
    "stop_after_attempt",
    "urljoin",
    "urlparse",
    "wait_exponential",
    "yaml",
]
