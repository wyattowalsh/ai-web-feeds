"""Characterization of one FeedPoller poll with httpx mocked.

The RSS document is only the mocked response. Assertions cover the poll
outcome (status, identity, single GET). They do not snapshot item bodies.
"""

from __future__ import annotations

import socket
from datetime import UTC, datetime
from typing import Any, cast
from unittest.mock import MagicMock

import httpx
import pytest
from ai_web_feeds.config import Settings
from ai_web_feeds.models import (
    ArticleEntry,
    FeedPollJob,
    Notification,
    NotificationType,
    PollStatus,
)
from ai_web_feeds.polling import FeedPoller
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.websocket_server import WebSocketServer

_FEED_ID = "test-feed"
_FEED_URL = "https://example.test/feed.xml"
_ITEM_GUID = "item-1"
_ITEM_LINK = "https://example.test/items/1"
_ITEM_TITLE = "Pinned title"
_POLL_TIMEOUT_SECONDS = 30

# Input to the mock transport. Not a stored-body snapshot.
_FEED_XML = """<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example</title>
    <item>
      <title>Pinned title</title>
      <link>https://example.test/items/1</link>
      <guid>item-1</guid>
      <author>Ada</author>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <category>AI</category>
      <description>not asserted</description>
    </item>
  </channel>
</rss>
"""


def _block_live_sockets(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Reject socket calls so a missed mock cannot reach the network."""
    calls: list[str] = []

    def _blocked(name: str):
        def _inner(*_args: object, **_kwargs: object) -> None:
            calls.append(name)
            raise AssertionError(f"poll attempted a live socket via {name}")

        return _inner

    monkeypatch.setattr(socket, "create_connection", _blocked("socket.create_connection"))
    monkeypatch.setattr(socket, "getaddrinfo", _blocked("socket.getaddrinfo"))
    monkeypatch.setattr(socket, "create_server", _blocked("socket.create_server"))
    return calls


def _database() -> tuple[MagicMock, list[PollStatus]]:
    """Database stand-in. Identity lookup reports the item as unseen."""
    db = MagicMock(spec=DatabaseManager)
    seen_status: list[PollStatus] = []

    def _create(job: FeedPollJob) -> FeedPollJob:
        seen_status.append(job.status)
        job.id = 1
        return job

    db.create_poll_job.side_effect = _create
    db.update_poll_job.side_effect = lambda job: job
    db.get_article_by_identity.return_value = None
    return db, seen_status


def _install_mocked_client(
    monkeypatch: pytest.MonkeyPatch,
    requests: list[httpx.Request],
    constructed: list[dict[str, Any]],
) -> None:
    """Serve one fixed response through httpx.MockTransport. No public bind."""

    def _handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, text=_FEED_XML)

    transport = httpx.MockTransport(_handler)
    real_client = httpx.AsyncClient

    def _client(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        constructed.append({"args": args, "kwargs": dict(kwargs)})
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    monkeypatch.setattr("ai_web_feeds.polling.httpx.AsyncClient", _client)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_one_poll_uses_mocked_http_and_records_one_new_article(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One successful poll GETs the feed URL once and stores one new article."""
    live_socket_calls = _block_live_sockets(monkeypatch)
    requests: list[httpx.Request] = []
    constructed: list[dict[str, Any]] = []
    _install_mocked_client(monkeypatch, requests, constructed)

    settings = Settings()
    settings.phase3b.feed_poll_timeout = _POLL_TIMEOUT_SECONDS
    database, seen_status = _database()
    poller = FeedPoller(database, settings)

    job = await poller.poll_feed(_FEED_ID, _FEED_URL)

    assert live_socket_calls == []
    assert len(constructed) == 1
    assert constructed[0]["kwargs"]["timeout"] == _POLL_TIMEOUT_SECONDS
    assert len(requests) == 1
    assert requests[0].method == "GET"
    assert str(requests[0].url) == _FEED_URL

    assert isinstance(job, FeedPollJob)
    assert job.feed_id == _FEED_ID
    assert job.id == 1
    assert seen_status == [PollStatus.RUNNING]
    assert job.status == PollStatus.SUCCESS
    assert job.articles_discovered == 1
    assert job.error_message is None
    assert job.response_time_ms is not None
    assert job.response_time_ms >= 0
    assert job.started_at is not None
    assert job.completed_at is not None
    assert job.started_at.tzinfo is not None
    assert job.completed_at.tzinfo is not None
    assert job.completed_at >= job.started_at

    database.get_article_by_identity.assert_called_once_with(_ITEM_GUID, _ITEM_LINK, _FEED_ID)
    database.add_article.assert_called_once()
    database.update_poll_job.assert_called_once_with(job)

    article = database.add_article.call_args.args[0]
    assert isinstance(article, ArticleEntry)
    assert article.feed_id == _FEED_ID
    assert article.guid == _ITEM_GUID
    assert article.link == _ITEM_LINK
    assert article.title == _ITEM_TITLE
    assert article.author == "Ada"
    assert article.raw_categories == ["AI"]
    assert article.pub_date == datetime(2024, 1, 1, 12, 0, tzinfo=UTC)


def _contract_notification_payload(notification: Notification) -> dict[str, Any]:
    """Payload of the ``notification`` event from ``_serialize_notification``.

    ``WebSocketServer.start`` is not called, so no port is bound.
    """
    return WebSocketServer._serialize_notification(cast(Any, None), notification)


class _RecordingBroadcaster:
    """Records the ``notification`` event. Does not open a socket."""

    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    async def broadcast_notification(self, user_id: str, notification: Notification) -> None:
        self.events.append(
            {
                "event": "notification",
                "user_id": user_id,
                "notification": notification,
                "payload": _contract_notification_payload(notification),
            }
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_new_article_emits_one_feed_updated_notification_seen_item_does_not(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A new article emits one contract notification. A seen item emits none."""
    live_socket_calls = _block_live_sockets(monkeypatch)
    requests: list[httpx.Request] = []
    constructed: list[dict[str, Any]] = []
    _install_mocked_client(monkeypatch, requests, constructed)

    settings = Settings()
    settings.phase3b.feed_poll_timeout = _POLL_TIMEOUT_SECONDS
    database, _seen_status = _database()
    broadcaster = _RecordingBroadcaster()
    poller = FeedPoller(database, settings, broadcaster=broadcaster)

    job = await poller.poll_feed(_FEED_ID, _FEED_URL)

    assert live_socket_calls == []
    assert len(requests) == 1
    assert requests[0].method == "GET"
    assert str(requests[0].url) == _FEED_URL
    assert job.status == PollStatus.SUCCESS
    assert job.articles_discovered == 1
    database.add_article.assert_called_once()

    article = database.add_article.call_args.args[0]
    assert isinstance(article, ArticleEntry)
    assert len(broadcaster.events) == 1
    event = broadcaster.events[0]
    notification = event["notification"]
    assert event["event"] == "notification"
    assert isinstance(notification, Notification)
    assert notification.type == NotificationType.FEED_UPDATED
    assert notification.user_id == article.feed_id == _FEED_ID
    assert event["user_id"] == notification.user_id
    assert notification.title == article.title == _ITEM_TITLE
    assert notification.message == (article.summary or article.title)
    assert notification.action_url == article.link == _ITEM_LINK
    assert notification.context_data == {"feed_id": _FEED_ID, "guid": _ITEM_GUID}
    payload = event["payload"]
    assert payload == _contract_notification_payload(notification)
    assert payload["type"] == NotificationType.FEED_UPDATED.value
    assert payload["title"] == _ITEM_TITLE
    assert payload["action_url"] == _ITEM_LINK
    assert payload["context_data"] == {"feed_id": _FEED_ID, "guid": _ITEM_GUID}
    assert payload["read_at"] is None
    assert payload["dismissed_at"] is None
    assert payload["created_at"] == notification.created_at.isoformat()

    database.get_article_by_identity.return_value = article
    seen_job = await poller.poll_feed(_FEED_ID, _FEED_URL)

    assert live_socket_calls == []
    assert len(requests) == 2
    assert seen_job.status == PollStatus.SUCCESS
    assert seen_job.articles_discovered == 0
    assert database.add_article.call_count == 1
    assert len(broadcaster.events) == 1
