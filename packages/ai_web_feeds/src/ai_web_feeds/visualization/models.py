"""Visualization data models for AIWebFeeds Phase 006.

SQLAlchemy models for:
- Visualization: Saved chart configurations
- Dashboard: Custom dashboard layouts
- DashboardWidget: Individual dashboard widgets
- Forecast: Time-series predictions
- APIKey: API authentication keys
- ExportJob: Async export jobs
- APIUsage: API usage tracking
"""

import re
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, Index
from sqlmodel import Field as SQLField
from sqlmodel import Relationship, SQLModel

# ============================================================================
# Enums
# ============================================================================


def _utc_now() -> datetime:
    """Return the current UTC timestamp as a timezone-aware datetime."""
    return datetime.now(UTC)


def _with_legacy_aliases(payload: dict[str, Any], **aliases: Any) -> dict[str, Any]:
    """Attach legacy alias fields without dropping canonical names."""
    result = dict(payload)
    result.update(aliases)
    return result


def _normalize_wire_value(value: str) -> str:
    """Normalize wire values across snake_case, kebab-case, and camelCase."""
    normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value.strip())
    normalized = normalized.replace("-", "_").replace(" ", "_").lower()
    normalized = re.sub(r"_+", "_", normalized)
    return normalized


class CompatibilityEnum(str, Enum):
    """Enum with tolerant parsing for legacy wire values."""

    @classmethod
    def legacy_aliases(cls) -> dict[str, str]:
        """Return normalized legacy values accepted for this enum."""
        return {}

    @classmethod
    def _missing_(cls, value: object):  # type: ignore[override]
        if not isinstance(value, str):
            return None

        normalized = _normalize_wire_value(value)
        normalized = cls.legacy_aliases().get(normalized, normalized)
        for member in cls:
            if member.value == normalized:
                return member
        return None


class ChartType(CompatibilityEnum):
    """Supported chart types."""

    LINE = "line"
    BAR = "bar"
    SCATTER = "scatter"
    PIE = "pie"
    AREA = "area"
    HEATMAP = "heatmap"


class DataSource(CompatibilityEnum):
    """Data source types."""

    FEEDS = "feeds"
    TOPICS = "topics"
    ARTICLES = "articles"
    ENTITIES = "entities"
    SENTIMENT = "sentiment"
    QUALITY = "quality"


class WidgetType(CompatibilityEnum):
    """Dashboard widget types."""

    @classmethod
    def legacy_aliases(cls) -> dict[str, str]:
        return {
            "metric": "metric_card",
            "metriccard": "metric_card",
            "list": "feed_list",
            "feedlist": "feed_list",
            "table": "feed_list",
            "cloud": "topic_cloud",
            "topiccloud": "topic_cloud",
        }

    CHART = "chart"
    METRIC_CARD = "metric_card"
    FEED_LIST = "feed_list"
    TOPIC_CLOUD = "topic_cloud"


class ExportFormat(CompatibilityEnum):
    """Export file formats."""

    PNG = "png"
    SVG = "svg"
    HTML = "html"
    CSV = "csv"
    JSON = "json"
    PARQUET = "parquet"


class ExportStatus(CompatibilityEnum):
    """Export job status."""

    @classmethod
    def legacy_aliases(cls) -> dict[str, str]:
        return {"processing": "in_progress"}

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PROCESSING = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ForecastModelType(CompatibilityEnum):
    """Forecasting model types."""

    PROPHET = "prophet"
    ARIMA = "arima"
    LSTM = "lstm"


# ============================================================================
# SQLModel Tables
# ============================================================================


class Visualization(SQLModel, table=True):
    """Saved chart configuration for a user device.

    Stores visualization settings including chart type, data source, filters,
    and customization options. Identified by device_id from localStorage.
    """

    __tablename__ = "visualizations"

    # Primary key
    id: int | None = SQLField(default=None, primary_key=True)

    # Device identification (from localStorage UUID)
    device_id: str = SQLField(
        max_length=36,
        nullable=False,
        index=True,
        description="Browser device UUID from localStorage",
    )

    # Visualization metadata
    name: str = SQLField(max_length=255, nullable=False)
    chart_type: ChartType = SQLField(nullable=False)
    data_source: DataSource = SQLField(nullable=False)

    # Configuration stored as JSON
    filters: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
        description="Query filters: date_range, topic_filter, feed_ids, etc.",
    )
    customization: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
        description="Chart appearance: colors, labels, axes, legend, etc.",
    )

    # Timestamps
    created_at: datetime = SQLField(
        default_factory=_utc_now,
        nullable=False,
    )
    last_viewed: datetime = SQLField(
        default_factory=_utc_now,
        nullable=False,
    )

    __table_args__ = (
        Index("idx_viz_device_created", "device_id", "created_at"),
        Index("idx_viz_device_viewed", "device_id", "last_viewed"),
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "device_id": self.device_id,
            "name": self.name,
            "chart_type": self.chart_type.value,
            "data_source": self.data_source.value,
            "filters": self.filters,
            "customization": self.customization,
            "created_at": self.created_at.isoformat(),
            "last_viewed": self.last_viewed.isoformat(),
        }


class Dashboard(SQLModel, table=True):
    """User-created dashboard with multiple widgets.

    Stores dashboard layout and configuration. Widgets are stored separately
    in DashboardWidget table with foreign key relationship.
    """

    __tablename__ = "dashboards"

    id: int | None = SQLField(default=None, primary_key=True)
    device_id: str = SQLField(max_length=36, nullable=False, index=True)

    # Dashboard metadata
    name: str = SQLField(max_length=255, nullable=False)
    description: str | None = SQLField(default=None)
    template_id: str | None = SQLField(
        max_length=50,
        default=None,
        description="curator_dashboard|research_overview|topic_monitor|null",
    )

    # Layout configuration
    layout: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
        description="React Grid Layout config: {lg, md, sm, xs breakpoints}",
    )

    # Version for optimistic locking
    version: int = SQLField(default=1, nullable=False)

    # Timestamps
    created_at: datetime = SQLField(default_factory=_utc_now, nullable=False)
    updated_at: datetime = SQLField(default_factory=_utc_now, nullable=False)

    # Relationship to widgets
    widgets: list["DashboardWidget"] = Relationship(
        back_populates="dashboard",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )

    __table_args__ = (Index("idx_dashboard_device_updated", "device_id", "updated_at"),)

    def to_dict(self, include_widgets: bool = False) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        result: dict[str, Any] = {
            "id": self.id,
            "device_id": self.device_id,
            "name": self.name,
            "description": self.description,
            "template_id": self.template_id,
            "layout": self.layout,
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_widgets and self.widgets:
            result["widgets"] = [w.to_dict() for w in self.widgets]
        return _with_legacy_aliases(result, layout_config=self.layout)


class DashboardWidget(SQLModel, table=True):
    """Individual widget on a dashboard.

    Can optionally reference a saved Visualization, or have its own
    independent configuration.
    """

    __tablename__ = "dashboard_widgets"

    id: int | None = SQLField(default=None, primary_key=True)
    dashboard_id: int = SQLField(
        foreign_key="dashboards.id",
        nullable=False,
        ondelete="CASCADE",
    )
    visualization_id: int | None = SQLField(
        foreign_key="visualizations.id",
        default=None,
        ondelete="SET NULL",
    )

    # Widget configuration
    widget_type: WidgetType = SQLField(default=WidgetType.CHART, nullable=False)
    data_source: DataSource = SQLField(default=DataSource.TOPICS, nullable=False)
    filters: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
    )
    refresh_interval_seconds: int = SQLField(default=300, nullable=False)

    # Position on dashboard grid
    position: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        description="{x, y, w, h} for React Grid Layout",
    )

    # Widget-specific configuration
    config: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
        description="Widget display options: title, colors, size, etc.",
    )

    # Relationships
    dashboard: Dashboard = Relationship(back_populates="widgets")

    @classmethod
    def _normalize_legacy_widget_payload(cls, data: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(data)
        if "position" not in normalized:
            x = normalized.pop("position_x", 0)
            y = normalized.pop("position_y", 0)
            w = normalized.pop("width", 12)
            h = normalized.pop("height", 4)
            normalized["position"] = {"x": x, "y": y, "w": w, "h": h}
        return normalized

    def __init__(self, **data: Any):
        super().__init__(**self._normalize_legacy_widget_payload(data))

    @property
    def position_x(self) -> int:
        return int(self.position.get("x", 0))

    @position_x.setter
    def position_x(self, value: int) -> None:
        self.position["x"] = value

    @property
    def position_y(self) -> int:
        return int(self.position.get("y", 0))

    @position_y.setter
    def position_y(self, value: int) -> None:
        self.position["y"] = value

    @property
    def width(self) -> int:
        return int(self.position.get("w", 12))

    @width.setter
    def width(self, value: int) -> None:
        self.position["w"] = value

    @property
    def height(self) -> int:
        return int(self.position.get("h", 4))

    @height.setter
    def height(self, value: int) -> None:
        self.position["h"] = value

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return _with_legacy_aliases(
            {
                "id": self.id,
                "dashboard_id": self.dashboard_id,
                "visualization_id": self.visualization_id,
                "widget_type": self.widget_type.value,
                "data_source": self.data_source.value,
                "filters": self.filters,
                "refresh_interval_seconds": self.refresh_interval_seconds,
                "position": self.position,
                "config": self.config,
            },
            position_x=self.position_x,
            position_y=self.position_y,
            width=self.width,
            height=self.height,
        )


class Forecast(SQLModel, table=True):
    """Time-series prediction for a topic with accuracy tracking."""

    __tablename__ = "forecasts"

    id: int | None = SQLField(default=None, primary_key=True)
    topic_id: str = SQLField(
        foreign_key="topics.id",
        default=None,
        index=True,
    )

    # Forecast parameters
    forecast_horizon_days: int = SQLField(
        default=30,
        description="30|60|90",
    )
    confidence_level: float = SQLField(default=0.95, ge=0.0, le=1.0)
    model_type: ForecastModelType = SQLField(
        default=ForecastModelType.PROPHET,
        nullable=False,
    )

    # Training period
    training_period_start: datetime = SQLField(default_factory=_utc_now, nullable=False)
    training_period_end: datetime = SQLField(default_factory=_utc_now, nullable=False)

    # Predictions
    predictions: Any = SQLField(
        sa_column=Column(JSON),
        description="Array of {date, value, confidence_lower, confidence_upper}",
    )

    # Accuracy metrics (updated as actual data arrives)
    accuracy_metrics: dict[str, Any] | None = SQLField(
        sa_column=Column(JSON),
        default=None,
        description="Accuracy metrics and retraining metadata",
    )

    # Model parameters for reproducibility
    model_params: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        description="Model hyperparameters and settings",
    )

    # Timestamps
    generated_at: datetime = SQLField(
        default_factory=_utc_now,
        nullable=False,
    )

    __table_args__ = (Index("idx_forecast_topic_generated", "topic_id", "generated_at"),)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        generated_at = self.generated_at.isoformat()
        return _with_legacy_aliases(
            {
                "id": self.id,
                "device_id": self.device_id,
                "data_source": self.data_source.value if self.data_source else None,
                "topic_id": self.topic_id,
                "forecast_horizon_days": self.forecast_horizon_days,
                "confidence_level": self.confidence_level,
                "model_type": self.model_type.value,
                "training_period_start": self.training_period_start.isoformat(),
                "training_period_end": self.training_period_end.isoformat(),
                "predictions": self.predictions,
                "accuracy_metrics": self.accuracy_metrics,
                "model_params": self.model_params,
                "generated_at": generated_at,
            },
            horizon_days=self.forecast_horizon_days,
            metrics=self.accuracy_metrics,
            created_at=generated_at,
        )


class APIKey(SQLModel, table=True):
    """API authentication key for programmatic export access."""

    __tablename__ = "api_keys"

    id: int | None = SQLField(default=None, primary_key=True)
    device_id: str = SQLField(max_length=36, nullable=False, index=True)

    # API key (stored hashed with bcrypt)
    key_hash: str = SQLField(
        max_length=60,
        nullable=False,
        unique=True,
        description="bcrypt hash of API key",
    )

    # Key metadata
    name: str = SQLField(
        max_length=255,
        nullable=False,
        description="User-defined key name",
    )
    created_at: datetime = SQLField(
        default_factory=_utc_now,
        nullable=False,
    )
    last_used_at: datetime | None = SQLField(default=None)
    revoked_at: datetime | None = SQLField(default=None)
    scopes: list[str] = SQLField(default_factory=list, sa_column=Column(JSON))
    request_count: int = SQLField(default=0, nullable=False)
    is_revoked: bool = SQLField(default=False, nullable=False)

    # Relationship to usage logs
    usage_logs: list["APIUsage"] = Relationship(back_populates="api_key")

    __table_args__ = (
        Index("idx_apikey_device_created", "device_id", "created_at"),
        Index("idx_apikey_hash", "key_hash"),
    )

    @classmethod
    def _normalize_legacy_apikey_payload(cls, data: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(data)
        if "is_active" in normalized and "is_revoked" not in normalized:
            normalized["is_revoked"] = not normalized.pop("is_active")
        if "last_used" in normalized and "last_used_at" not in normalized:
            normalized["last_used_at"] = normalized.pop("last_used")
        return normalized

    def __init__(self, **data: Any):
        super().__init__(**self._normalize_legacy_apikey_payload(data))

    @property
    def is_active(self) -> bool:
        return not self.is_revoked

    @is_active.setter
    def is_active(self, value: bool) -> None:
        self.is_revoked = not value

    @property
    def last_used(self) -> datetime | None:
        return self.last_used_at

    @last_used.setter
    def last_used(self, value: datetime | None) -> None:
        self.last_used_at = value

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses.

        Note: Never return key_hash, only return plaintext key on creation.
        """
        return {
            "id": self.id,
            "device_id": self.device_id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "last_used_at": (self.last_used_at.isoformat() if self.last_used_at else None),
            "request_count": self.request_count,
            "is_revoked": self.is_revoked,
        }


class ExportJob(SQLModel, table=True):
    """Async export job for large dataset exports."""

    __tablename__ = "export_jobs"

    id: int | None = SQLField(default=None, primary_key=True)
    device_id: str = SQLField(max_length=36, nullable=False, index=True)
    visualization_id: int | None = SQLField(
        foreign_key="visualizations.id",
        default=None,
        ondelete="SET NULL",
    )
    api_key_id: int | None = SQLField(
        foreign_key="api_keys.id",
        default=None,
        ondelete="SET NULL",
    )

    # Export parameters
    entity_type: str = SQLField(
        max_length=50,
        default="visualization",
        description="feeds|topics|articles",
    )
    filters: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
    )
    format: ExportFormat = SQLField(nullable=False)
    dpi: int | None = SQLField(default=None)

    # Job status
    status: ExportStatus = SQLField(
        default=ExportStatus.PENDING,
        nullable=False,
    )
    record_count: int | None = SQLField(default=None)
    file_url: str | None = SQLField(
        max_length=500,
        default=None,
        description="S3/local URL for download",
    )

    # Timestamps
    created_at: datetime = SQLField(
        default_factory=_utc_now,
        nullable=False,
    )
    completed_at: datetime | None = SQLField(default=None)
    error_message: str | None = SQLField(default=None)

    # Retry tracking
    retry_count: int = SQLField(default=0, nullable=False)

    __table_args__ = (
        Index("idx_exportjob_device_status", "device_id", "status"),
        Index("idx_exportjob_created", "created_at"),
    )

    @classmethod
    def _normalize_legacy_export_job_payload(cls, data: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(data)
        if "file_path" in normalized and "file_url" not in normalized:
            normalized["file_url"] = normalized.pop("file_path")
        if "error" in normalized and "error_message" not in normalized:
            normalized["error_message"] = normalized.pop("error")
        if "format" in normalized and not isinstance(normalized["format"], ExportFormat):
            normalized["format"] = ExportFormat(normalized["format"])
        if "status" in normalized and not isinstance(normalized["status"], ExportStatus):
            normalized["status"] = ExportStatus(normalized["status"])
        return normalized

    def __init__(self, **data: Any):
        super().__init__(**self._normalize_legacy_export_job_payload(data))

    @property
    def file_path(self) -> str | None:
        return self.file_url

    @file_path.setter
    def file_path(self, value: str | None) -> None:
        self.file_url = value

    @property
    def error(self) -> str | None:
        return self.error_message

    @error.setter
    def error(self, value: str | None) -> None:
        self.error_message = value

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "device_id": self.device_id,
            "entity_type": self.entity_type,
            "filters": self.filters,
            "format": self.format.value,
            "status": self.status.value,
            "record_count": self.record_count,
            "file_url": self.file_url,
            "created_at": self.created_at.isoformat(),
            "completed_at": (self.completed_at.isoformat() if self.completed_at else None),
            "error_message": self.error_message,
            "retry_count": self.retry_count,
        }


class APIUsage(SQLModel, table=True):
    """Tracks API export usage for rate limiting and analytics."""

    __tablename__ = "api_usage"

    id: int | None = SQLField(default=None, primary_key=True)
    device_id: str | None = SQLField(default=None, max_length=36, index=True)
    api_key_id: int | None = SQLField(
        foreign_key="api_keys.id",
        default=None,
        index=True,
        ondelete="CASCADE",
    )

    # Request details
    endpoint: str = SQLField(max_length=255, nullable=False)
    method: str = SQLField(default="GET", max_length=10, nullable=False)
    request_params: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
    )
    response_status: int = SQLField(nullable=False)
    records_exported: int | None = SQLField(default=None)
    response_time_ms: int = SQLField(nullable=False)

    # Timestamp
    timestamp: datetime = SQLField(
        default_factory=_utc_now,
        nullable=False,
        index=True,
    )

    # Relationship
    api_key: APIKey | None = Relationship(back_populates="usage_logs")

    __table_args__ = (Index("idx_apiusage_key_timestamp", "api_key_id", "timestamp"),)

    @classmethod
    def _normalize_legacy_api_usage_payload(cls, data: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(data)
        if "status_code" in normalized and "response_status" not in normalized:
            normalized["response_status"] = normalized.pop("status_code")
        return normalized

    def __init__(self, **data: Any):
        super().__init__(**self._normalize_legacy_api_usage_payload(data))

    @property
    def status_code(self) -> int:
        return self.response_status

    @status_code.setter
    def status_code(self, value: int) -> None:
        self.response_status = value

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return _with_legacy_aliases(
            {
                "id": self.id,
                "api_key_id": self.api_key_id,
                "endpoint": self.endpoint,
                "request_params": self.request_params,
                "response_status": self.response_status,
                "records_exported": self.records_exported,
                "response_time_ms": self.response_time_ms,
                "timestamp": self.timestamp.isoformat(),
            },
            status_code=self.response_status,
        )
