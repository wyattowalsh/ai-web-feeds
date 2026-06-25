"""Typed contracts for staged catalog synchronization."""

from enum import StrEnum

from pydantic import BaseModel, Field


class QuarantineReason(StrEnum):
    """Why a catalog row was quarantined instead of synced."""

    ORPHAN_TOPICS = "orphan_topics"
    INVALID_URL = "invalid_url"
    DUPLICATE_ID = "duplicate_id"
    SCHEMA_MISMATCH = "schema_mismatch"
    ENRICHMENT_MISSING = "enrichment_missing"


class CatalogSyncStage(StrEnum):
    """Ordered sync stages executed by catalog_sync."""

    TOPICS = "topics"
    EDGES = "edges"
    SOURCES = "sources"
    JUNCTIONS = "junctions"
    ENRICHMENT = "enrichment"


class StageResult(BaseModel):
    """Per-stage counters and errors for observability and ledger writes."""

    stage: CatalogSyncStage
    inserted: int = 0
    updated: int = 0
    deleted: int = 0
    quarantined: int = 0
    errors: list[str] = Field(default_factory=list)


class CatalogSyncResult(BaseModel):
    """Aggregate result returned by sync_catalog_to_db."""

    catalog_hash: str | None = None
    stages: list[StageResult] = Field(default_factory=list)
    topics_count: int = 0
    sources_count: int = 0
    junction_count: int = 0
    quarantine_count: int = 0
    pipeline_run_id: str | None = None
    duration_ms: int | None = None

    @property
    def succeeded(self) -> bool:
        return all(not stage.errors for stage in self.stages)
