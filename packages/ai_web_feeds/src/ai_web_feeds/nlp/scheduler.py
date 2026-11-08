"""APScheduler configuration for NLP batch jobs (Phase 5).

Importing this module does not start a scheduler thread, download model
weights, or import the optional ML extra. Jobs are registered explicitly.
When that extra is missing, the scheduled job is skipped and logged.
"""

import importlib

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

from ai_web_feeds.config import Settings


class NLPScheduler:
    """Background scheduler for Phase 5 NLP batch jobs.

    Manages scheduled execution of:
    - Quality scoring (configurable cron)
    - Entity extraction (configurable cron)
    - Sentiment analysis (configurable cron)
    - TopicNode modeling (configurable cron)
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

        # TopicNode modeling job (Phase 5D)
        self.scheduler.add_job(
            func=self._run_topic_job,
            trigger=CronTrigger.from_crontab(self.config.topic_modeling_cron),
            id="topic_modeling",
            name="TopicNode Modeling Batch Job",
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

    def _run_job(
        self,
        module_name: str,
        class_name: str,
        *,
        label: str,
        completed: str,
        failed: str,
    ) -> None:
        """Run one registered batch job.

        Importing the job module is deferred until the job fires. A missing
        optional ML extra is logged and skipped. Other failures are logged
        and do not escape the scheduler thread.

        Args:
            module_name: Job module imported only when the job runs.
            class_name: Batch job class on that module.
            label: Short name used in the start and skip logs.
            completed: Success log prefix. Stats are appended.
            failed: Failure log prefix. The error is appended.
        """
        try:
            module = importlib.import_module(module_name)
            job_cls = getattr(module, class_name)
            logger.info(f"Starting scheduled {label}")
            job = job_cls(self.settings)
            stats = job.run()
            logger.info(f"{completed}: {stats}")
        except ImportError as exc:
            logger.warning(f"Skipping {label}; optional ml extra is missing: {exc}")
        except Exception as exc:
            logger.error(f"{failed}: {exc}")

    def _run_quality_job(self) -> None:
        """Execute quality scoring batch job."""
        self._run_job(
            "ai_web_feeds.nlp.jobs.quality_job",
            "QualityBatchJob",
            label="quality scoring job",
            completed="Quality scoring job completed",
            failed="Quality scoring job failed",
        )

    def _run_entity_job(self) -> None:
        """Execute entity extraction batch job."""
        self._run_job(
            "ai_web_feeds.nlp.jobs.entity_job",
            "EntityBatchJob",
            label="entity extraction job",
            completed="Entity extraction job completed",
            failed="Entity extraction job failed",
        )

    def _run_sentiment_job(self) -> None:
        """Execute sentiment analysis batch job."""
        self._run_job(
            "ai_web_feeds.nlp.jobs.sentiment_job",
            "SentimentBatchJob",
            label="sentiment analysis job",
            completed="Sentiment analysis job completed",
            failed="Sentiment analysis job failed",
        )

    def _run_topic_job(self) -> None:
        """Execute topic modeling batch job."""
        self._run_job(
            "ai_web_feeds.nlp.jobs.topic_job",
            "TopicModelingJob",
            label="topic modeling job",
            completed="TopicNode modeling job completed",
            failed="TopicNode modeling job failed",
        )
