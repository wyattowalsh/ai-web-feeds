"""Disabled dashboard builder contract.

Public names stay importable. Every public operation returns the same
frozen payload. No dashboards, widgets, or random series are created.
"""

from __future__ import annotations

import inspect
import operator
from collections.abc import Mapping
from typing import Any, cast

import pytest
from ai_web_feeds.visualization import dashboard_service as dashboard_service_module
from ai_web_feeds.visualization.dashboard_service import (
    DASHBOARD_BUILDER_DISABLED,
    DashboardService,
)
from ai_web_feeds.visualization.models import DataSource, WidgetType

_PUBLIC_METHODS: tuple[str, ...] = (
    "list_dashboards",
    "create_dashboard",
    "get_dashboard",
    "update_dashboard",
    "delete_dashboard",
    "add_widget",
)

_METHOD_PARAMETERS: dict[str, tuple[str, ...]] = {
    "list_dashboards": ("device_id", "limit"),
    "create_dashboard": ("device_id", "name", "description", "template_id", "layout"),
    "get_dashboard": ("dashboard_id", "device_id", "include_widgets"),
    "update_dashboard": (
        "dashboard_id",
        "device_id",
        "name",
        "description",
        "layout",
        "expected_version",
    ),
    "delete_dashboard": ("dashboard_id", "device_id"),
    "add_widget": (
        "dashboard_id",
        "device_id",
        "widget_type",
        "data_source",
        "filters",
        "refresh_interval_seconds",
        "position",
        "config",
        "visualization_id",
    ),
}

_DISABLED: dict[str, object] = {
    "enabled": False,
    "reason": "dashboard builder is not enabled",
}

_DEVICE_ID = "device-contract"
_DASHBOARD_NAME = "Contract"
_REFRESH_SECONDS = 300
_POSITION: dict[str, int] = {"x": 0, "y": 0, "w": 2, "h": 2}
_FORBIDDEN_SOURCE: tuple[str, ...] = (
    "get_session",
    "DashboardWidget",
    "session.add",
    "create_engine",
    "sqlalchemy",
)


def _refuse_storage(*_args: object, **_kwargs: object) -> None:
    """Fail if a public operation opens dashboard storage."""
    message = "dashboard storage was opened"
    raise AssertionError(message)


def _assert_disabled(payload: object) -> None:
    """The shared frozen payload, not a dashboard or widget record."""
    assert payload is DASHBOARD_BUILDER_DISABLED
    assert isinstance(payload, Mapping)
    assert not isinstance(payload, dict)
    assert dict(payload) == _DISABLED
    assert payload["enabled"] is False
    assert payload["reason"] == "dashboard builder is not enabled"
    assert set(payload) == {"enabled", "reason"}
    for key in ("id", "name", "widgets", "layout", "device_id"):
        assert key not in payload


@pytest.mark.unit
def test_dashboard_service_public_names() -> None:
    """The service module keeps its class and async operation names."""
    defined_classes = {
        name
        for name, value in vars(dashboard_service_module).items()
        if inspect.isclass(value) and value.__module__ == dashboard_service_module.__name__
    }
    assert defined_classes == {"DashboardService"}

    source = inspect.getsource(dashboard_service_module)
    assert "dashboard builder is not enabled" in source
    for forbidden in _FORBIDDEN_SOURCE:
        assert forbidden not in source

    service = DashboardService()
    assert vars(service) == {}

    public_callables = {
        name
        for name, value in vars(DashboardService).items()
        if callable(value) and not name.startswith("_")
    }
    assert public_callables == set(_PUBLIC_METHODS)

    coroutines = {
        name for name, value in vars(DashboardService).items() if inspect.iscoroutinefunction(value)
    }
    assert coroutines == set(_PUBLIC_METHODS)

    for name, parameter_names in _METHOD_PARAMETERS.items():
        method = getattr(DashboardService, name)
        assert getattr(method, "__name__", None) == name
        signature = inspect.signature(method)
        assert tuple(signature.parameters) == ("self", *parameter_names)

    assert inspect.signature(DashboardService.list_dashboards).parameters["limit"].default == 50
    create_signature = inspect.signature(DashboardService.create_dashboard).parameters
    assert create_signature["description"].default is None
    assert create_signature["template_id"].default is None
    assert create_signature["layout"].default is None
    include_widgets = inspect.signature(DashboardService.get_dashboard).parameters[
        "include_widgets"
    ]
    assert include_widgets.default is True
    update_signature = inspect.signature(DashboardService.update_dashboard).parameters
    assert update_signature["name"].default is None
    assert update_signature["description"].default is None
    assert update_signature["layout"].default is None
    assert update_signature["expected_version"].default is None
    visualization_id = inspect.signature(DashboardService.add_widget).parameters["visualization_id"]
    assert visualization_id.default is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_public_operations_return_the_frozen_disabled_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Every public operation returns the same frozen object and stores nothing."""
    monkeypatch.setattr("ai_web_feeds.storage.get_session", _refuse_storage)
    assert not hasattr(dashboard_service_module, "get_session")

    with pytest.raises(TypeError, match="item assignment"):
        operator.setitem(
            cast(dict[str, Any], DASHBOARD_BUILDER_DISABLED),
            "enabled",
            True,
        )
    _assert_disabled(DASHBOARD_BUILDER_DISABLED)

    service = DashboardService()
    other = DashboardService()
    payloads = (
        await service.list_dashboards(_DEVICE_ID),
        await service.list_dashboards(_DEVICE_ID, limit=0),
        await service.list_dashboards("device-with-no-rows"),
        await other.list_dashboards(_DEVICE_ID),
        await service.create_dashboard(_DEVICE_ID, _DASHBOARD_NAME),
        await service.create_dashboard(
            _DEVICE_ID,
            _DASHBOARD_NAME,
            description=None,
            template_id=None,
            layout=None,
        ),
        await service.get_dashboard(0, _DEVICE_ID),
        await service.get_dashboard(1, _DEVICE_ID, include_widgets=True),
        await service.get_dashboard(1, _DEVICE_ID, include_widgets=False),
        await service.update_dashboard(0, _DEVICE_ID),
        await service.update_dashboard(
            1,
            _DEVICE_ID,
            name="Other",
            description=None,
            layout={},
            expected_version=1,
        ),
        await service.delete_dashboard(0, _DEVICE_ID),
        await service.delete_dashboard(1, _DEVICE_ID),
        await service.add_widget(
            0,
            _DEVICE_ID,
            WidgetType.CHART,
            DataSource.TOPICS,
            {},
            _REFRESH_SECONDS,
            {},
            {},
        ),
        await service.add_widget(
            1,
            _DEVICE_ID,
            WidgetType.CHART,
            DataSource.TOPICS,
            {},
            _REFRESH_SECONDS,
            _POSITION,
            {},
            visualization_id=None,
        ),
    )

    assert payloads
    for payload in payloads:
        _assert_disabled(payload)
    assert vars(service) == {}
    assert vars(other) == {}
