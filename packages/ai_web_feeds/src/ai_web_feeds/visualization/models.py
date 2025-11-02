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

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import Field
from sqlalchemy import JSON, Column, Index
from sqlmodel import Field as SQLField
from sqlmodel import Relationship, SQLModel


# ============================================================================
# Enums
# ============================================================================


class ChartType(str, Enum):
    """Supported chart types."""

    LINE = "line"
    BAR = "bar"
    SCATTER = "scatter"
    PIE = "pie"
    AREA = "area"
    HEATMAP = "heatmap"


class DataSource(str, Enum):
    """Data source types."""

    FEEDS = "feeds"
    TOPICS = "topics"
    ARTICLES = "articles"
    ENTITIES = "entities"
    SENTIMENT = "sentiment"
    QUALITY = "quality"


class WidgetType(str, Enum):
    """Dashboard widget types."""

    CHART = "chart"
    METRIC_CARD = "metric_card"
    FEED_LIST = "feed_list"
    TOPIC_CLOUD = "topic_cloud"


class ExportFormat(str, Enum):
    """Export file formats."""

    CSV = "csv"
    JSON = "json"
    PARQUET = "parquet"


class ExportStatus(str, Enum):
    """Export job status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ForecastModelType(str, Enum):
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
        default_factory=datetime.utcnow,
        nullable=False,
    )
    last_viewed: datetime = SQLField(
        default_factory=datetime.utcnow,
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
    created_at: datetime = SQLField(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = SQLField(default_factory=datetime.utcnow, nullable=False)

    # Relationship to widgets
    widgets: list["DashboardWidget"] = Relationship(
        back_populates="dashboard",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )

    __table_args__ = (
        Index("idx_dashboard_device_updated", "device_id", "updated_at"),
    )

    def to_dict(self, include_widgets: bool = False) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        result = {
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
        return result


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
    widget_type: WidgetType = SQLField(nullable=False)
    data_source: DataSource = SQLField(nullable=False)
    filters: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
    )
    refresh_interval_seconds: int = SQLField(default=300, nullable=False)

    # Position on dashboard grid
    position: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        nullable=False,
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

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "dashboard_id": self.dashboard_id,
            "visualization_id": self.visualization_id,
            "widget_type": self.widget_type.value,
            "data_source": self.data_source.value,
            "filters": self.filters,
            "refresh_interval_seconds": self.refresh_interval_seconds,
            "position": self.position,
            "config": self.config,
        }


class Forecast(SQLModel, table=True):
    """Time-series prediction for a topic with accuracy tracking."""

    __tablename__ = "forecasts"

    id: int | None = SQLField(default=None, primary_key=True)
    topic_id: int = SQLField(
        foreign_key="topics.id",
        nullable=False,
        index=True,
    )

    # Forecast parameters
    forecast_horizon_days: int = SQLField(
        nullable=False,
        description="30|60|90",
    )
    model_type: ForecastModelType = SQLField(
        default=ForecastModelType.PROPHET,
        nullable=False,
    )

    # Training period
    training_period_start: datetime = SQLField(nullable=False)
    training_period_end: datetime = SQLField(nullable=False)

    # Predictions
    predictions: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        nullable=False,
        description="Array of {date, value, confidence_lower, confidence_upper}",
    )

    # Accuracy metrics (updated as actual data arrives)
    accuracy_metrics: dict[str, Any] | None = SQLField(
        sa_column=Column(JSON),
        default=None,
        description="{mape, mae, last_retrain_date, retrain_trigger_reason}",
    )

    # Model parameters for reproducibility
    model_params: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        nullable=False,
        description="Model hyperparameters and settings",
    )

    # Timestamps
    generated_at: datetime = SQLField(
        default_factory=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        Index("idx_forecast_topic_generated", "topic_id", "generated_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "topic_id": self.topic_id,
            "forecast_horizon_days": self.forecast_horizon_days,
            "model_type": self.model_type.value,
            "training_period_start": self.training_period_start.isoformat(),
            "training_period_end": self.training_period_end.isoformat(),
            "predictions": self.predictions,
            "accuracy_metrics": self.accuracy_metrics,
            "model_params": self.model_params,
            "generated_at": self.generated_at.isoformat(),
        }


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
        default_factory=datetime.utcnow,
        nullable=False,
    )
    last_used_at: datetime | None = SQLField(default=None)
    request_count: int = SQLField(default=0, nullable=False)
    is_revoked: bool = SQLField(default=False, nullable=False)

    # Relationship to usage logs
    usage_logs: list["APIUsage"] = Relationship(back_populates="api_key")

    __table_args__ = (
        Index("idx_apikey_device_created", "device_id", "created_at"),
        Index("idx_apikey_hash", "key_hash"),
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses.

        Note: Never return key_hash, only return plaintext key on creation.
        """
        return {
            "id": self.id,
            "device_id": self.device_id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "last_used_at": (
                self.last_used_at.isoformat() if self.last_used_at else None
            ),
            "request_count": self.request_count,
            "is_revoked": self.is_revoked,
        }


class ExportJob(SQLModel, table=True):
    """Async export job for large dataset exports."""

    __tablename__ = "export_jobs"

    id: int | None = SQLField(default=None, primary_key=True)
    device_id: str = SQLField(max_length=36, nullable=False, index=True)
    api_key_id: int | None = SQLField(
        foreign_key="api_keys.id",
        default=None,
        ondelete="SET NULL",
    )

    # Export parameters
    entity_type: str = SQLField(
        max_length=50,
        nullable=False,
        description="feeds|topics|articles",
    )
    filters: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
    )
    format: ExportFormat = SQLField(nullable=False)

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
        default_factory=datetime.utcnow,
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
            "completed_at": (
                self.completed_at.isoformat() if self.completed_at else None
            ),
            "error_message": self.error_message,
            "retry_count": self.retry_count,
        }


class APIUsage(SQLModel, table=True):
    """Tracks API export usage for rate limiting and analytics."""

    __tablename__ = "api_usage"

    id: int | None = SQLField(default=None, primary_key=True)
    api_key_id: int = SQLField(
        foreign_key="api_keys.id",
        nullable=False,
        index=True,
        ondelete="CASCADE",
    )

    # Request details
    endpoint: str = SQLField(max_length=255, nullable=False)
    request_params: dict[str, Any] = SQLField(
        sa_column=Column(JSON),
        default_factory=dict,
    )
    response_status: int = SQLField(nullable=False)
    records_exported: int | None = SQLField(default=None)
    response_time_ms: int = SQLField(nullable=False)

    # Timestamp
    timestamp: datetime = SQLField(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # Relationship
    api_key: APIKey = Relationship(back_populates="usage_logs")

    __table_args__ = (Index("idx_apiusage_key_timestamp", "api_key_id", "timestamp"),)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "api_key_id": self.api_key_id,
            "endpoint": self.endpoint,
            "request_params": self.request_params,
            "response_status": self.response_status,
            "records_exported": self.records_exported,
            "response_time_ms": self.response_time_ms,
            "timestamp": self.timestamp.isoformat(),
        }
