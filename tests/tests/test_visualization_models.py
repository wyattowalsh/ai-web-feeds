"""Unit tests for visualization SQLModel models."""

from datetime import UTC, datetime

import pytest
from ai_web_feeds.models import TopicNode
from ai_web_feeds.visualization.models import (
    APIKey,
    APIUsage,
    ChartType,
    Dashboard,
    DashboardWidget,
    DataSource,
    ExportFormat,
    ExportJob,
    ExportStatus,
    Forecast,
    ForecastModelType,
    Visualization,
    WidgetType,
)
from sqlmodel import Session, SQLModel, create_engine, select


@pytest.fixture
def db_session():
    """Create an isolated in-memory database session."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        yield session
    engine.dispose()


class TestVisualizationModel:
    """Test Visualization model behavior."""

    def test_create_visualization(self, db_session):
        """A visualization should persist and serialize correctly."""
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
        db_session.refresh(viz)

        assert viz.id is not None
        assert viz.last_viewed is not None
        assert viz.to_dict()["chart_type"] == "line"

    def test_visualization_defaults(self):
        """JSON configuration fields should default to empty dictionaries."""
        viz = Visualization(
            device_id="test-device",
            name="Test",
            chart_type=ChartType.BAR,
            data_source=DataSource.FEEDS,
        )

        assert viz.filters == {}
        assert viz.customization == {}


class TestDashboardModel:
    """Test Dashboard and DashboardWidget models."""

    def test_dashboard_with_widgets(self, db_session):
        """Dashboards should relate to widgets through SQLModel relationships."""
        viz = Visualization(
            device_id="test-device",
            name="Related Chart",
            chart_type=ChartType.PIE,
            data_source=DataSource.TOPICS,
        )
        dashboard = Dashboard(
            device_id="test-device",
            name="Dashboard with Widgets",
            layout={"lg": []},
        )
        db_session.add(viz)
        db_session.add(dashboard)
        db_session.commit()
        db_session.refresh(viz)
        db_session.refresh(dashboard)

        widget = DashboardWidget(
            dashboard_id=dashboard.id,
            visualization_id=viz.id,
            widget_type=WidgetType.CHART,
            data_source=DataSource.TOPICS,
            position={"x": 0, "y": 0, "w": 6, "h": 4},
            config={"title": "Topics"},
        )
        db_session.add(widget)
        db_session.commit()

        widgets = db_session.exec(
            select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard.id)
        ).all()

        assert len(widgets) == 1
        assert widgets[0].position["w"] == 6
        assert widgets[0].to_dict()["widget_type"] == "chart"


class TestForecastModel:
    """Test Forecast model behavior."""

    def test_create_forecast(self, db_session):
        """Forecasts should persist with prediction metadata."""
        topic = TopicNode(id="llm", label="LLM", facet="domain")
        db_session.add(topic)
        db_session.commit()

        forecast = Forecast(
            topic_id=topic.id,
            forecast_horizon_days=30,
            model_type=ForecastModelType.PROPHET,
            training_period_start=datetime(2024, 1, 1, tzinfo=UTC),
            training_period_end=datetime(2024, 1, 31, tzinfo=UTC),
            predictions={
                "items": [
                    {
                        "date": "2024-02-01",
                        "value": 100,
                        "confidence_lower": 90,
                        "confidence_upper": 110,
                    }
                ]
            },
            accuracy_metrics={"mae": 5.2, "rmse": 6.8},
            model_params={"seasonality": "daily"},
        )

        db_session.add(forecast)
        db_session.commit()
        db_session.refresh(forecast)

        assert forecast.id is not None
        assert forecast.forecast_horizon_days == 30
        assert forecast.to_dict()["model_type"] == "prophet"


class TestAPIKeyModel:
    """Test APIKey model behavior."""

    def test_create_api_key(self, db_session):
        """API keys should persist with non-revoked defaults."""
        api_key = APIKey(
            device_id="test-device",
            key_hash="hashed_key_value",
            name="Production Key",
        )

        db_session.add(api_key)
        db_session.commit()
        db_session.refresh(api_key)

        assert api_key.id is not None
        assert api_key.is_revoked is False
        assert api_key.last_used_at is None

    def test_revoke_api_key(self, db_session):
        """Revocation metadata should persist."""
        api_key = APIKey(
            device_id="test-device",
            key_hash="hashed_key",
            name="Test Key",
        )

        db_session.add(api_key)
        db_session.commit()

        api_key.is_revoked = True
        api_key.last_used_at = datetime.now(UTC)
        db_session.add(api_key)
        db_session.commit()

        assert api_key.is_revoked is True
        assert api_key.last_used_at is not None


class TestExportJobModel:
    """Test ExportJob model behavior."""

    def test_create_export_job(self, db_session):
        """Export jobs should persist basic request metadata."""
        job = ExportJob(
            device_id="test-device",
            entity_type="articles",
            format=ExportFormat.JSON,
        )

        db_session.add(job)
        db_session.commit()
        db_session.refresh(job)

        assert job.id is not None
        assert job.status == ExportStatus.PENDING
        assert job.retry_count == 0

    def test_export_job_success(self, db_session):
        """Completed export jobs should store file metadata."""
        job = ExportJob(
            device_id="test-device",
            entity_type="feeds",
            format=ExportFormat.CSV,
            status=ExportStatus.PENDING,
        )

        db_session.add(job)
        db_session.commit()

        job.status = ExportStatus.COMPLETED
        job.file_url = "/exports/chart_123.csv"
        job.completed_at = datetime.now(UTC)
        db_session.add(job)
        db_session.commit()

        assert job.status == ExportStatus.COMPLETED
        assert job.file_url == "/exports/chart_123.csv"


class TestAPIUsageModel:
    """Test APIUsage tracking."""

    def test_create_api_usage(self, db_session):
        """Usage logs should relate back to API keys."""
        api_key = APIKey(
            device_id="test-device",
            key_hash="hashed_key_value",
            name="Usage Key",
        )
        db_session.add(api_key)
        db_session.commit()
        db_session.refresh(api_key)

        usage = APIUsage(
            api_key_id=api_key.id,
            endpoint="/api/export",
            request_params={"entity_type": "articles"},
            response_status=200,
            records_exported=20,
            response_time_ms=150,
        )
        db_session.add(usage)
        db_session.commit()
        db_session.refresh(usage)

        assert usage.id is not None
        assert usage.to_dict()["response_status"] == 200
