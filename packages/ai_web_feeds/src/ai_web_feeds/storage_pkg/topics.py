"""Taxonomy rows shared by catalog sync and the storage facade."""

from datetime import UTC, datetime

from sqlalchemy import delete, text
from sqlmodel import Session

from ai_web_feeds.models import SourceTopic, TopicNode


def _topics_table_columns(session: Session) -> set[str]:
    from ai_web_feeds import storage

    try:
        inspector = storage.inspect(session.get_bind())
        if not inspector.has_table("topics"):
            return set()
        return {column["name"] for column in inspector.get_columns("topics")}
    except Exception:
        return set()


def _sync_legacy_topic_name(session: Session, topic: TopicNode) -> None:
    """Populate legacy ``topics.name`` when Alembic schemas still require it."""
    from ai_web_feeds import storage

    if "name" not in storage._topics_table_columns(session):
        return
    session.execute(
        text("UPDATE topics SET name = :name WHERE id = :id"),
        {"name": topic.label, "id": topic.id},
    )


def upsert_topic(session: Session, topic: TopicNode) -> tuple[TopicNode, bool]:
    """Insert or update a taxonomy node by primary key."""
    from ai_web_feeds import storage

    columns = storage._topics_table_columns(session)
    existing = session.get(TopicNode, topic.id)
    if existing is None:
        if "name" in columns:
            session.execute(
                text(
                    "INSERT INTO topics (id, name, label, facet, created_at, updated_at) "
                    "VALUES (:id, :name, :label, :facet, :created_at, :updated_at)"
                ),
                {
                    "id": topic.id,
                    "name": topic.label,
                    "label": topic.label,
                    "facet": topic.facet,
                    "created_at": topic.created_at,
                    "updated_at": topic.updated_at,
                },
            )
            persisted = session.get(TopicNode, topic.id)
            if persisted is not None:
                for field_name in (
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
                ):
                    setattr(persisted, field_name, getattr(topic, field_name))
                session.add(persisted)
                return persisted, True
        session.add(topic)
        session.flush()
        _sync_legacy_topic_name(session, topic)
        return topic, True

    for field_name in (
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
    ):
        setattr(existing, field_name, getattr(topic, field_name))
    existing.updated_at = datetime.now(UTC)
    session.add(existing)
    session.flush()
    _sync_legacy_topic_name(session, topic)
    return existing, False


def replace_source_topics(
    session: Session,
    *,
    source_id: str,
    topic_ids: list[str],
    origin: str = "catalog",
    weight: float = 1.0,
    confidence: float = 1.0,
) -> int:
    """Replace catalog-origin topic assignments for a single feed source."""
    session.exec(
        delete(SourceTopic).where(
            SourceTopic.source_id == source_id,
            SourceTopic.origin == origin,
        )
    )
    inserted = 0
    for topic_id in topic_ids:
        session.add(
            SourceTopic(
                source_id=source_id,
                topic_id=topic_id,
                origin=origin,
                weight=weight,
                confidence=confidence,
            )
        )
        inserted += 1
    return inserted
