"""Unit tests for ai_web_feeds.scheduler module"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from ai_web_feeds.config import Settings
from ai_web_feeds.scheduler import SchedulerManager
from ai_web_feeds.storage import DatabaseManager


@pytest.fixture
def mock_db():
    """Mock database manager"""
    db = MagicMock(spec=DatabaseManager)
    db.get_user_follows = MagicMock(return_value=["feed-1", "feed-2"])
    db.get_feed_entries = MagicMock(return_value=[])
    db.get_due_digests = MagicMock(return_value=[])
    return db


@pytest.fixture
def mock_settings():
    """Mock settings"""
    settings = Settings()
    settings.phase3b.feed_poll_interval_min = 15
    settings.phase3b.trending_update_interval_hours = 1
    return settings


@pytest.fixture
def scheduler(mock_db, mock_settings):
    """Create SchedulerManager instance"""
    return SchedulerManager(mock_db, mock_settings)


class TestSchedulerManager:
    """Test SchedulerManager class"""

    def test_initialization(self, scheduler):
        """Test scheduler initialization"""
        assert scheduler.db is not None
        assert scheduler.settings is not None
        assert scheduler.scheduler is not None
        assert scheduler.poller is not None
        assert scheduler.notifier is not None
        assert scheduler.trending is not None
        assert scheduler.digests is not None

    def test_start_creates_jobs(self, scheduler):
        """Test that start() creates all background jobs"""
        scheduler.start()

        # Verify scheduler is running
        assert scheduler.scheduler.running

        # Verify all 4 jobs were added
        jobs = scheduler.scheduler.get_jobs()
        assert len(jobs) == 4

        job_ids = [job.id for job in jobs]
        assert "poll_feeds" in job_ids
        assert "detect_trending" in job_ids
        assert "send_digests" in job_ids
        assert "cleanup_notifications" in job_ids

        # Cleanup
        scheduler.stop()

    def test_stop(self, scheduler):
        """Test scheduler stop"""
        scheduler.start()
        assert scheduler.scheduler.running

        scheduler.stop()
        assert not scheduler.scheduler.running

    def test_get_job_status_existing(self, scheduler):
        """Test get_job_status for existing job"""
        scheduler.start()

        status = scheduler.get_job_status("poll_feeds")

        assert status["exists"] is True
        assert status["id"] == "poll_feeds"
        assert status["name"] == "Poll all feeds"
        assert "next_run" in status

        scheduler.stop()

    def test_get_job_status_nonexistent(self, scheduler):
        """Test get_job_status for non-existent job"""
        status = scheduler.get_job_status("nonexistent")

        assert status["exists"] is False

    def test_list_jobs(self, scheduler):
        """Test list_jobs"""
        scheduler.start()

        jobs = scheduler.list_jobs()

        assert len(jobs) == 4
        assert all("id" in job for job in jobs)
        assert all("name" in job for job in jobs)
        assert all("next_run" in job for job in jobs)
        assert all("trigger" in job for job in jobs)

        scheduler.stop()

    @pytest.mark.asyncio
    async def test_poll_all_feeds(self, scheduler, mock_db):
        """Test _poll_all_feeds job"""
        mock_feeds = [
            {"id": "feed-1", "feed": "http://example.com/feed1.xml", "active": True},
            {"id": "feed-2", "feed": "http://example.com/feed2.xml", "active": True},
            {"id": "feed-3", "feed": "http://example.com/feed3.xml", "active": False},
        ]

        with patch("ai_web_feeds.scheduler.load_feeds", return_value=mock_feeds):
            with patch.object(scheduler.poller, "poll_feed", new_callable=AsyncMock) as mock_poll:
                mock_poll.return_value.articles_discovered = 2

                await scheduler._poll_all_feeds()

                # Should only poll active feeds (2 out of 3)
                assert mock_poll.call_count == 2

    @pytest.mark.asyncio
    async def test_detect_trending(self, scheduler):
        """Test _detect_trending job"""
        mock_topics = [
            MagicMock(topic_id="ai", z_score=3.0),
            MagicMock(topic_id="ml", z_score=2.5),
        ]

        with patch.object(
            scheduler.trending, "detect_trending_topics", return_value=mock_topics
        ):
            with patch.object(scheduler.notifier, "notify_trending_topic", new_callable=AsyncMock):
                await scheduler._detect_trending()

                # Should complete without error
                # (notification sending tested separately)

    @pytest.mark.asyncio
    async def test_send_digests(self, scheduler):
        """Test _send_digests job"""
        with patch.object(scheduler.digests, "send_due_digests", return_value=3):
            await scheduler._send_digests()

            # Should complete without error

    @pytest.mark.asyncio
    async def test_cleanup_notifications(self, scheduler):
        """Test _cleanup_notifications job"""
        with patch.object(scheduler.notifier, "cleanup_old_notifications", return_value=10):
            await scheduler._cleanup_notifications()

            # Should complete without error

