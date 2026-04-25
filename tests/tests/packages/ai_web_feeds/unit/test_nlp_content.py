"""Unit tests for shared NLP content helpers."""

from types import SimpleNamespace

from ai_web_feeds.nlp.content import (
    build_article_payload,
    extract_article_body,
    extract_article_text,
)


def test_extract_article_body_prefers_content_html_when_content_empty():
    """Empty ``content`` values should fall back to populated ``content_html`` payloads."""
    article = {
        "title": "Test",
        "content": "   ",
        "content_html": "<p>Rendered body</p>",
        "summary": "Fallback summary",
    }

    assert extract_article_body(article) == "<p>Rendered body</p>"


def test_build_article_payload_supports_object_inputs():
    """Shared payload normalization should work for model-like objects."""
    article = SimpleNamespace(
        id=1,
        title="Object article",
        content_html="Rendered body",
        summary="Summary",
        link="https://example.com/article",
        feed_id="feed-1",
    )

    payload = build_article_payload(article)

    assert payload["id"] == 1
    assert payload["content"] == "Rendered body"
    assert payload["url"] == "https://example.com/article"
    assert payload["feed_id"] == "feed-1"


def test_extract_article_text_requires_body_before_title():
    """Title-only payloads should be ignored when callers require body text."""
    article = {
        "title": "Headline only",
        "summary": "",
        "content": "",
    }

    assert extract_article_text(article, require_body_for_title=True) == ""
