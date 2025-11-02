# Data Model: Advanced Visualization & Analytics

**Feature**: 006-advanced-visualization-analytics  
**Date**: 2025-11-01  
**Purpose**: Define database schema and entity relationships for visualization features

---

## Overview

This document defines the SQLAlchemy models and database schema for Phase 006 visualization features. All entities use device-based identification (no user accounts) via `device_id` column populated from browser localStorage UUID.

---

## Entity Relationship Diagram

```
┌─────────────────┐
│    Device       │ (Conceptual - localStorage UUID)
│    device_id    │
└────────┬────────┘
         │
         ├───────────────────────────────────────────────┐
         │                                                │
         ▼                                                ▼
┌─────────────────────┐                         ┌──────────────────┐
│   Visualization     │                         │    Dashboard     │
├─────────────────────┤                         ├──────────────────┤
│ id (PK)             │                         │ id (PK)          │
│ device_id           │◄────────┐               │ device_id        │
│ name                │         │               │ name             │
│ chart_type          │         │               │ description      │
│ data_source         │         │               │ layout (JSON)    │
│ filters (JSON)      │         │               │ template_id      │
│ customization (JSON)│         │               │ created_at       │
│ created_at          │         │               │ updated_at       │
│ last_viewed         │         │               └────────┬─────────┘
└─────────────────────┘         │                        │
                                │                        │ 1:N
                                │                        ▼
                                │               ┌──────────────────┐
                                │               │ DashboardWidget  │
                                │               ├──────────────────┤
                                │               │ id (PK)          │
                                │               │ dashboard_id (FK)│
                                └───────────────┤ visualization_id │
                                                │ widget_type      │
                                                │ data_source      │
                                                │ filters (JSON)   │
                                                │ refresh_interval │
                                                │ position (JSON)  │
                                                │ config (JSON)    │
                                                └──────────────────┘

┌──────────────────┐         ┌───────────────────┐         ┌─────────────────┐
│    Forecast      │         │     ExportJob     │         │     APIKey      │
├──────────────────┤         ├───────────────────┤         ├─────────────────┤
│ id (PK)          │         │ id (PK)           │         │ id (PK)         │
│ topic_id (FK)    │         │ device_id         │         │ device_id       │
│ forecast_horizon │         │ api_key_id (FK)   │◄────────┤ key_hash        │
│ model_type       │         │ entity_type       │         │ name            │
│ predictions(JSON)│         │ filters (JSON)    │         │ created_at      │
│ accuracy (JSON)  │         │ format            │         │ last_used_at    │
│ generated_at     │         │ status            │         │ request_count   │
│ model_params(JSON│         │ record_count      │         │ is_revoked      │
└──────────────────┘         │ file_url          │         └─────────────────┘
                             │ created_at        │
                             │ completed_at      │         ┌─────────────────┐
                             │ error_message     │         │    APIUsage     │
                             └───────────────────┘         ├─────────────────┤
                                                           │ id (PK)         │
                                                           │ api_key_id (FK) │
                                                           │ endpoint        │
                                                           │ params (JSON)   │
                                                           │ response_status │
                                                           │ records_exported│
                                                           │ response_time_ms│
                                                           │ timestamp       │
                                                           └─────────────────┘
```

---

## SQLAlchemy Models

### Visualization

Represents a saved chart configuration created by a user.

```python
from sqlalchemy import Column, String, Integer, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.sql import func
from ai_web_feeds.storage import Base

class Visualization(Base):
    __tablename__ = "visualizations"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Device identification (from localStorage UUID)
    device_id = Column(String(36), nullable=False, index=True)
    
    # Visualization metadata
    name = Column(String(255), nullable=False)
    chart_type = Column(
        String(50), 
        nullable=False,
        comment="line|bar|scatter|pie|area|heatmap"
    )
    data_source = Column(
        String(50), 
        nullable=False,
        comment="feeds|topics|articles|entities|sentiment|quality"
    )
    
    # Configuration stored as JSON
    filters = Column(
        JSON,
        nullable=False,
        default=dict,
        comment="Query filters: {date_range, topic_filter, feed_ids, etc.}"
    )
    customization = Column(
        JSON,
        nullable=False,
        default=dict,
        comment="Chart appearance: {title, colors, labels, axes, legend, etc.}"
    )
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_viewed = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_viz_device_created', 'device_id', 'created_at'),
        Index('idx_viz_device_viewed', 'device_id', 'last_viewed'),
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "device_id": self.device_id,
            "name": self.name,
            "chart_type": self.chart_type,
            "data_source": self.data_source,
            "filters": self.filters,
            "customization": self.customization,
            "created_at": self.created_at.isoformat(),
            "last_viewed": self.last_viewed.isoformat(),
        }
```

**Validation Rules**:
- `device_id`: Must be valid UUID v4 format (36 chars with hyphens)
- `name`: 1-255 characters, non-empty
- `chart_type`: Must be one of allowed types (enum validation in Pydantic schema)
- `data_source`: Must be one of allowed sources (enum validation in Pydantic schema)
- `filters`: Valid JSON object, specific structure validated by data_source type
- `customization`: Valid JSON object with chart configuration schema

---

### Dashboard

User-created dashboard containing multiple widgets.

```python
class Dashboard(Base):
    __tablename__ = "dashboards"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(36), nullable=False, index=True)
    
    # Dashboard metadata
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    template_id = Column(
        String(50), 
        nullable=True,
        comment="curator_dashboard|research_overview|topic_monitor|null for custom"
    )
    
    # Layout configuration
    layout = Column(
        JSON,
        nullable=False,
        default=dict,
        comment="React Grid Layout config: {lg, md, sm, xs breakpoints}"
    )
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationship to widgets (1:N)
    widgets = relationship("DashboardWidget", back_populates="dashboard", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_dashboard_device_updated', 'device_id', 'updated_at'),
    )
    
    def to_dict(self, include_widgets=False):
        result = {
            "id": self.id,
            "device_id": self.device_id,
            "name": self.name,
            "description": self.description,
            "template_id": self.template_id,
            "layout": self.layout,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_widgets:
            result["widgets"] = [w.to_dict() for w in self.widgets]
        return result
```

**Validation Rules**:
- `name`: 1-255 characters, non-empty
- `description`: Max 1000 characters, optional
- `template_id`: Must be one of predefined templates or null
- `layout`: Valid React Grid Layout JSON schema
- `widgets`: Max 20 widgets per dashboard (enforced at API level)

---

### DashboardWidget

Individual widget on a dashboard, optionally linked to a saved Visualization.

```python
class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False)
    visualization_id = Column(Integer, ForeignKey("visualizations.id", ondelete="SET NULL"), nullable=True)
    
    # Widget configuration
    widget_type = Column(
        String(50),
        nullable=False,
        comment="chart|metric_card|feed_list|topic_cloud"
    )
    data_source = Column(String(50), nullable=False)
    filters = Column(JSON, nullable=False, default=dict)
    refresh_interval_seconds = Column(Integer, nullable=False, default=300)  # 5 min default
    
    # Position on dashboard grid
    position = Column(
        JSON,
        nullable=False,
        comment="{x, y, w, h} for React Grid Layout"
    )
    
    # Widget-specific configuration
    config = Column(
        JSON,
        nullable=False,
        default=dict,
        comment="Widget display options: {title, colors, size, etc.}"
    )
    
    # Relationships
    dashboard = relationship("Dashboard", back_populates="widgets")
    visualization = relationship("Visualization")
    
    def to_dict(self):
        return {
            "id": self.id,
            "dashboard_id": self.dashboard_id,
            "visualization_id": self.visualization_id,
            "widget_type": self.widget_type,
            "data_source": self.data_source,
            "filters": self.filters,
            "refresh_interval_seconds": self.refresh_interval_seconds,
            "position": self.position,
            "config": self.config,
        }
```

**Validation Rules**:
- `widget_type`: Must be one of allowed types
- `refresh_interval_seconds`: 60-3600 seconds (1 min - 1 hour)
- `position`: Valid grid position {x: int, y: int, w: int >= 2, h: int >= 2}

---

### Forecast

Time-series prediction for a topic with accuracy tracking.

```python
class Forecast(Base):
    __tablename__ = "forecasts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False, index=True)
    
    # Forecast parameters
    forecast_horizon_days = Column(Integer, nullable=False, comment="30|60|90")
    model_type = Column(String(50), nullable=False, default="prophet", comment="prophet|arima|lstm")
    
    # Training period
    training_period_start = Column(DateTime(timezone=True), nullable=False)
    training_period_end = Column(DateTime(timezone=True), nullable=False)
    
    # Predictions
    predictions = Column(
        JSON,
        nullable=False,
        comment="Array of {date, value, confidence_lower, confidence_upper}"
    )
    
    # Accuracy metrics (updated as actual data arrives)
    accuracy_metrics = Column(
        JSON,
        nullable=True,
        comment="{mape, mae, last_retrain_date, retrain_trigger_reason}"
    )
    
    # Model parameters for reproducibility
    model_params = Column(
        JSON,
        nullable=False,
        comment="Model hyperparameters and settings"
    )
    
    # Timestamps
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        Index('idx_forecast_topic_generated', 'topic_id', 'generated_at'),
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "topic_id": self.topic_id,
            "forecast_horizon_days": self.forecast_horizon_days,
            "model_type": self.model_type,
            "training_period_start": self.training_period_start.isoformat(),
            "training_period_end": self.training_period_end.isoformat(),
            "predictions": self.predictions,
            "accuracy_metrics": self.accuracy_metrics,
            "model_params": self.model_params,
            "generated_at": self.generated_at.isoformat(),
        }
```

**Validation Rules**:
- `forecast_horizon_days`: Must be 30, 60, or 90
- `predictions`: Array length must match horizon (30/60/90 elements)
- Training period: Must be >= 90 days (enforced at service level)
- Retraining trigger: MAPE >30% for 30-day forecasts

---

### APIKey

API authentication key for programmatic export access.

```python
class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(36), nullable=False, index=True)
    
    # API key (stored hashed with bcrypt)
    key_hash = Column(String(60), nullable=False, unique=True, comment="bcrypt hash of API key")
    
    # Key metadata
    name = Column(String(255), nullable=False, comment="User-defined key name")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    request_count = Column(Integer, nullable=False, default=0)
    is_revoked = Column(Boolean, nullable=False, default=False)
    
    # Relationship to usage logs
    usage_logs = relationship("APIUsage", back_populates="api_key")
    
    __table_args__ = (
        Index('idx_apikey_device_created', 'device_id', 'created_at'),
        Index('idx_apikey_hash', 'key_hash'),
    )
    
    def to_dict(self, include_key=False):
        result = {
            "id": self.id,
            "device_id": self.device_id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "request_count": self.request_count,
            "is_revoked": self.is_revoked,
        }
        # Never return key_hash, only return plaintext key on creation (not stored)
        return result
```

**Validation Rules**:
- `key_hash`: bcrypt hash of 32-character random key with `awf_` prefix
- `name`: 1-255 characters, non-empty
- `is_revoked`: Once revoked, cannot be un-revoked (immutable)

---

### ExportJob

Async export job for large dataset exports.

```python
class ExportJob(Base):
    __tablename__ = "export_jobs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(36), nullable=False, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True)
    
    # Export parameters
    entity_type = Column(String(50), nullable=False, comment="feeds|topics|articles")
    filters = Column(JSON, nullable=False, default=dict)
    format = Column(String(10), nullable=False, comment="csv|json|parquet")
    
    # Job status
    status = Column(
        String(20),
        nullable=False,
        default="pending",
        comment="pending|processing|completed|failed"
    )
    record_count = Column(Integer, nullable=True)
    file_url = Column(String(500), nullable=True, comment="S3/local URL for download")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    
    __table_args__ = (
        Index('idx_exportjob_device_status', 'device_id', 'status'),
        Index('idx_exportjob_created', 'created_at'),
    )
    
    def to_dict(self):
        return {
            "id": self.id,
            "device_id": self.device_id,
            "entity_type": self.entity_type,
            "filters": self.filters,
            "format": self.format,
            "status": self.status,
            "record_count": self.record_count,
            "file_url": self.file_url,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
        }
```

**Validation Rules**:
- `status`: Must follow state transition (pending → processing → completed/failed)
- `file_url`: Generated only on completion, includes signed URL with 24h expiration
- Cleanup: Delete completed jobs >7 days old (cron job)

---

### APIUsage

Tracks API export usage for rate limiting and analytics.

```python
class APIUsage(Base):
    __tablename__ = "api_usage"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Request details
    endpoint = Column(String(255), nullable=False)
    request_params = Column(JSON, nullable=False, default=dict)
    response_status = Column(Integer, nullable=False)
    records_exported = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=False)
    
    # Timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Relationship
    api_key = relationship("APIKey", back_populates="usage_logs")
    
    __table_args__ = (
        Index('idx_apiusage_key_timestamp', 'api_key_id', 'timestamp'),
    )
    
    def to_dict(self):
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
```

**Validation Rules**:
- Retention: Keep usage logs for 90 days for analytics, then delete
- Rate limiting: Count requests per api_key_id in last 1 hour (<= 100)

---

## Database Migration

### Alembic Migration Script

```python
"""Add visualization tables for Phase 006

Revision ID: 006_visualization
Revises: 005_nlp_features
Create Date: 2025-11-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '006_visualization'
down_revision = '005_nlp_features'  # Previous migration
branch_labels = None
depends_on = None

def upgrade():
    # Visualizations table
    op.create_table(
        'visualizations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('device_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('chart_type', sa.String(50), nullable=False),
        sa.Column('data_source', sa.String(50), nullable=False),
        sa.Column('filters', sa.JSON(), nullable=False),
        sa.Column('customization', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_viewed', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_viz_device_created', 'visualizations', ['device_id', 'created_at'])
    op.create_index('idx_viz_device_viewed', 'visualizations', ['device_id', 'last_viewed'])
    
    # Dashboards table
    op.create_table(
        'dashboards',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('device_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('template_id', sa.String(50), nullable=True),
        sa.Column('layout', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_dashboard_device_updated', 'dashboards', ['device_id', 'updated_at'])
    
    # Dashboard widgets table
    op.create_table(
        'dashboard_widgets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('dashboard_id', sa.Integer(), nullable=False),
        sa.Column('visualization_id', sa.Integer(), nullable=True),
        sa.Column('widget_type', sa.String(50), nullable=False),
        sa.Column('data_source', sa.String(50), nullable=False),
        sa.Column('filters', sa.JSON(), nullable=False),
        sa.Column('refresh_interval_seconds', sa.Integer(), nullable=False),
        sa.Column('position', sa.JSON(), nullable=False),
        sa.Column('config', sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['dashboard_id'], ['dashboards.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['visualization_id'], ['visualizations.id'], ondelete='SET NULL')
    )
    
    # Forecasts table
    op.create_table(
        'forecasts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('topic_id', sa.Integer(), nullable=False),
        sa.Column('forecast_horizon_days', sa.Integer(), nullable=False),
        sa.Column('model_type', sa.String(50), nullable=False),
        sa.Column('training_period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('training_period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('predictions', sa.JSON(), nullable=False),
        sa.Column('accuracy_metrics', sa.JSON(), nullable=True),
        sa.Column('model_params', sa.JSON(), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['topic_id'], ['topics.id'])
    )
    op.create_index('idx_forecast_topic_generated', 'forecasts', ['topic_id', 'generated_at'])
    
    # API keys table
    op.create_table(
        'api_keys',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('device_id', sa.String(36), nullable=False),
        sa.Column('key_hash', sa.String(60), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('request_count', sa.Integer(), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key_hash')
    )
    op.create_index('idx_apikey_device_created', 'api_keys', ['device_id', 'created_at'])
    op.create_index('idx_apikey_hash', 'api_keys', ['key_hash'])
    
    # Export jobs table
    op.create_table(
        'export_jobs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('device_id', sa.String(36), nullable=False),
        sa.Column('api_key_id', sa.Integer(), nullable=True),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('filters', sa.JSON(), nullable=False),
        sa.Column('format', sa.String(10), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('record_count', sa.Integer(), nullable=True),
        sa.Column('file_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ondelete='SET NULL')
    )
    op.create_index('idx_exportjob_device_status', 'export_jobs', ['device_id', 'status'])
    op.create_index('idx_exportjob_created', 'export_jobs', ['created_at'])
    
    # API usage table
    op.create_table(
        'api_usage',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('api_key_id', sa.Integer(), nullable=False),
        sa.Column('endpoint', sa.String(255), nullable=False),
        sa.Column('request_params', sa.JSON(), nullable=False),
        sa.Column('response_status', sa.Integer(), nullable=False),
        sa.Column('records_exported', sa.Integer(), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ondelete='CASCADE')
    )
    op.create_index('idx_apiusage_key_timestamp', 'api_usage', ['api_key_id', 'timestamp'])

def downgrade():
    op.drop_table('api_usage')
    op.drop_table('export_jobs')
    op.drop_table('api_keys')
    op.drop_table('forecasts')
    op.drop_table('dashboard_widgets')
    op.drop_table('dashboards')
    op.drop_table('visualizations')
```

---

## JSON Schema Examples

### Visualization Filters Schema

```json
{
  "type": "object",
  "properties": {
    "date_range": {
      "type": "object",
      "properties": {
        "start": {"type": "string", "format": "date"},
        "end": {"type": "string", "format": "date"}
      },
      "required": ["start", "end"]
    },
    "topic_ids": {"type": "array", "items": {"type": "integer"}},
    "feed_ids": {"type": "array", "items": {"type": "integer"}},
    "quality_threshold": {"type": "number", "minimum": 0, "maximum": 1}
  }
}
```

### Dashboard Layout Schema

```json
{
  "type": "object",
  "properties": {
    "lg": {"type": "array", "items": {"$ref": "#/definitions/gridItem"}},
    "md": {"type": "array", "items": {"$ref": "#/definitions/gridItem"}},
    "sm": {"type": "array", "items": {"$ref": "#/definitions/gridItem"}},
    "xs": {"type": "array", "items": {"$ref": "#/definitions/gridItem"}}
  },
  "definitions": {
    "gridItem": {
      "type": "object",
      "properties": {
        "i": {"type": "string"},
        "x": {"type": "integer", "minimum": 0},
        "y": {"type": "integer", "minimum": 0},
        "w": {"type": "integer", "minimum": 2, "maximum": 12},
        "h": {"type": "integer", "minimum": 2}
      },
      "required": ["i", "x", "y", "w", "h"]
    }
  }
}
```

---

## Data Lifecycle & Cleanup

### Retention Policies

| Entity | Retention | Cleanup Method |
|--------|-----------|----------------|
| Visualization | Indefinite (user data) | Delete device_id inactive >90 days |
| Dashboard | Indefinite (user data) | Delete device_id inactive >90 days |
| Forecast | Latest + 4 previous | Keep 5 most recent per topic |
| ExportJob | 7 days | Cron job deletes completed_at < now() - 7 days |
| APIUsage | 90 days | Cron job deletes timestamp < now() - 90 days |

### Cron Jobs

```bash
# Daily cleanup job (2 AM)
0 2 * * * python -m ai_web_feeds.visualization.cleanup --inactive-devices --old-exports --old-usage
```

---

## Summary

- **7 new tables** added to database schema
- **Device-based architecture**: All entities linked to `device_id` (localStorage UUID)
- **Foreign key relationships**: Dashboards → Widgets → Visualizations
- **JSON storage**: Flexible configuration without schema migrations
- **Indexes**: Optimized for common query patterns (device_id + timestamp)
- **Data lifecycle**: Automated cleanup of old exports and inactive devices
- **Migration**: Single Alembic script adds all tables atomically

**Next**: Generate API contracts in `/contracts/` directory.
