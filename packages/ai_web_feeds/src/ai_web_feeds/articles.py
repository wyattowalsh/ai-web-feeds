"""Article identity helpers for stable cross-store keys."""

from __future__ import annotations

import hashlib
from typing import Any


def normalize_article_identity_value(value: Any) -> str:
    """Normalize a guid/link identity value for hashing."""
    if not isinstance(value, str):
        return ""
    return value.strip().lower()


def article_identity_digest(value: Any) -> str | None:
    """Return sha256 hex digest for a normalized identity value."""
    normalized = normalize_article_identity_value(value)
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def resolve_article_identity_value(guid: Any, link: Any) -> str | None:
    """Prefer guid identity, then fall back to link."""
    normalized_guid = normalize_article_identity_value(guid)
    if normalized_guid:
        return normalized_guid
    normalized_link = normalize_article_identity_value(link)
    return normalized_link or None


def compute_article_stable_id(
    feed_id: str,
    *,
    guid: Any = None,
    link: Any = None,
    guid_hash: str | None = None,
    link_hash: str | None = None,
) -> str | None:
    """Compute a stable article key scoped to a feed source."""
    if not isinstance(feed_id, str) or not feed_id.strip():
        return None

    if guid_hash:
        return f"{feed_id}:{guid_hash}"
    if link_hash and not guid_hash:
        return f"{feed_id}:{link_hash}"

    identity = resolve_article_identity_value(guid, link)
    if not identity:
        return None
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
    return f"{feed_id}:{digest}"
