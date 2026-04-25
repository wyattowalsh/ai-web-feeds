"""Shared article-content helpers for NLP modules."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def _has_article_value(value: Any) -> bool:
    """Return True when a candidate article value is meaningfully populated."""
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list | tuple | set | dict):
        return bool(value)
    return True


def article_value(article: Mapping[str, Any] | Any, *keys: str) -> Any:
    """Return the first matching mapping key or attribute from an article-like object."""
    if isinstance(article, Mapping):
        for key in keys:
            if key in article:
                value = article.get(key)
                if _has_article_value(value):
                    return value
        return None

    for key in keys:
        if hasattr(article, key):
            value = getattr(article, key)
            if _has_article_value(value):
                return value
    return None


def normalize_article_text(value: Any, *, strip_edges: bool = True) -> str:
    """Normalize article payload fragments into plain text."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip() if strip_edges else value
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, Mapping):
                normalized = normalize_article_text(item.get("value"), strip_edges=strip_edges)
            else:
                normalized = normalize_article_text(item, strip_edges=strip_edges)
            if normalized:
                parts.append(normalized)
        joined = " ".join(parts)
        return joined.strip() if strip_edges else joined
    rendered = str(value)
    return rendered.strip() if strip_edges else rendered


def build_article_payload(article: Mapping[str, Any] | Any) -> dict[str, Any]:
    """Normalize mapping or model instances into a shared NLP article payload."""
    return {
        "id": article_value(article, "id"),
        "title": normalize_article_text(article_value(article, "title")),
        "summary": normalize_article_text(article_value(article, "summary")),
        "content": normalize_article_text(
            article_value(article, "content", "content_html"),
            strip_edges=False,
        ),
        "author": normalize_article_text(article_value(article, "author")),
        "author_detail": article_value(article, "author_detail"),
        "url": normalize_article_text(article_value(article, "url", "link")),
        "feed_id": article_value(article, "feed_id"),
        "share_count": article_value(article, "share_count") or 0,
    }


def extract_article_body(article: Mapping[str, Any] | Any) -> str:
    """Return the body content for an article, falling back to summary."""
    content = normalize_article_text(article_value(article, "content", "content_html"))
    if content:
        return content
    return normalize_article_text(article_value(article, "summary"))


def extract_article_text(
    article: Mapping[str, Any] | Any,
    *,
    include_title: bool = True,
    require_body_for_title: bool = False,
    include_summary: bool = True,
    include_content: bool = True,
) -> str:
    """Build NLP input text from article title/summary/content fields."""
    title = normalize_article_text(article_value(article, "title"))
    summary = normalize_article_text(article_value(article, "summary")) if include_summary else ""
    content = (
        normalize_article_text(article_value(article, "content", "content_html"))
        if include_content
        else ""
    )
    has_body = bool(summary or content)

    parts = []
    if include_title and title and (not require_body_for_title or has_body):
        parts.append(title)
    if include_summary and summary:
        parts.append(summary)
    if include_content and content:
        parts.append(content)
    return " ".join(parts).strip()
