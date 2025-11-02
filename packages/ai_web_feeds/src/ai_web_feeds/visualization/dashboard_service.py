"""Dashboard service with business logic.

Implements T051: Dashboard layout management, widget data fetching
"""

from datetime import datetime
from typing import Any, Optional

from loguru import logger
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError

from ai_web_feeds.storage import get_session
from ai_web_feeds.visualization.models import (
    Dashboard,
    DashboardWidget,
    DataSource,
    WidgetType,
)
from ai_web_feeds.visualization.validators import (
    DashboardValidator,
    ValidationError,
)


class DashboardService:
    """Service for managing dashboards."""

    def __init__(self):
        """Initialize service."""
        self.validator = DashboardValidator()

    async def list_dashboards(
        self,
        device_id: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List all dashboards for a device.

        Args:
            device_id: Device identifier
            limit: Maximum results

        Returns:
            List of dashboard records
        """
        try:
            with get_session() as session:
                statement = (
                    select(Dashboard)
                    .where(Dashboard.device_id == device_id)
                    .order_by(Dashboard.updated_at.desc())
                    .limit(limit)
                )

                result = session.execute(statement)
                dashboards = result.scalars().all()

                return [dashboard.to_dict() for dashboard in dashboards]
        except Exception as e:
            logger.error(f"Error listing dashboards: {e}")
            return []

    async def create_dashboard(
        self,
        device_id: str,
        name: str,
        description: Optional[str] = None,
        template_id: Optional[str] = None,
        layout: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Create a new dashboard.

        Args:
            device_id: Device identifier
            name: Dashboard name
            description: Dashboard description (optional)
            template_id: Template to use (optional)
            layout: Grid layout configuration (optional)

        Returns:
            Created dashboard record

        Raises:
            ValidationError: If validation fails
        """
        try:
            with get_session() as session:
                dashboard = Dashboard(
                    device_id=device_id,
                    name=name,
                    description=description,
                    template_id=template_id,
                    layout=layout or {},
                    version=1,
                )

                session.add(dashboard)
                session.commit()
                session.refresh(dashboard)

                logger.info(f"Created dashboard {dashboard.id} for device {device_id[:8]}")
                return dashboard.to_dict()
        except IntegrityError as e:
            logger.error(f"Integrity error creating dashboard: {e}")
            raise ValidationError("Failed to create dashboard")
        except Exception as e:
            logger.error(f"Error creating dashboard: {e}")
            raise

    async def get_dashboard(
        self,
        dashboard_id: int,
        device_id: str,
        include_widgets: bool = True,
    ) -> Optional[dict[str, Any]]:
        """Get a specific dashboard.

        Args:
            dashboard_id: Dashboard ID
            device_id: Device identifier (for access control)
            include_widgets: Whether to include widgets

        Returns:
            Dashboard record or None if not found
        """
        try:
            with get_session() as session:
                statement = select(Dashboard).where(
                    Dashboard.id == dashboard_id,
                    Dashboard.device_id == device_id,
                )

                result = session.execute(statement)
                dashboard = result.scalar_one_or_none()

                if not dashboard:
                    return None

                return dashboard.to_dict(include_widgets=include_widgets)
        except Exception as e:
            logger.error(f"Error getting dashboard {dashboard_id}: {e}")
            return None

    async def update_dashboard(
        self,
        dashboard_id: int,
        device_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        layout: Optional[dict[str, Any]] = None,
        expected_version: Optional[int] = None,
    ) -> Optional[dict[str, Any]]:
        """Update a dashboard with optimistic locking.

        Args:
            dashboard_id: Dashboard ID
            device_id: Device identifier (for access control)
            name: New name (optional)
            description: New description (optional)
            layout: New layout (optional)
            expected_version: Expected version for optimistic locking

        Returns:
            Updated dashboard record or None if not found

        Raises:
            ValidationError: If version mismatch (concurrent update)
        """
        try:
            with get_session() as session:
                statement = select(Dashboard).where(
                    Dashboard.id == dashboard_id,
                    Dashboard.device_id == device_id,
                )

                result = session.execute(statement)
                dashboard = result.scalar_one_or_none()

                if not dashboard:
                    return None

                # Check version for optimistic locking
                if expected_version is not None:
                    if dashboard.version != expected_version:
                        raise ValidationError(
                            f"Version mismatch: expected {expected_version}, "
                            f"current {dashboard.version}. Dashboard was modified elsewhere."
                        )

                # Update fields
                if name is not None:
                    dashboard.name = name

                if description is not None:
                    dashboard.description = description

                if layout is not None:
                    dashboard.layout = layout

                # Increment version
                dashboard.version += 1
                dashboard.updated_at = datetime.utcnow()

                session.commit()
                session.refresh(dashboard)

                logger.info(f"Updated dashboard {dashboard_id} to version {dashboard.version}")
                return dashboard.to_dict()
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error updating dashboard {dashboard_id}: {e}")
            return None

    async def delete_dashboard(
        self,
        dashboard_id: int,
        device_id: str,
    ) -> bool:
        """Delete a dashboard and all its widgets.

        Args:
            dashboard_id: Dashboard ID
            device_id: Device identifier (for access control)

        Returns:
            True if deleted successfully
        """
        try:
            with get_session() as session:
                statement = delete(Dashboard).where(
                    Dashboard.id == dashboard_id,
                    Dashboard.device_id == device_id,
                )

                result = session.execute(statement)
                session.commit()

                deleted = result.rowcount > 0

                if deleted:
                    logger.info(f"Deleted dashboard {dashboard_id}")
                else:
                    logger.warning(f"Dashboard {dashboard_id} not found")

                return deleted
        except Exception as e:
            logger.error(f"Error deleting dashboard {dashboard_id}: {e}")
            return False

    async def add_widget(
        self,
        dashboard_id: int,
        device_id: str,
        widget_type: WidgetType,
        data_source: DataSource,
        filters: dict[str, Any],
        refresh_interval_seconds: int,
        position: dict[str, int],
        config: dict[str, Any],
        visualization_id: Optional[int] = None,
    ) -> dict[str, Any]:
        """Add a widget to a dashboard.

        Args:
            dashboard_id: Dashboard ID
            device_id: Device identifier (for access control)
            widget_type: Type of widget
            data_source: Data source
            filters: Query filters
            refresh_interval_seconds: Refresh interval
            position: Grid position {x, y, w, h}
            config: Widget configuration
            visualization_id: Optional linked visualization

        Returns:
            Created widget record

        Raises:
            ValidationError: If validation fails
        """
        # Validate position
        self.validator.validate_widget_position(position)

        try:
            with get_session() as session:
                # Verify dashboard exists and belongs to device
                dashboard_stmt = select(Dashboard).where(
                    Dashboard.id == dashboard_id,
                    Dashboard.device_id == device_id,
                )
                dashboard = session.execute(dashboard_stmt).scalar_one_or_none()

                if not dashboard:
                    raise ValidationError("Dashboard not found")

                # Check widget count limit
                widget_count = len(dashboard.widgets)
                self.validator.validate_widget_count(widget_count + 1)

                # Create widget
                widget = DashboardWidget(
                    dashboard_id=dashboard_id,
                    visualization_id=visualization_id,
                    widget_type=widget_type,
                    data_source=data_source,
                    filters=filters,
                    refresh_interval_seconds=refresh_interval_seconds,
                    position=position,
                    config=config,
                )

                session.add(widget)

                # Update dashboard version and timestamp
                dashboard.version += 1
                dashboard.updated_at = datetime.utcnow()

                session.commit()
                session.refresh(widget)

                logger.info(f"Added widget {widget.id} to dashboard {dashboard_id}")
                return widget.to_dict()
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error adding widget to dashboard {dashboard_id}: {e}")
            raise
