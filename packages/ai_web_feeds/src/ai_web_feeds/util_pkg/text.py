"""Text, id, and timestamp helpers."""

import re
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from hashlib import sha256

from ai_web_feeds.util_pkg.namespace import lookup


def sanitize_url(url: str) -> str:
    """Normalize a user-provided URL string for deterministic comparisons."""

    normalized = url.strip()
    if normalized.endswith("/") and lookup("urlparse")(normalized).path in {"", "/"}:
        return normalized.rstrip("/")
    return normalized.rstrip("/") if normalized.endswith("/") else normalized


def sanitize_text(text: object) -> str:
    """Collapse whitespace in arbitrary text-like input."""

    return re.sub(r"\s+", " ", str(text)).strip()


def generate_feed_id(url: str) -> str:
    """Generate a stable, readable feed ID from a URL."""

    normalized = lookup("sanitize_url")(url).lower()
    parsed = lookup("urlparse")(normalized)
    host = parsed.netloc.removeprefix("www.")
    path = parsed.path.strip("/").replace("/", "-")
    slug_source = "-".join(part for part in (host, path) if part) or "feed"
    slug = re.sub(r"[^a-z0-9]+", "-", slug_source).strip("-") or "feed"
    digest = sha256(normalized.encode("utf-8")).hexdigest()[:10]
    return f"{slug[:48].rstrip('-')}-{digest}"


def parse_datetime(value: str) -> datetime | None:
    """Parse common feed timestamp formats into timezone-aware datetimes."""

    if not isinstance(value, str) or not value.strip():
        return None

    raw = value.strip()
    normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        try:
            parsed = parsedate_to_datetime(raw)
        except (TypeError, ValueError):
            return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def is_valid_url(url: str) -> bool:
    """Return whether a URL is an HTTP(S) URL with a network location."""

    if not isinstance(url, str) or not url.strip():
        return False
    parsed = lookup("urlparse")(url.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
