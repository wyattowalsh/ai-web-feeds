"""Unit tests for ai_web_feeds.articles module."""

import hashlib

import pytest
from ai_web_feeds.articles import (
    article_identity_digest,
    compute_article_stable_id,
    normalize_article_identity_value,
    resolve_article_identity_value,
)


@pytest.mark.unit
class TestNormalizeArticleIdentityValue:
    def test_strips_and_lowercases(self):
        assert normalize_article_identity_value("  HTTPS://Example.COM/Post  ") == (
            "https://example.com/post"
        )

    def test_non_string_returns_empty(self):
        assert normalize_article_identity_value(None) == ""
        assert normalize_article_identity_value(42) == ""

    def test_empty_string(self):
        assert normalize_article_identity_value("") == ""
        assert normalize_article_identity_value("   ") == ""


@pytest.mark.unit
class TestArticleIdentityDigest:
    def test_returns_sha256_hex(self):
        normalized = "https://example.com/article"
        expected = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        assert article_identity_digest("HTTPS://Example.COM/article") == expected

    def test_empty_or_none_returns_none(self):
        assert article_identity_digest(None) is None
        assert article_identity_digest("") is None
        assert article_identity_digest("   ") is None


@pytest.mark.unit
class TestResolveArticleIdentityValue:
    def test_prefers_guid_over_link(self):
        assert resolve_article_identity_value("GUID-1", "https://example.com") == "guid-1"

    def test_falls_back_to_link(self):
        assert (
            resolve_article_identity_value(None, "https://Example.COM/x") == "https://example.com/x"
        )

    def test_returns_none_when_both_empty(self):
        assert resolve_article_identity_value(None, None) is None
        assert resolve_article_identity_value("", "") is None


@pytest.mark.unit
class TestComputeArticleStableId:
    def test_computes_from_guid(self):
        feed_id = "feed-1"
        guid = "unique-guid"
        digest = hashlib.sha256(guid.encode()).hexdigest()
        assert compute_article_stable_id(feed_id, guid=guid) == f"{feed_id}:{digest}"

    def test_computes_from_link_when_no_guid(self):
        feed_id = "feed-1"
        link = "https://example.com/post"
        digest = hashlib.sha256(link.encode()).hexdigest()
        assert compute_article_stable_id(feed_id, link=link) == f"{feed_id}:{digest}"

    def test_reuses_stored_guid_hash(self):
        assert compute_article_stable_id("feed-1", guid_hash="abc123") == "feed-1:abc123"

    def test_prefers_guid_hash_over_link_hash(self):
        assert (
            compute_article_stable_id("feed-1", guid_hash="guid-digest", link_hash="link-digest")
            == "feed-1:guid-digest"
        )

    def test_returns_none_without_feed_id(self):
        assert compute_article_stable_id("", guid="x") is None
        assert compute_article_stable_id("", link="https://x") is None

    def test_returns_none_without_identity(self):
        assert compute_article_stable_id("feed-1") is None
        assert compute_article_stable_id("feed-1", guid=None, link=None) is None
