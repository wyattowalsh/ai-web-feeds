"""ai_web_feeds.enrich_pkg.batch -- Single-source and batch enrichment."""

from datetime import UTC, datetime
from typing import Any

from loguru import logger

from ai_web_feeds.enrich_pkg.runtime import lookup
from ai_web_feeds.models import FeedEnrichmentData
from ai_web_feeds.storage import DatabaseManager


async def enrich_feed_source(
    source: dict[str, Any], db: DatabaseManager | None = None
) -> dict[str, Any]:
    """Enrich a single feed source with metadata.

    Args:
        source: Feed source dictionary
        db: Optional database manager for persistence

    Returns:
        Enriched feed source dictionary
    """
    enricher = lookup("AdvancedEnricher")()
    feed_url = source.get("feed")
    site_url = source.get("site")

    if not feed_url and not site_url:
        logger.warning(f"Skipping {source.get('id')}: no feed or site URL")
        return source

    try:
        # Use AdvancedEnricher for enrichment
        url_to_enrich = feed_url or site_url
        url_type = "feed" if feed_url else "site"
        enrichment = await enricher.enrich_from_url(url_to_enrich, url_type=url_type)

        # Merge enrichment data back into source
        enriched = {**source}

        # Update with enriched metadata (access direct attributes, not to_dict())
        if enrichment.title:
            enriched["title"] = enrichment.title
        if enrichment.description:
            enriched["description"] = enrichment.description
        if enrichment.language:
            enriched["language"] = enrichment.language

        # Add enrichment metadata to source
        enriched["enrichment"] = {
            "enriched_at": datetime.now(UTC).isoformat(),
            "quality_score": enrichment.quality_score,
            "health_score": enrichment.health_score,
        }

        # Persist enrichment data to database if db provided
        if db:
            enrichment_data = FeedEnrichmentData(
                feed_source_id=source.get("id", ""),
                enriched_at=datetime.now(UTC),
                enrichment_version="1.0.0",
                enricher="AdvancedEnricher",
                # Basic metadata
                discovered_title=enrichment.title,
                discovered_description=enrichment.description,
                discovered_language=enrichment.language,
                discovered_author=enrichment.author,
                # Format/platform
                detected_format=enrichment.format,
                detected_platform=enrichment.platform,
                # Visual assets
                icon_url=enrichment.icon_url,
                logo_url=enrichment.logo_url,
                image_url=enrichment.image_url,
                # Scores
                health_score=enrichment.health_score,
                quality_score=enrichment.quality_score,
                completeness_score=enrichment.completeness_score,
                # Content analysis
                entry_count=enrichment.entry_count,
                has_full_content=enrichment.has_full_content,
                avg_content_length=enrichment.avg_content_length,
                content_types=enrichment.content_types,
                # Update patterns
                estimated_frequency=enrichment.estimated_frequency,
                last_updated=enrichment.last_updated,
                update_regularity=enrichment.update_regularity,
                # Performance
                response_time_ms=enrichment.response_time_ms,
                availability_score=enrichment.availability_score,
                # Topics
                suggested_topics=enrichment.suggested_topics,
                topic_confidence=enrichment.topic_confidence,
                # Extensions
                has_itunes=enrichment.has_itunes,
                has_media_rss=enrichment.has_media_rss,
                has_dublin_core=enrichment.has_dublin_core,
                # Extra data - store full dict representation
                extra_data=enrichment.to_dict(),
            )
            db.add_enrichment_data(enrichment_data)

        logger.info(f"Enriched: {source.get('id')}")
        return enriched

    except Exception as e:
        logger.error(f"Failed to enrich {source.get('id')}: {e}")
        return source


def enrich_all_feeds(
    feeds_data: dict[str, Any], db: DatabaseManager | None = None
) -> dict[str, Any]:
    """Enrich all feed sources in the data.

    Args:
        feeds_data: Dictionary containing 'sources' list
        db: Optional database manager for persistence

    Returns:
        Dictionary with enriched sources
    """
    sources = feeds_data.get("sources", [])
    logger.info(f"Enriching {len(sources)} feed sources...")

    enriched_sources = lookup("asyncio").run(lookup("_enrich_all_feeds_async")(sources, db))

    # Update metadata
    enriched_data = {
        **feeds_data,
        "sources": enriched_sources,
        "document_meta": {
            **feeds_data.get("document_meta", {}),
            "enriched_at": datetime.now(UTC).isoformat(),
            "total_sources": len(enriched_sources),
        },
    }

    logger.info(f"Enrichment complete: {len(enriched_sources)} sources processed")
    return enriched_data


async def _enrich_all_feeds_async(
    sources: list[dict[str, Any]], db: DatabaseManager | None = None
) -> list[dict[str, Any]]:
    """Asynchronously enrich all feed sources.

    Args:
        sources: List of feed source dictionaries
        db: Optional database manager for persistence

    Returns:
        List of enriched feed source dictionaries
    """
    enriched_sources = []
    for source in sources:
        try:
            enriched = await lookup("enrich_feed_source")(source, db=db)
            enriched_sources.append(enriched)
        except Exception as e:
            logger.error(f"Error enriching {source.get('id')}: {e}")
            enriched_sources.append(source)
    return enriched_sources
