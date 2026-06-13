"""ai_web_feeds.load -- Load feed data from YAML files"""

from copy import deepcopy
from hashlib import sha256
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlparse

import yaml
from loguru import logger

_VALID_SOURCE_TYPES = frozenset(
    {
        "blog",
        "newsletter",
        "podcast",
        "journal",
        "preprint",
        "organization",
        "aggregator",
        "video",
        "docs",
        "forum",
        "dataset",
        "code-repo",
        "newsroom",
        "education",
        "reddit",
        "medium",
        "youtube",
        "github",
        "substack",
        "devto",
        "hackernews",
        "twitter",
        "arxiv",
    }
)


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
    if not isinstance(data, dict):
        msg = f"Feeds file must contain a YAML object: {path}"
        raise TypeError(msg)

    sources = data.get("sources", [])
    logger.info(f"Loaded {len(sources)} feed sources")

    return cast(dict[str, Any], data)


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
    if not isinstance(data, dict):
        msg = f"Topics file must contain a YAML object: {path}"
        raise TypeError(msg)

    topics = data.get("topics", [])
    logger.info(f"Loaded {len(topics)} topics")

    return cast(dict[str, Any], data)


def canonicalize_catalog(data: dict[str, Any], *, enriched: bool = False) -> dict[str, Any]:
    """Return the canonical catalog shape expected by validation helpers.

    Minimal contributor catalogs only require ``url`` and ``topics``. Generated
    surfaces need stable IDs, feed aliases, tags, and source types to support
    validation and web filters, so this function normalizes those derived fields
    without mutating the input dictionary.
    """

    canonical = deepcopy(data)
    canonical["sources"] = [
        _canonicalize_source(source, enriched=enriched)
        for source in data.get("sources", [])
        if isinstance(source, dict)
    ]

    if enriched:
        document_meta = dict(canonical.get("document_meta", {}))
        document_meta["total_sources"] = len(canonical["sources"])
        canonical["document_meta"] = document_meta

    return canonical


def infer_source_type(source: dict[str, Any]) -> str:
    """Infer a valid source type from URL and topic hints."""

    explicit_source_type = source.get("source_type")
    if isinstance(explicit_source_type, str):
        normalized_source_type = explicit_source_type.strip()
        if normalized_source_type in _VALID_SOURCE_TYPES:
            return normalized_source_type

    url = _first_non_empty_string(source.get("url"), source.get("feed"), source.get("site"))
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    path = parsed.path.lower()
    topics = set(_string_list(source.get("topics"))) | set(_string_list(source.get("tags")))
    source_type = _platform_source_type(domain)

    if source_type is None:
        topic_rules = (
            ("podcast", "podcasts" in topics or "podcast" in path),
            ("video", bool({"videos", "video"} & topics)),
            ("newsletter", "newsletters" in topics or "newsletter" in path),
            ("docs", bool({"docs", "documentation"} & topics)),
            ("dataset", bool({"datasets", "data"} & topics)),
            ("education", "education" in topics),
            ("journal", "papers" in topics),
            ("organization", bool(topics & {"industry", "product", "governance", "safety"})),
        )
        source_type = next((candidate for candidate, matches in topic_rules if matches), None)

    return source_type or "blog"


def _canonicalize_source(source: dict[str, Any], *, enriched: bool) -> dict[str, Any]:
    canonical = deepcopy(source)
    url = _first_non_empty_string(
        canonical.get("url"),
        canonical.get("feed"),
        canonical.get("site"),
    )

    if url:
        canonical.setdefault("url", url)
        canonical.setdefault("feed", url)

    if not _first_non_empty_string(canonical.get("id")) and url:
        canonical["id"] = sha256(url.encode()).hexdigest()[:16]

    if not _first_non_empty_string(canonical.get("title")):
        canonical["title"] = url or canonical.get("id") or "Untitled source"

    topics = _string_list(canonical.get("topics"))
    canonical["topics"] = topics

    tags = _string_list(canonical.get("tags"))
    canonical["tags"] = tags or list(topics)

    if enriched:
        canonical["source_type"] = infer_source_type(canonical)

    return canonical


def _first_non_empty_string(*values: Any) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()

    return ""


def _platform_source_type(domain: str) -> str | None:
    if domain.endswith(".substack.com") or domain in {"substack.com", "www.substack.com"}:
        return "substack"

    platform_types = {
        "github": {"github.com", "www.github.com"},
        "youtube": {"youtube.com", "www.youtube.com", "youtu.be"},
        "reddit": {"reddit.com", "www.reddit.com", "old.reddit.com"},
        "devto": {"dev.to"},
        "medium": {"medium.com", "towardsdatascience.com", "www.towardsdatascience.com"},
        "hackernews": {"news.ycombinator.com"},
        "twitter": {"twitter.com", "www.twitter.com", "x.com", "www.x.com"},
        "arxiv": {"arxiv.org", "www.arxiv.org", "export.arxiv.org"},
    }
    for source_type, domains in platform_types.items():
        if domain in domains:
            return source_type

    return None


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
