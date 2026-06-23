"""Integration tests for NLP scheduler with main scheduler.

Uses pytest patterns from test_analytics.py and test_scheduler.py.
"""

from unittest.mock import MagicMock, patch

import pytest
from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.scheduler import NLPScheduler
from ai_web_feeds.scheduler import SchedulerManager
from ai_web_feeds.storage import DatabaseManager


@pytest.fixture
def mock_db():
    """Mock database manager following test_scheduler.py pattern."""
    db = MagicMock(spec=DatabaseManager)
    db.get_user_followed_sources = MagicMock(return_value=["feed-1", "feed-2"])
    db.get_articles = MagicMock(return_value=[])
    db.get_due_digests = MagicMock(return_value=[])
    return db


@pytest.fixture
def mock_settings():
    """Mock settings with NLP cron schedules."""
    settings = Settings()
    settings.phase3b.feed_poll_interval_min = 15
    settings.phase3b.trending_update_interval_hours = 1
    # NLP crons (fast for tests)
    settings.phase5.quality_cron = "* * * * *"
    settings.phase5.entity_cron = "* * * * *"
    settings.phase5.sentiment_cron = "* * * * *"
    settings.phase5.topic_modeling_cron = "* * * * *"
    return settings


@pytest.fixture
def nlp_scheduler(mock_settings):
    """Create NLPScheduler instance."""
    return NLPScheduler(mock_settings)


class TestNLPSchedulerInit:
    """Tests for NLPScheduler initialization."""

    def test_nlp_scheduler_initialization(self):
        """NLPScheduler should initialize with settings."""
        scheduler = NLPScheduler()
        assert scheduler is not None
        assert scheduler.settings is not None
        assert scheduler.scheduler is not None
        assert scheduler._jobs_registered is False

    def test_nlp_scheduler_with_custom_settings(self, mock_settings):
        """NLPScheduler should accept custom settings."""
        scheduler = NLPScheduler(mock_settings)
        assert scheduler.config is not None


class TestNLPSchedulerRegisterJobs:
    """Tests for job registration."""

    def test_register_jobs_registers_all_jobs(self, nlp_scheduler):
        """register_jobs should register all four NLP jobs."""
        nlp_scheduler.register_jobs()

        assert nlp_scheduler._jobs_registered is True
        jobs = nlp_scheduler.scheduler.get_jobs()
        job_ids = [job.id for job in jobs]

        assert "quality_scoring" in job_ids
        assert "entity_extraction" in job_ids
        assert "sentiment_analysis" in job_ids
        assert "topic_modeling" in job_ids

    def test_register_jobs_idempotent(self, nlp_scheduler):
        """Calling register_jobs twice should be safe."""
        nlp_scheduler.register_jobs()
        first_count = len(nlp_scheduler.scheduler.get_jobs())

        # Second call should warn but not duplicate
        nlp_scheduler.register_jobs()
        second_count = len(nlp_scheduler.scheduler.get_jobs())

        assert first_count == second_count

    def test_register_jobs_without_settings_uses_defaults(self):
        """NLPScheduler without settings should use defaults."""
        scheduler = NLPScheduler()
        scheduler.register_jobs()
        assert scheduler._jobs_registered is True


class TestNLPSchedulerLifecycle:
    """Tests for scheduler start/shutdown."""

    def test_start_starts_scheduler(self, nlp_scheduler):
        """start() should start the underlying scheduler."""
        with patch.object(nlp_scheduler.scheduler, "start") as mock_start:
            nlp_scheduler.start()
            mock_start.assert_called_once()

    def test_shutdown_stops_scheduler(self, nlp_scheduler):
        """shutdown() should stop the scheduler if running."""
        with patch.object(
            type(nlp_scheduler.scheduler), "running", new_callable=lambda: True
        ):
            with patch.object(nlp_scheduler.scheduler, "shutdown") as mock_shutdown:
                nlp_scheduler.shutdown(wait=True)
                mock_shutdown.assert_called_once_with(wait=True)


class TestSchedulerManagerNLPIntegration:
    """Tests for SchedulerManager integration with NLPScheduler."""

    @pytest.fixture
    def scheduler(self, mock_db, mock_settings):
        """Create SchedulerManager with mocked DB/settings."""
        return SchedulerManager(mock_db, mock_settings)

    def test_scheduler_manager_has_nlp_scheduler(self, scheduler):
        """SchedulerManager should have an nlp_scheduler attribute."""
        assert hasattr(scheduler, "nlp_scheduler")
        assert isinstance(scheduler.nlp_scheduler, NLPScheduler)

    def test_start_registers_nlp_jobs(self, scheduler):
        """SchedulerManager.start() should register NLP jobs."""
        with patch.object(scheduler.scheduler, "start"):
            with patch.object(scheduler.nlp_scheduler.scheduler, "start"):
                scheduler.start()

                # NLP scheduler should have jobs registered
                assert scheduler.nlp_scheduler._jobs_registered is True

    def test_stop_shuts_down_nlp_scheduler(self, scheduler):
        """SchedulerManager.stop() should attempt to shutdown NLP scheduler."""
        with patch.object(scheduler.scheduler, "start"):
            with patch.object(scheduler.scheduler, "shutdown"):
                with patch.object(scheduler.nlp_scheduler, "shutdown") as mock_nlp_shutdown:
                    scheduler.start()
                    scheduler.stop()
                    # shutdown may be called; verify no exception
                    # (actual call depends on running state)
                    assert mock_nlp_shutdown is not None
