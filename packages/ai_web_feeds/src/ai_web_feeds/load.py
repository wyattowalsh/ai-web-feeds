"""ai_web_feeds.load -- Load feed data from YAML files"""

from hashlib import sha256
from pathlib import Path
from typing import Any

import yaml
from loguru import logger

from ai_web_feeds.models import SourceType
from ai_web_feeds.utils import detect_platform, generate_platform_feed_url

_PLATFORM_SOURCE_TYPE_MAP: dict[str, SourceType] = {
    "reddit": SourceType.REDDIT,
    "medium": SourceType.MEDIUM,
    "youtube": SourceType.YOUTUBE,
    "github": SourceType.GITHUB,
    "substack": SourceType.SUBSTACK,
    "devto": SourceType.DEVTO,
    "hackernews": SourceType.HACKERNEWS,
    "twitter": SourceType.TWITTER,
    "arxiv": SourceType.ARXIV,
}

_ENRICHED_META_FIELD_ALIASES = {
    "language": "language",
    "format": "format",
    "updated": "updated",
    "last_validated": "last_validated",
    "verified": "verified",
    "contributor": "contributor",
    "popularity_score": "popularity_score",
    "validation_count": "validation_count",
    "description": "description",
    "author": "author",
    "icon_url": "icon_url",
    "logo_url": "logo_url",
    "image_url": "image_url",
    "favicon_url": "favicon_url",
    "detected_platform": "detected_platform",
    "platform_metadata": "platform_metadata",
    "health_score": "health_score",
    "quality_score": "quality_score",
    "completeness_score": "completeness_score",
    "reliability_score": "reliability_score",
    "freshness_score": "freshness_score",
    "entry_count": "entry_count",
    "has_full_content": "has_full_content",
    "avg_content_length": "avg_content_length",
    "content_types": "content_types",
    "estimated_frequency": "estimated_frequency",
    "last_updated": "last_updated",
    "update_regularity": "update_regularity",
    "response_time_ms": "response_time_ms",
    "availability_score": "availability_score",
    "uptime_percentage": "uptime_percentage",
    "suggested_topics": "suggested_topics",
    "topic_confidence": "topic_confidence",
    "auto_keywords": "auto_keywords",
    "has_itunes": "has_itunes",
    "has_media_rss": "has_media_rss",
    "has_dublin_core": "has_dublin_core",
    "has_geo": "has_geo",
    "seo_title": "seo_title",
    "seo_description": "seo_description",
    "og_image": "og_image",
    "twitter_card": "twitter_card",
    "encoding": "encoding",
    "generator": "generator",
    "ttl": "ttl",
    "uses_https": "uses_https",
    "has_valid_ssl": "has_valid_ssl",
}
_ENRICHED_CURATION_FIELD_ALIASES = {
    "curation_status": "status",
    "curation_since": "since",
    "curation_by": "by",
    "curation_notes": "notes",
}
_ENRICHED_PROVENANCE_FIELD_ALIASES = {
    "provenance_source": "source",
    "provenance_from": "from",
    "provenance_license": "license",
}
_SOURCE_FIELD_ORDER = (
    "url",
    "topics",
    "title",
    "notes",
    "id",
    "feed",
    "site",
    "source_type",
    "mediums",
    "tags",
    "topic_weights",
    "meta",
    "curation",
    "provenance",
    "discover",
    "relations",
    "mappings",
)


def _stable_source_id(url: str) -> str:
    """Generate stable source ID from URL."""
    return sha256(url.encode("utf-8")).hexdigest()[:16]


def _looks_like_feed_url(url: str) -> bool:
    """Heuristic check for direct feed URLs."""
    lowered = url.lower()
    return any(token in lowered for token in ("/feed", "/rss", "/atom", ".xml", ".rss", ".atom"))


def _normalize_topics(raw_topics: Any) -> list[str]:
    """Normalize topic list, preserving order and removing duplicates."""
    if not isinstance(raw_topics, list):
        return []

    seen: set[str] = set()
    topics: list[str] = []
    for topic in raw_topics:
        if isinstance(topic, str) and topic and topic not in seen:
            seen.add(topic)
            topics.append(topic)
    return topics


def _resolve_feed_and_site(
    source_url: str | None,
    feed: str | None,
    site: str | None,
) -> tuple[str | None, str | None]:
    """Resolve canonical feed/site fields from minimal source input."""
    if source_url:
        if not feed and not site:
            if _looks_like_feed_url(source_url):
                feed = source_url
            else:
                site = source_url
        elif not site and feed != source_url:
            site = source_url
        elif not feed and site != source_url and _looks_like_feed_url(source_url):
            feed = source_url

    normalized_feed = feed.strip() if isinstance(feed, str) and feed.strip() else None
    normalized_site = site.strip() if isinstance(site, str) and site.strip() else None
    return normalized_feed, normalized_site


def _resolve_source_type(
    source_type_value: Any,
    platform: str | None,
) -> SourceType | None:
    """Resolve source type from explicit value or inferred platform."""
    if isinstance(source_type_value, str) and source_type_value.strip():
        return SourceType(source_type_value.strip())
    if platform:
        return _PLATFORM_SOURCE_TYPE_MAP.get(platform)
    return None


def _normalize_source_type_value(value: Any) -> str | None:
    """Convert source type enum values to stable string identifiers."""
    if isinstance(value, SourceType):
        return value.value
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _prune_empty_values(data: dict[str, Any]) -> dict[str, Any]:
    """Remove empty optional values while preserving boolean and numeric zeros."""
    return {
        key: value for key, value in data.items() if value is not None and value not in ([], {})
    }


def _order_source_fields(source: dict[str, Any]) -> dict[str, Any]:
    """Return a stable, human-readable field order for catalog sources."""
    ordered: dict[str, Any] = {}
    for key in _SOURCE_FIELD_ORDER:
        if key in source:
            ordered[key] = source[key]
    for key, value in source.items():
        if key not in ordered:
            ordered[key] = value
    return ordered


def normalize_source_for_feed_source(source: dict[str, Any]) -> dict[str, Any]:
    """Normalize feed source data to canonical FeedSource storage shape."""
    source_url = source.get("url")
    feed, site = _resolve_feed_and_site(source_url, source.get("feed"), source.get("site"))

    canonical_url = feed or site or source_url
    if not isinstance(canonical_url, str) or not canonical_url.strip():
        msg = "Source entry requires a URL via one of: url, feed, site"
        raise ValueError(msg)

    canonical_url = canonical_url.strip()

    platform = detect_platform(site or canonical_url)
    source_type = _resolve_source_type(source.get("source_type"), platform)

    if not feed and site and platform:
        generated_feed = generate_platform_feed_url(
            site,
            platform,
            source.get("platform_config")
            if isinstance(source.get("platform_config"), dict)
            else None,
        )
        if generated_feed:
            feed = generated_feed

    title = source.get("title")
    if not isinstance(title, str) or not title.strip():
        title = site or feed or canonical_url

    tags = source.get("tags", [])
    if not isinstance(tags, list):
        tags = []
    tags = [str(tag) for tag in tags if isinstance(tag, str) and tag]

    notes = source.get("notes")
    if not isinstance(notes, str) or not notes.strip():
        notes = None

    return {
        "id": source.get("id") or _stable_source_id(canonical_url),
        "feed": feed,
        "site": site or (None if feed == canonical_url else canonical_url),
        "title": title,
        "source_type": source_type,
        "topics": _normalize_topics(source.get("topics")),
        "tags": tags,
        "notes": notes,
    }


def canonicalize_catalog_source(source: dict[str, Any]) -> dict[str, Any]:  # noqa: PLR0912
    """Canonicalize a minimal or enriched source entry for generated asset exports."""
    normalized = normalize_source_for_feed_source(source)
    canonical = dict(source)

    source_url = canonical.get("url")
    normalized_feed = normalized.get("feed")
    normalized_site = normalized.get("site")
    if not normalized_feed and isinstance(source_url, str) and source_url.strip():
        normalized_feed = source_url.strip()
    if (
        not normalized_site
        and isinstance(source_url, str)
        and source_url.strip()
        and not _looks_like_feed_url(source_url)
    ):
        normalized_site = source_url.strip()

    canonical["id"] = normalized["id"]
    canonical["title"] = normalized["title"]
    canonical["topics"] = normalized["topics"]

    if normalized_feed:
        canonical["feed"] = normalized_feed
    else:
        canonical.pop("feed", None)

    if normalized_site:
        canonical["site"] = normalized_site
    else:
        canonical.pop("site", None)

    source_type = _normalize_source_type_value(
        normalized.get("source_type") or canonical.get("source_type")
    )
    if source_type:
        canonical["source_type"] = source_type
    else:
        canonical.pop("source_type", None)

    tags = normalized.get("tags", [])
    if tags:
        canonical["tags"] = tags
    else:
        canonical.pop("tags", None)

    notes = normalized.get("notes")
    if notes is not None:
        canonical["notes"] = notes
    else:
        canonical.pop("notes", None)

    if not isinstance(canonical.get("title"), str) or not canonical["title"].strip():
        canonical.pop("title", None)

    return _order_source_fields(_prune_empty_values(canonical))


def canonicalize_enriched_source(source: dict[str, Any]) -> dict[str, Any]:  # noqa: PLR0912
    """Canonicalize an enriched source entry to the enriched schema contract."""
    canonical = canonicalize_catalog_source(source)

    meta = dict(source.get("meta") or {})
    curation = dict(source.get("curation") or {})
    provenance = dict(source.get("provenance") or {})

    for source_key, meta_key in _ENRICHED_META_FIELD_ALIASES.items():
        value = source.get(source_key)
        if value is not None and meta_key not in meta:
            meta[meta_key] = value

    enrichment = source.get("enrichment")
    if isinstance(enrichment, dict):
        if enrichment.get("quality_score") is not None and "quality_score" not in meta:
            meta["quality_score"] = enrichment["quality_score"]
        if enrichment.get("health_score") is not None and "health_score" not in meta:
            meta["health_score"] = enrichment["health_score"]

    for source_key, curation_key in _ENRICHED_CURATION_FIELD_ALIASES.items():
        value = source.get(source_key)
        if value is not None and curation_key not in curation:
            curation[curation_key] = value

    for source_key, provenance_key in _ENRICHED_PROVENANCE_FIELD_ALIASES.items():
        value = source.get(source_key)
        if value is not None and provenance_key not in provenance:
            provenance[provenance_key] = value

    if "discover" not in canonical:
        discover = source.get("discover")
        if discover is None:
            discover = source.get("discover_config")
        if discover is not None:
            canonical["discover"] = discover

    for block_name, block in (
        ("meta", _prune_empty_values(meta)),
        ("curation", _prune_empty_values(curation)),
        ("provenance", _prune_empty_values(provenance)),
    ):
        if block:
            canonical[block_name] = block
        else:
            canonical.pop(block_name, None)

    for legacy_key in (
        *_ENRICHED_META_FIELD_ALIASES.keys(),
        *_ENRICHED_CURATION_FIELD_ALIASES.keys(),
        *_ENRICHED_PROVENANCE_FIELD_ALIASES.keys(),
        "enrichment",
        "discover_config",
    ):
        if legacy_key not in {"notes", "source_type"}:
            canonical.pop(legacy_key, None)

    return _order_source_fields(_prune_empty_values(canonical))


def canonicalize_catalog(
    data: dict[str, Any],
    *,
    enriched: bool = False,
) -> dict[str, Any]:
    """Canonicalize an entire catalog while preserving top-level metadata."""
    canonical = {key: value for key, value in data.items() if key != "sources"}
    source_normalizer = canonicalize_enriched_source if enriched else canonicalize_catalog_source
    canonical["sources"] = [
        source_normalizer(source) for source in data.get("sources", []) if isinstance(source, dict)
    ]

    document_meta = dict(canonical.get("document_meta") or {})
    if document_meta:
        canonical["document_meta"] = document_meta

    return canonical


def load_feeds(path: Path | str) -> dict[str, Any]:
    """Load feeds from YAML file.

    Args:
        path: Path to feeds.yaml file

    Returns:
        Dictionary containing feeds data with 'sources' list

    Raises:
        FileNotFoundError: If the file doesn't exist
        yaml.YAMLError: If the YAML is invalid
    """
    path = Path(path)

    if not path.exists():
        msg = f"Feeds file not found: {path}"
        raise FileNotFoundError(msg)

    logger.info(f"Loading feeds from {path}")

    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)

    # Handle empty/None YAML files
    if data is None:
        data = {}

    sources = data.get("sources", [])
    logger.info(f"Loaded {len(sources)} feed sources")

    return data


def load_topics(path: Path | str) -> dict[str, Any]:
    """Load topics from YAML file.

    Args:
        path: Path to topics.yaml file

    Returns:
        Dictionary containing topics data

    Raises:
        FileNotFoundError: If the file doesn't exist
        yaml.YAMLError: If the YAML is invalid
    """
    path = Path(path)

    if not path.exists():
        msg = f"Topics file not found: {path}"
        raise FileNotFoundError(msg)

    logger.info(f"Loading topics from {path}")

    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if data is None:
        data = {}

    topics = data.get("topics") or []
    logger.info(f"Loaded {len(topics)} topics")

    return data


def save_feeds(data: dict[str, Any], path: Path | str) -> None:
    """Save feeds to YAML file.

    Args:
        data: Dictionary containing feeds data
        path: Output path for YAML file
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Saving feeds to {path}")

    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    sources_count = len(data.get("sources", []))
    logger.info(f"Saved {sources_count} feed sources to {path}")


def save_topics(data: dict[str, Any], path: Path | str) -> None:
    """Save topics to YAML file.

    Args:
        data: Dictionary containing topics data
        path: Output path for YAML file
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Saving topics to {path}")

    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    topics_count = len(data.get("topics", []))
    logger.info(f"Saved {topics_count} topics to {path}")
