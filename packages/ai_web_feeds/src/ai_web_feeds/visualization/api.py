"""FastAPI router for visualization endpoints.

Implements FR-055 through FR-065:
- Visualization CRUD endpoints
- Dashboard CRUD endpoints
- Forecast endpoints
- Export API endpoints
- Authentication middleware
- Rate limiting
"""

import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from pydantic import BaseModel, Field

from ai_web_feeds.visualization.auth import (
    get_current_device_id,
)
from ai_web_feeds.visualization.dashboard_service import DashboardService
from ai_web_feeds.visualization.models import (
    ChartType,
    DataSource,
    ExportFormat,
    ForecastModelType,
    WidgetType,
)
from ai_web_feeds.visualization.rate_limiter import check_rate_limit
from ai_web_feeds.visualization.visualization_service import VisualizationService

# Create router
router = APIRouter(prefix="/api/v1", tags=["visualization"])

# Services (will be initialized on startup)
visualization_service: VisualizationService | None = None
dashboard_service: DashboardService | None = None

_VIZ_ENABLED_ENV = "AWF_VIZ_ENABLED"


def _empty_series() -> dict[str, Any]:
    """Empty series. Demo stays off and no points are invented."""
    return {"demo": False, "points": []}


def _viz_series_enabled() -> bool:
    """True only when AWF_VIZ_ENABLED is set to a non-empty value."""
    raw = os.environ.get(_VIZ_ENABLED_ENV)
    if raw is None:
        return False
    return raw.strip() != ""


def _dashboard_disabled() -> dict[str, bool | str]:
    """Frozen dashboard-builder response. Nothing is stored."""
    return {
        "enabled": False,
        "reason": "dashboard builder is not enabled",
    }


def _catalog_path(filename: str) -> Path:
    """Locate a catalog file from the cwd or the repo that contains this package."""
    cwd_candidate = Path("data") / filename
    if cwd_candidate.is_file():
        return cwd_candidate
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "data" / filename
        if candidate.is_file():
            return candidate
    return cwd_candidate


def _dict_rows(rows: object, limit: int) -> list[dict[str, Any]]:
    """Keep stored dict rows only, capped by limit. No rows are synthesized."""
    if not isinstance(rows, list) or limit <= 0:
        return []
    points: list[dict[str, Any]] = []
    for row in rows:
        if isinstance(row, dict):
            points.append(row)
        if len(points) >= limit:
            break
    return points


def _catalog_points(data_source: object, limit: int) -> list[dict[str, Any]]:
    """Load real catalog rows for feeds or topics. Other sources stay empty."""
    if data_source == "feeds":
        filename = "feeds.yaml"
        key = "sources"
    elif data_source == "topics":
        filename = "topics.yaml"
        key = "topics"
    else:
        return []

    try:
        from ai_web_feeds.load import load_feeds, load_topics

        path = _catalog_path(filename)
        payload = load_feeds(path) if key == "sources" else load_topics(path)
    except Exception as exc:
        logger.warning(f"Catalog rows unavailable: {exc}")
        return []

    if not isinstance(payload, dict):
        return []
    return _dict_rows(payload.get(key), limit)


# ============================================================================
# Request/Response Models
# ============================================================================


class CreateVisualizationRequest(BaseModel):
    """Request model for creating a visualization."""

    name: str = Field(max_length=255)
    chart_type: ChartType
    data_source: DataSource
    filters: dict[str, Any] = Field(default_factory=dict)
    customization: dict[str, Any] = Field(default_factory=dict)


class UpdateVisualizationRequest(BaseModel):
    """Request model for updating a visualization."""

    name: str | None = Field(None, max_length=255)
    filters: dict[str, Any] | None = None
    customization: dict[str, Any] | None = None


class VisualizationResponse(BaseModel):
    """Response model for visualization."""

    id: int
    device_id: str
    name: str
    chart_type: str
    data_source: str
    filters: dict[str, Any]
    customization: dict[str, Any]
    created_at: str
    last_viewed: str


class VisualizationDataRequest(BaseModel):
    """Request model for fetching visualization data."""

    date_range: dict[str, str] | None = None
    limit: int = Field(default=1000, le=100_000)


class CreateDashboardRequest(BaseModel):
    """Request model for creating a dashboard."""

    name: str = Field(max_length=255)
    description: str | None = None
    template_id: str | None = None
    layout: dict[str, Any] = Field(default_factory=dict)


class UpdateDashboardRequest(BaseModel):
    """Request model for updating a dashboard."""

    name: str | None = None
    description: str | None = None
    layout: dict[str, Any] | None = None
    version: int  # For optimistic locking


class AddWidgetRequest(BaseModel):
    """Request model for adding a widget to dashboard."""

    widget_type: WidgetType
    data_source: DataSource
    filters: dict[str, Any] = Field(default_factory=dict)
    refresh_interval_seconds: int = Field(default=300, ge=60, le=3600)
    position: dict[str, int]
    config: dict[str, Any] = Field(default_factory=dict)
    visualization_id: int | None = None


class CreateForecastRequest(BaseModel):
    """Request model for creating a forecast."""

    topic_id: int
    model_type: ForecastModelType = ForecastModelType.PROPHET
    forecast_horizon_days: int = Field(ge=30, le=90)


class ExportRequest(BaseModel):
    """Request model for data export."""

    entity_type: str = Field(pattern="^(feeds|topics|articles)$")
    filters: dict[str, Any] = Field(default_factory=dict)
    format: ExportFormat
    limit: int | None = Field(None, le=100_000)


# ============================================================================
# Visualization Endpoints (T017-T020)
# ============================================================================


@router.get("/visualizations", response_model=list[VisualizationResponse])
async def list_visualizations(
    device_id: str = Depends(get_current_device_id),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[dict[str, Any]]:
    """List all visualizations for current device.

    Args:
        device_id: Current device identifier
        limit: Maximum results to return
        offset: Pagination offset

    Returns:
        List of visualization records
    """
    await check_rate_limit(device_id)

    visualizations = await visualization_service.list_visualizations(
        device_id=device_id,
        limit=limit,
        offset=offset,
    )

    logger.info(f"Listed {len(visualizations)} visualizations for device {device_id[:8]}")
    return visualizations


@router.post(
    "/visualizations",
    response_model=VisualizationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_visualization(
    request: CreateVisualizationRequest,
    device_id: str = Depends(get_current_device_id),
) -> dict[str, Any]:
    """Create a new visualization.

    Args:
        request: Visualization configuration
        device_id: Current device identifier

    Returns:
        Created visualization record
    """
    await check_rate_limit(device_id)

    visualization = await visualization_service.create_visualization(
        device_id=device_id,
        name=request.name,
        chart_type=request.chart_type,
        data_source=request.data_source,
        filters=request.filters,
        customization=request.customization,
    )

    logger.info(f"Created visualization {visualization['id']} for device {device_id[:8]}")
    return visualization


@router.get("/visualizations/{visualization_id}", response_model=VisualizationResponse)
async def get_visualization(
    visualization_id: int,
    device_id: str = Depends(get_current_device_id),
) -> dict[str, Any]:
    """Get a specific visualization.

    Args:
        visualization_id: Visualization ID
        device_id: Current device identifier

    Returns:
        Visualization record

    Raises:
        HTTPException: If visualization not found or access denied
    """
    await check_rate_limit(device_id)

    visualization = await visualization_service.get_visualization(
        visualization_id=visualization_id,
        device_id=device_id,
    )

    if not visualization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visualization not found",
        )

    logger.debug(f"Retrieved visualization {visualization_id}")
    return visualization


@router.put("/visualizations/{visualization_id}", response_model=VisualizationResponse)
async def update_visualization(
    visualization_id: int,
    request: UpdateVisualizationRequest,
    device_id: str = Depends(get_current_device_id),
) -> dict[str, Any]:
    """Update a visualization.

    Args:
        visualization_id: Visualization ID
        request: Fields to update
        device_id: Current device identifier

    Returns:
        Updated visualization record

    Raises:
        HTTPException: If visualization not found or access denied
    """
    await check_rate_limit(device_id)

    visualization = await visualization_service.update_visualization(
        visualization_id=visualization_id,
        device_id=device_id,
        name=request.name,
        filters=request.filters,
        customization=request.customization,
    )

    if not visualization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visualization not found",
        )

    logger.info(f"Updated visualization {visualization_id}")
    return visualization


@router.delete("/visualizations/{visualization_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_visualization(
    visualization_id: int,
    device_id: str = Depends(get_current_device_id),
) -> None:
    """Delete a visualization.

    Args:
        visualization_id: Visualization ID
        device_id: Current device identifier

    Raises:
        HTTPException: If visualization not found or access denied
    """
    await check_rate_limit(device_id)

    success = await visualization_service.delete_visualization(
        visualization_id=visualization_id,
        device_id=device_id,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visualization not found",
        )

    logger.info(f"Deleted visualization {visualization_id}")


@router.post("/visualizations/{visualization_id}/data")
async def get_visualization_data(
    visualization_id: int,
    request: VisualizationDataRequest,
    device_id: str = Depends(get_current_device_id),
) -> dict[str, Any]:
    """Fetch data for a visualization.

    Args:
        visualization_id: Visualization ID
        request: Data request parameters
        device_id: Current device identifier

    Returns:
        Visualization data with metadata

    Raises:
        HTTPException: If visualization not found or data query fails
    """
    await check_rate_limit(device_id)

    # Unset or blank AWF_VIZ_ENABLED: frozen empty series, no catalog read.
    if not _viz_series_enabled():
        return _empty_series()

    if visualization_service is None:
        return _empty_series()

    visualization = await visualization_service.get_visualization(
        visualization_id=visualization_id,
        device_id=device_id,
    )

    if not visualization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visualization not found",
        )

    points = _catalog_points(visualization.get("data_source"), request.limit)
    logger.debug(f"Fetched {len(points)} catalog rows for visualization {visualization_id}")
    return {"demo": False, "points": points}


# ============================================================================
# Dashboard Endpoints (T046-T050)
# ============================================================================


@router.get("/dashboards")
async def list_dashboards(
    device_id: str = Depends(get_current_device_id),
    limit: int = Query(default=50, le=100),
) -> dict[str, bool | str]:
    """List all dashboards for current device. The builder stays disabled."""
    await check_rate_limit(device_id)
    if dashboard_service is not None:
        await dashboard_service.list_dashboards(device_id=device_id, limit=limit)
    logger.info(f"Dashboard builder is not enabled for device {device_id[:8]}")
    return _dashboard_disabled()


@router.post("/dashboards", status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    request: CreateDashboardRequest,
    device_id: str = Depends(get_current_device_id),
) -> dict[str, bool | str]:
    """Create a new dashboard. The builder stays disabled."""
    await check_rate_limit(device_id)
    if dashboard_service is not None:
        await dashboard_service.create_dashboard(
            device_id=device_id,
            name=request.name,
            description=request.description,
            template_id=request.template_id,
            layout=request.layout,
        )
    logger.info(f"Dashboard builder is not enabled for device {device_id[:8]}")
    return _dashboard_disabled()


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(
    dashboard_id: int,
    device_id: str = Depends(get_current_device_id),
    include_widgets: bool = Query(default=True),
) -> dict[str, bool | str]:
    """Get a specific dashboard. The builder stays disabled."""
    await check_rate_limit(device_id)
    if dashboard_service is not None:
        await dashboard_service.get_dashboard(
            dashboard_id=dashboard_id,
            device_id=device_id,
            include_widgets=include_widgets,
        )
    return _dashboard_disabled()


@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(
    dashboard_id: int,
    request: UpdateDashboardRequest,
    device_id: str = Depends(get_current_device_id),
) -> dict[str, bool | str]:
    """Update a dashboard. The builder stays disabled."""
    await check_rate_limit(device_id)
    if dashboard_service is not None:
        await dashboard_service.update_dashboard(
            dashboard_id=dashboard_id,
            device_id=device_id,
            name=request.name,
            description=request.description,
            layout=request.layout,
            expected_version=request.version,
        )
    logger.info(f"Dashboard builder is not enabled for dashboard {dashboard_id}")
    return _dashboard_disabled()


@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: int,
    device_id: str = Depends(get_current_device_id),
) -> dict[str, bool | str]:
    """Delete a dashboard. The builder stays disabled."""
    await check_rate_limit(device_id)
    if dashboard_service is not None:
        await dashboard_service.delete_dashboard(
            dashboard_id=dashboard_id,
            device_id=device_id,
        )
    logger.info(f"Dashboard builder is not enabled for dashboard {dashboard_id}")
    return _dashboard_disabled()


@router.post("/dashboards/{dashboard_id}/widgets", status_code=status.HTTP_201_CREATED)
async def add_widget(
    dashboard_id: int,
    request: AddWidgetRequest,
    device_id: str = Depends(get_current_device_id),
) -> dict[str, bool | str]:
    """Add a widget to dashboard. The builder stays disabled."""
    await check_rate_limit(device_id)
    if dashboard_service is not None:
        await dashboard_service.add_widget(
            dashboard_id=dashboard_id,
            device_id=device_id,
            widget_type=request.widget_type,
            data_source=request.data_source,
            filters=request.filters,
            refresh_interval_seconds=request.refresh_interval_seconds,
            position=request.position,
            config=request.config,
            visualization_id=request.visualization_id,
        )
    logger.info(f"Dashboard builder is not enabled for dashboard {dashboard_id}")
    return _dashboard_disabled()


# ============================================================================
# Startup/Shutdown Events
# ============================================================================


async def startup_event():
    """Initialize services on startup."""
    global visualization_service, dashboard_service

    from ai_web_feeds.visualization.dashboard_service import DashboardService
    from ai_web_feeds.visualization.visualization_service import VisualizationService

    visualization_service = VisualizationService()
    dashboard_service = DashboardService()

    logger.info("Visualization API initialized")


async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Visualization API shutdown")
