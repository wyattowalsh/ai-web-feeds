"""Contract for today's Socket.IO notification server.

Connect, subscribe (authenticate joins the user room), deliver one fixture
notification, then reject one oversized websocket frame. The app is served on
127.0.0.1 via an ephemeral port. ``WebSocketServer.start()`` is not called, so
the configured port is never bound.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

import pytest
import socketio
from ai_web_feeds.config import Settings
from ai_web_feeds.models import Notification, NotificationType
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.websocket_server import WebSocketServer
from aiohttp.test_utils import TestServer

_LOOPBACK = "127.0.0.1"
_USER_ID = "contract-user"


def _settings() -> Settings:
    settings = Settings()
    settings.phase3b.websocket_host = _LOOPBACK
    settings.phase3b.websocket_port = 0
    return settings


@pytest.fixture
def contract_db(tmp_path) -> Iterator[DatabaseManager]:
    """SQLite database with the notification tables today's server queries."""
    manager = DatabaseManager(database_url=f"sqlite:///{tmp_path / 'ws-contract.db'}")
    manager.create_db_and_tables()
    try:
        yield manager
    finally:
        manager.close()


@pytest.fixture
def fixture_notification() -> Notification:
    """The single notification the contract expects on the wire."""
    return Notification(
        id=1,
        user_id=_USER_ID,
        type=NotificationType.FEED_UPDATED,
        title="Fixture event",
        message="one",
        created_at=datetime(2026, 11, 8, tzinfo=UTC),
    )


@asynccontextmanager
async def _loopback_server(db: DatabaseManager) -> AsyncIterator[tuple[WebSocketServer, str]]:
    server = WebSocketServer(db, _settings())
    http = TestServer(server.app, host=_LOOPBACK, port=0)
    await http.start_server()
    try:
        assert http.host == _LOOPBACK
        assert isinstance(http.port, int)
        assert http.port > 0
        yield server, f"http://{_LOOPBACK}:{http.port}"
    finally:
        await server.sio.shutdown()
        await http.close()


def _subscribed(server: WebSocketServer, user_id: str) -> bool:
    return any(server.sio.manager.get_participants("/", user_id))


async def _wait_for(predicate, timeout: float) -> None:
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while not predicate():
        if loop.time() >= deadline:
            pytest.fail("condition was not met before timeout")
        await asyncio.sleep(0.02)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_connect_subscribe_one_fixture_event_and_oversized_frame(
    contract_db: DatabaseManager,
    fixture_notification: Notification,
) -> None:
    """Live server: connect, room subscribe, one fixture event, oversized frame closes."""
    async with _loopback_server(contract_db) as (server, url):
        client = socketio.AsyncClient(
            reconnection=False,
            logger=False,
            engineio_logger=False,
            handle_sigint=False,
        )
        history: asyncio.Future[dict[str, object]] = asyncio.get_running_loop().create_future()
        events: list[dict[str, object]] = []
        dropped = asyncio.Event()

        @client.on("notifications_history")
        def _on_history(payload: dict[str, object]) -> None:
            if not history.done():
                history.set_result(payload)

        @client.on("notification")
        def _on_notification(payload: dict[str, object]) -> None:
            events.append(payload)

        @client.on("disconnect")
        def _on_disconnect(*_args: object) -> None:
            dropped.set()

        try:
            await client.connect(url, transports=["websocket"], wait_timeout=5)
            assert client.connected is True
            assert client.transport() == "websocket"

            await client.emit("authenticate", {"user_id": fixture_notification.user_id})
            history_payload = await asyncio.wait_for(history, timeout=5)
            assert history_payload == {"notifications": []}
            assert _subscribed(server, fixture_notification.user_id) is True

            await server.broadcast_notification(
                fixture_notification.user_id,
                fixture_notification,
            )
            await _wait_for(lambda: len(events) == 1, timeout=5)
            assert events == [server._serialize_notification(fixture_notification)]

            limit = server.sio.eio.max_http_buffer_size
            assert isinstance(limit, int)
            # aiohttp closes once the frame header exceeds max_msg_size, so the
            # in-flight write can raise while the disconnect event is delivered.
            try:
                await client.eio.ws.send_str("x" * (limit + 1))
            except OSError:
                pass
            await asyncio.wait_for(dropped.wait(), timeout=5)
            assert client.connected is False
            await _wait_for(
                lambda: not _subscribed(server, fixture_notification.user_id),
                timeout=5,
            )
            assert events == [server._serialize_notification(fixture_notification)]
        finally:
            if client.connected:
                try:
                    await client.disconnect()
                except OSError:
                    pass
