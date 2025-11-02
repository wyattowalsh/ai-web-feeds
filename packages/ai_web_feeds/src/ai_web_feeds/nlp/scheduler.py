"""APScheduler configuration for NLP batch jobs (Phase 5)."""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.jobs.entity_job import EntityBatchJob
from ai_web_feeds.nlp.jobs.quality_job import QualityBatchJob
from ai_web_feeds.nlp.jobs.sentiment_job import SentimentBatchJob
from ai_web_feeds.nlp.jobs.topic_job import TopicModelingJob


class NLPScheduler:
    """Background scheduler for Phase 5 NLP batch jobs.

    Manages scheduled execution of:
    - Quality scoring (configurable cron)
    - Entity extraction (configurable cron)
    - Sentiment analysis (configurable cron)
    - Topic modeling (configurable cron)
    """

    def __init__(self, settings: Settings | None = None):
        """Initialize NLP scheduler."""
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.scheduler = BackgroundScheduler()
        self._jobs_registered = False

    def register_jobs(self) -> None:
        """Register all NLP batch jobs with scheduler."""
        if self._jobs_registered:
            logger.warning("NLP jobs already registered, skipping")
            return

        # Quality scoring job (Phase 5A)
        self.scheduler.add_job(
            func=self._run_quality_job,
            trigger=CronTrigger.from_crontab(self.config.quality_cron),
            id="quality_scoring",
            name="Quality Scoring Batch Job",
            replace_existing=True,
        )
        logger.info(f"Registered quality scoring job: {self.config.quality_cron}")

        # Entity extraction job (Phase 5B)
        self.scheduler.add_job(
            func=self._run_entity_job,
            trigger=CronTrigger.from_crontab(self.config.entity_cron),
            id="entity_extraction",
            name="Entity Extraction Batch Job",
            replace_existing=True,
        )
        logger.info(f"Registered entity extraction job: {self.config.entity_cron}")

        # Sentiment analysis job (Phase 5C)
        self.scheduler.add_job(
            func=self._run_sentiment_job,
            trigger=CronTrigger.from_crontab(self.config.sentiment_cron),
            id="sentiment_analysis",
            name="Sentiment Analysis Batch Job",
            replace_existing=True,
        )
        logger.info(f"Registered sentiment analysis job: {self.config.sentiment_cron}")

        # Topic modeling job (Phase 5D)
        self.scheduler.add_job(
            func=self._run_topic_job,
            trigger=CronTrigger.from_crontab(self.config.topic_modeling_cron),
            id="topic_modeling",
            name="Topic Modeling Batch Job",
            replace_existing=True,
        )
        logger.info(f"Registered topic modeling job: {self.config.topic_modeling_cron}")

        self._jobs_registered = True

    def start(self) -> None:
        """Start the scheduler."""
        if not self._jobs_registered:
            self.register_jobs()

        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("NLP scheduler started")
        else:
            logger.warning("NLP scheduler already running")

    def shutdown(self, wait: bool = True) -> None:
        """Shutdown the scheduler.

        Args:
            wait: If True, wait for running jobs to complete
        """
        if self.scheduler.running:
            self.scheduler.shutdown(wait=wait)
            logger.info("NLP scheduler stopped")

    def _run_quality_job(self) -> None:
        """Execute quality scoring batch job."""
        try:
            logger.info("Starting scheduled quality scoring job")
            job = QualityBatchJob(self.settings)
            stats = job.run()
            logger.info(f"Quality scoring job completed: {stats}")
        except Exception as e:
            logger.error(f"Quality scoring job failed: {e}")

    def _run_entity_job(self) -> None:
        """Execute entity extraction batch job."""
        try:
            logger.info("Starting scheduled entity extraction job")
            job = EntityBatchJob(self.settings)
            stats = job.run()
            logger.info(f"Entity extraction job completed: {stats}")
        except Exception as e:
            logger.error(f"Entity extraction job failed: {e}")

    def _run_sentiment_job(self) -> None:
        """Execute sentiment analysis batch job."""
        try:
            logger.info("Starting scheduled sentiment analysis job")
            job = SentimentBatchJob(self.settings)
            stats = job.run()
            logger.info(f"Sentiment analysis job completed: {stats}")
        except Exception as e:
            logger.error(f"Sentiment analysis job failed: {e}")

    def _run_topic_job(self) -> None:
        """Execute topic modeling batch job."""
        try:
            logger.info("Starting scheduled topic modeling job")
            job = TopicModelingJob(self.settings)
            stats = job.run()
            logger.info(f"Topic modeling job completed: {stats}")
        except Exception as e:
            logger.error(f"Topic modeling job failed: {e}")
