"""ai_web_feeds.models -- AIWebFeeds data models with SQLModel support"""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import ConfigDict, Field
from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field as SQLField
from sqlmodel import Relationship, SQLModel


# Helper function for UTC-aware datetime defaults
def _utc_now() -> datetime:
    """Return current UTC time with timezone awareness."""
    return datetime.now(UTC)


# ============================================================================
# Enums
# ============================================================================


class SourceType(StrEnum):
    """Feed source types."""

    BLOG = "blog"
    NEWSLETTER = "newsletter"
    PODCAST = "podcast"
    JOURNAL = "journal"
    PREPRINT = "preprint"
    ORGANIZATION = "organization"
    AGGREGATOR = "aggregator"
    VIDEO = "video"
    DOCS = "docs"
    FORUM = "forum"
    DATASET = "dataset"
    CODE_REPO = "code-repo"
    NEWSROOM = "newsroom"
    EDUCATION = "education"
    REDDIT = "reddit"
    MEDIUM = "medium"
    YOUTUBE = "youtube"
    GITHUB = "github"
    SUBSTACK = "substack"
    DEVTO = "devto"
    HACKERNEWS = "hackernews"
    TWITTER = "twitter"
    ARXIV = "arxiv"


class FeedFormat(StrEnum):
    """Feed format types."""

    RSS = "rss"
    ATOM = "atom"
    JSONFEED = "jsonfeed"
    UNKNOWN = "unknown"


class CurationStatus(StrEnum):
    """Curation status values."""

    VERIFIED = "verified"
    UNVERIFIED = "unverified"
    ARCHIVED = "archived"
    EXPERIMENTAL = "experimental"
    INACTIVE = "inactive"


class Medium(StrEnum):
    """Content medium types."""

    TEXT = "text"
    AUDIO = "audio"
    VIDEO = "video"
    CODE = "code"
    DATA = "data"


# ============================================================================
# SQLModel Tables
# ============================================================================


class FeedSource(SQLModel, table=True):
    """Feed source with full metadata - main table.

    Represents a single feed source (blog, newsletter, podcast, etc.) with comprehensive
    metadata including classification, curation status, quality metrics, and relationships.
    """

    __tablename__ = "sources"

    # Primary key
    id: str = SQLField(primary_key=True, description="Stable unique feed identifier")

    # Core feed info
    url: str | None = SQLField(default=None, description="Canonical source URL")
    feed: str | None = SQLField(default=None, description="Direct feed URL, alias, or CURIE")
    site: str | None = SQLField(default=None, description="Site homepage/section URL")
    title: str = SQLField(description="Feed/source title")

    # Classification
    source_type: SourceType | None = SQLField(default=None)
    mediums: list[Medium] = SQLField(
        default_factory=list, sa_column=Column(JSON), description="Content modalities"
    )
    tags: list[str] = SQLField(
        default_factory=list, sa_column=Column(JSON), description="Freeform tags"
    )

    # Topics and weights
    topics: list[str] = SQLField(
        default_factory=list, sa_column=Column(JSON), description="TopicNode IDs"
    )
    topic_weights: dict[str, float] = SQLField(
        default_factory=dict,
        sa_column=Column(JSON),
        description="TopicNode relevance weights",
    )

    # Metadata
    language: str | None = SQLField(default="en")
    format: FeedFormat | None = SQLField(default=FeedFormat.UNKNOWN)
    updated: datetime | None = SQLField(default=None, description="Last human/automation review")
    last_validated: datetime | None = SQLField(
        default=None, description="Last successful validation"
    )
    verified: bool = SQLField(default=False)
    contributor: str | None = SQLField(default=None)

    # NEW Phase 1: Search & Recommendation fields
    popularity_score: float = SQLField(
        default=0.0,
        ge=0.0,
        le=1.0,
        index=True,
        description="Computed popularity score for recommendations",
    )
    validation_count: int = SQLField(
        default=0, description="Number of successful validations for trending analysis"
    )

    # Curation
    curation_status: CurationStatus | None = SQLField(default=CurationStatus.UNVERIFIED)
    curation_since: datetime | None = SQLField(default=None)
    curation_by: str | None = SQLField(default=None)
    quality_score: float | None = SQLField(default=None, ge=0.0, le=1.0)
    curation_notes: str | None = SQLField(default=None)

    # Provenance
    provenance_source: str | None = SQLField(default=None)
    provenance_from: str | None = SQLField(default=None)
    provenance_license: str | None = SQLField(default=None)

    # Discovery config
    discover_enabled: bool = SQLField(default=False)
    discover_config: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Relations (stored as JSON)
    relations: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    mappings: dict[str, str] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Additional notes
    notes: str | None = SQLField(default=None)

    # Relationships
    fetch_logs: list["FeedFetchLog"] = Relationship(back_populates="feed_source")


class FeedFetchLog(SQLModel, table=True):
    """Log of feed fetch attempts and responses.

    Tracks every fetch operation including success/failure status, response metrics,
    performance data, and error information for monitoring and debugging.
    """

    __tablename__ = "fetch_logs"

    # Primary key
    id: UUID = SQLField(default_factory=uuid4, primary_key=True)

    # Foreign key
    feed_source_id: str = SQLField(foreign_key="sources.id", index=True)

    # Fetch info
    fetched_at: datetime = SQLField(default_factory=_utc_now)
    fetch_url: str = SQLField(description="Actual URL fetched")
    success: bool = SQLField(default=False)

    # Response info
    status_code: int | None = SQLField(default=None)
    content_type: str | None = SQLField(default=None)
    content_length: int | None = SQLField(default=None)
    etag: str | None = SQLField(default=None)
    last_modified: str | None = SQLField(default=None)

    # Error info
    error_message: str | None = SQLField(default=None)
    error_type: str | None = SQLField(default=None)

    # Stats
    items_found: int | None = SQLField(default=None)
    items_new: int | None = SQLField(default=None)
    items_updated: int | None = SQLField(default=None)
    fetch_duration_ms: int | None = SQLField(default=None)

    # Response data (stored as JSON for analysis)
    response_headers: dict[str, str] = SQLField(default_factory=dict, sa_column=Column(JSON))
    extra_data: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Relationships
    feed_source: FeedSource = Relationship(back_populates="fetch_logs")


class TopicNode(SQLModel, table=True):
    """Canonical topic taxonomy node matching data/topics.yaml."""

    __tablename__ = "topics"

    # Primary key
    id: str = SQLField(primary_key=True, description="Topic ID (slug)")

    # Topic info
    label: str = SQLField(description="Display label")
    facet: str = SQLField(description="Primary classification axis")
    facet_group: str | None = SQLField(default=None, description="Optional UI/meta grouping")
    description: str | None = SQLField(default=None)

    # Metadata
    aliases: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    parents: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    relations: dict[str, list[str]] = SQLField(default_factory=dict, sa_column=Column(JSON))
    examples: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    uri: str | None = SQLField(default=None)
    mappings: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    i18n: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    rank_hint: float | None = SQLField(default=None, ge=0.0, le=1.0)
    tags: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    notes: str | None = SQLField(default=None)

    # Timestamps
    created_at: datetime = SQLField(default_factory=_utc_now)
    updated_at: datetime = SQLField(default_factory=_utc_now)


class SourceTopic(SQLModel, table=True):
    """Normalized source-to-topic assignment with weighting and provenance."""

    __tablename__ = "source_topics"

    source_id: str = SQLField(foreign_key="sources.id", primary_key=True)
    topic_id: str = SQLField(foreign_key="topics.id", primary_key=True)
    origin: str = SQLField(default="catalog", primary_key=True, max_length=50)
    weight: float | None = SQLField(default=None, ge=0.0, le=1.0)
    confidence: float | None = SQLField(default=None, ge=0.0, le=1.0)
    created_at: datetime = SQLField(default_factory=_utc_now)


class TopicEdge(SQLModel, table=True):
    """Normalized topic graph edge derived from parent and relation metadata."""

    __tablename__ = "topic_edges"

    topic_id: str = SQLField(foreign_key="topics.id", primary_key=True)
    related_topic_id: str = SQLField(foreign_key="topics.id", primary_key=True)
    relation_type: str = SQLField(default="related", primary_key=True, max_length=50)
    weight: float | None = SQLField(default=None, ge=0.0, le=1.0)
    created_at: datetime = SQLField(default_factory=_utc_now)


class FeedEnrichmentData(SQLModel, table=True):
    """Comprehensive enrichment data for feed sources.

    Stores AI-generated and automatically discovered metadata including quality scores,
    platform detection, content analysis, SEO data, and security assessments.
    """

    __tablename__ = "enrichment"

    # Primary key
    id: UUID = SQLField(default_factory=uuid4, primary_key=True)

    # Foreign key
    feed_source_id: str = SQLField(foreign_key="sources.id", index=True, unique=True)

    # Enrichment metadata
    enriched_at: datetime = SQLField(default_factory=_utc_now)
    enrichment_version: str = SQLField(default="1.0.0")
    enricher: str | None = SQLField(default=None, description="Enrichment method/service")

    # Basic metadata
    discovered_title: str | None = SQLField(default=None)
    discovered_description: str | None = SQLField(default=None)
    discovered_language: str | None = SQLField(default=None)
    discovered_author: str | None = SQLField(default=None)

    # Format and platform detection
    detected_format: FeedFormat | None = SQLField(default=None)
    detected_platform: str | None = SQLField(default=None)
    platform_metadata: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Visual assets
    icon_url: str | None = SQLField(default=None)
    logo_url: str | None = SQLField(default=None)
    image_url: str | None = SQLField(default=None)
    favicon_url: str | None = SQLField(default=None)
    banner_url: str | None = SQLField(default=None)

    # Quality and health scores
    health_score: float | None = SQLField(default=None, ge=0.0, le=1.0)
    quality_score: float | None = SQLField(default=None, ge=0.0, le=1.0)
    completeness_score: float | None = SQLField(default=None, ge=0.0, le=1.0)
    reliability_score: float | None = SQLField(default=None, ge=0.0, le=1.0)
    freshness_score: float | None = SQLField(default=None, ge=0.0, le=1.0)

    # Content analysis
    entry_count: int | None = SQLField(default=None)
    has_full_content: bool = SQLField(default=False)
    avg_content_length: float | None = SQLField(default=None)
    content_types: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    content_samples: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Update patterns
    estimated_frequency: str | None = SQLField(default=None)
    last_updated: datetime | None = SQLField(default=None)
    update_regularity: float | None = SQLField(default=None, ge=0.0, le=1.0)
    update_intervals: list[int] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Performance metrics
    response_time_ms: float | None = SQLField(default=None)
    availability_score: float | None = SQLField(default=None, ge=0.0, le=1.0)
    uptime_percentage: float | None = SQLField(default=None, ge=0.0, le=100.0)

    # TopicNode suggestions
    suggested_topics: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    topic_confidence: dict[str, float] = SQLField(default_factory=dict, sa_column=Column(JSON))
    auto_keywords: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Feed extensions
    has_itunes: bool = SQLField(default=False)
    has_media_rss: bool = SQLField(default=False)
    has_dublin_core: bool = SQLField(default=False)
    has_geo: bool = SQLField(default=False)
    extension_data: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # SEO and social
    seo_title: str | None = SQLField(default=None)
    seo_description: str | None = SQLField(default=None)
    og_image: str | None = SQLField(default=None)
    twitter_card: str | None = SQLField(default=None)
    social_metadata: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Technical details
    encoding: str | None = SQLField(default=None)
    generator: str | None = SQLField(default=None)
    ttl: int | None = SQLField(default=None, description="Time-to-live in minutes")
    cloud: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Link analysis
    internal_links: int | None = SQLField(default=None)
    external_links: int | None = SQLField(default=None)
    broken_links: int | None = SQLField(default=None)
    redirect_chains: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Security
    uses_https: bool = SQLField(default=False)
    has_valid_ssl: bool = SQLField(default=False)
    security_headers: dict[str, str] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Additional structured data
    structured_data: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    raw_metadata: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    extra_data: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = SQLField(default_factory=_utc_now)
    updated_at: datetime = SQLField(default_factory=_utc_now)


class FeedValidationResult(SQLModel, table=True):
    """Feed validation results and checks.

    Comprehensive validation results including schema compliance, accessibility checks,
    content validation, link verification, security assessment, and recommendations.
    """

    __tablename__ = "validations"

    # Primary key
    id: UUID = SQLField(default_factory=uuid4, primary_key=True)

    # Foreign key
    feed_source_id: str = SQLField(foreign_key="sources.id", index=True)

    # Validation metadata
    validated_at: datetime = SQLField(default_factory=_utc_now)
    validator_version: str = SQLField(default="1.0.0")

    # Overall status
    is_valid: bool = SQLField(default=False)
    validation_level: str | None = SQLField(default=None)  # strict, moderate, lenient

    # Schema validation
    schema_valid: bool = SQLField(default=False)
    schema_version: str | None = SQLField(default=None)
    schema_errors: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Feed accessibility
    is_accessible: bool = SQLField(default=False)
    http_status: int | None = SQLField(default=None)
    redirect_count: int | None = SQLField(default=None)
    final_url: str | None = SQLField(default=None)

    # Content validation
    has_items: bool = SQLField(default=False)
    item_count: int | None = SQLField(default=None)
    has_required_fields: bool = SQLField(default=False)
    missing_fields: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Format validation
    format_valid: bool = SQLField(default=False)
    format_errors: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    xml_well_formed: bool = SQLField(default=False)

    # Link validation
    links_checked: int | None = SQLField(default=None)
    links_valid: int | None = SQLField(default=None)
    links_broken: int | None = SQLField(default=None)
    broken_link_urls: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Image validation
    images_checked: int | None = SQLField(default=None)
    images_accessible: int | None = SQLField(default=None)
    image_errors: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Performance checks
    response_time_ms: float | None = SQLField(default=None)
    size_bytes: int | None = SQLField(default=None)
    compression_ratio: float | None = SQLField(default=None)

    # Security checks
    https_enabled: bool = SQLField(default=False)
    ssl_valid: bool = SQLField(default=False)
    security_issues: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Warnings and recommendations
    warnings: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    recommendations: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Full validation report
    validation_report: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = SQLField(default_factory=_utc_now)


class FeedAnalytics(SQLModel, table=True):
    """Analytics and metrics for feed sources.

    Time-series analytics tracking volume, frequency, content quality, reliability,
    performance, engagement proxies, and topic distributions over defined periods.
    """

    __tablename__ = "analytics"

    # Primary key
    id: UUID = SQLField(default_factory=uuid4, primary_key=True)

    # Foreign key
    feed_source_id: str = SQLField(foreign_key="sources.id", index=True)

    # Time period
    period_start: datetime = SQLField(description="Start of analytics period")
    period_end: datetime = SQLField(description="End of analytics period")
    period_type: str = SQLField(default="daily")  # daily, weekly, monthly, yearly

    # Volume metrics
    total_items: int = SQLField(default=0)
    new_items: int = SQLField(default=0)
    updated_items: int = SQLField(default=0)
    deleted_items: int = SQLField(default=0)

    # Update frequency
    update_count: int = SQLField(default=0)
    avg_update_interval_hours: float | None = SQLField(default=None)
    min_update_interval_hours: float | None = SQLField(default=None)
    max_update_interval_hours: float | None = SQLField(default=None)

    # Content metrics
    avg_content_length: float | None = SQLField(default=None)
    avg_title_length: float | None = SQLField(default=None)
    has_images_count: int = SQLField(default=0)
    has_video_count: int = SQLField(default=0)
    has_audio_count: int = SQLField(default=0)

    # Engagement proxies
    avg_links_per_item: float | None = SQLField(default=None)
    avg_raw_terms_per_item: float | None = SQLField(default=None)
    unique_authors: int = SQLField(default=0)

    # Quality metrics
    items_with_full_content: int = SQLField(default=0)
    items_with_summary_only: int = SQLField(default=0)
    items_with_media: int = SQLField(default=0)

    # Reliability
    fetch_attempts: int = SQLField(default=0)
    fetch_successes: int = SQLField(default=0)
    fetch_failures: int = SQLField(default=0)
    uptime_percentage: float | None = SQLField(default=None, ge=0.0, le=100.0)

    # Performance
    avg_response_time_ms: float | None = SQLField(default=None)
    min_response_time_ms: float | None = SQLField(default=None)
    max_response_time_ms: float | None = SQLField(default=None)

    # TopicNode distribution
    topic_distribution: dict[str, int] = SQLField(default_factory=dict, sa_column=Column(JSON))
    keyword_frequency: dict[str, int] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Additional metrics
    extra_metrics: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = SQLField(default_factory=_utc_now)
    updated_at: datetime = SQLField(default_factory=_utc_now)


# ============================================================================
# Pydantic Models for API/Validation (not stored in DB)
# ============================================================================


class FeedSourceEnriched(SQLModel):
    """Enriched feed source for YAML export (matches feeds.enriched.yaml structure)."""

    model_config = ConfigDict(use_enum_values=True)

    # Core fields
    id: str
    url: str | None = None
    feed: str | None = None
    site: str | None = None
    title: str
    source_type: SourceType | None = None
    mediums: list[Medium] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    topic_weights: dict[str, float] = Field(default_factory=dict)

    # Meta block
    meta: dict[str, Any] = Field(default_factory=dict)

    # Curation block
    curation: dict[str, Any] = Field(default_factory=dict)

    # Provenance block
    provenance: dict[str, Any] = Field(default_factory=dict)

    # Relations
    relations: dict[str, Any] = Field(default_factory=dict)
    mappings: dict[str, str] = Field(default_factory=dict)

    # Discover
    discover: bool | dict[str, Any] | None = None

    # Notes
    notes: str | None = None


class OPMLOutline(SQLModel):
    """OPML outline element."""

    model_config = ConfigDict(populate_by_name=True)

    text: str
    title: str | None = None
    type: str | None = None
    xml_url: str | None = Field(default=None, alias="xmlUrl")
    html_url: str | None = Field(default=None, alias="htmlUrl")
    description: str | None = None
    category: str | None = None
    outlines: list["OPMLOutline"] = Field(default_factory=list)


class OPMLDocument(SQLModel):
    """OPML document structure."""

    title: str
    date_created: datetime = Field(default_factory=_utc_now)
    date_modified: datetime = Field(default_factory=_utc_now)
    owner_name: str = "AI Web Feeds"
    owner_email: str | None = None
    outlines: list[OPMLOutline] = Field(default_factory=list)


# ============================================================================
# Phase 1: Data Discovery & Analytics Models
# ============================================================================


class FeedEmbedding(SQLModel, table=True):
    """Vector embeddings for semantic similarity search.

    Stores 384-dim embeddings from all-MiniLM-L6-v2 model for semantic search
    and content-based recommendations.
    """

    __tablename__ = "feed_embeddings"

    feed_id: str = SQLField(
        foreign_key="sources.id", primary_key=True, description="Feed source ID"
    )
    embedding: bytes = SQLField(
        description="384-dim float32 array serialized as bytes (1536 bytes)"
    )
    embedding_model: str = SQLField(
        default="sentence-transformers/all-MiniLM-L6-v2", description="Embedding model version"
    )
    embedding_provider: str = SQLField(
        default="local", description="Embedding provider: 'local' or 'huggingface'"
    )
    created_at: datetime = SQLField(default_factory=_utc_now)
    updated_at: datetime = SQLField(default_factory=_utc_now)


class AnalyticsSnapshot(SQLModel, table=True):
    """Aggregated analytics metrics stored daily for historical trending.

    JSON snapshots of key metrics for efficient dashboard rendering without
    real-time aggregation queries.
    """

    __tablename__ = "analytics_snapshots"

    snapshot_date: str = SQLField(primary_key=True, description="ISO date YYYY-MM-DD")
    total_feeds: int = SQLField(description="Total feed count")
    active_feeds: int = SQLField(description="Active feed count")
    validation_success_rate: float = SQLField(ge=0.0, le=1.0, description="Validation success rate")
    avg_response_time: float = SQLField(description="Average validation response time (ms)")
    trending_topics: list[dict[str, Any]] = SQLField(
        sa_column=Column(JSON), description="Top topics by validation frequency"
    )
    health_distribution: dict[str, int] = SQLField(
        sa_column=Column(JSON), description="Feed counts by health category"
    )
    created_at: datetime = SQLField(default_factory=_utc_now)


class TopicStats(SQLModel, table=True):
    """TopicNode-level analytics for trending and Most Active Topics.

    Tracks validation frequency and health scores per topic for analytics dashboard.
    """

    __tablename__ = "topic_stats"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    topic: str = SQLField(index=True, description="TopicNode ID from topics.yaml")
    feed_count: int = SQLField(description="Number of feeds with this topic")
    validation_frequency: float = SQLField(
        description="Validation frequency (last 30 days), weighted by health"
    )
    avg_health_score: float = SQLField(ge=0.0, le=1.0, description="Average health score")
    snapshot_date: str = SQLField(index=True, description="ISO date YYYY-MM-DD")
    created_at: datetime = SQLField(default_factory=_utc_now)


class SearchQuery(SQLModel, table=True):
    """User search interactions for analytics and personalization.

    Logs search queries, filters, and clicked results for search analytics
    and improvement.
    """

    __tablename__ = "search_queries"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    user_id: str | None = SQLField(
        default=None, index=True, description="User ID (optional, localStorage key)"
    )
    query_text: str = SQLField(description="Search query text")
    search_type: str = SQLField(description="Search type: 'full_text' or 'semantic'")
    filters_applied: dict[str, Any] = SQLField(
        default_factory=dict,
        sa_column=Column(JSON),
        description="Applied filters (source_type, topics, verified, active)",
    )
    result_count: int = SQLField(description="Number of results returned")
    clicked_results: list[str] = SQLField(
        default_factory=list, sa_column=Column(JSON), description="Feed IDs clicked by user"
    )
    timestamp: datetime = SQLField(default_factory=_utc_now, index=True)


class SavedSearch(SQLModel, table=True):
    """User-saved search queries for one-click replay.

    Stores search query + filters for quick access from sidebar.
    """

    __tablename__ = "saved_searches"
    __table_args__ = (UniqueConstraint("user_id", "search_name", name="uq_saved_search_user_name"),)

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    user_id: str = SQLField(index=True, description="User ID (localStorage key)")
    search_name: str = SQLField(description="User-provided name for saved search")
    query_text: str = SQLField(description="Search query text")
    filters: dict[str, Any] = SQLField(
        default_factory=dict, sa_column=Column(JSON), description="Saved filters"
    )
    created_at: datetime = SQLField(default_factory=_utc_now)
    last_used_at: datetime = SQLField(default_factory=_utc_now)


class RecommendationInteraction(SQLModel, table=True):
    """User feedback on recommendations for model training and evaluation.

    Tracks impressions, clicks, likes, and dismisses for recommendation
    performance metrics.
    """

    __tablename__ = "recommendation_interactions"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    user_id: str = SQLField(index=True, description="User ID (localStorage key)")
    feed_id: str = SQLField(foreign_key="sources.id", index=True)
    interaction_type: str = SQLField(
        description="Interaction: 'impression', 'click', 'like', 'dismiss', 'block_topic'"
    )
    context: dict[str, Any] = SQLField(
        default_factory=dict,
        sa_column=Column(JSON),
        description="Additional context (explanation, position, etc.)",
    )
    timestamp: datetime = SQLField(default_factory=_utc_now, index=True)


class UserProfile(SQLModel, table=True):
    """User interests and preferences for personalization.

    Stores normalized account preferences used by recommendations and sync.
    """

    __tablename__ = "user_profiles"

    user_id: str = SQLField(primary_key=True, description="User ID (localStorage key)")
    preferred_topics: list[str] = SQLField(
        default_factory=list, sa_column=Column(JSON), description="TopicNode IDs user prefers"
    )
    blocked_topics: list[str] = SQLField(
        default_factory=list, sa_column=Column(JSON), description="TopicNode IDs user blocked"
    )
    interaction_history: dict[str, Any] = SQLField(
        default_factory=dict,
        sa_column=Column(JSON),
        description="Interaction history for recommendations",
    )
    created_at: datetime = SQLField(default_factory=_utc_now)
    updated_at: datetime = SQLField(default_factory=_utc_now)


class CollaborativeMatrix(SQLModel, table=True):
    """Precomputed feed co-occurrence matrix for collaborative filtering.

    Populated by recommendation jobs when user interaction volume is sufficient.
    """

    __tablename__ = "collaborative_matrix"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    feed_id_1: str = SQLField(foreign_key="sources.id", index=True)
    feed_id_2: str = SQLField(foreign_key="sources.id", index=True)
    co_occurrence_score: float = SQLField(
        ge=0.0, le=1.0, description="Co-occurrence score based on user interactions"
    )
    support: int = SQLField(description="Number of users who interacted with both feeds")
    last_updated: datetime = SQLField(default_factory=_utc_now)


# ============================================================================
# Phase 3B: Real-Time Monitoring Models
# ============================================================================


class PollStatus(StrEnum):
    """Feed poll job status values."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILURE = "failure"


class NotificationType(StrEnum):
    """Notification type values."""

    NEW_ARTICLE = "new_article"
    TRENDING_TOPIC = "trending_topic"
    FEED_UPDATED = "feed_updated"
    SYSTEM_ALERT = "system_alert"


class DeliveryMethod(StrEnum):
    """Notification delivery method."""

    WEBSOCKET = "websocket"
    EMAIL = "email"
    IN_APP = "in_app"


class NotificationFrequency(StrEnum):
    """Notification frequency preferences."""

    INSTANT = "instant"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    OFF = "off"


class ScheduleType(StrEnum):
    """Email digest schedule type."""

    DAILY = "daily"
    WEEKLY = "weekly"
    CUSTOM = "custom"


class ArticleEntry(SQLModel, table=True):
    """Individual feed articles/entries from polling.

    Stores article metadata discovered during feed polling for notification
    targeting and historical tracking.
    """

    __tablename__ = "articles"
    __table_args__ = (
        UniqueConstraint("feed_id", "guid_hash", name="uq_articles_feed_guid_hash"),
        UniqueConstraint("feed_id", "link_hash", name="uq_articles_feed_link_hash"),
    )

    id: int | None = SQLField(default=None, primary_key=True)
    feed_id: str = SQLField(foreign_key="sources.id", index=True)
    guid: str = SQLField(index=True, description="Raw feed GUID")
    guid_hash: str | None = SQLField(default=None, index=True, description="Normalized GUID hash")
    link_hash: str | None = SQLField(default=None, index=True, description="Normalized link hash")
    link: str = SQLField(max_length=2048, description="Article URL")
    canonical_url: str | None = SQLField(
        default=None, max_length=2048, description="Canonicalized article URL"
    )
    title: str = SQLField(max_length=512)
    summary: str | None = SQLField(default=None)
    content_html: str | None = SQLField(default=None)
    pub_date: datetime = SQLField(index=True, description="Article publication date")
    author: str | None = SQLField(default=None, max_length=255)
    topics: list[str] = SQLField(
        default_factory=list, sa_column=Column(JSON), description="Canonical article topic IDs"
    )
    raw_categories: list[str] = SQLField(
        default_factory=list,
        sa_column=Column(JSON),
        description="Raw feed category/tag labels preserved from ingress",
    )
    discovered_at: datetime = SQLField(default_factory=_utc_now)
    first_seen_at: datetime = SQLField(default_factory=_utc_now)
    last_seen_at: datetime = SQLField(default_factory=_utc_now)
    created_at: datetime = SQLField(default_factory=_utc_now)

    # Phase 5: NLP processing flags
    quality_processed: bool = SQLField(default=False, description="Quality scoring completed")
    entities_processed: bool = SQLField(default=False, description="Entity extraction completed")
    sentiment_processed: bool = SQLField(default=False, description="Sentiment analysis completed")
    topics_processed: bool = SQLField(default=False, description="TopicNode modeling completed")
    quality_processed_at: datetime | None = None
    entities_processed_at: datetime | None = None
    sentiment_processed_at: datetime | None = None
    nlp_failures: dict[str, int] = SQLField(
        default_factory=dict,
        sa_column=Column(JSON),
        description="NLP failure counts by processor",
    )
    last_failure_reason: str | None = None


class ArticleTopic(SQLModel, table=True):
    """Normalized article-to-topic assignment with provenance."""

    __tablename__ = "article_topics"

    article_id: int = SQLField(foreign_key="articles.id", primary_key=True)
    topic_id: str = SQLField(foreign_key="topics.id", primary_key=True)
    origin: str = SQLField(default="source", primary_key=True, max_length=50)
    confidence: float | None = SQLField(default=None, ge=0.0, le=1.0)
    created_at: datetime = SQLField(default_factory=_utc_now)


class ArticleRawTerm(SQLModel, table=True):
    """Raw ingress taxonomy terms extracted from feeds before canonical mapping."""

    __tablename__ = "article_raw_terms"

    article_id: int = SQLField(foreign_key="articles.id", primary_key=True)
    term: str = SQLField(primary_key=True, max_length=255)
    scheme: str | None = SQLField(default=None, max_length=255)
    source: str = SQLField(default="feed", primary_key=True, max_length=50)
    created_at: datetime = SQLField(default_factory=_utc_now)


class FeedPollJob(SQLModel, table=True):
    """Feed polling job tracking for monitoring and debugging.

    Logs each polling attempt with status, timing, and error information
    for feed health monitoring.
    """

    __tablename__ = "feed_poll_jobs"

    id: int | None = SQLField(default=None, primary_key=True)
    feed_id: str = SQLField(foreign_key="sources.id", index=True)
    scheduled_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    status: PollStatus = SQLField(index=True)
    error_message: str | None = SQLField(default=None, sa_column=Column(JSON))
    articles_discovered: int = SQLField(default=0, ge=0)
    response_time_ms: int | None = SQLField(default=None, ge=0)
    created_at: datetime = SQLField(default_factory=_utc_now)


class PipelineRun(SQLModel, table=True):
    """Durable pipeline run ledger for catalog, enrichment, polling, and exports."""

    __tablename__ = "pipeline_runs"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    run_type: str = SQLField(index=True, max_length=80)
    status: str = SQLField(default="running", index=True, max_length=50)
    started_at: datetime = SQLField(default_factory=_utc_now, index=True)
    completed_at: datetime | None = SQLField(default=None)
    catalog_hash: str | None = SQLField(default=None, index=True, max_length=128)
    input_hashes: dict[str, str] = SQLField(default_factory=dict, sa_column=Column(JSON))
    summary: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    error_message: str | None = SQLField(default=None)


class PipelineStageRun(SQLModel, table=True):
    """Per-stage pipeline execution details for replay and failure analysis."""

    __tablename__ = "pipeline_stage_runs"
    __table_args__ = (UniqueConstraint("run_id", "stage_name", name="uq_pipeline_stage_run"),)

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    run_id: UUID = SQLField(foreign_key="pipeline_runs.id", index=True)
    stage_name: str = SQLField(index=True, max_length=120)
    status: str = SQLField(default="running", index=True, max_length=50)
    started_at: datetime = SQLField(default_factory=_utc_now)
    completed_at: datetime | None = SQLField(default=None)
    records_in: int = SQLField(default=0, ge=0)
    records_out: int = SQLField(default=0, ge=0)
    records_quarantined: int = SQLField(default=0, ge=0)
    metrics: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    error_message: str | None = SQLField(default=None)


class AssetManifest(SQLModel, table=True):
    """Generated asset manifest with reproducibility metadata."""

    __tablename__ = "asset_manifests"
    __table_args__ = (
        UniqueConstraint("asset_path", "content_hash", name="uq_asset_manifest_hash"),
    )

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    run_id: UUID | None = SQLField(default=None, foreign_key="pipeline_runs.id", index=True)
    asset_path: str = SQLField(index=True, max_length=512)
    schema_version: str = SQLField(index=True, max_length=80)
    content_hash: str = SQLField(index=True, max_length=128)
    source_hashes: dict[str, str] = SQLField(default_factory=dict, sa_column=Column(JSON))
    row_count: int | None = SQLField(default=None, ge=0)
    generated_at: datetime = SQLField(default_factory=_utc_now, index=True)
    freshness_watermark: datetime | None = SQLField(default=None)
    partial_coverage: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))


class QuarantineRecord(SQLModel, table=True):
    """Invalid or unsafe pipeline records retained for review without publication."""

    __tablename__ = "quarantine_records"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    run_id: UUID | None = SQLField(default=None, foreign_key="pipeline_runs.id", index=True)
    stage_name: str = SQLField(index=True, max_length=120)
    record_type: str = SQLField(index=True, max_length=80)
    record_id: str | None = SQLField(default=None, index=True, max_length=255)
    reason_code: str = SQLField(index=True, max_length=120)
    reason_detail: str | None = SQLField(default=None)
    payload: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = SQLField(default_factory=_utc_now, index=True)
    resolved_at: datetime | None = SQLField(default=None)


class DataQualityResult(SQLModel, table=True):
    """Data quality check result associated with a run, stage, or asset."""

    __tablename__ = "data_quality_results"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    run_id: UUID | None = SQLField(default=None, foreign_key="pipeline_runs.id", index=True)
    asset_path: str | None = SQLField(default=None, index=True, max_length=512)
    check_name: str = SQLField(index=True, max_length=160)
    status: str = SQLField(index=True, max_length=50)
    severity: str = SQLField(default="error", max_length=50)
    observed_value: str | None = SQLField(default=None)
    expected_value: str | None = SQLField(default=None)
    details: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = SQLField(default_factory=_utc_now, index=True)


class Notification(SQLModel, table=True):
    """User notifications for real-time and in-app delivery.

    Stores notification messages with metadata for WebSocket broadcasting
    and notification center display.
    """

    __tablename__ = "notifications"

    id: int | None = SQLField(default=None, primary_key=True)
    user_id: str = SQLField(index=True, description="User ID (localStorage UUID)")
    type: NotificationType = SQLField(index=True)
    title: str = SQLField(max_length=255)
    message: str = SQLField(max_length=1000)
    action_url: str | None = SQLField(default=None, max_length=2048)
    context_data: dict[str, Any] = SQLField(
        default_factory=dict,
        sa_column=Column(JSON),
        description="Additional context (feed_id, article_id, trend_score)",
    )
    read_at: datetime | None = None
    dismissed_at: datetime | None = None
    created_at: datetime = SQLField(default_factory=_utc_now, index=True)


class UserSourceFollow(SQLModel, table=True):
    """Normalized user source follow relationships for account features.

    Stores which sources a user follows to determine notification recipients,
    digest inputs, and recommendation seeds.
    """

    __tablename__ = "user_source_follows"
    __table_args__ = (UniqueConstraint("user_id", "source_id", name="uq_user_source_follow"),)

    id: int | None = SQLField(default=None, primary_key=True)
    user_id: str = SQLField(index=True, description="User ID (localStorage UUID)")
    source_id: str = SQLField(foreign_key="sources.id", index=True)
    followed_at: datetime = SQLField(default_factory=_utc_now)


class UserArticleState(SQLModel, table=True):
    """Per-user reader state for local-first sync."""

    __tablename__ = "user_article_states"
    __table_args__ = (UniqueConstraint("user_id", "article_id", name="uq_user_article_state"),)

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    user_id: str = SQLField(index=True)
    article_id: int = SQLField(foreign_key="articles.id", index=True)
    read_at: datetime | None = SQLField(default=None)
    saved_at: datetime | None = SQLField(default=None)
    starred_at: datetime | None = SQLField(default=None)
    archived_at: datetime | None = SQLField(default=None)
    annotation_ids: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    updated_at: datetime = SQLField(default_factory=_utc_now, index=True)


class UserTopicPreference(SQLModel, table=True):
    """Normalized user topic preference used by recommendations and alerts."""

    __tablename__ = "user_topic_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", "preference", name="uq_user_topic_preference"),
    )

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    user_id: str = SQLField(index=True)
    topic_id: str = SQLField(foreign_key="topics.id", index=True)
    preference: str = SQLField(max_length=40, description="follow, boost, mute, or block")
    weight: float = SQLField(default=1.0)
    source: str = SQLField(default="user", max_length=50)
    created_at: datetime = SQLField(default_factory=_utc_now)
    updated_at: datetime = SQLField(default_factory=_utc_now)


class SyncEvent(SQLModel, table=True):
    """Client/server sync event for local-first account features."""

    __tablename__ = "sync_events"

    id: UUID = SQLField(default_factory=uuid4, primary_key=True)
    user_id: str = SQLField(index=True)
    event_type: str = SQLField(index=True, max_length=80)
    entity_type: str = SQLField(index=True, max_length=80)
    entity_id: str = SQLField(index=True, max_length=255)
    payload: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    client_updated_at: datetime | None = SQLField(default=None)
    server_received_at: datetime = SQLField(default_factory=_utc_now, index=True)
    applied_at: datetime | None = SQLField(default=None)
    conflict_status: str | None = SQLField(default=None, max_length=50)


class TrendingTopic(SQLModel, table=True):
    """Detected trending topics with statistical metrics.

    Stores topic trends with Z-score calculations for alerting and
    discovery features.
    """

    __tablename__ = "trending_topics"

    id: int | None = SQLField(default=None, primary_key=True)
    topic_id: str = SQLField(index=True, description="TopicNode ID from taxonomy")
    period_start: datetime = SQLField(index=True)
    period_end: datetime
    article_count: int = SQLField(ge=0, description="Articles in period")
    baseline_mean: float = SQLField(ge=0.0, description="Historical mean")
    baseline_std: float = SQLField(ge=0.0, description="Historical std dev")
    z_score: float = SQLField(description="Z-score (trending if >2.0)")
    rank: int = SQLField(ge=1, description="Ranking by Z-score")
    representative_articles: list[int] = SQLField(
        default_factory=list, sa_column=Column(JSON), description="Top 3 article IDs"
    )
    created_at: datetime = SQLField(default_factory=_utc_now)


class NotificationPreference(SQLModel, table=True):
    """User notification preferences per feed and delivery method.

    Configures notification delivery settings with quiet hours and
    frequency preferences.
    """

    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "feed_id",
            "delivery_method",
            name="uq_notification_pref_user_feed_method",
        ),
    )

    id: int | None = SQLField(default=None, primary_key=True)
    user_id: str = SQLField(index=True, description="User ID (localStorage UUID)")
    feed_id: str | None = SQLField(
        default=None, foreign_key="sources.id", description="NULL for global preferences"
    )
    delivery_method: DeliveryMethod
    frequency: NotificationFrequency
    quiet_hours_start: str | None = SQLField(default=None, description="HH:MM format")
    quiet_hours_end: str | None = SQLField(default=None, description="HH:MM format")
    created_at: datetime = SQLField(default_factory=_utc_now)
    updated_at: datetime = SQLField(default_factory=_utc_now)


class EmailDigest(SQLModel, table=True):
    """Email digest subscriptions with engagement tracking.

    Stores digest schedule and tracks open/click metrics for
    optimization and analytics.
    """

    __tablename__ = "email_digests"

    id: int | None = SQLField(default=None, primary_key=True)
    user_id: str = SQLField(index=True, description="User ID (localStorage UUID)")
    email: str = SQLField(max_length=255)
    schedule_type: ScheduleType
    schedule_cron: str = SQLField(max_length=50, description="Cron expression: '0 9 * * *'")
    timezone: str = SQLField(default="UTC", max_length=50, description="IANA timezone")
    last_sent_at: datetime | None = None
    next_send_at: datetime = SQLField(index=True)
    article_count: int = SQLField(default=0, ge=0, description="Total articles sent")
    open_count: int = SQLField(default=0, ge=0, description="Digest opens")
    click_count: int = SQLField(default=0, ge=0, description="Article clicks")
    unsubscribed_at: datetime | None = None
    created_at: datetime = SQLField(default_factory=_utc_now)


# =============================================================================
# Phase 5: Advanced AI/NLP Models
# =============================================================================


class ArticleQualityScore(SQLModel, table=True):
    """Quality scores for article content analysis.

    Stores heuristic-based quality metrics including content depth,
    references, author authority, and domain reputation.
    """

    __tablename__ = "article_quality_scores"

    article_id: int = SQLField(foreign_key="articles.id", primary_key=True)
    overall_score: int = SQLField(ge=0, le=100, description="Weighted overall quality score")
    depth_score: int | None = SQLField(
        default=None, ge=0, le=100, description="Content depth (words, structure)"
    )
    reference_score: int | None = SQLField(
        default=None, ge=0, le=100, description="External links and citations"
    )
    author_score: int | None = SQLField(
        default=None, ge=0, le=100, description="Author authority and credentials"
    )
    domain_score: int | None = SQLField(
        default=None, ge=0, le=100, description="Feed reputation score"
    )
    engagement_score: int | None = SQLField(
        default=None, ge=0, le=100, description="Read time and shares"
    )
    computed_at: datetime = SQLField(default_factory=_utc_now, index=True)


class Entity(SQLModel, table=True):
    """Extracted entities with normalization and metadata.

    Stores canonical entity names with aliases, descriptions, and
    frequency tracking for entity-based navigation and search.
    """

    __tablename__ = "entities"

    id: str = SQLField(default_factory=lambda: str(uuid4()), primary_key=True)
    canonical_name: str = SQLField(unique=True, max_length=255, index=True)
    entity_type: str = SQLField(
        max_length=50, description="Entity type: person, organization, technique, dataset, concept"
    )
    aliases: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    description: str | None = None
    entity_metadata: dict[str, Any] = SQLField(
        default_factory=dict,
        sa_column=Column(JSON),
        description="Structured entity metadata",
    )
    frequency_count: int = SQLField(default=0, index=True, ge=0)
    first_seen: datetime = SQLField(default_factory=_utc_now)
    last_seen: datetime | None = None
    created_at: datetime = SQLField(default_factory=_utc_now)


class EntityMention(SQLModel, table=True):
    """Links entities to articles with extraction metadata.

    Records entity occurrences in articles with confidence scores
    and extraction context for quality assessment.
    """

    __tablename__ = "entity_mentions"

    id: int | None = SQLField(default=None, primary_key=True)
    entity_id: str = SQLField(foreign_key="entities.id", index=True)
    article_id: int = SQLField(foreign_key="articles.id", index=True)
    confidence: float = SQLField(ge=0.0, le=1.0, description="Extraction confidence score")
    extraction_method: str = SQLField(
        max_length=50, description="Method used: ner_model, rule_based, manual"
    )
    context: str | None = SQLField(default=None, description="Surrounding text snippet")
    mentioned_at: datetime = SQLField(default_factory=_utc_now)


class ArticleSentiment(SQLModel, table=True):
    """Sentiment classification for articles.

    Stores transformer-based sentiment scores with model tracking
    for reproducibility and trend analysis.
    """

    __tablename__ = "article_sentiment"

    article_id: int = SQLField(foreign_key="articles.id", primary_key=True)
    sentiment_score: float = SQLField(
        ge=-1.0, le=1.0, description="Sentiment score: -1 (negative) to +1 (positive)"
    )
    classification: str = SQLField(
        max_length=20, description="Classification: positive, neutral, negative"
    )
    model_name: str = SQLField(max_length=255, description="Hugging Face model identifier")
    confidence: float = SQLField(ge=0.0, le=1.0, description="Model confidence score")
    computed_at: datetime = SQLField(default_factory=_utc_now, index=True)


class TopicSentimentDaily(SQLModel, table=True):
    """Aggregated daily sentiment scores by topic.

    Time-series data for sentiment trend analysis and shift detection.
    Enables charting and alerting on sentiment changes.
    """

    __tablename__ = "topic_sentiment_daily"

    id: int | None = SQLField(default=None, primary_key=True)
    topic: str = SQLField(max_length=255, index=True)
    date: str = SQLField(max_length=10, description="Date in YYYY-MM-DD format")
    avg_sentiment: float = SQLField(description="Average sentiment score for the day")
    article_count: int = SQLField(ge=0, description="Number of articles analyzed")
    positive_count: int = SQLField(default=0, ge=0)
    neutral_count: int = SQLField(default=0, ge=0)
    negative_count: int = SQLField(default=0, ge=0)


class Subtopic(SQLModel, table=True):
    """Discovered subtopics from topic modeling.

    Stores LDA/BERTopic results with keywords and manual curation flags.
    Enables hierarchical topic taxonomy and evolution tracking.
    """

    __tablename__ = "subtopics"

    id: str = SQLField(default_factory=lambda: str(uuid4()), primary_key=True)
    parent_topic: str = SQLField(max_length=255, index=True)
    name: str = SQLField(max_length=255)
    keywords: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    description: str | None = None
    article_count: int = SQLField(default=0, ge=0, index=True)
    detected_at: datetime = SQLField(default_factory=_utc_now)
    approved: bool = SQLField(default=False, index=True, description="Manual curation flag")
    created_by: str = SQLField(default="system", max_length=50)


class TopicEvolutionEvent(SQLModel, table=True):
    """TopicNode evolution events for tracking topic lifecycle.

    Records splits, merges, emergence, and decline events for
    strategic foresight and research trend identification.
    """

    __tablename__ = "topic_evolution_events"

    id: int | None = SQLField(default=None, primary_key=True)
    event_type: str = SQLField(
        max_length=50, description="Event type: split, merge, emergence, decline"
    )
    source_topic: str | None = SQLField(default=None, max_length=255)
    target_topics: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    article_count: int = SQLField(ge=0, description="Articles involved in the event")
    growth_rate: float | None = SQLField(
        default=None, description="Month-over-month growth percentage"
    )
    detected_at: datetime = SQLField(default_factory=_utc_now, index=True)
