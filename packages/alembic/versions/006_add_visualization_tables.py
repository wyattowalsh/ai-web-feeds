"""Add visualization tables for Phase 006.

Revision ID: 006_visualization
Revises: (previous migration ID - to be filled)
Create Date: 2025-11-02
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic
revision = "006_visualization"
down_revision = None  # Update with previous migration ID
branch_labels = None
depends_on = None


def upgrade():
    """Create all visualization tables."""

    # Visualizations table
    op.create_table(
        "visualizations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("chart_type", sa.String(50), nullable=False),
        sa.Column("data_source", sa.String(50), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("customization", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "last_viewed",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_viz_device_created",
        "visualizations",
        ["device_id", "created_at"],
    )
    op.create_index(
        "idx_viz_device_viewed",
        "visualizations",
        ["device_id", "last_viewed"],
    )

    # Dashboards table
    op.create_table(
        "dashboards",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("template_id", sa.String(50), nullable=True),
        sa.Column("layout", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_dashboard_device_updated",
        "dashboards",
        ["device_id", "updated_at"],
    )

    # Dashboard widgets table
    op.create_table(
        "dashboard_widgets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("dashboard_id", sa.Integer(), nullable=False),
        sa.Column("visualization_id", sa.Integer(), nullable=True),
        sa.Column("widget_type", sa.String(50), nullable=False),
        sa.Column("data_source", sa.String(50), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("refresh_interval_seconds", sa.Integer(), nullable=False),
        sa.Column("position", sa.JSON(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["dashboard_id"],
            ["dashboards.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["visualization_id"],
            ["visualizations.id"],
            ondelete="SET NULL",
        ),
    )

    # Forecasts table
    op.create_table(
        "forecasts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.Column("forecast_horizon_days", sa.Integer(), nullable=False),
        sa.Column("model_type", sa.String(50), nullable=False),
        sa.Column(
            "training_period_start",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "training_period_end",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column("predictions", sa.JSON(), nullable=False),
        sa.Column("accuracy_metrics", sa.JSON(), nullable=True),
        sa.Column("model_params", sa.JSON(), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_forecast_topic_generated",
        "forecasts",
        ["topic_id", "generated_at"],
    )

    # API keys table
    op.create_table(
        "api_keys",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.String(36), nullable=False),
        sa.Column("key_hash", sa.String(60), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_hash"),
    )
    op.create_index(
        "idx_apikey_device_created",
        "api_keys",
        ["device_id", "created_at"],
    )
    op.create_index("idx_apikey_hash", "api_keys", ["key_hash"])

    # Export jobs table
    op.create_table(
        "export_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.String(36), nullable=False),
        sa.Column("api_key_id", sa.Integer(), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("format", sa.String(10), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("record_count", sa.Integer(), nullable=True),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["api_key_id"],
            ["api_keys.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "idx_exportjob_device_status",
        "export_jobs",
        ["device_id", "status"],
    )
    op.create_index("idx_exportjob_created", "export_jobs", ["created_at"])

    # API usage table
    op.create_table(
        "api_usage",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("api_key_id", sa.Integer(), nullable=False),
        sa.Column("endpoint", sa.String(255), nullable=False),
        sa.Column("request_params", sa.JSON(), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=False),
        sa.Column("records_exported", sa.Integer(), nullable=True),
        sa.Column("response_time_ms", sa.Integer(), nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["api_key_id"],
            ["api_keys.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "idx_apiusage_key_timestamp",
        "api_usage",
        ["api_key_id", "timestamp"],
    )


def downgrade():
    """Drop all visualization tables."""
    op.drop_table("api_usage")
    op.drop_table("export_jobs")
    op.drop_table("api_keys")
    op.drop_table("forecasts")
    op.drop_table("dashboard_widgets")
    op.drop_table("dashboards")
    op.drop_table("visualizations")
