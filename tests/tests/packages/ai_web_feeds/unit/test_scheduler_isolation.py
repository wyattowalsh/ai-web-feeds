"""Characterization: importing the scheduler does not start a background thread."""

import importlib
import threading
from datetime import UTC, datetime, tzinfo
from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from ai_web_feeds.storage import DatabaseManager

_FROZEN_NOW = datetime(2026, 11, 8, 12, 0, tzinfo=UTC)


class _FrozenDateTime(datetime):
    """Clock stand-in so a scheduler cannot observe wall time."""

    @classmethod
    def now(cls, tz: tzinfo | None = None) -> datetime:
        """Return the frozen instant, converted when a timezone is requested."""
        if tz is None:
            return _FROZEN_NOW
        return _FROZEN_NOW.astimezone(tz)


def _alive_thread_idents() -> set[int]:
    """Return idents of threads that are still alive."""
    return {
        thread.ident
        for thread in threading.enumerate()
        if thread.is_alive() and thread.ident is not None
    }


def _thread_names() -> set[str]:
    """Return names of threads that are still alive."""
    return {thread.name for thread in threading.enumerate() if thread.is_alive()}


@pytest.mark.unit
def test_importing_scheduler_does_not_start_background_thread() -> None:
    """Importing and constructing schedulers must not start a thread or poll feeds.

    Package logging may already own a writer thread. The scheduler import itself
    must not add a thread, and neither scheduler may be running.
    """
    poll_feed = AsyncMock()
    fetch_feed = AsyncMock()
    http_get = AsyncMock()
    database = cast(DatabaseManager, MagicMock(spec=DatabaseManager))

    with (
        patch("apscheduler.schedulers.base.datetime", _FrozenDateTime),
        patch("ai_web_feeds.polling._utc_now", return_value=_FROZEN_NOW),
        patch("ai_web_feeds.polling.FeedPoller.poll_feed", poll_feed),
        patch("ai_web_feeds.polling.FeedPoller.fetch_feed", fetch_feed),
        patch("httpx.AsyncClient.get", http_get),
        patch("httpx.Client.get", http_get),
    ):
        # Snapshot after the mocks are installed so only the scheduler import is measured.
        before = _alive_thread_idents()
        scheduler_mod = importlib.import_module("ai_web_feeds.scheduler")
        scheduler_mod = importlib.reload(scheduler_mod)
        nlp_mod = importlib.import_module("ai_web_feeds.nlp.scheduler")
        nlp_mod = importlib.reload(nlp_mod)

        from ai_web_feeds.config import Settings

        settings = Settings()
        manager = scheduler_mod.SchedulerManager(database, settings)
        nlp = nlp_mod.NLPScheduler(settings)
        try:
            assert manager.scheduler.running is False
            assert nlp.scheduler.running is False
            assert manager.scheduler.get_jobs() == []
            assert nlp.scheduler.get_jobs() == []
            poll_feed.assert_not_called()
            fetch_feed.assert_not_called()
            http_get.assert_not_called()
            assert _alive_thread_idents() == before
            assert not any("APScheduler" in name for name in _thread_names())
        finally:
            if manager.scheduler.running:
                manager.scheduler.shutdown(wait=False)
            if nlp.scheduler.running:
                nlp.scheduler.shutdown(wait=False)
