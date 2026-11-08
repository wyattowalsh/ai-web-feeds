"""Characterization of current ai_web_feeds.enrich branches."""

from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
from ai_web_feeds.enrich import AdvancedEnricher, enrich_feed_source
from ai_web_feeds.models import FeedFormat

_RSS = """<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Branch Feed</title>
    <description>Characterization description</description>
    <language>en</language>
    <item>
      <title>Entry One</title>
      <description>Short summary</description>
    </item>
  </channel>
</rss>
"""


def _rss_response() -> Mock:
    response = Mock()
    response.status_code = 200
    response.text = _RSS
    response.content = _RSS.encode()
    response.headers = {"content-type": "application/rss+xml"}
    response.raise_for_status = Mock()
    return response


def _client_factory(response: Mock) -> MagicMock:
    client = AsyncMock()
    client.get = AsyncMock(return_value=response)
    factory = MagicMock()
    factory.return_value.__aenter__.return_value = client
    factory.return_value.__aexit__.return_value = False
    return factory


@pytest.mark.unit
@pytest.mark.asyncio
async def test_enrich_from_url_rss_success_fills_metadata() -> None:
    """A mocked 200 RSS response yields parsed metadata and a positive quality score."""
    response = _rss_response()

    with (
        patch("ai_web_feeds.enrich.httpx.AsyncClient", _client_factory(response)),
        patch("ai_web_feeds.utils.httpx.AsyncClient", _client_factory(response)),
    ):
        enrichment = await AdvancedEnricher().enrich_from_url(
            "https://example.com/feed.xml",
            url_type="feed",
        )

    assert enrichment.title == "Branch Feed"
    assert enrichment.description == "Characterization description"
    assert enrichment.language == "en"
    assert enrichment.entry_count == 1
    assert enrichment.format == FeedFormat.RSS
    assert enrichment.availability_score == 1.0
    assert enrichment.quality_score > 0.0
    assert enrichment.health_score > 0.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_enrich_feed_source_without_urls_returns_input() -> None:
    """Sources with neither a feed nor a site URL are returned unchanged."""
    source = {"id": "missing-url", "title": "Keep me"}

    result = await enrich_feed_source(source)

    assert result is source
    assert "enrichment" not in result
