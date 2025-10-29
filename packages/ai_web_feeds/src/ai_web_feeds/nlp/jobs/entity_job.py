"""Batch job for entity extraction (Phase 5B)."""

import json
from datetime import datetime
from typing import Optional
from uuid import uuid4

from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import Entity, EntityMention, FeedEntry
from ai_web_feeds.nlp.entity_extractor import EntityExtractor
from ai_web_feeds.storage import DatabaseManager


class EntityBatchJob:
    """Batch process articles for entity extraction.
    
    Extracts named entities from articles using spaCy,
    normalizes entity names, and stores mentions in SQLite.
    """
    
    def __init__(self, settings: Optional[Settings] = None):
        """Initialize entity batch job."""
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.extractor = EntityExtractor(settings)
        self.db_manager = DatabaseManager(self.settings.database_url)
        self.engine = self.db_manager.engine
    
    def run(self, batch_size: Optional[int] = None, force: bool = False) -> dict:
        """Run entity extraction batch job.
        
        Args:
            batch_size: Number of articles to process (default: from config)
            force: If True, reprocess all articles regardless of existing entities
            
        Returns:
            Dict with job statistics: {
                "processed": 42,
                "entities_found": 150,
                "unique_entities": 45,
                "failed": 0,
                "duration_seconds": 25.3
            }
        """
        start_time = datetime.utcnow()
        batch_size = batch_size or self.config.entity_batch_size
        
        stats = {
            "processed": 0,
            "entities_found": 0,
            "unique_entities": 0,
            "failed": 0,
            "duration_seconds": 0.0,
        }
        
        logger.info(f"Starting entity extraction batch job (batch_size={batch_size}, force={force})")
        
        with Session(self.engine) as session:
            # Query unprocessed articles
            query = select(FeedEntry)
            if not force:
                query = query.where(FeedEntry.entities_processed == False)
            query = query.limit(batch_size)
            
            articles = session.exec(query).all()
            
            if not articles:
                logger.info("No articles to process")
                return stats
            
            logger.info(f"Found {len(articles)} articles to process for entity extraction")
            
            # Load existing entities for normalization
            existing_entities = self._load_existing_entities(session)
            
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
                    
                    # Extract entities
                    entities = self.extractor.extract_entities(article_dict)
                    
                    if not entities:
                        logger.debug(f"No entities found in article {article.id}")
                        # Mark as processed even if no entities found
                        article.entities_processed = True
                        article.entities_processed_at = datetime.utcnow()
                        session.add(article)
                        continue
                    
                    stats["entities_found"] += len(entities)
                    
                    # Normalize and store entities
                    for extracted_entity in entities:
                        # Normalize entity
                        normalized = self.extractor.normalize_entity(
                            extracted_entity.text,
                            extracted_entity.label,
                            existing_entities
                        )
                        
                        entity_id = None
                        
                        if normalized["is_new"]:
                            # Create new entity
                            entity_id = str(uuid4())
                            entity = Entity(
                                id=entity_id,
                                canonical_name=normalized["canonical_name"],
                                entity_type=normalized["entity_type"],
                                aliases=json.dumps([normalized["canonical_name"]]),
                                frequency_count=1,
                                first_seen=datetime.utcnow(),
                                last_seen=datetime.utcnow(),
                            )
                            session.add(entity)
                            existing_entities[entity_id] = {
                                "canonical_name": normalized["canonical_name"],
                                "entity_type": normalized["entity_type"],
                            }
                            stats["unique_entities"] += 1
                        else:
                            # Update existing entity
                            entity_id = normalized["id"]
                            entity = session.get(Entity, entity_id)
                            if entity:
                                entity.frequency_count += 1
                                entity.last_seen = datetime.utcnow()
                                session.add(entity)
                        
                        # Create entity mention
                        mention = EntityMention(
                            entity_id=entity_id,
                            article_id=article.id,
                            confidence=extracted_entity.confidence,
                            extraction_method="spacy_ner",
                            context=self._extract_context(
                                article_dict.get("content", ""),
                                extracted_entity.start,
                                extracted_entity.end
                            ),
                            mentioned_at=datetime.utcnow(),
                        )
                        session.add(mention)
                    
                    # Mark article as processed
                    article.entities_processed = True
                    article.entities_processed_at = datetime.utcnow()
                    session.add(article)
                    
                    logger.debug(f"Extracted {len(entities)} entities from article {article.id}")
                    
                except Exception as e:
                    stats["failed"] += 1
                    logger.error(f"Failed to extract entities from article {article.id}: {e}")
                    
                    # Track failure
                    article.last_failure_reason = f"entity_extraction: {str(e)}"
                    session.add(article)
            
            # Commit all changes
            session.commit()
        
        end_time = datetime.utcnow()
        stats["duration_seconds"] = (end_time - start_time).total_seconds()
        
        logger.info(
            f"Entity extraction batch job completed: "
            f"processed={stats['processed']}, entities_found={stats['entities_found']}, "
            f"unique={stats['unique_entities']}, failed={stats['failed']}, "
            f"duration={stats['duration_seconds']:.2f}s"
        )
        
        return stats
    
    def _load_existing_entities(self, session: Session) -> dict[str, dict]:
        """Load existing entities for normalization."""
        entities = session.exec(select(Entity)).all()
        return {
            entity.id: {
                "canonical_name": entity.canonical_name,
                "entity_type": entity.entity_type,
            }
            for entity in entities
        }
    
    def _extract_context(self, content: str, start: int, end: int, window: int = 50) -> str:
        """Extract surrounding context for entity mention.
        
        Args:
            content: Full article content
            start: Entity start position
            end: Entity end position
            window: Characters to include before/after
            
        Returns:
            Context string with entity and surrounding text
        """
        if not content:
            return ""
        
        context_start = max(0, start - window)
        context_end = min(len(content), end + window)
        
        context = content[context_start:context_end]
        
        # Truncate to reasonable length
        return context[:200]
