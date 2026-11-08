"""Unit tests for the validation concurrency pool."""

import asyncio
from typing import Self

import pytest
from ai_web_feeds.config import settings
from ai_web_feeds.models import FeedSource
from ai_web_feeds.validate import validate_all_feeds

_FEED_XML = """<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example</title>
    <item><title>One</title></item>
  </channel>
</rss>
"""


class _FakeResponse:
    """Minimal HTTP response used by the fake client."""

    def __init__(self, text: str) -> None:
        self.status_code: int = 200
        self.text: str = text


class _PoolStats:
    """In-flight counters for the fake HTTP client."""

    def __init__(self) -> None:
        self.in_flight: int = 0
        self.peak: int = 0
        self.calls: int = 0


def _install_fake_http(monkeypatch: pytest.MonkeyPatch, stats: _PoolStats) -> None:
    """Replace httpx.AsyncClient so validation never opens a socket."""

    class _FakeAsyncClient:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            return None

        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def get(self, _url: str) -> _FakeResponse:
            stats.in_flight += 1
            stats.calls += 1
            stats.peak = max(stats.peak, stats.in_flight)
            try:
                await asyncio.sleep(0.05)
            finally:
                stats.in_flight -= 1
            return _FakeResponse(_FEED_XML)

    monkeypatch.setattr("ai_web_feeds.validate.httpx.AsyncClient", _FakeAsyncClient)


def _feeds(count: int) -> list[FeedSource]:
    """Build distinct feed sources that all point at the fake HTTP client."""
    return [
        FeedSource(
            id=f"feed-{index}",
            title=f"Feed {index}",
            feed=f"https://example.test/feeds/{index}.xml",
            url=f"https://example.test/{index}",
        )
        for index in range(count)
    ]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_in_flight_validations_never_exceed_configured_cap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Many feeds stay within settings.phase3b.feed_poll_max_concurrent."""
    configured_cap = 3
    capped = settings.phase3b.model_copy(update={"feed_poll_max_concurrent": configured_cap})
    monkeypatch.setattr(settings, "phase3b", capped)
    stats = _PoolStats()
    _install_fake_http(monkeypatch, stats)
    feeds = _feeds(configured_cap * 4)

    results = await validate_all_feeds(
        feeds,
        concurrency_limit=configured_cap * 5,
        show_progress=False,
    )

    assert settings.phase3b.feed_poll_max_concurrent == configured_cap
    assert stats.peak <= configured_cap
    assert stats.peak == configured_cap
    assert stats.in_flight == 0
    assert stats.calls == len(feeds)
    assert [result.feed_source_id for result in results] == [feed.id for feed in feeds]
    assert all(result.is_valid for result in results)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_explicit_limit_can_be_lower_than_settings_cap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A smaller concurrency_limit is honored and still finite."""
    configured_cap = 10
    capped = settings.phase3b.model_copy(update={"feed_poll_max_concurrent": configured_cap})
    monkeypatch.setattr(settings, "phase3b", capped)
    requested_limit = 2
    stats = _PoolStats()
    _install_fake_http(monkeypatch, stats)
    feeds = _feeds(configured_cap)

    results = await validate_all_feeds(
        feeds,
        concurrency_limit=requested_limit,
        show_progress=False,
    )

    assert stats.peak <= requested_limit
    assert stats.peak == requested_limit
    assert stats.calls == len(feeds)
    assert len(results) == len(feeds)
