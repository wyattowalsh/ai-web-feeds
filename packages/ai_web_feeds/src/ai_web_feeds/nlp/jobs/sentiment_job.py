"""Batch job for sentiment analysis (Phase 5C)."""

from datetime import datetime
from typing import Optional

from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import ArticleSentiment, FeedEntry
from ai_web_feeds.nlp.sentiment_analyzer import SentimentAnalyzer
from ai_web_feeds.storage import DatabaseManager


class SentimentBatchJob:
    """Batch process articles for sentiment analysis.
    
    Analyzes article sentiment using transformer models,
    and stores results in SQLite for trend analysis.
    """
    
    def __init__(self, settings: Optional[Settings] = None):
        """Initialize sentiment batch job."""
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.analyzer = SentimentAnalyzer(settings)
        self.db_manager = DatabaseManager(self.settings.database_url)
        self.engine = self.db_manager.engine
    
    def run(self, batch_size: Optional[int] = None, force: bool = False) -> dict:
        """Run sentiment analysis batch job.
        
        Args:
            batch_size: Number of articles to process (default: from config)
            force: If True, reprocess all articles regardless of existing sentiment
            
        Returns:
            Dict with job statistics: {
                "processed": 42,
                "analyzed": 40,
                "positive": 15,
                "neutral": 20,
                "negative": 5,
                "failed": 2,
                "duration_seconds": 18.7
            }
        """
        start_time = datetime.utcnow()
        batch_size = batch_size or self.config.sentiment_batch_size
        
        stats = {
            "processed": 0,
            "analyzed": 0,
            "positive": 0,
            "neutral": 0,
            "negative": 0,
            "failed": 0,
            "duration_seconds": 0.0,
        }
        
        logger.info(f"Starting sentiment analysis batch job (batch_size={batch_size}, force={force})")
        
        with Session(self.engine) as session:
            # Query unprocessed articles
            query = select(FeedEntry)
            if not force:
                query = query.where(FeedEntry.sentiment_processed == False)
            query = query.limit(batch_size)
            
            articles = session.exec(query).all()
            
            if not articles:
                logger.info("No articles to process")
                return stats
            
            logger.info(f"Found {len(articles)} articles to process for sentiment analysis")
            
            for article in articles:
                stats["processed"] += 1
                
                try:
                    # Convert SQLModel to dict
                    article_dict = {
                        "id": article.id,
                        "title": article.title,
                        "content": article.content or article.summary or "",
                        "summary": article.summary,
                    }
                    
                    # Analyze sentiment
                    sentiment_result = self.analyzer.analyze_sentiment(article_dict)
                    
                    if sentiment_result is None:
                        logger.debug(f"No sentiment result for article {article.id}")
                        # Mark as processed even if analysis failed
                        article.sentiment_processed = True
                        article.sentiment_processed_at = datetime.utcnow()
                        session.add(article)
                        continue
                    
                    # Store sentiment
                    sentiment = ArticleSentiment(
                        article_id=article.id,
                        sentiment_score=sentiment_result.sentiment_score,
                        classification=sentiment_result.classification,
                        model_name=sentiment_result.model_name,
                        confidence=sentiment_result.confidence,
                        computed_at=datetime.utcnow(),
                    )
                    
                    # Upsert: delete existing sentiment if reprocessing
                    if force:
                        existing = session.get(ArticleSentiment, article.id)
                        if existing:
                            session.delete(existing)
                    
                    session.add(sentiment)
                    
                    # Update statistics
                    stats["analyzed"] += 1
                    if sentiment_result.classification == "positive":
                        stats["positive"] += 1
                    elif sentiment_result.classification == "negative":
                        stats["negative"] += 1
                    else:
                        stats["neutral"] += 1
                    
                    # Mark article as processed
                    article.sentiment_processed = True
                    article.sentiment_processed_at = datetime.utcnow()
                    session.add(article)
                    
                    logger.debug(
                        f"Analyzed sentiment for article {article.id}: "
                        f"{sentiment_result.classification} ({sentiment_result.sentiment_score:.2f})"
                    )
                    
                except Exception as e:
                    stats["failed"] += 1
                    logger.error(f"Failed to analyze sentiment for article {article.id}: {e}")
                    
                    # Track failure
                    article.last_failure_reason = f"sentiment_analysis: {str(e)}"
                    session.add(article)
            
            # Commit all changes
            session.commit()
        
        end_time = datetime.utcnow()
        stats["duration_seconds"] = (end_time - start_time).total_seconds()
        
        logger.info(
            f"Sentiment analysis batch job completed: "
            f"processed={stats['processed']}, analyzed={stats['analyzed']}, "
            f"positive={stats['positive']}, neutral={stats['neutral']}, negative={stats['negative']}, "
            f"failed={stats['failed']}, duration={stats['duration_seconds']:.2f}s"
        )
        
        return stats
