"""Unit tests for ai_web_feeds.enrich module."""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from ai_web_feeds.enrich import AdvancedEnricher, FeedEnrichment
from ai_web_feeds.models import FeedFormat


@pytest.mark.unit
class TestFeedEnrichment:
    """Test FeedEnrichment class."""

    def test_init(self):
        """Test FeedEnrichment initialization."""
        enrichment = FeedEnrichment()
        assert enrichment.title is None
        assert enrichment.description is None
        assert enrichment.health_score == 0.0
        assert enrichment.quality_score == 0.0
        assert enrichment.entry_count == 0

    def test_to_dict(self):
        """Test converting enrichment to dictionary."""
        enrichment = FeedEnrichment()
        enrichment.title = "Test Feed"
        enrichment.entry_count = 10
        enrichment.format = FeedFormat.RSS

        result = enrichment.to_dict()
        assert isinstance(result, dict)
        # to_dict() returns nested structure
        assert result["basic"]["title"] == "Test Feed"
        assert result["content"]["entry_count"] == 10
        assert result["technical"]["format"] == "rss"


@pytest.mark.unit
class TestAdvancedEnricher:
    """Test AdvancedEnricher class."""

    def test_init(self):
        """Test AdvancedEnricher initialization."""
        enricher = AdvancedEnricher()
        assert enricher is not None

    @pytest.mark.asyncio
    @patch("ai_web_feeds.enrich.httpx.AsyncClient")
    @patch("ai_web_feeds.utils.httpx.AsyncClient")
    async def test_enrich_from_url_rss(self, mock_utils_client, mock_enrich_client):
        """Test enriching from RSS feed URL."""
        # Mock HTTP response
        mock_response = Mock()
        mock_response.text = """<?xml version="1.0"?>
<rss version="2.0">
    <channel>
        <title>Test Feed</title>
        <description>Test Description</description>
        <item>
            <title>Item 1</title>
            <description>Item description</description>
        </item>
    </channel>
</rss>"""
        mock_response.content = mock_response.text.encode()
        mock_response.status_code = 200
        mock_response.raise_for_status = Mock()
        mock_response.headers = {"content-type": "application/rss+xml"}

        # Mock client instances for both enrich and utils
        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(return_value=mock_response)

        mock_enrich_client.return_value.__aenter__.return_value = mock_client_instance
        mock_utils_client.return_value.__aenter__.return_value = mock_client_instance

        enricher = AdvancedEnricher()
        enrichment = await enricher.enrich_from_url("https://example.com/feed.xml")

        assert enrichment is not None
        assert enrichment.title == "Test Feed"
        assert enrichment.description == "Test Description"
        assert enrichment.entry_count >= 1

    def test_calculate_quality_score(self):
        """Test quality score calculation."""
        enricher = AdvancedEnricher()
        enrichment = FeedEnrichment()

        enrichment.title = "Test Feed"
        enrichment.description = "A good description"
        enrichment.has_full_content = True
        enrichment.entry_count = 10

        score = enricher._calculate_quality_score(enrichment)
        assert 0.0 <= score <= 1.0

    def test_calculate_health_score(self):
        """Test health score calculation."""
        enricher = AdvancedEnricher()
        enrichment = FeedEnrichment()

        enrichment.entry_count = 20
        enrichment.has_full_content = True

        score = enricher._calculate_health_score(enrichment)
        assert 0.0 <= score <= 1.0

    def test_calculate_completeness_score(self):
        """Test completeness score calculation."""
        enricher = AdvancedEnricher()
        enrichment = FeedEnrichment()

        enrichment.title = "Test"
        enrichment.description = "Description"
        enrichment.icon_url = "https://example.com/icon.png"
        enrichment.language = "en"

        score = enricher._calculate_completeness_score(enrichment)
        assert 0.0 <= score <= 1.0


@pytest.mark.unit
@pytest.mark.asyncio
class TestEnrichFeedSource:
    """Test enrich_feed_source function."""

    @patch("ai_web_feeds.enrich.AdvancedEnricher")
    async def test_enrich_feed_source_success(self, mock_enricher_class):
        """Test successful feed source enrichment."""
        # Mock enricher
        mock_enrichment = FeedEnrichment()
        mock_enrichment.title = "Enriched Feed"
        mock_enrichment.quality_score = 0.8

        mock_enricher = AsyncMock()
        mock_enricher.enrich_from_url = AsyncMock(return_value=mock_enrichment)
        mock_enricher_class.return_value = mock_enricher

        from ai_web_feeds.enrich import enrich_feed_source

        source_dict = {
            "id": "test-feed",
            "title": "Original Title",
            "feed": "https://example.com/feed.xml",
        }

        result = await enrich_feed_source(source_dict)
        assert result is not None
        assert "enrichment" in result


@pytest.mark.unit
class TestEnrichmentEdgeCases:
    """Test enrichment edge cases."""

    def test_enrichment_empty_values(self):
        """Test enrichment with empty/None values."""
        enrichment = FeedEnrichment()

        # Should handle None values gracefully
        result = enrichment.to_dict()
        assert result["basic"]["title"] is None
        assert result["basic"]["description"] is None

    def test_score_bounds(self):
        """Test that scores stay within 0-1 bounds."""
        enricher = AdvancedEnricher()
        enrichment = FeedEnrichment()

        # Test with extreme values
        enrichment.entry_count = 1000
        enrichment.has_full_content = True

        health = enricher._calculate_health_score(enrichment)
        quality = enricher._calculate_quality_score(enrichment)
        completeness = enricher._calculate_completeness_score(enrichment)

        assert 0.0 <= health <= 1.0
        assert 0.0 <= quality <= 1.0
        assert 0.0 <= completeness <= 1.0
