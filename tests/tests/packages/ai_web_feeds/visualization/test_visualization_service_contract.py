"""Characterization contract for the visualization service.

Locks public names, return shapes, and empty-input behavior of the current
service. Stored filters use a real catalog feed row. Demo stays false.
No seeded numeric series is required or snapshotted.
"""

from __future__ import annotations

import inspect
from collections.abc import Mapping
from datetime import datetime
from pathlib import Path
from typing import TypedDict, cast

import pytest
from ai_web_feeds.load import load_feeds
from ai_web_feeds.visualization import visualization_service as visualization_service_module
from ai_web_feeds.visualization.data_service import DataService
from ai_web_feeds.visualization.models import ChartType, DataSource, Visualization
from ai_web_feeds.visualization.validators import CustomizationValidator
from ai_web_feeds.visualization.visualization_service import VisualizationService
from sqlalchemy import Table, create_engine
from sqlalchemy.engine import Engine
from sqlmodel import Session

_PUBLIC_METHODS: tuple[str, ...] = (
    "list_visualizations",
    "create_visualization",
    "get_visualization",
    "update_visualization",
    "delete_visualization",
    "fetch_visualization_data",
)

_METHOD_PARAMETERS: dict[str, tuple[str, ...]] = {
    "list_visualizations": ("device_id", "limit", "offset"),
    "create_visualization": (
        "device_id",
        "name",
        "chart_type",
        "data_source",
        "filters",
        "customization",
    ),
    "get_visualization": ("visualization_id", "device_id"),
    "update_visualization": (
        "visualization_id",
        "device_id",
        "name",
        "filters",
        "customization",
    ),
    "delete_visualization": ("visualization_id", "device_id"),
    "fetch_visualization_data": ("visualization", "date_range", "limit"),
}

_RECORD_FIELDS: frozenset[str] = frozenset(
    {
        "id",
        "device_id",
        "name",
        "chart_type",
        "data_source",
        "filters",
        "customization",
        "created_at",
        "last_viewed",
    }
)

_FETCH_FIELDS: frozenset[str] = frozenset(
    {
        "records",
        "count",
        "data_source",
        "filters",
        "date_range",
    }
)

_SERIES_FIELDS: frozenset[str] = frozenset({"points", "y", "yhat", "ds", "demo"})

_UNQUERIED_SOURCES: tuple[str, ...] = (
    DataSource.ARTICLES.value,
    DataSource.ENTITIES.value,
    DataSource.SENTIMENT.value,
    DataSource.QUALITY.value,
    "",
)

_FORBIDDEN_SOURCE: tuple[str, ...] = (
    "default_rng",
    "np.random",
    "numpy.random",
    "sentence_transformers",
    "Prophet",
)

_EMPTY_DEVICE = "viz-empty-device"
_CATALOG_DEVICE = "viz-catalog-device"


class _ChartRecord(TypedDict):
    """Saved visualization row. Field values stay the service's own objects."""

    id: int
    device_id: str
    name: str
    chart_type: str
    data_source: str
    filters: dict[str, object]
    customization: dict[str, object]
    created_at: str
    last_viewed: str


def _catalog_feeds_path() -> Path:
    """Return the repository catalog file."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "data" / "feeds.yaml"
        if candidate.is_file():
            return candidate
    message = "catalog feeds.yaml was not found"
    raise FileNotFoundError(message)


def _catalog_feed() -> Mapping[str, str]:
    """One real catalog feed row: id and title only, no metric series."""
    loaded = load_feeds(_catalog_feeds_path())
    sources = loaded["sources"]
    assert isinstance(sources, list)
    for source in sources:
        if not isinstance(source, Mapping):
            continue
        source_id = source.get("id")
        title = source.get("title")
        if (
            isinstance(source_id, str)
            and source_id
            and isinstance(title, str)
            and title
            and len(title) <= 255
        ):
            return {"id": source_id, "title": title}
    message = "catalog has no usable feed row"
    raise AssertionError(message)


def _bind_empty_database(monkeypatch: pytest.MonkeyPatch, database_path: Path) -> Engine:
    """Point the service at an empty temp visualizations table."""
    engine = create_engine(
        f"sqlite:///{database_path}",
        connect_args={"check_same_thread": False},
    )
    table = getattr(Visualization, "__table__", None)
    if not isinstance(table, Table):
        message = "Visualization has no SQL table"
        raise AssertionError(message)
    table.create(engine)

    def get_session() -> Session:
        return Session(engine)

    monkeypatch.setattr(visualization_service_module, "get_session", get_session)
    return engine


def _refuse_storage(*_args: object, **_kwargs: object) -> None:
    """Fail if an empty fetch opens visualization storage."""
    message = "visualization storage was opened"
    raise AssertionError(message)


def _assert_timestamp(value: object) -> None:
    assert isinstance(value, str)
    assert value
    datetime.fromisoformat(value)


def _assert_record(
    record: object,
    *,
    device_id: str,
    name: str,
    chart_type: str,
    data_source: str,
) -> _ChartRecord:
    """Saved chart config shape. Not a forecast or a numeric series."""
    assert isinstance(record, dict)
    typed = cast(_ChartRecord, record)
    assert set(typed) == _RECORD_FIELDS
    assert isinstance(typed["id"], int)
    assert typed["device_id"] == device_id
    assert typed["name"] == name
    assert typed["chart_type"] == chart_type
    assert typed["data_source"] == data_source
    assert isinstance(typed["filters"], dict)
    assert isinstance(typed["customization"], dict)
    _assert_timestamp(typed["created_at"])
    _assert_timestamp(typed["last_viewed"])
    assert _SERIES_FIELDS.isdisjoint(typed)
    return typed


def _assert_empty_fetch(
    payload: object,
    *,
    data_source: object,
    filters: object,
    date_range: object,
) -> None:
    """Success envelope with no rows and no synthesized series."""
    assert isinstance(payload, dict)
    typed = cast(dict[str, object], payload)
    assert set(typed) == _FETCH_FIELDS
    assert typed["records"] == []
    assert typed["count"] == 0
    assert typed["data_source"] is data_source
    assert typed["filters"] is filters
    assert typed["date_range"] is date_range
    assert _SERIES_FIELDS.isdisjoint(typed)


@pytest.mark.unit
def test_visualization_service_public_names() -> None:
    """The service keeps its class, async operations, and defaults."""
    defined_classes = {
        name
        for name, value in vars(visualization_service_module).items()
        if inspect.isclass(value) and value.__module__ == visualization_service_module.__name__
    }
    assert defined_classes == {"VisualizationService"}

    defined_functions = {
        name
        for name, value in vars(visualization_service_module).items()
        if inspect.isfunction(value) and value.__module__ == visualization_service_module.__name__
    }
    assert defined_functions == set()

    source = inspect.getsource(visualization_service_module)
    for forbidden in _FORBIDDEN_SOURCE:
        assert forbidden not in source
    assert '"demo": False' in source
    assert '"points": []' in source

    service = VisualizationService()
    assert set(vars(service)) == {"data_service", "customization_validator"}
    assert isinstance(service.data_service, DataService)
    assert isinstance(service.customization_validator, CustomizationValidator)

    public_callables = {
        name
        for name, value in vars(VisualizationService).items()
        if callable(value) and not name.startswith("_")
    }
    assert public_callables == set(_PUBLIC_METHODS)

    coroutines = {
        name
        for name, value in vars(VisualizationService).items()
        if inspect.iscoroutinefunction(value)
    }
    assert coroutines == set(_PUBLIC_METHODS)

    init_parameters = inspect.signature(VisualizationService.__init__).parameters
    assert tuple(init_parameters) == ("self",)

    for name, parameter_names in _METHOD_PARAMETERS.items():
        method = getattr(VisualizationService, name)
        assert getattr(method, "__name__", None) == name
        signature = inspect.signature(method)
        assert tuple(signature.parameters) == ("self", *parameter_names)

    list_signature = inspect.signature(VisualizationService.list_visualizations).parameters
    assert list_signature["limit"].default == 50
    assert list_signature["offset"].default == 0

    update_signature = inspect.signature(VisualizationService.update_visualization).parameters
    assert update_signature["name"].default is None
    assert update_signature["filters"].default is None
    assert update_signature["customization"].default is None

    fetch_signature = inspect.signature(VisualizationService.fetch_visualization_data).parameters
    assert fetch_signature["date_range"].default is None
    assert fetch_signature["limit"].default == 1000


@pytest.mark.unit
@pytest.mark.asyncio
async def test_empty_fetch_returns_no_series(monkeypatch: pytest.MonkeyPatch) -> None:
    """Empty and non-metric inputs return an empty envelope and do not store."""
    monkeypatch.setattr(visualization_service_module, "get_session", _refuse_storage)
    topic_calls: list[dict[str, object]] = []
    feed_calls: list[dict[str, object]] = []

    def empty_topic_metrics(**kwargs: object) -> list[dict[str, object]]:
        topic_calls.append(kwargs)
        return []

    def empty_feed_health(**kwargs: object) -> list[dict[str, object]]:
        feed_calls.append(kwargs)
        return []

    service = VisualizationService()
    monkeypatch.setattr(service.data_service, "query_topic_metrics", empty_topic_metrics)
    monkeypatch.setattr(service.data_service, "query_feed_health", empty_feed_health)

    empty_filters: dict[str, object] = {}
    for data_source in _UNQUERIED_SOURCES:
        payload = await service.fetch_visualization_data(
            {
                "data_source": data_source,
                "filters": empty_filters,
                "device_id": "",
            },
            date_range=None,
            limit=0,
        )
        _assert_empty_fetch(
            payload,
            data_source=data_source,
            filters=empty_filters,
            date_range=None,
        )

    none_filters: dict[str, object] = {}
    none_payload = await service.fetch_visualization_data(
        {
            "data_source": None,
            "filters": none_filters,
            "device_id": "",
        }
    )
    _assert_empty_fetch(
        none_payload,
        data_source=None,
        filters=none_filters,
        date_range=None,
    )

    topic_filters: dict[str, object] = {}
    topic_payload = await service.fetch_visualization_data(
        {
            "data_source": DataSource.TOPICS.value,
            "filters": topic_filters,
            "device_id": "",
        },
        date_range=None,
        limit=0,
    )
    _assert_empty_fetch(
        topic_payload,
        data_source=DataSource.TOPICS.value,
        filters=topic_filters,
        date_range=None,
    )
    assert topic_calls == [
        {
            "topic_ids": None,
            "date_range": None,
            "device_id": "",
            "limit": 0,
        }
    ]

    empty_topic_ids: dict[str, list[object]] = {"topic_ids": []}
    empty_topic_payload = await service.fetch_visualization_data(
        {
            "data_source": "topics",
            "filters": empty_topic_ids,
            "device_id": _EMPTY_DEVICE,
        },
        limit=0,
    )
    _assert_empty_fetch(
        empty_topic_payload,
        data_source="topics",
        filters=empty_topic_ids,
        date_range=None,
    )

    feed_filters: dict[str, list[object]] = {"feed_ids": []}
    preserved_range: dict[str, str] = {}
    feed_payload = await service.fetch_visualization_data(
        {
            "data_source": DataSource.FEEDS.value,
            "filters": feed_filters,
            "device_id": _EMPTY_DEVICE,
        },
        date_range=preserved_range,
        limit=0,
    )
    _assert_empty_fetch(
        feed_payload,
        data_source=DataSource.FEEDS.value,
        filters=feed_filters,
        date_range=preserved_range,
    )
    assert feed_calls == [
        {
            "feed_ids": [],
            "date_range": preserved_range,
            "device_id": _EMPTY_DEVICE,
            "limit": 0,
        }
    ]
    assert len(topic_calls) == 2
    assert topic_calls[1]["topic_ids"] == []
    assert topic_calls[1]["device_id"] == _EMPTY_DEVICE
    assert topic_calls[1]["limit"] == 0
    assert topic_calls[1]["date_range"] is None

    with pytest.raises(KeyError, match="data_source"):
        await service.fetch_visualization_data({})
    with pytest.raises(KeyError, match="filters"):
        await service.fetch_visualization_data({"data_source": DataSource.TOPICS.value})
    with pytest.raises(KeyError, match="device_id"):
        await service.fetch_visualization_data(
            {"data_source": DataSource.FEEDS.value, "filters": {}}
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_empty_storage_and_catalog_row_shape(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """An empty table stays empty. A saved chart keeps one real catalog feed."""
    catalog = _catalog_feed()
    catalog_filters = {"feed_ids": [catalog["id"]]}
    engine = _bind_empty_database(monkeypatch, tmp_path / "visualizations-empty.db")
    try:
        service = VisualizationService()

        assert await service.list_visualizations(_EMPTY_DEVICE) == []
        assert await service.list_visualizations(_CATALOG_DEVICE, limit=0, offset=0) == []
        assert await service.get_visualization(0, _EMPTY_DEVICE) is None
        assert await service.update_visualization(0, _EMPTY_DEVICE) is None
        assert await service.delete_visualization(0, _EMPTY_DEVICE) is False

        created = _assert_record(
            await service.create_visualization(
                _CATALOG_DEVICE,
                catalog["title"],
                ChartType.BAR,
                DataSource.FEEDS,
                catalog_filters,
                {},
            ),
            device_id=_CATALOG_DEVICE,
            name=catalog["title"],
            chart_type=ChartType.BAR.value,
            data_source=DataSource.FEEDS.value,
        )
        assert created["filters"] == catalog_filters
        assert created["customization"] == {}
        assert created["filters"] == {"feed_ids": [catalog["id"]]}
        visualization_id = created["id"]
        assert isinstance(visualization_id, int)

        assert await service.list_visualizations(_EMPTY_DEVICE) == []
        listed = await service.list_visualizations(_CATALOG_DEVICE)
        assert listed == [created]
        assert await service.list_visualizations(_CATALOG_DEVICE, limit=0) == []
        assert await service.list_visualizations(_CATALOG_DEVICE, offset=1) == []

        loaded = _assert_record(
            await service.get_visualization(visualization_id, _CATALOG_DEVICE),
            device_id=_CATALOG_DEVICE,
            name=catalog["title"],
            chart_type=ChartType.BAR.value,
            data_source=DataSource.FEEDS.value,
        )
        assert loaded["id"] == visualization_id
        assert loaded["filters"] == catalog_filters
        assert loaded["customization"] == {}
        assert await service.get_visualization(visualization_id, _EMPTY_DEVICE) is None

        untouched = _assert_record(
            await service.update_visualization(visualization_id, _CATALOG_DEVICE),
            device_id=_CATALOG_DEVICE,
            name=catalog["title"],
            chart_type=ChartType.BAR.value,
            data_source=DataSource.FEEDS.value,
        )
        assert untouched["filters"] == catalog_filters
        assert untouched["customization"] == {}

        cleared_filters: dict[str, object] = {}
        cleared = _assert_record(
            await service.update_visualization(
                visualization_id,
                _CATALOG_DEVICE,
                filters=cleared_filters,
            ),
            device_id=_CATALOG_DEVICE,
            name=catalog["title"],
            chart_type=ChartType.BAR.value,
            data_source=DataSource.FEEDS.value,
        )
        assert cleared["filters"] == {}
        assert cleared["customization"] == {}
        assert (
            await service.update_visualization(visualization_id, _EMPTY_DEVICE, name="Other")
            is None
        )

        assert await service.delete_visualization(0, _CATALOG_DEVICE) is False
        assert await service.delete_visualization(visualization_id, _EMPTY_DEVICE) is False
        assert await service.delete_visualization(visualization_id, _CATALOG_DEVICE) is True
        assert await service.list_visualizations(_CATALOG_DEVICE) == []
        assert await service.get_visualization(visualization_id, _CATALOG_DEVICE) is None
        assert await service.update_visualization(visualization_id, _CATALOG_DEVICE) is None
        assert await service.delete_visualization(visualization_id, _CATALOG_DEVICE) is False
    finally:
        engine.dispose()
