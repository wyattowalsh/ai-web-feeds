"""Unit tests for catalog_sync.mapper."""

from datetime import UTC, datetime

import pytest
from ai_web_feeds.catalog_sync.mapper import (
    catalog_hash,
    flatten_provenance,
    map_curation_block,
    map_enriched_source,
    map_id,
    map_meta_block,
    map_provenance_block,
    map_title,
    map_topics_tags,
    map_url_feed_site,
)


@pytest.fixture
def sample_source() -> dict:
    return {
        "id": "openai-blog",
        "url": "https://openai.com/blog/rss/",
        "feed": "https://openai.com/blog/rss/",
        "site": "https://openai.com/blog",
        "title": "OpenAI Blog",
        "source_type": "blog",
        "mediums": ["text"],
        "tags": ["chatgpt", "gpt-4"],
        "topics": ["industry", "product", "llm"],
        "topic_weights": {"industry": 0.9, "llm": 0.95},
        "meta": {
            "language": "en",
            "format": "rss",
            "updated": "2025-11-02T10:30:00Z",
            "last_validated": "2025-11-02T09:15:00Z",
            "verified": True,
            "contributor": "aiwebfeeds-curator",
            "popularity_score": 0.95,
            "validation_count": 247,
        },
        "curation": {
            "status": "verified",
            "since": "2025-01-15T00:00:00Z",
            "by": "admin",
            "quality_score": 0.92,
            "notes": "High-quality source.",
        },
        "provenance": {
            "source": "manual",
            "from": "https://github.com/wyattowalsh/ai-web-feeds",
            "license": "Public",
        },
        "discover": {
            "enabled": True,
            "strategy": "rss-autodiscovery",
            "params": {},
        },
        "relations": {"related": ["anthropic-blog"]},
        "mappings": {"wikidata": "Q21634357"},
        "notes": "Example feed",
    }


@pytest.mark.unit
class TestFlattenProvenance:
    def test_flattens_nested_provenance_keys(self, sample_source: dict) -> None:
        result = flatten_provenance(sample_source)
        assert result == {
            "provenance_source": "manual",
            "provenance_from": "https://github.com/wyattowalsh/ai-web-feeds",
            "provenance_license": "Public",
        }

    def test_missing_provenance_returns_empty_dict(self) -> None:
        assert flatten_provenance({}) == {}


@pytest.mark.unit
class TestCatalogHash:
    def test_stable_for_same_payload(self) -> None:
        feeds_doc = {
            "schema_version": "feeds.enriched-3.0.0",
            "sources": [
                {"id": "b", "url": "https://b.example"},
                {"id": "a", "url": "https://a.example"},
            ],
        }
        topics_doc = {
            "version": "2025-10",
            "topics": [{"id": "ml", "label": "ML"}, {"id": "ai", "label": "AI"}],
            "relations_meta": {"directed": ["depends_on"]},
        }
        assert catalog_hash(feeds_doc, topics_doc) == catalog_hash(feeds_doc, topics_doc)

    def test_order_independent_for_sources_and_topics(self) -> None:
        feeds_a = {
            "schema_version": "feeds.enriched-3.0.0",
            "sources": [
                {"id": "a", "url": "https://a.example"},
                {"id": "b", "url": "https://b.example"},
            ],
        }
        feeds_b = {
            "schema_version": "feeds.enriched-3.0.0",
            "sources": [
                {"id": "b", "url": "https://b.example"},
                {"id": "a", "url": "https://a.example"},
            ],
        }
        topics_a = {"version": "2025-10", "topics": [{"id": "ai"}, {"id": "ml"}]}
        topics_b = {"version": "2025-10", "topics": [{"id": "ml"}, {"id": "ai"}]}
        assert catalog_hash(feeds_a, topics_a) == catalog_hash(feeds_b, topics_b)

    def test_changes_when_source_content_changes(self) -> None:
        feeds_doc = {
            "schema_version": "feeds.enriched-3.0.0",
            "sources": [{"id": "a", "url": "https://a.example"}],
        }
        topics_doc = {"version": "2025-10", "topics": [{"id": "ai"}]}
        baseline = catalog_hash(feeds_doc, topics_doc)
        changed = catalog_hash(
            {
                "schema_version": "feeds.enriched-3.0.0",
                "sources": [{"id": "a", "url": "https://changed.example"}],
            },
            topics_doc,
        )
        assert baseline != changed


@pytest.mark.unit
class TestMapperAtoms:
    def test_map_id_requires_non_empty_string(self) -> None:
        with pytest.raises(ValueError, match="source id is required"):
            map_id({})

    def test_map_url_feed_site_defaults_feed_to_url(self) -> None:
        result = map_url_feed_site({"url": "https://example.com/feed.xml"})
        assert result == {
            "url": "https://example.com/feed.xml",
            "feed": "https://example.com/feed.xml",
        }

    def test_map_title_fallback_to_url(self) -> None:
        assert map_title({"url": "https://example.com"}) == {"title": "https://example.com"}

    def test_map_topics_tags_defaults_tags_to_topics(self) -> None:
        result = map_topics_tags({"topics": ["ml", "ai"]})
        assert result["topics"] == ["ml", "ai"]
        assert result["tags"] == ["ml", "ai"]

    def test_map_meta_block_parses_datetimes(self, sample_source: dict) -> None:
        result = map_meta_block(sample_source)
        assert result["language"] == "en"
        assert result["format"] == "rss"
        assert result["verified"] is True
        assert result["updated"] == datetime(2025, 11, 2, 10, 30, tzinfo=UTC)
        assert result["validation_count"] == 247

    def test_map_curation_block(self, sample_source: dict) -> None:
        result = map_curation_block(sample_source)
        assert result["curation_status"] == "verified"
        assert result["curation_by"] == "admin"
        assert result["quality_score"] == 0.92
        assert result["curation_since"] == datetime(2025, 1, 15, 0, 0, tzinfo=UTC)

    def test_map_provenance_block_matches_flatten(self, sample_source: dict) -> None:
        assert map_provenance_block(sample_source) == flatten_provenance(sample_source)


@pytest.mark.unit
class TestMapEnrichedSource:
    def test_composes_full_feed_source_dict(self, sample_source: dict) -> None:
        result = map_enriched_source(sample_source)

        assert result["id"] == "openai-blog"
        assert result["url"] == "https://openai.com/blog/rss/"
        assert result["feed"] == "https://openai.com/blog/rss/"
        assert result["site"] == "https://openai.com/blog"
        assert result["title"] == "OpenAI Blog"
        assert result["source_type"] == "blog"
        assert result["mediums"] == ["text"]
        assert result["topics"] == ["industry", "product", "llm"]
        assert result["tags"] == ["chatgpt", "gpt-4"]
        assert result["topic_weights"] == {"industry": 0.9, "llm": 0.95}
        assert result["language"] == "en"
        assert result["format"] == "rss"
        assert result["verified"] is True
        assert result["contributor"] == "aiwebfeeds-curator"
        assert result["curation_status"] == "verified"
        assert result["provenance_source"] == "manual"
        assert result["discover_enabled"] is True
        assert result["discover_config"] == {"strategy": "rss-autodiscovery", "params": {}}
        assert result["relations"] == {"related": ["anthropic-blog"]}
        assert result["mappings"] == {"wikidata": "Q21634357"}
        assert result["notes"] == "Example feed"

    def test_discover_bool_form(self) -> None:
        result = map_enriched_source({"id": "x", "title": "X", "discover": True})
        assert result["discover_enabled"] is True
        assert result["discover_config"] == {}

    def test_requires_dict_source(self) -> None:
        with pytest.raises(TypeError, match="source must be a dict"):
            map_enriched_source("not-a-dict")  # type: ignore[arg-type]
