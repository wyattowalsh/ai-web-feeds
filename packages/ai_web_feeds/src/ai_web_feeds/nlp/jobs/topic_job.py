"""Batch job for topic modeling (Phase 5D)."""

from datetime import datetime
import json
from uuid import uuid4

from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import FeedEntry, Subtopic
from ai_web_feeds.nlp.topic_modeler import TopicModeler
from ai_web_feeds.storage import DatabaseManager


class TopicModelingJob:
    """Batch process articles for topic modeling and subtopic discovery.

    Groups articles by parent topic, discovers subtopics using LDA,
    and stores results for hierarchical taxonomy and evolution tracking.
    """

    def __init__(self, settings: Settings | None = None):
        """Initialize topic modeling job."""
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.modeler = TopicModeler(settings)
        self.db_manager = DatabaseManager(self.settings.database_url)
        self.engine = self.db_manager.engine

    def run(self, topic: str | None = None, force: bool = False, min_articles: int = 10) -> dict:
        """Run topic modeling batch job.

        Args:
            topic: Specific topic to model (None = all topics)
            force: If True, reprocess all topics
            min_articles: Minimum articles per topic for modeling

        Returns:
            Dict with job statistics: {
                "topics_processed": 5,
                "subtopics_discovered": 23,
                "articles_analyzed": 450,
                "failed": 0,
                "duration_seconds": 120.5
            }
        """
        start_time = datetime.utcnow()

        stats = {
            "topics_processed": 0,
            "subtopics_discovered": 0,
            "articles_analyzed": 0,
            "failed": 0,
            "duration_seconds": 0.0,
        }

        logger.info(f"Starting topic modeling batch job (topic={topic}, force={force})")

        with Session(self.engine) as session:
            # Get articles grouped by topic
            if topic:
                topics_to_process = [topic]
            else:
                # Get all unique topics from feed entries
                # This would ideally query from a topics table
                topics_to_process = ["Machine Learning", "AI", "Deep Learning"]  # Placeholder

            for parent_topic in topics_to_process:
                try:
                    # Query articles for this topic
                    # In production, this would filter by topic assignments
                    query = select(FeedEntry).where(FeedEntry.topics_processed == False)
                    articles = session.exec(query).all()

                    if len(articles) < min_articles:
                        logger.info(
                            f"Skipping '{parent_topic}': insufficient articles ({len(articles)} < {min_articles})"
                        )
                        continue

                    stats["topics_processed"] += 1
                    stats["articles_analyzed"] += len(articles)

                    # Convert to dicts
                    article_dicts = [
                        {
                            "id": a.id,
                            "title": a.title,
                            "content": a.content or a.summary or "",
                            "summary": a.summary,
                        }
                        for a in articles
                    ]

                    # Discover subtopics
                    subtopics = self.modeler.discover_subtopics(
                        parent_topic, article_dicts, num_topics=5
                    )

                    # Store discovered subtopics
                    for discovered in subtopics:
                        subtopic = Subtopic(
                            id=str(uuid4()),
                            parent_topic=parent_topic,
                            name=discovered.name,
                            keywords=json.dumps(discovered.keywords),
                            description=f"Auto-discovered subtopic with coherence {discovered.coherence_score:.2f}",
                            article_count=discovered.article_count,
                            detected_at=datetime.utcnow(),
                            approved=False,  # Requires manual curation
                            created_by="system",
                        )
                        session.add(subtopic)
                        stats["subtopics_discovered"] += 1

                    # Mark articles as processed
                    for article in articles:
                        article.topics_processed = True
                        session.add(article)

                    logger.info(
                        f"Discovered {len(subtopics)} subtopics for '{parent_topic}' "
                        f"from {len(articles)} articles"
                    )

                except Exception as e:
                    stats["failed"] += 1
                    logger.error(f"Failed to process topic '{parent_topic}': {e}")

            # Commit all changes
            session.commit()

        end_time = datetime.utcnow()
        stats["duration_seconds"] = (end_time - start_time).total_seconds()

        logger.info(
            f"Topic modeling batch job completed: "
            f"topics={stats['topics_processed']}, subtopics={stats['subtopics_discovered']}, "
            f"articles={stats['articles_analyzed']}, failed={stats['failed']}, "
            f"duration={stats['duration_seconds']:.2f}s"
        )

        return stats
