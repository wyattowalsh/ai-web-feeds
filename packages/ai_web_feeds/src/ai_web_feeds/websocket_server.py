"""ai_web_feeds.websocket_server -- WebSocket server for real-time notifications

This module implements Socket.IO server for real-time client-server communication.
"""

from typing import Any

import socketio
from aiohttp import web
from loguru import logger

from ai_web_feeds.config import Settings
from ai_web_feeds.models import Notification
from ai_web_feeds.storage import DatabaseManager


class WebSocketServer:
    """Socket.IO server for real-time notifications."""

    def __init__(
        self,
        db: DatabaseManager,
        settings: Settings,
    ):
        """Initialize WebSocket server.

        Args:
            db: Database manager instance
            settings: Application settings
        """
        self.db = db
        self.settings = settings
        self.port = settings.phase3b.websocket_port

        # Parse CORS origins
        cors_origins = [
            origin.strip() for origin in settings.phase3b.websocket_cors_origins.split(",")
        ]

        # Create Socket.IO server
        self.sio = socketio.AsyncServer(
            async_mode="aiohttp",
            cors_allowed_origins=cors_origins,
            logger=False,
            engineio_logger=False,
        )

        # Create aiohttp app
        self.app = web.Application()
        self.sio.attach(self.app)

        # Register event handlers
        self.sio.on("connect", self.on_connect)
        self.sio.on("disconnect", self.on_disconnect)
        self.sio.on("authenticate", self.on_authenticate)
        self.sio.on("mark_read", self.on_mark_read)
        self.sio.on("dismiss", self.on_dismiss)

        logger.info(f"WebSocket server initialized on port {self.port}")

    async def start(self) -> None:
        """Start WebSocket server."""
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", self.port)
        await site.start()
        logger.info(f"WebSocket server listening on port {self.port}")

    async def on_connect(self, sid: str, environ: dict[str, Any]) -> None:
        """Handle client connection.

        Args:
            sid: Session ID
            environ: WSGI environ dict
        """
        logger.info(f"Client connected: {sid}")

    async def on_disconnect(self, sid: str) -> None:
        """Handle client disconnection.

        Args:
            sid: Session ID
        """
        logger.info(f"Client disconnected: {sid}")

    async def on_authenticate(self, sid: str, data: dict[str, Any]) -> None:
        """Handle client authentication.

        Client sends: { "user_id": "<localStorage UUID>" }

        Args:
            sid: Session ID
            data: Authentication data
        """
        user_id = data.get("user_id")
        if not user_id:
            await self.sio.emit("error", {"message": "Missing user_id"}, to=sid)
            return

        # Join user-specific room
        await self.sio.enter_room(sid, user_id)
        logger.info(f"Client {sid} authenticated as user {user_id}")

        # Send unread notifications
        notifications = self.db.get_user_notifications(user_id, unread_only=True, limit=50)
        await self.sio.emit(
            "notifications_history",
            {"notifications": [self._serialize_notification(n) for n in notifications]},
            to=sid,
        )

    async def on_mark_read(self, sid: str, data: dict[str, Any]) -> None:
        """Handle mark notification as read.

        Client sends: { "notification_id": <int> }

        Args:
            sid: Session ID
            data: Request data
        """
        notification_id = data.get("notification_id")
        if notification_id:
            self.db.mark_notification_read(notification_id)
            logger.debug(f"Marked notification {notification_id} as read")

    async def on_dismiss(self, sid: str, data: dict[str, Any]) -> None:
        """Handle dismiss notification.

        Client sends: { "notification_id": <int> }

        Args:
            sid: Session ID
            data: Request data
        """
        notification_id = data.get("notification_id")
        if notification_id:
            self.db.dismiss_notification(notification_id)
            logger.debug(f"Dismissed notification {notification_id}")

    async def broadcast_notification(self, user_id: str, notification: Notification) -> None:
        """Broadcast notification to user via WebSocket.

        Args:
            user_id: User ID (localStorage UUID)
            notification: Notification to broadcast
        """
        await self.sio.emit(
            "notification",
            self._serialize_notification(notification),
            room=user_id,
        )
        logger.debug(f"Broadcasted notification {notification.id} to user {user_id}")

    async def broadcast_trending_alert(
        self, user_id: str, topic_id: str, z_score: float, article_count: int
    ) -> None:
        """Broadcast trending topic alert to user.

        Args:
            user_id: User ID (localStorage UUID)
            topic_id: Topic ID
            z_score: Z-score value
            article_count: Number of articles
        """
        await self.sio.emit(
            "trending_alert",
            {
                "topic_id": topic_id,
                "z_score": z_score,
                "article_count": article_count,
                "timestamp": int(logger._core.now().timestamp() * 1000),
            },
            room=user_id,
        )
        logger.debug(f"Broadcasted trending alert for {topic_id} to user {user_id}")

    def _serialize_notification(self, notification: Notification) -> dict[str, Any]:
        """Serialize Notification to dict for WebSocket transmission.

        Args:
            notification: Notification instance

        Returns:
            Serialized notification dict
        """
        return {
            "id": notification.id,
            "type": notification.type.value,
            "title": notification.title,
            "message": notification.message,
            "action_url": notification.action_url,
            "context_data": notification.context_data,
            "read_at": notification.read_at.isoformat() if notification.read_at else None,
            "dismissed_at": notification.dismissed_at.isoformat()
            if notification.dismissed_at
            else None,
            "created_at": notification.created_at.isoformat(),
        }
