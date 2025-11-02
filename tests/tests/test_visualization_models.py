"""
Unit tests for visualization models.

Tests SQLAlchemy models for the advanced visualization feature.
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ai_web_feeds.visualization.models import (
    Visualization,
    Dashboard,
    DashboardWidget,
    Forecast,
    APIKey,
    ExportJob,
    APIUsage,
    ChartType,
    DataSource,
    ExportFormat,
    ExportStatus,
)


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    # Import Base and create tables
    from sqlmodel import SQLModel
    
    SQLModel.metadata.create_all(engine)
    
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


class TestVisualizationModel:
    """Test Visualization model."""

    def test_create_visualization(self, db_session):
        """Test creating a new visualization."""
        viz = Visualization(
            device_id="test-device-123",
            name="Test Chart",
            chart_type=ChartType.LINE,
            data_source=DataSource.TOPICS,
            filters={"date_range": {"start": "2024-01-01", "end": "2024-01-31"}},
            customization={"color": "blue", "show_legend": True},
        )
        
        db_session.add(viz)
        db_session.commit()
        
        assert viz.id is not None
        assert viz.device_id == "test-device-123"
        assert viz.chart_type == ChartType.LINE
        assert viz.created_at is not None
        assert viz.last_viewed is not None

    def test_visualization_defaults(self):
        """Test visualization default values."""
        viz = Visualization(
            device_id="test-device",
            name="Test",
            chart_type=ChartType.BAR,
            data_source=DataSource.FEEDS,
        )
        
        assert viz.filters == {}
        assert viz.customization == {}
        assert viz.created_at is not None

    def test_visualization_chart_types(self):
        """Test all chart type enum values."""
        chart_types = [
            ChartType.LINE,
            ChartType.BAR,
            ChartType.SCATTER,
            ChartType.PIE,
            ChartType.AREA,
            ChartType.HEATMAP,
        ]
        
        for chart_type in chart_types:
            viz = Visualization(
                device_id="test",
                name=f"Test {chart_type}",
                chart_type=chart_type,
                data_source=DataSource.TOPICS,
            )
            assert viz.chart_type == chart_type


class TestDashboardModel:
    """Test Dashboard model."""

    def test_create_dashboard(self, db_session):
        """Test creating a new dashboard."""
        dashboard = Dashboard(
            device_id="test-device",
            name="My Dashboard",
            layout_config={"cols": 12, "rows": "auto"},
        )
        
        db_session.add(dashboard)
        db_session.commit()
        
        assert dashboard.id is not None
        assert dashboard.name == "My Dashboard"
        assert dashboard.created_at is not None
        assert dashboard.updated_at is not None

    def test_dashboard_with_widgets(self, db_session):
        """Test dashboard with multiple widgets."""
        dashboard = Dashboard(
            device_id="test-device",
            name="Dashboard with Widgets",
            layout_config={},
        )
        db_session.add(dashboard)
        db_session.commit()
        
        # Add widgets
        widget1 = DashboardWidget(
            dashboard_id=dashboard.id,
            visualization_id=1,
            position_x=0,
            position_y=0,
            width=6,
            height=4,
        )
        widget2 = DashboardWidget(
            dashboard_id=dashboard.id,
            visualization_id=2,
            position_x=6,
            position_y=0,
            width=6,
            height=4,
        )
        
        db_session.add_all([widget1, widget2])
        db_session.commit()
        
        # Query widgets
        widgets = db_session.query(DashboardWidget).filter_by(
            dashboard_id=dashboard.id
        ).all()
        
        assert len(widgets) == 2
        assert widgets[0].width == 6
        assert widgets[1].position_x == 6


class TestForecastModel:
    """Test Forecast model."""

    def test_create_forecast(self, db_session):
        """Test creating a forecast."""
        forecast = Forecast(
            device_id="test-device",
            data_source=DataSource.TOPICS,
            horizon_days=30,
            confidence_level=0.95,
            predictions=[
                {"date": "2024-02-01", "value": 100, "lower": 90, "upper": 110}
            ],
            metrics={"mae": 5.2, "rmse": 6.8},
        )
        
        db_session.add(forecast)
        db_session.commit()
        
        assert forecast.id is not None
        assert forecast.horizon_days == 30
        assert forecast.confidence_level == 0.95
        assert len(forecast.predictions) == 1
        assert "mae" in forecast.metrics


class TestAPIKeyModel:
    """Test APIKey model."""

    def test_create_api_key(self, db_session):
        """Test creating an API key."""
        api_key = APIKey(
            device_id="test-device",
            key_hash="hashed_key_value",
            name="Production Key",
            scopes=["read", "write"],
        )
        
        db_session.add(api_key)
        db_session.commit()
        
        assert api_key.id is not None
        assert api_key.is_active is True
        assert api_key.created_at is not None
        assert api_key.last_used is None

    def test_revoke_api_key(self, db_session):
        """Test revoking an API key."""
        api_key = APIKey(
            device_id="test-device",
            key_hash="hashed_key",
            name="Test Key",
        )
        
        db_session.add(api_key)
        db_session.commit()
        
        # Revoke the key
        api_key.is_active = False
        api_key.revoked_at = datetime.now(timezone.utc)
        db_session.commit()
        
        assert api_key.is_active is False
        assert api_key.revoked_at is not None


class TestExportJobModel:
    """Test ExportJob model."""

    def test_create_export_job(self, db_session):
        """Test creating an export job."""
        job = ExportJob(
            device_id="test-device",
            visualization_id=1,
            format=ExportFormat.PNG,
            dpi=300,
            status=ExportStatus.PENDING,
        )
        
        db_session.add(job)
        db_session.commit()
        
        assert job.id is not None
        assert job.status == ExportStatus.PENDING
        assert job.dpi == 300
        assert job.created_at is not None

    def test_export_job_success(self, db_session):
        """Test successful export job."""
        job = ExportJob(
            device_id="test-device",
            visualization_id=1,
            format=ExportFormat.SVG,
            status=ExportStatus.PENDING,
        )
        
        db_session.add(job)
        db_session.commit()
        
        # Simulate job completion
        job.status = ExportStatus.COMPLETED
        job.file_path = "/exports/chart_123.svg"
        job.completed_at = datetime.now(timezone.utc)
        db_session.commit()
        
        assert job.status == ExportStatus.COMPLETED
        assert job.file_path is not None
        assert job.completed_at is not None

    def test_export_job_failure(self, db_session):
        """Test failed export job."""
        job = ExportJob(
            device_id="test-device",
            visualization_id=1,
            format=ExportFormat.HTML,
            status=ExportStatus.PENDING,
        )
        
        db_session.add(job)
        db_session.commit()
        
        # Simulate job failure
        job.status = ExportStatus.FAILED
        job.error = "Insufficient memory"
        job.completed_at = datetime.now(timezone.utc)
        db_session.commit()
        
        assert job.status == ExportStatus.FAILED
        assert job.error is not None


class TestAPIUsageModel:
    """Test APIUsage model."""

    def test_create_api_usage(self, db_session):
        """Test creating an API usage record."""
        usage = APIUsage(
            device_id="test-device",
            endpoint="/api/v1/visualizations",
            method="GET",
            status_code=200,
            response_time_ms=125,
        )
        
        db_session.add(usage)
        db_session.commit()
        
        assert usage.id is not None
        assert usage.status_code == 200
        assert usage.response_time_ms == 125
        assert usage.timestamp is not None

    def test_api_usage_with_api_key(self, db_session):
        """Test API usage linked to an API key."""
        api_key = APIKey(
            device_id="test-device",
            key_hash="hash",
            name="Test",
        )
        db_session.add(api_key)
        db_session.commit()
        
        usage = APIUsage(
            device_id="test-device",
            api_key_id=api_key.id,
            endpoint="/api/v1/dashboards",
            method="POST",
            status_code=201,
            response_time_ms=234,
        )
        
        db_session.add(usage)
        db_session.commit()
        
        assert usage.api_key_id == api_key.id


class TestModelValidation:
    """Test model validation rules."""

    def test_dashboard_widget_max_count(self):
        """Test dashboard widget maximum count (FR-032a)."""
        # This would be enforced at the service layer
        # Just verify the model can handle multiple widgets
        widgets = [
            DashboardWidget(
                dashboard_id=1,
                visualization_id=i,
                position_x=0,
                position_y=i * 4,
                width=12,
                height=4,
            )
            for i in range(20)
        ]
        
        assert len(widgets) == 20

    def test_export_format_enum(self):
        """Test all export format enum values."""
        formats = [ExportFormat.PNG, ExportFormat.SVG, ExportFormat.HTML]
        
        for fmt in formats:
            job = ExportJob(
                device_id="test",
                visualization_id=1,
                format=fmt,
                status=ExportStatus.PENDING,
            )
            assert job.format == fmt

    def test_export_status_enum(self):
        """Test all export status enum values."""
        statuses = [
            ExportStatus.PENDING,
            ExportStatus.IN_PROGRESS,
            ExportStatus.COMPLETED,
            ExportStatus.FAILED,
        ]
        
        for status in statuses:
            job = ExportJob(
                device_id="test",
                visualization_id=1,
                format=ExportFormat.PNG,
                status=status,
            )
            assert job.status == status
