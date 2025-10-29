"""APScheduler configuration for NLP batch jobs (Phase 5)."""

from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.jobs.quality_job import QualityBatchJob


class NLPScheduler:
    """Background scheduler for Phase 5 NLP batch jobs.
    
    Manages scheduled execution of:
    - Quality scoring (configurable cron)
    - Entity extraction (configurable cron)
    - Sentiment analysis (configurable cron)
    - Topic modeling (configurable cron)
    """
    
    def __init__(self, settings: Optional[Settings] = None):
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
        
        # Quality scoring job
        self.scheduler.add_job(
            func=self._run_quality_job,
            trigger=CronTrigger.from_crontab(self.config.quality_cron),
            id="quality_scoring",
            name="Quality Scoring Batch Job",
            replace_existing=True,
        )
        logger.info(f"Registered quality scoring job: {self.config.quality_cron}")
        
        # Entity extraction job (Phase 5B)
        # TODO: Implement entity extraction job
        logger.info(f"Entity extraction job (Phase 5B): {self.config.entity_cron}")
        
        # Sentiment analysis job (Phase 5C)
        # TODO: Implement sentiment analysis job
        logger.info(f"Sentiment analysis job (Phase 5C): {self.config.sentiment_cron}")
        
        # Topic modeling job (Phase 5D)
        # TODO: Implement topic modeling job
        logger.info(f"Topic modeling job (Phase 5D): {self.config.topic_modeling_cron}")
        
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

