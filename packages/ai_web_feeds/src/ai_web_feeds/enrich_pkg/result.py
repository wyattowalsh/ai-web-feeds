"""ai_web_feeds.enrich_pkg.result -- Enrichment result container."""

from datetime import UTC, datetime
from typing import Any

from ai_web_feeds.models import FeedFormat


class FeedEnrichment:
    """Container for enrichment data."""

    def __init__(self):
        """Initialize feed enrichment."""
        # Basic metadata
        self.title: str | None = None
        self.description: str | None = None
        self.language: str | None = None
        self.author: str | None = None

        # Format and platform
        self.format: FeedFormat | None = None
        self.platform: str | None = None

        # Images
        self.icon_url: str | None = None
        self.logo_url: str | None = None
        self.image_url: str | None = None

        # Quality metrics
        self.health_score: float = 0.0
        self.quality_score: float = 0.0
        self.completeness_score: float = 0.0

        # Content analysis
        self.entry_count: int = 0
        self.has_full_content: bool = False
        self.avg_content_length: float = 0.0
        self.content_types: list[str] = []

        # Update patterns
        self.estimated_frequency: str | None = None
        self.last_updated: datetime | None = None
        self.update_regularity: float = 0.0

        # Performance
        self.response_time_ms: float = 0.0
        self.availability_score: float = 1.0

        # TopicNode suggestions
        self.suggested_topics: list[str] = []
        self.topic_confidence: dict[str, float] = {}

        # Extensions
        self.has_itunes: bool = False
        self.has_media_rss: bool = False
        self.has_dublin_core: bool = False

        # Metadata
        self.enriched_at: datetime = datetime.now(UTC)
        self.enrichment_version: str = "1.0.0"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "basic": {
                "title": self.title,
                "description": self.description,
                "language": self.language,
                "author": self.author,
            },
            "technical": {
                "format": self.format.value if self.format else None,
                "platform": self.platform,
            },
            "images": {
                "icon_url": self.icon_url,
                "logo_url": self.logo_url,
                "image_url": self.image_url,
            },
            "quality": {
                "health_score": round(self.health_score, 2),
                "quality_score": round(self.quality_score, 2),
                "completeness_score": round(self.completeness_score, 2),
            },
            "content": {
                "entry_count": self.entry_count,
                "has_full_content": self.has_full_content,
                "avg_content_length": round(self.avg_content_length, 2),
                "content_types": self.content_types,
            },
            "updates": {
                "estimated_frequency": self.estimated_frequency,
                "last_updated": self.last_updated.isoformat() if self.last_updated else None,
                "update_regularity": round(self.update_regularity, 2),
            },
            "performance": {
                "response_time_ms": round(self.response_time_ms, 2),
                "availability_score": round(self.availability_score, 2),
            },
            "topics": {
                "suggested": self.suggested_topics,
                "confidence": {k: round(v, 2) for k, v in self.topic_confidence.items()},
            },
            "extensions": {
                "itunes": self.has_itunes,
                "media_rss": self.has_media_rss,
                "dublin_core": self.has_dublin_core,
            },
            "metadata": {
                "enriched_at": self.enriched_at.isoformat(),
                "version": self.enrichment_version,
            },
        }
