"""Batch job for entity extraction (Phase 5B)."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from loguru import logger
from sqlmodel import Session, select

from ai_web_feeds.config import Settings
from ai_web_feeds.models import ArticleEntry, Entity, EntityMention
from ai_web_feeds.nlp.entity_extractor import EntityExtractor
from ai_web_feeds.storage import DatabaseManager


def _utc_now() -> datetime:
    """Return the current UTC timestamp as a timezone-aware datetime."""
    return datetime.now(UTC)


class EntityBatchJob:
    """Batch process articles for entity extraction.

    Extracts named entities from articles using spaCy,
    normalizes entity names, and stores mentions in SQLite.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        db_manager: DatabaseManager | None = None,
        nlp: Any | None = None,
    ):
        """Initialize entity batch job.

        Args:
            settings: Application settings (uses defaults if None)
            db_manager: Database that holds stored article rows
            nlp: Optional spaCy model injected into the extractor. When omitted, the
                extractor loads the configured local model on first use.
        """
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.extractor = EntityExtractor(self.settings, nlp=nlp)
        self.db_manager = db_manager or DatabaseManager(self.settings.database_url)

    def run(self, batch_size: int | None = None, force: bool = False) -> dict:
        """Run entity extraction batch job.

        Args:
            batch_size: Number of articles to process (default: from config)
            force: If True, reprocess all articles regardless of existing entities

        Returns:
            Dict with job statistics: {
                "processed": 42,
                "entities_found": 150,
                "unique_entities": 45,
                "skipped": 0,
                "failed": 0,
                "duration_seconds": 25.3
            }
        """
        start_time = _utc_now()
        batch_size = batch_size or self.config.entity_batch_size

        stats = {
            "processed": 0,
            "entities_found": 0,
            "unique_entities": 0,
            "skipped": 0,
            "failed": 0,
            "duration_seconds": 0.0,
        }

        logger.info(
            f"Starting entity extraction batch job (batch_size={batch_size}, force={force})"
        )

        with self.db_manager.get_session() as session:
            # Query unprocessed articles
            query = select(ArticleEntry)
            if not force:
                query = query.where(ArticleEntry.entities_processed.is_(False))
            query = query.limit(batch_size)

            articles = session.exec(query).all()

            if not articles:
                logger.info("No articles to process")
                return stats

            logger.info(f"Found {len(articles)} articles to process for entity extraction")

            # Injected model, or a local spaCy install. A missing ml extra skips rows.
            model_ready = self.extractor.ensure_model()
            existing_entities = self._load_existing_entities(session) if model_ready else {}

            for article in articles:
                stats["processed"] += 1
                if not model_ready:
                    stats["skipped"] += 1
                    logger.warning(f"Skipping article {article.id}; optional ml extra is missing")
                    continue

                try:
                    # Convert SQLModel to dict
                    article_dict = {
                        "id": article.id,
                        "title": article.title,
                        "content": article.content_html or article.summary or "",
                        "summary": article.summary,
                    }

                    # Extract entities
                    entities = self.extractor.extract_entities(article_dict)

                    if not entities:
                        logger.debug(f"No entities found in article {article.id}")
                        # Mark as processed even if no entities found
                        article.entities_processed = True
                        article.entities_processed_at = _utc_now()
                        session.add(article)
                        continue

                    stats["entities_found"] += len(entities)

                    # Normalize and store entities
                    for extracted_entity in entities:
                        # Normalize entity
                        normalized = self.extractor.normalize_entity(
                            extracted_entity.text, extracted_entity.label, existing_entities
                        )

                        entity_id = None

                        if normalized["is_new"]:
                            # Create new entity
                            entity_id = str(uuid4())
                            entity = Entity(
                                id=entity_id,
                                canonical_name=normalized["canonical_name"],
                                entity_type=normalized["entity_type"],
                                aliases=[normalized["canonical_name"]],
                                frequency_count=1,
                                first_seen=_utc_now(),
                                last_seen=_utc_now(),
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
                                entity.last_seen = _utc_now()
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
                                extracted_entity.end,
                            ),
                            mentioned_at=_utc_now(),
                        )
                        session.add(mention)

                    # Mark article as processed
                    article.entities_processed = True
                    article.entities_processed_at = _utc_now()
                    session.add(article)

                    logger.debug(f"Extracted {len(entities)} entities from article {article.id}")

                except Exception as e:
                    stats["failed"] += 1
                    logger.error(f"Failed to extract entities from article {article.id}: {e}")

                    # Track failure
                    article.last_failure_reason = f"entity_extraction: {e!s}"
                    session.add(article)

            # Commit all changes
            session.commit()

        end_time = _utc_now()
        stats["duration_seconds"] = (end_time - start_time).total_seconds()

        logger.info(
            f"Entity extraction batch job completed: "
            f"processed={stats['processed']}, entities_found={stats['entities_found']}, "
            f"unique={stats['unique_entities']}, skipped={stats['skipped']}, "
            f"failed={stats['failed']}, duration={stats['duration_seconds']:.2f}s"
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
