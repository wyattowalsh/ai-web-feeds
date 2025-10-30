"""Batch job for quality scoring articles (Phase 5A)."""

from datetime import datetime
from typing import Optional

from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import ArticleQualityScore, FeedEntry
from ai_web_feeds.nlp.quality_scorer import QualityScorer
from ai_web_feeds.storage import DatabaseManager


class QualityBatchJob:
    """Batch process articles for quality scoring.
    
    Processes unscored articles in configurable batch sizes,
    computing quality metrics and storing results in SQLite.
    """
    
    def __init__(self, settings: Optional[Settings] = None):
        """Initialize quality batch job."""
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.scorer = QualityScorer(settings)
        self.db_manager = DatabaseManager(self.settings.database_url)
        self.engine = self.db_manager.engine
    
    def run(self, batch_size: Optional[int] = None, force: bool = False) -> dict:
        """Run quality scoring batch job.
        
        Args:
            batch_size: Number of articles to process (default: from config)
            force: If True, reprocess all articles regardless of existing scores
            
        Returns:
            Dict with job statistics: {
                "processed": 42,
                "scored": 40,
                "skipped": 2,
                "failed": 0,
                "duration_seconds": 12.5
            }
        """
        start_time = datetime.utcnow()
        batch_size = batch_size or self.config.quality_batch_size
        
        stats = {
            "processed": 0,
            "scored": 0,
            "skipped": 0,
            "failed": 0,
            "duration_seconds": 0.0,
        }
        
        logger.info(f"Starting quality scoring batch job (batch_size={batch_size}, force={force})")
        
        with Session(self.engine) as session:
            # Query unprocessed articles
            query = select(FeedEntry)
            if not force:
                query = query.where(FeedEntry.quality_processed == False)
            query = query.limit(batch_size)
            
            articles = session.exec(query).all()
            
            if not articles:
                logger.info("No articles to process")
                return stats
            
            logger.info(f"Found {len(articles)} articles to score")
            
            for article in articles:
                stats["processed"] += 1
                
                try:
                    # Convert SQLModel to dict for scorer
                    article_dict = {
                        "id": article.id,
                        "title": article.title,
                        "content": article.content or article.summary or "",
                        "summary": article.summary,
                        "author": getattr(article, "author", None),
                        "author_detail": None,  # TODO: Extract from feed metadata
                        "url": article.link,
                        "feed_id": article.feed_id,
                        "share_count": 0,  # TODO: Add social sharing metrics
                    }
                    
                    # Score article
                    score_result = self.scorer.score_article(article_dict)
                    
                    if score_result is None:
                        # Article too short or invalid
                        logger.debug(f"Skipped article {article.id}: content too short")
                        stats["skipped"] += 1
                        
                        # Mark as processed to avoid reprocessing
                        article.quality_processed = True
                        article.quality_processed_at = datetime.utcnow()
                        session.add(article)
                        continue
                    
                    # Store quality scores
                    quality_score = ArticleQualityScore(
                        article_id=article.id,
                        overall_score=score_result.overall_score,
                        depth_score=score_result.depth_score,
                        reference_score=score_result.reference_score,
                        author_score=score_result.author_score,
                        domain_score=score_result.domain_score,
                        engagement_score=score_result.engagement_score,
                        computed_at=datetime.utcnow(),
                    )
                    
                    # Upsert: delete existing score if reprocessing
                    if force:
                        existing = session.get(ArticleQualityScore, article.id)
                        if existing:
                            session.delete(existing)
                    
                    session.add(quality_score)
                    
                    # Mark article as processed
                    article.quality_processed = True
                    article.quality_processed_at = datetime.utcnow()
                    session.add(article)
                    
                    stats["scored"] += 1
                    logger.debug(f"Scored article {article.id}: overall={score_result.overall_score}")
                    
                except Exception as e:
                    stats["failed"] += 1
                    logger.error(f"Failed to score article {article.id}: {e}")
                    
                    # Track failure in article record
                    article.last_failure_reason = f"quality_scoring: {str(e)}"
                    # Update nlp_failures JSON (increment counter)
                    # TODO: Implement JSON field update logic
                    session.add(article)
            
            # Commit all changes
            session.commit()
        
        end_time = datetime.utcnow()
        stats["duration_seconds"] = (end_time - start_time).total_seconds()
        
        logger.info(
            f"Quality scoring batch job completed: "
            f"processed={stats['processed']}, scored={stats['scored']}, "
            f"skipped={stats['skipped']}, failed={stats['failed']}, "
            f"duration={stats['duration_seconds']:.2f}s"
        )
        
        return stats
