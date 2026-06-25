"""Map enriched YAML source dicts to FeedSource-compatible flat dicts."""

from __future__ import annotations

import json
from hashlib import sha256
from typing import Any

from ai_web_feeds.utils import parse_datetime

_PROVENANCE_KEY_MAP = {
    "source": "provenance_source",
    "from": "provenance_from",
    "license": "provenance_license",
}


def _first_non_empty_string(*values: Any) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    seen: set[str] = set()
    strings: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        strings.append(normalized)
    return strings


def _sorted_by_id(items: list[Any]) -> list[dict[str, Any]]:
    valid = [item for item in items if isinstance(item, dict) and item.get("id")]
    return sorted(valid, key=lambda item: str(item["id"]))


def flatten_provenance(source: dict[str, Any]) -> dict[str, Any]:
    """Flatten nested ``provenance`` block to FeedSource provenance_* keys."""
    provenance = source.get("provenance")
    if not isinstance(provenance, dict):
        provenance = {}

    flattened: dict[str, Any] = {}
    for yaml_key, model_key in _PROVENANCE_KEY_MAP.items():
        value = provenance.get(yaml_key)
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                flattened[model_key] = stripped
        elif value is not None:
            flattened[model_key] = value
    return flattened


def catalog_hash(feeds_doc: dict[str, Any], topics_doc: dict[str, Any]) -> str:
    """Return sha256 hex digest of canonical combined feeds + topics JSON."""
    payload = {
        "feeds": {
            "schema_version": feeds_doc.get("schema_version"),
            "sources": _sorted_by_id(feeds_doc.get("sources", [])),
        },
        "topics": {
            "version": topics_doc.get("version"),
            "relations_meta": topics_doc.get("relations_meta", {}),
            "topics": _sorted_by_id(topics_doc.get("topics", [])),
        },
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return sha256(canonical.encode("utf-8")).hexdigest()


def map_id(source: dict[str, Any]) -> dict[str, Any]:
    """Map stable source identifier."""
    source_id = source.get("id")
    if not isinstance(source_id, str) or not source_id.strip():
        raise ValueError("source id is required")
    return {"id": source_id.strip()}


def map_url_feed_site(source: dict[str, Any]) -> dict[str, Any]:
    """Map canonical url/feed/site triple."""
    url = _first_non_empty_string(source.get("url"), source.get("feed"), source.get("site"))
    feed = _first_non_empty_string(source.get("feed"), source.get("url"))
    site_raw = source.get("site")
    site = site_raw.strip() if isinstance(site_raw, str) and site_raw.strip() else None

    mapped: dict[str, Any] = {}
    if url:
        mapped["url"] = url
    if feed:
        mapped["feed"] = feed
    elif url:
        mapped["feed"] = url
    if site:
        mapped["site"] = site
    return mapped


def map_title(source: dict[str, Any]) -> dict[str, Any]:
    """Map human-readable title with load.py fallbacks."""
    title = source.get("title")
    if isinstance(title, str) and title.strip():
        return {"title": title.strip()}

    url = _first_non_empty_string(source.get("url"), source.get("feed"), source.get("site"))
    if url:
        return {"title": url}

    source_id = source.get("id")
    if isinstance(source_id, str) and source_id.strip():
        return {"title": source_id.strip()}

    return {"title": "Untitled source"}


def map_topics_tags(source: dict[str, Any]) -> dict[str, Any]:
    """Map topics, tags, and topic weight map."""
    topics = _string_list(source.get("topics"))
    tags = _string_list(source.get("tags"))

    weights_raw = source.get("topic_weights")
    topic_weights: dict[str, float] = {}
    if isinstance(weights_raw, dict):
        for key, value in weights_raw.items():
            if isinstance(key, str) and isinstance(value, (int, float)):
                topic_weights[key] = float(value)

    return {
        "topics": topics,
        "tags": tags or list(topics),
        "topic_weights": topic_weights,
    }


def map_meta_block(source: dict[str, Any]) -> dict[str, Any]:
    """Map nested meta block to top-level FeedSource metadata fields."""
    meta = source.get("meta")
    if not isinstance(meta, dict):
        meta = {}

    mapped: dict[str, Any] = {}

    language = meta.get("language")
    if isinstance(language, str) and language.strip():
        mapped["language"] = language.strip()

    feed_format = meta.get("format")
    if isinstance(feed_format, str) and feed_format.strip():
        mapped["format"] = feed_format.strip()

    for field in ("updated", "last_validated"):
        raw_value = meta.get(field)
        if isinstance(raw_value, str):
            parsed = parse_datetime(raw_value)
            if parsed is not None:
                mapped[field] = parsed

    if "verified" in meta:
        mapped["verified"] = bool(meta["verified"])

    contributor = meta.get("contributor")
    if isinstance(contributor, str) and contributor.strip():
        mapped["contributor"] = contributor.strip()

    if "popularity_score" in meta and isinstance(meta["popularity_score"], (int, float)):
        mapped["popularity_score"] = float(meta["popularity_score"])

    if "validation_count" in meta and isinstance(meta["validation_count"], int):
        mapped["validation_count"] = meta["validation_count"]

    return mapped


def map_curation_block(source: dict[str, Any]) -> dict[str, Any]:
    """Map nested curation block to top-level FeedSource curation fields."""
    curation = source.get("curation")
    if not isinstance(curation, dict):
        curation = {}

    mapped: dict[str, Any] = {}

    status = curation.get("status")
    if isinstance(status, str) and status.strip():
        mapped["curation_status"] = status.strip()

    since = curation.get("since")
    if isinstance(since, str):
        parsed = parse_datetime(since)
        if parsed is not None:
            mapped["curation_since"] = parsed

    curator = curation.get("by")
    if isinstance(curator, str) and curator.strip():
        mapped["curation_by"] = curator.strip()

    if "quality_score" in curation and isinstance(curation["quality_score"], (int, float)):
        mapped["quality_score"] = float(curation["quality_score"])

    notes = curation.get("notes")
    if isinstance(notes, str) and notes.strip():
        mapped["curation_notes"] = notes.strip()

    return mapped


def map_provenance_block(source: dict[str, Any]) -> dict[str, Any]:
    """Map nested provenance block to top-level FeedSource provenance fields."""
    return flatten_provenance(source)


def _map_discover(source: dict[str, Any]) -> dict[str, Any]:
    discover = source.get("discover")
    if discover is None:
        return {}
    if isinstance(discover, bool):
        return {"discover_enabled": discover, "discover_config": {}}
    if isinstance(discover, dict):
        config = {key: value for key, value in discover.items() if key != "enabled"}
        return {
            "discover_enabled": bool(discover.get("enabled", False)),
            "discover_config": config,
        }
    return {}


def map_enriched_source(source: dict[str, Any]) -> dict[str, Any]:
    """Compose mapper atoms into a FeedSource-compatible flat dict."""
    if not isinstance(source, dict):
        raise TypeError("source must be a dict")

    mapped: dict[str, Any] = {}
    mapped.update(map_id(source))
    mapped.update(map_url_feed_site(source))
    mapped.update(map_title(source))
    mapped.update(map_topics_tags(source))
    mapped.update(map_meta_block(source))
    mapped.update(map_curation_block(source))
    mapped.update(map_provenance_block(source))
    mapped.update(_map_discover(source))

    source_type = source.get("source_type")
    if isinstance(source_type, str) and source_type.strip():
        mapped["source_type"] = source_type.strip()

    mediums = source.get("mediums")
    if isinstance(mediums, list):
        mapped["mediums"] = [item for item in mediums if isinstance(item, str) and item.strip()]

    relations = source.get("relations")
    if isinstance(relations, dict):
        mapped["relations"] = relations

    mappings = source.get("mappings")
    if isinstance(mappings, dict):
        mapped["mappings"] = {
            str(key): str(value)
            for key, value in mappings.items()
            if key is not None and value is not None
        }

    notes = source.get("notes")
    if isinstance(notes, str) and notes.strip():
        mapped["notes"] = notes.strip()

    return mapped
