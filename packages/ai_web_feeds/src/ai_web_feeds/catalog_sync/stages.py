"""Staged catalog synchronization steps (topics, edges, sources, junctions)."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

import yaml
from sqlalchemy import delete
from sqlmodel import Session, select

from ai_web_feeds.catalog_sync.mapper import map_enriched_source
from ai_web_feeds.catalog_sync.types import CatalogSyncStage, QuarantineReason, StageResult
from ai_web_feeds.models import (
    CurationStatus,
    FeedFormat,
    FeedSource,
    Medium,
    SourceTopic,
    SourceType,
    TopicEdge,
    TopicNode,
)
from ai_web_feeds.storage import replace_source_topics, upsert_topic

_TOPIC_FIELDS = (
    "label",
    "facet",
    "facet_group",
    "description",
    "aliases",
    "parents",
    "relations",
    "examples",
    "uri",
    "mappings",
    "i18n",
    "rank_hint",
    "tags",
    "notes",
)


def load_yaml_document(path) -> dict[str, Any]:
    """Load a YAML catalog document."""
    text = path.read_text(encoding="utf-8")
    document = yaml.safe_load(text)
    return document if isinstance(document, dict) else {}


def topic_entry_to_node(entry: dict[str, Any]) -> TopicNode:
    """Map a topics.yaml entry to a TopicNode row."""
    topic_id = entry.get("id")
    if not isinstance(topic_id, str) or not topic_id.strip():
        raise ValueError("topic id is required")

    label = entry.get("label")
    if not isinstance(label, str) or not label.strip():
        raise ValueError(f"topic label is required for {topic_id}")

    facet = entry.get("facet")
    if not isinstance(facet, str) or not facet.strip():
        facet = "domain"

    return TopicNode(
        id=topic_id.strip(),
        label=label.strip(),
        facet=facet.strip(),
        facet_group=entry.get("facet_group"),
        description=entry.get("description"),
        aliases=list(entry.get("aliases") or []),
        parents=list(entry.get("parents") or []),
        relations=dict(entry.get("relations") or {}),
        examples=list(entry.get("examples") or []),
        uri=entry.get("uri"),
        mappings=dict(entry.get("mappings") or {}),
        i18n=dict(entry.get("i18n") or {}),
        rank_hint=entry.get("rank_hint"),
        tags=list(entry.get("tags") or []),
        notes=entry.get("notes"),
    )


def sync_topics(session: Session, topics_doc: dict[str, Any]) -> tuple[StageResult, set[str]]:
    """Upsert TopicNode rows from a topics.yaml document."""
    result = StageResult(stage=CatalogSyncStage.TOPICS)
    known_ids: set[str] = set()

    for raw_entry in topics_doc.get("topics", []):
        if not isinstance(raw_entry, dict):
            result.errors.append("topic entry must be a mapping")
            continue
        try:
            topic = topic_entry_to_node(raw_entry)
        except ValueError as exc:
            result.errors.append(str(exc))
            continue

        _, inserted = upsert_topic(session, topic)
        known_ids.add(topic.id)
        if inserted:
            result.inserted += 1
        else:
            result.updated += 1

    return result, known_ids


def _iter_topic_edges(topic: dict[str, Any], known_ids: set[str]) -> list[tuple[str, str, str]]:
    """Yield (topic_id, related_topic_id, relation_type) tuples for known endpoints."""
    topic_id = topic.get("id")
    if not isinstance(topic_id, str) or topic_id not in known_ids:
        return []

    edges: list[tuple[str, str, str]] = []
    for parent_id in topic.get("parents") or []:
        if isinstance(parent_id, str) and parent_id in known_ids:
            edges.append((topic_id, parent_id, "parent"))

    relations = topic.get("relations")
    if isinstance(relations, dict):
        for relation_type, related_ids in relations.items():
            if not isinstance(relation_type, str) or not isinstance(related_ids, list):
                continue
            for related_id in related_ids:
                if isinstance(related_id, str) and related_id in known_ids:
                    edges.append((topic_id, related_id, relation_type))

    return edges


def sync_edges(
    session: Session,
    topics_doc: dict[str, Any],
    known_ids: set[str],
) -> StageResult:
    """Upsert TopicEdge rows derived from topic parents and relations."""
    result = StageResult(stage=CatalogSyncStage.EDGES)
    seen: set[tuple[str, str, str]] = set()

    for raw_entry in topics_doc.get("topics", []):
        if not isinstance(raw_entry, dict):
            continue
        for topic_id, related_id, relation_type in _iter_topic_edges(raw_entry, known_ids):
            key = (topic_id, related_id, relation_type)
            if key in seen:
                continue
            seen.add(key)

            existing = session.get(TopicEdge, key)
            if existing is None:
                session.add(
                    TopicEdge(
                        topic_id=topic_id,
                        related_topic_id=related_id,
                        relation_type=relation_type,
                    )
                )
                result.inserted += 1
            else:
                result.updated += 1

    return result


def _coerce_enum(value: Any, enum_cls: type, *, _field_name: str) -> Any:
    if value is None:
        return None
    if isinstance(value, enum_cls):
        return value
    if isinstance(value, str):
        try:
            return enum_cls(value)
        except ValueError:
            return None
    return None


def _coerce_mediums(values: Any) -> list[Medium]:
    if not isinstance(values, list):
        return []
    mediums: list[Medium] = []
    for value in values:
        medium = _coerce_enum(value, Medium, field_name="mediums")
        if medium is not None:
            mediums.append(medium)
    return mediums


def feed_source_from_mapped(mapped: dict[str, Any]) -> FeedSource:
    """Build a FeedSource ORM object from mapper output."""
    payload = dict(mapped)
    payload["source_type"] = _coerce_enum(
        payload.get("source_type"), SourceType, field_name="source_type"
    )
    payload["format"] = _coerce_enum(payload.get("format"), FeedFormat, field_name="format")
    payload["curation_status"] = _coerce_enum(
        payload.get("curation_status"), CurationStatus, field_name="curation_status"
    )
    payload["mediums"] = _coerce_mediums(payload.get("mediums"))
    return FeedSource(**payload)


def _is_valid_url(value: str | None) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def sync_sources(
    session: Session,
    enriched_doc: dict[str, Any],
    known_topic_ids: set[str],
) -> tuple[StageResult, list[dict[str, Any]]]:
    """Upsert FeedSource rows from feeds.enriched.yaml via the mapper."""
    result = StageResult(stage=CatalogSyncStage.SOURCES)
    synced_sources: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for raw_source in enriched_doc.get("sources", []):
        if not isinstance(raw_source, dict):
            result.errors.append("source entry must be a mapping")
            continue

        try:
            mapped = map_enriched_source(raw_source)
        except (TypeError, ValueError) as exc:
            result.quarantined += 1
            result.errors.append(f"{QuarantineReason.SCHEMA_MISMATCH.value}: {exc}")
            continue

        source_id = mapped["id"]
        if source_id in seen_ids:
            result.quarantined += 1
            result.errors.append(f"{QuarantineReason.DUPLICATE_ID.value}: {source_id}")
            continue
        seen_ids.add(source_id)

        url = mapped.get("url") or mapped.get("feed")
        if not _is_valid_url(url):
            result.quarantined += 1
            result.errors.append(f"{QuarantineReason.INVALID_URL.value}: {source_id}")
            continue

        orphan_topics = [
            topic_id
            for topic_id in mapped.get("topics", [])
            if isinstance(topic_id, str) and topic_id not in known_topic_ids
        ]
        if orphan_topics:
            result.quarantined += len(orphan_topics)
            result.errors.append(
                f"{QuarantineReason.ORPHAN_TOPICS.value}: {source_id} -> {', '.join(orphan_topics)}"
            )

        feed_source = feed_source_from_mapped(mapped)
        existing = session.get(FeedSource, feed_source.id)
        if existing is None:
            session.add(feed_source)
            result.inserted += 1
        else:
            for field_name in feed_source.model_fields:
                if field_name == "id":
                    continue
                setattr(existing, field_name, getattr(feed_source, field_name))
            session.add(existing)
            result.updated += 1

        synced_sources.append(mapped)

    return result, synced_sources


def purge_stale_sources(session: Session, *, active_ids: set[str]) -> StageResult:
    """Delete feed sources (and catalog junctions) missing from the active catalog."""
    result = StageResult(stage=CatalogSyncStage.SOURCES)
    stale_ids = {
        row.id for row in session.exec(select(FeedSource)).all() if row.id not in active_ids
    }
    if not stale_ids:
        return result

    session.exec(delete(SourceTopic).where(SourceTopic.source_id.in_(stale_ids)))
    session.exec(delete(FeedSource).where(FeedSource.id.in_(stale_ids)))
    result.deleted = len(stale_ids)
    return result


def sync_junctions(
    session: Session,
    synced_sources: list[dict[str, Any]],
    known_topic_ids: set[str],
) -> StageResult:
    """Materialize SourceTopic rows from synced source topic assignments."""
    result = StageResult(stage=CatalogSyncStage.JUNCTIONS)

    for mapped in synced_sources:
        source_id = mapped.get("id")
        if not isinstance(source_id, str):
            continue

        topic_ids = [
            topic_id
            for topic_id in mapped.get("topics", [])
            if isinstance(topic_id, str) and topic_id in known_topic_ids
        ]
        if not topic_ids:
            continue

        inserted = replace_source_topics(
            session,
            source_id=source_id,
            topic_ids=topic_ids,
            origin="catalog",
            weight=1.0,
            confidence=1.0,
        )
        result.inserted += inserted

    return result


def count_source_topics(session: Session) -> int:
    """Return total SourceTopic rows (for aggregate reporting)."""
    return len(list(session.exec(select(SourceTopic)).all()))
