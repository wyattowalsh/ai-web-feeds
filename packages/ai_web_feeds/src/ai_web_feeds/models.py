"""ai_web_feeds.models -- AIWebFeeds data models with SQLModel support"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import Field, HttpUrl
from sqlalchemy import JSON, Column
from sqlmodel import Field as SQLField
from sqlmodel import Relationship, SQLModel


# ============================================================================
# Enums
# ============================================================================


class SourceType(str, Enum):
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


class FeedFormat(str, Enum):
    """Feed format types."""

    RSS = "rss"
    ATOM = "atom"
    JSONFEED = "jsonfeed"
    UNKNOWN = "unknown"


class CurationStatus(str, Enum):
    """Curation status values."""

    VERIFIED = "verified"
    UNVERIFIED = "unverified"
    ARCHIVED = "archived"
    EXPERIMENTAL = "experimental"
    INACTIVE = "inactive"


class Medium(str, Enum):
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
    feed: str | None = SQLField(
        default=None, description="Direct feed URL, alias, or CURIE"
    )
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
        default_factory=list, sa_column=Column(JSON), description="Topic IDs"
    )
    topic_weights: dict[str, float] = SQLField(
        default_factory=dict,
        sa_column=Column(JSON),
        description="Topic relevance weights",
    )

    # Metadata
    language: str | None = SQLField(default="en")
    format: FeedFormat | None = SQLField(default=FeedFormat.UNKNOWN)
    updated: datetime | None = SQLField(
        default=None, description="Last human/automation review"
    )
    last_validated: datetime | None = SQLField(
        default=None, description="Last successful validation"
    )
    verified: bool = SQLField(default=False)
    contributor: str | None = SQLField(default=None)

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
    discover_config: dict[str, Any] = SQLField(
        default_factory=dict, sa_column=Column(JSON)
    )

    # Relations (stored as JSON)
    relations: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))
    mappings: dict[str, str] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Additional notes
    notes: str | None = SQLField(default=None)

    # Relationships
    items: list["FeedItem"] = Relationship(back_populates="feed_source")
    fetch_logs: list["FeedFetchLog"] = Relationship(back_populates="feed_source")


class FeedItem(SQLModel, table=True):
    """Individual feed item/entry.
    
    Represents a single article, post, or entry from a feed source with full content,
    metadata, timestamps, and categorization.
    """

    __tablename__ = "items"

    # Primary key
    id: UUID = SQLField(default_factory=uuid4, primary_key=True)

    # Foreign key
    feed_source_id: str = SQLField(foreign_key="sources.id", index=True)

    # Item metadata
    title: str | None = SQLField(default=None)
    link: str | None = SQLField(default=None)
    description: str | None = SQLField(default=None)
    content: str | None = SQLField(default=None)
    author: str | None = SQLField(default=None)
    published: datetime | None = SQLField(default=None)
    updated: datetime | None = SQLField(default=None)

    # Item identifiers
    guid: str | None = SQLField(default=None, unique=True)

    # Additional data
    categories: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    tags: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    enclosures: list[dict[str, Any]] = SQLField(
        default_factory=list, sa_column=Column(JSON)
    )
    extra_data: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = SQLField(default_factory=datetime.utcnow)
    updated_at: datetime = SQLField(default_factory=datetime.utcnow)

    # Relationships
    feed_source: FeedSource = Relationship(back_populates="items")


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
    fetched_at: datetime = SQLField(default_factory=datetime.utcnow)
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
    response_headers: dict[str, str] = SQLField(
        default_factory=dict, sa_column=Column(JSON)
    )
    extra_data: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Relationships
    feed_source: FeedSource = Relationship(back_populates="fetch_logs")


class Topic(SQLModel, table=True):
    """Topic definitions."""

    __tablename__ = "topics"

    # Primary key
    id: str = SQLField(primary_key=True, description="Topic ID (slug)")

    # Topic info
    name: str = SQLField(description="Display name")
    description: str | None = SQLField(default=None)
    parent_id: str | None = SQLField(default=None)

    # Metadata
    aliases: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    related_topics: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = SQLField(default_factory=datetime.utcnow)
    updated_at: datetime = SQLField(default_factory=datetime.utcnow)


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
    enriched_at: datetime = SQLField(default_factory=datetime.utcnow)
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

    # Topic suggestions
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
    created_at: datetime = SQLField(default_factory=datetime.utcnow)
    updated_at: datetime = SQLField(default_factory=datetime.utcnow)


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
    validated_at: datetime = SQLField(default_factory=datetime.utcnow)
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
    created_at: datetime = SQLField(default_factory=datetime.utcnow)


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
    avg_categories_per_item: float | None = SQLField(default=None)
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

    # Topic distribution
    topic_distribution: dict[str, int] = SQLField(default_factory=dict, sa_column=Column(JSON))
    keyword_frequency: dict[str, int] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Additional metrics
    extra_metrics: dict[str, Any] = SQLField(default_factory=dict, sa_column=Column(JSON))

    # Timestamps
    created_at: datetime = SQLField(default_factory=datetime.utcnow)
    updated_at: datetime = SQLField(default_factory=datetime.utcnow)


# ============================================================================
# Pydantic Models for API/Validation (not stored in DB)
# ============================================================================


class FeedSourceEnriched(SQLModel):
    """Enriched feed source for YAML export (matches feeds.enriched.yaml structure)."""

    # Core fields
    id: str
    feed: str | None = None
    site: str | None = None
    title: str
    source_type: SourceType | None = None
    mediums: list[Medium] = []
    tags: list[str] = []
    topics: list[str] = []
    topic_weights: dict[str, float] = {}

    # Meta block
    meta: dict[str, Any] = {}

    # Curation block
    curation: dict[str, Any] = {}

    # Provenance block
    provenance: dict[str, Any] = {}

    # Relations
    relations: dict[str, Any] = {}
    mappings: dict[str, str] = {}

    # Discover
    discover: bool | dict[str, Any] | None = None

    # Notes
    notes: str | None = None

    class Config:
        """Pydantic config."""

        use_enum_values = True


class OPMLOutline(SQLModel):
    """OPML outline element."""

    text: str
    title: str | None = None
    type: str | None = None
    xmlUrl: str | None = None
    htmlUrl: str | None = None
    description: str | None = None
    category: str | None = None
    outlines: list["OPMLOutline"] = []

    class Config:
        """Pydantic config."""

        populate_by_name = True


class OPMLDocument(SQLModel):
    """OPML document structure."""

    title: str
    date_created: datetime = Field(default_factory=datetime.utcnow)
    date_modified: datetime = Field(default_factory=datetime.utcnow)
    owner_name: str = "AI Web Feeds"
    owner_email: str | None = None
    outlines: list[OPMLOutline] = []