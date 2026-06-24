"""Unit tests for ai_web_feeds.scheduler module"""

from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest
from ai_web_feeds.config import Settings
from ai_web_feeds.models import DeliveryMethod, NotificationFrequency, NotificationPreference
from ai_web_feeds.scheduler import SchedulerManager
from ai_web_feeds.storage import DatabaseManager


@pytest.fixture
def mock_db():
    """Mock database manager"""
    db = MagicMock(spec=DatabaseManager)
    db.get_user_followed_sources = MagicMock(return_value=["feed-1", "feed-2"])
    db.get_articles = MagicMock(return_value=[])
    db.get_due_digests = MagicMock(return_value=[])
    db.get_active_user_ids = MagicMock(return_value=["user-1", "user-2", "user-3"])
    db.get_user_preferences = MagicMock(return_value=[])
    db.get_user_profile = MagicMock(return_value=None)
    db.get_user_followed_sources = MagicMock(return_value=[])
    db.get_feed_topics = MagicMock(return_value=[])
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
        # Mock the actual scheduler start to avoid event loop issues
        with patch.object(scheduler.scheduler, "start") as mock_start:
            scheduler.start()

            # Verify start was called
            assert mock_start.called

            # Verify all 4 jobs were added to scheduler
            jobs = scheduler.scheduler.get_jobs()
            assert len(jobs) == 4

            job_ids = [job.id for job in jobs]
            assert "poll_feeds" in job_ids
            assert "detect_trending" in job_ids
            assert "send_digests" in job_ids
            assert "cleanup_notifications" in job_ids

    def test_stop(self, scheduler):
        """Test scheduler stop"""
        with patch.object(scheduler.scheduler, "start"):
            with patch.object(scheduler.scheduler, "shutdown") as mock_shutdown:
                # Mock the running property to return True
                with patch.object(
                    type(scheduler.scheduler), "running", new_callable=PropertyMock
                ) as mock_running:
                    mock_running.return_value = True

                    scheduler.start()
                    scheduler.stop()

                    # Verify shutdown was called
                    assert mock_shutdown.called

    def test_get_job_status_existing(self, scheduler):
        """Test get_job_status for existing job"""
        with patch.object(scheduler.scheduler, "start"):
            scheduler.start()

            # Get the job and add next_run_time if it doesn't exist
            jobs = scheduler.scheduler.get_jobs()
            poll_job = next((j for j in jobs if j.id == "poll_feeds"), None)
            assert poll_job is not None

            # Add next_run_time attribute if missing
            if not hasattr(poll_job, "next_run_time"):
                poll_job.next_run_time = None

            status = scheduler.get_job_status("poll_feeds")

            assert status["exists"] is True
            assert status["id"] == "poll_feeds"
            assert status["name"] == "Poll all feeds"
            assert "next_run" in status

    def test_get_job_status_nonexistent(self, scheduler):
        """Test get_job_status for non-existent job"""
        status = scheduler.get_job_status("nonexistent")

        assert status["exists"] is False

    def test_list_jobs(self, scheduler):
        """Test list_jobs"""
        with patch.object(scheduler.scheduler, "start"):
            scheduler.start()

            # Patch all jobs to have next_run_time
            for job in scheduler.scheduler.get_jobs():
                job.next_run_time = None

            jobs = scheduler.list_jobs()

            assert len(jobs) == 4
            assert all("id" in job for job in jobs)
            assert all("name" in job for job in jobs)
            assert all("next_run" in job for job in jobs)
            assert all("trigger" in job for job in jobs)

    @pytest.mark.asyncio
    async def test_poll_all_feeds(self, scheduler, mock_db):
        """Test _poll_all_feeds job"""
        mock_catalog = {
            "sources": [
                {"id": "feed-1", "feed": "http://example.com/feed1.xml"},
                {"id": "feed-2", "feed": "http://example.com/feed2.xml"},
                {
                    "id": "feed-3",
                    "feed": "http://example.com/feed3.xml",
                    "curation": {"status": "inactive"},
                },
            ]
        }

        with patch("ai_web_feeds.scheduler.load_feeds", return_value=mock_catalog):
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

        with patch.object(scheduler.trending, "detect_trending_topics", return_value=mock_topics):
            with patch.object(
                scheduler.notifier, "notify_trending_topic", new_callable=AsyncMock
            ) as mock_notify:
                await scheduler._detect_trending()

                # Should call with filtered active users (default prefs allow)
                assert mock_notify.call_count == 2
                # Users passed should be the active ones
                called_users = mock_notify.call_args[0][1]
                assert called_users == ["user-1", "user-2", "user-3"]

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


class TestTrendingNotificationFiltering:
    """Tests for user preference filtering on trending notifications (TBD in scheduler)."""

    def test_get_interested_users_default_no_prefs(self, scheduler):
        """Users with no preferences should receive trending (default on)."""
        users = scheduler._get_interested_users_for_trending(["u1", "u2"])
        assert users == ["u1", "u2"]

    def test_get_interested_users_global_off(self, scheduler, mock_db):
        """User with global OFF should be filtered out."""
        off_pref = NotificationPreference(
            user_id="u2",
            feed_id=None,
            delivery_method=DeliveryMethod.WEBSOCKET,
            frequency=NotificationFrequency.OFF,
        )
        mock_db.get_user_preferences = MagicMock(
            side_effect=lambda uid: [off_pref] if uid == "u2" else []
        )
        scheduler.db = mock_db

        users = scheduler._get_interested_users_for_trending(["u1", "u2", "u3"])
        assert "u2" not in users
        assert "u1" in users and "u3" in users

    def test_get_interested_users_per_feed_pref_ignored_for_trending(self, scheduler, mock_db):
        """Per-feed prefs do not opt-out of global trending (feed_id set)."""
        feed_pref = NotificationPreference(
            user_id="u1",
            feed_id="some-feed",
            delivery_method=DeliveryMethod.IN_APP,
            frequency=NotificationFrequency.OFF,
        )
        mock_db.get_user_preferences = MagicMock(return_value=[feed_pref])
        scheduler.db = mock_db

        users = scheduler._get_interested_users_for_trending(["u1"])
        assert users == ["u1"]  # per-feed OFF does not affect trending

    def test_get_interested_users_topic_preferred(self, scheduler, mock_db):
        """Users with preferred topics only receive matching trending topics."""
        from ai_web_feeds.models import UserProfile

        profile = UserProfile(user_id="u_pref", preferred_topics=["ai"], blocked_topics=[])
        mock_db.get_user_preferences = MagicMock(return_value=[])
        mock_db.get_user_profile = MagicMock(
            side_effect=lambda uid: profile if uid == "u_pref" else None
        )
        mock_db.get_user_followed_sources = MagicMock(return_value=["feed-1"])
        mock_db.get_feed_topics = MagicMock(return_value=["ml"])
        scheduler.db = mock_db

        assert "u_pref" in scheduler._get_interested_users_for_trending(["u_pref"], "ai")
        assert "u_pref" not in scheduler._get_interested_users_for_trending(["u_pref"], "ml")

    def test_get_interested_users_topic_blocked(self, scheduler, mock_db):
        """Blocked topics are excluded from trending notifications."""
        from ai_web_feeds.models import UserProfile

        profile = UserProfile(user_id="u_block", preferred_topics=[], blocked_topics=["crypto"])
        mock_db.get_user_preferences = MagicMock(return_value=[])
        mock_db.get_user_profile = MagicMock(return_value=profile)
        mock_db.get_user_followed_sources = MagicMock(return_value=["feed-1"])
        mock_db.get_feed_topics = MagicMock(return_value=["crypto"])
        scheduler.db = mock_db

        users = scheduler._get_interested_users_for_trending(["u_block"], "crypto")
        assert users == []

    def test_get_interested_users_mixed_prefs(self, scheduler, mock_db):
        """Mixed: one global OFF, one with per-feed, one none."""
        off_global = NotificationPreference(
            user_id="u_off",
            feed_id=None,
            delivery_method=DeliveryMethod.EMAIL,
            frequency=NotificationFrequency.OFF,
        )
        feed_pref = NotificationPreference(
            user_id="u_feed",
            feed_id="f1",
            delivery_method=DeliveryMethod.WEBSOCKET,
            frequency=NotificationFrequency.INSTANT,
        )

        def get_prefs(uid: str):
            if uid == "u_off":
                return [off_global]
            if uid == "u_feed":
                return [feed_pref]
            return []

        mock_db.get_user_preferences = MagicMock(side_effect=get_prefs)
        scheduler.db = mock_db

        users = scheduler._get_interested_users_for_trending(["u_off", "u_feed", "u_none"])
        assert users == ["u_feed", "u_none"]
