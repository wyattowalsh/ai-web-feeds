"""Dashboard builder stays disabled.

Public operations return one frozen payload. They do not create, store,
or return dashboards or widgets.
"""

from collections.abc import Mapping
from types import MappingProxyType
from typing import Any

from ai_web_feeds.visualization.models import DataSource, WidgetType

DASHBOARD_BUILDER_DISABLED: Mapping[str, bool | str] = MappingProxyType(
    {
        "enabled": False,
        "reason": "dashboard builder is not enabled",
    }
)


def _disabled(*_ignored: object) -> Mapping[str, bool | str]:
    """Ignore caller inputs. Nothing is created or stored."""
    return DASHBOARD_BUILDER_DISABLED


class DashboardService:
    """Disabled dashboard builder. No dashboards or widgets are stored."""

    def __init__(self) -> None:
        """No storage is opened and no dashboard state is kept."""

    async def list_dashboards(
        self,
        device_id: str,
        limit: int = 50,
    ) -> Mapping[str, bool | str]:
        """Return the frozen disabled payload."""
        return _disabled(self, device_id, limit)

    async def create_dashboard(
        self,
        device_id: str,
        name: str,
        description: str | None = None,
        template_id: str | None = None,
        layout: dict[str, Any] | None = None,
    ) -> Mapping[str, bool | str]:
        """Return the frozen disabled payload."""
        return _disabled(self, device_id, name, description, template_id, layout)

    async def get_dashboard(
        self,
        dashboard_id: int,
        device_id: str,
        include_widgets: bool = True,
    ) -> Mapping[str, bool | str]:
        """Return the frozen disabled payload."""
        return _disabled(self, dashboard_id, device_id, include_widgets)

    async def update_dashboard(
        self,
        dashboard_id: int,
        device_id: str,
        name: str | None = None,
        description: str | None = None,
        layout: dict[str, Any] | None = None,
        expected_version: int | None = None,
    ) -> Mapping[str, bool | str]:
        """Return the frozen disabled payload."""
        return _disabled(
            self,
            dashboard_id,
            device_id,
            name,
            description,
            layout,
            expected_version,
        )

    async def delete_dashboard(
        self,
        dashboard_id: int,
        device_id: str,
    ) -> Mapping[str, bool | str]:
        """Return the frozen disabled payload."""
        return _disabled(self, dashboard_id, device_id)

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
        visualization_id: int | None = None,
    ) -> Mapping[str, bool | str]:
        """Return the frozen disabled payload."""
        return _disabled(
            self,
            dashboard_id,
            device_id,
            widget_type,
            data_source,
            filters,
            refresh_interval_seconds,
            position,
            config,
            visualization_id,
        )
