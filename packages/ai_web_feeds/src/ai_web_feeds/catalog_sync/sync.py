"""Catalog sync orchestrator (staged implementation; see remediation-v8-plan.md)."""

from __future__ import annotations

import time
from pathlib import Path

from ai_web_feeds.catalog_sync.mapper import catalog_hash
from ai_web_feeds.catalog_sync.stages import (
    count_source_topics,
    load_yaml_document,
    purge_stale_sources,
    sync_edges,
    sync_junctions,
    sync_sources,
    sync_topics,
)
from ai_web_feeds.catalog_sync.types import CatalogSyncResult
from ai_web_feeds.config import resolve_database_url
from ai_web_feeds.storage import DatabaseManager, upgrade_database_to_head


def _project_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _default_catalog_paths(
    *,
    feeds_path: Path | None,
    topics_path: Path | None,
    enriched_path: Path | None,
) -> tuple[Path, Path, Path]:
    data_dir = _project_root() / "data"
    return (
        feeds_path or data_dir / "feeds.yaml",
        topics_path or data_dir / "topics.yaml",
        enriched_path or data_dir / "feeds.enriched.yaml",
    )


def sync_catalog_to_db(
    *,
    feeds_path: Path | None = None,
    topics_path: Path | None = None,
    enriched_path: Path | None = None,
    database_url: str | None = None,
) -> CatalogSyncResult:
    """Sync Git catalog assets into the operational database using staged upserts."""
    feeds_file, topics_file, enriched_file = _default_catalog_paths(
        feeds_path=feeds_path,
        topics_path=topics_path,
        enriched_path=enriched_path,
    )
    db_url = resolve_database_url(explicit=database_url)

    upgrade_database_to_head(db_url)
    db = DatabaseManager(db_url)

    started = time.monotonic()
    feeds_doc = load_yaml_document(feeds_file)
    topics_doc = load_yaml_document(topics_file)
    enriched_doc = load_yaml_document(enriched_file)
    digest = catalog_hash(feeds_doc, topics_doc)

    stages = []
    topics_count = 0
    sources_count = 0
    junction_count = 0
    quarantine_count = 0

    with db.get_session() as session:
        topics_result, known_topic_ids = sync_topics(session, topics_doc)
        stages.append(topics_result)
        topics_count = topics_result.inserted + topics_result.updated

        edges_result = sync_edges(session, topics_doc, known_topic_ids)
        stages.append(edges_result)

        sources_result, synced_sources = sync_sources(session, enriched_doc, known_topic_ids)
        active_ids = {
            mapped["id"] for mapped in synced_sources if isinstance(mapped.get("id"), str)
        }
        purge_result = purge_stale_sources(session, active_ids=active_ids)
        sources_result.deleted += purge_result.deleted
        stages.append(sources_result)
        sources_count = len(active_ids)

        junctions_result = sync_junctions(session, synced_sources, known_topic_ids)
        stages.append(junctions_result)
        junction_count = junctions_result.inserted

        quarantine_count = sum(stage.quarantined for stage in stages)
        session.commit()
        junction_count = count_source_topics(session)

    duration_ms = int((time.monotonic() - started) * 1000)
    return CatalogSyncResult(
        catalog_hash=digest,
        stages=stages,
        topics_count=topics_count,
        sources_count=sources_count,
        junction_count=junction_count,
        quarantine_count=quarantine_count,
        duration_ms=duration_ms,
    )
