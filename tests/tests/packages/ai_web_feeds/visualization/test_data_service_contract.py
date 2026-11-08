"""Characterization tests for visualization DataService.

Locks public names, return shape, and empty-input behavior against the
current service. Scripted catalog rows are the only numeric values asserted.
No default_rng series is required or snapshotted.
"""

from __future__ import annotations

import inspect
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from ai_web_feeds.visualization import data_service as data_service_module
from ai_web_feeds.visualization.cache import CacheLayer
from ai_web_feeds.visualization.data_service import DataService
from ai_web_feeds.visualization.validators import QueryValidator, ValidationError

_PUBLIC_METHODS: tuple[str, ...] = (
    "query_topic_metrics",
    "query_feed_health",
    "get_topic_graph_data",
    "invalidate_cache",
    "get_cache_stats",
)

_METHOD_PARAMETERS: dict[str, tuple[str, ...]] = {
    "query_topic_metrics": ("topic_ids", "date_range", "device_id", "limit"),
    "query_feed_health": ("feed_ids", "date_range", "device_id", "limit"),
    "get_topic_graph_data": ("topic_ids", "device_id"),
    "invalidate_cache": ("query_type",),
    "get_cache_stats": (),
}

_FORBIDDEN_SOURCE: tuple[str, ...] = (
    "default_rng",
    "np.random",
    "numpy.random",
    "import numpy",
    "sentence_transformers",
    "import torch",
)

_SHORT_RANGE: dict[str, str] = {
    "start": "2024-01-01T00:00:00+00:00",
    "end": "2024-01-10T00:00:00+00:00",
}
_LONG_RANGE: dict[str, str] = {
    "start": "2020-01-01T00:00:00+00:00",
    "end": "2022-01-01T00:00:00+00:00",
}
_INVERTED_RANGE: dict[str, str] = {
    "start": "2024-06-02T00:00:00+00:00",
    "end": "2024-06-01T00:00:00+00:00",
}
_OBSERVED = datetime(2024, 5, 1, 15, 30, tzinfo=UTC)
_OBSERVED_ISO = "2024-05-01T15:30:00+00:00"
_DEFAULT_WINDOW = timedelta(days=30)
_MAX_LIMIT = 100_000

_Call = tuple[str, Mapping[str, object]]


class _MappedRow:
    """Row whose `_mapping` is the catalog record the service copies."""

    def __init__(self, mapping: dict[str, object]) -> None:
        self._mapping = mapping


class _TopicRow:
    """Topic catalog row addressed by attribute, matching the graph query."""

    def __init__(
        self,
        row_id: int,
        label: str,
        facet: str,
        description: str | None,
        article_count: int | None,
    ) -> None:
        self.id = row_id
        self.label = label
        self.facet = facet
        self.description = description
        self.article_count = article_count


class _EdgeRow:
    """Topic-edge catalog row. Weight is stored, not sampled."""

    def __init__(
        self,
        topic_id: int,
        related_topic_id: int,
        relation_type: str,
        weight: float | None,
    ) -> None:
        self.topic_id = topic_id
        self.related_topic_id = related_topic_id
        self.relation_type = relation_type
        self.weight = weight


class _CatalogSession:
    """Plays scripted query results and records the SQL that was sent."""

    def __init__(self, results: list[list[object]]) -> None:
        self._results = results
        self.calls: list[_Call] = []

    def execute(
        self,
        statement: object,
        params: Mapping[str, object] | None = None,
    ) -> list[object]:
        recorded = {} if params is None else dict(params)
        self.calls.append((str(statement), recorded))
        if not self._results:
            return []
        return self._results.pop(0)


class _SessionScope:
    def __init__(self, session: _CatalogSession) -> None:
        self._session = session

    def __enter__(self) -> _CatalogSession:
        return self._session

    def __exit__(self, *_exc: object) -> None:
        return None


class _RejectSession:
    def execute(self, *_args: object, **_kwargs: object) -> list[object]:
        message = "invalid input opened a catalog query"
        raise AssertionError(message)


class _Guard:
    def __init__(self) -> None:
        self.entered = False

    def __enter__(self) -> _RejectSession:
        self.entered = True
        return _RejectSession()

    def __exit__(self, *_exc: object) -> None:
        return None


def _memory_cache() -> CacheLayer:
    return CacheLayer(enable_redis=False)


def _install(
    monkeypatch: pytest.MonkeyPatch,
    session: _CatalogSession | _Guard,
) -> tuple[DataService, CacheLayer]:
    """Bind a private memory cache and a session stand-in."""
    cache = _memory_cache()

    def _cache() -> CacheLayer:
        return cache

    def _open() -> _CatalogSession | _Guard | _SessionScope:
        if isinstance(session, _Guard):
            return session
        return _SessionScope(session)

    monkeypatch.setattr(data_service_module, "get_cache", _cache)
    monkeypatch.setattr(data_service_module, "get_session", _open)
    return DataService(), cache


def _future_range() -> dict[str, str]:
    start = datetime.now(UTC) + timedelta(days=1)
    end = start + timedelta(days=1)
    return {"start": start.isoformat(), "end": end.isoformat()}


def _assert_default_window(params: Mapping[str, object]) -> None:
    start = params["start_date"]
    end = params["end_date"]
    assert isinstance(start, datetime)
    assert isinstance(end, datetime)
    assert end - start == _DEFAULT_WINDOW
    assert start.tzinfo is not None
    assert end.tzinfo is not None


def _assert_short_window(params: Mapping[str, object]) -> None:
    assert params["start_date"] == datetime(2024, 1, 1, tzinfo=UTC)
    assert params["end_date"] == datetime(2024, 1, 10, tzinfo=UTC)


def _assert_topic_sql(sql: str) -> None:
    assert "FROM topic_metrics tm" in sql
    assert "JOIN topics t" in sql
    assert "ANY(:topic_ids)" in sql
    for column in (
        "tm.topic_id",
        "tm.date",
        "tm.article_count",
        "tm.avg_quality_score",
        "tm.sentiment_score",
        "topic_label",
    ):
        assert column in sql
    assert "default_rng" not in sql


def _assert_feed_sql(sql: str) -> None:
    assert "FROM feed_health fh" in sql
    assert "JOIN sources fs" in sql
    assert "ANY(:feed_ids)" in sql
    for column in (
        "fh.feed_id",
        "fh.date",
        "fh.status_code",
        "fh.response_time_ms",
        "fh.error_count",
        "fh.success_rate",
        "feed_title",
    ):
        assert column in sql
    assert "default_rng" not in sql


def _assert_graph_sql(calls: list[_Call]) -> None:
    assert len(calls) == 2
    topics_sql, _topics_params = calls[0]
    edges_sql, _edges_params = calls[1]
    assert "FROM topics t" in topics_sql
    assert "article_metadata" in topics_sql
    assert "ANY(:topic_ids)" in topics_sql
    for column in ("t.id", "t.label", "t.facet", "t.description", "article_count"):
        assert column in topics_sql
    assert "FROM topic_edges" in edges_sql
    assert "ANY(:topic_ids)" in edges_sql
    for column in ("topic_id", "related_topic_id", "relation_type", "weight"):
        assert column in edges_sql


def _metric_rows() -> list[object]:
    return [
        _MappedRow(
            {
                "topic_id": 7,
                "date": _OBSERVED,
                "article_count": 4,
                "avg_quality_score": 0.5,
                "sentiment_score": -0.25,
                "topic_label": "Language models",
            }
        )
    ]


def _expected_metrics() -> list[dict[str, object]]:
    return [
        {
            "topic_id": 7,
            "date": _OBSERVED_ISO,
            "article_count": 4,
            "avg_quality_score": 0.5,
            "sentiment_score": -0.25,
            "topic_label": "Language models",
        }
    ]


def _feed_rows() -> list[object]:
    return [
        _MappedRow(
            {
                "feed_id": "feed-stored",
                "date": _OBSERVED,
                "status_code": 200,
                "response_time_ms": 120,
                "error_count": 0,
                "success_rate": 1.0,
                "feed_title": "Stored Feed",
            }
        )
    ]


def _expected_feed() -> list[dict[str, object]]:
    return [
        {
            "feed_id": "feed-stored",
            "date": _OBSERVED_ISO,
            "status_code": 200,
            "response_time_ms": 120,
            "error_count": 0,
            "success_rate": 1.0,
            "feed_title": "Stored Feed",
        }
    ]


def _graph_rows() -> tuple[list[object], list[object]]:
    topics: list[object] = [
        _TopicRow(3, "Vision", "domain", "Stored topic", None),
        _TopicRow(4, "Speech", "domain", None, 0),
        _TopicRow(5, "Language", "task", "Stored task", 6),
    ]
    edges: list[object] = [
        _EdgeRow(3, 5, "related", None),
        _EdgeRow(4, 5, "broader", 1.0),
    ]
    return topics, edges


def _expected_graph() -> dict[str, list[dict[str, object]]]:
    return {
        "nodes": [
            {
                "id": 3,
                "label": "Vision",
                "facet": "domain",
                "description": "Stored topic",
                "article_count": 0,
            },
            {
                "id": 4,
                "label": "Speech",
                "facet": "domain",
                "description": None,
                "article_count": 0,
            },
            {
                "id": 5,
                "label": "Language",
                "facet": "task",
                "description": "Stored task",
                "article_count": 6,
            },
        ],
        "edges": [
            {"source": 3, "target": 5, "type": "related", "weight": None},
            {"source": 4, "target": 5, "type": "broader", "weight": 1.0},
        ],
    }


@pytest.mark.unit
def test_data_service_public_names() -> None:
    """The module exposes DataService and its current operation names."""
    defined = {
        name
        for name, value in vars(data_service_module).items()
        if not name.startswith("_")
        and getattr(value, "__module__", None) == data_service_module.__name__
    }
    assert defined == {"DataService"}

    source = inspect.getsource(data_service_module)
    for forbidden in _FORBIDDEN_SOURCE:
        assert forbidden not in source
    assert '"demo": False' in source
    assert '"points": []' in source

    public_callables = {
        name
        for name, value in vars(DataService).items()
        if callable(value) and not name.startswith("_")
    }
    assert public_callables == set(_PUBLIC_METHODS)

    coroutines = {
        name for name, value in vars(DataService).items() if inspect.iscoroutinefunction(value)
    }
    assert coroutines == set()

    for name, parameter_names in _METHOD_PARAMETERS.items():
        method = getattr(DataService, name)
        assert getattr(method, "__name__", None) == name
        signature = inspect.signature(method)
        assert tuple(signature.parameters) == ("self", *parameter_names)

    metrics = inspect.signature(DataService.query_topic_metrics)
    assert metrics.parameters["topic_ids"].default is None
    assert metrics.parameters["date_range"].default is None
    assert metrics.parameters["device_id"].default == ""
    assert metrics.parameters["limit"].default == 1000
    assert metrics.return_annotation == list[dict[str, Any]]

    health = inspect.signature(DataService.query_feed_health)
    assert health.parameters["feed_ids"].default is None
    assert health.parameters["date_range"].default is None
    assert health.parameters["device_id"].default == ""
    assert health.parameters["limit"].default == 1000
    assert health.return_annotation == list[dict[str, Any]]

    graph = inspect.signature(DataService.get_topic_graph_data)
    assert graph.parameters["topic_ids"].default is None
    assert graph.parameters["device_id"].default == ""
    assert graph.return_annotation == dict[str, Any]

    invalidate = inspect.signature(DataService.invalidate_cache)
    assert invalidate.parameters["query_type"].default is None
    assert invalidate.return_annotation is int

    stats = inspect.signature(DataService.get_cache_stats)
    assert stats.return_annotation == dict[str, Any]

    service = DataService()
    assert set(vars(service)) == {"cache", "validator"}
    assert isinstance(service.cache, CacheLayer)
    assert isinstance(service.validator, QueryValidator)


@pytest.mark.unit
def test_invalid_inputs_do_not_query(monkeypatch: pytest.MonkeyPatch) -> None:
    """Limits and ranges that cannot name catalog rows never open a session."""
    guard = _Guard()
    service, _cache = _install(monkeypatch, guard)
    future = _future_range()

    for limit in (0, -1):
        with pytest.raises(ValidationError, match="Limit must be positive"):
            service.query_topic_metrics(limit=limit)
        with pytest.raises(ValidationError, match="Limit must be positive"):
            service.query_feed_health(limit=limit)

    with pytest.raises(ValidationError, match="100,000"):
        service.query_topic_metrics(limit=_MAX_LIMIT + 1)
    with pytest.raises(ValidationError, match="100,000"):
        service.query_feed_health(limit=_MAX_LIMIT + 1)

    with pytest.raises(ValidationError, match="365"):
        service.query_topic_metrics(date_range=_LONG_RANGE)

    for query in (service.query_topic_metrics, service.query_feed_health):
        with pytest.raises(ValueError, match="after start"):
            query(date_range=_INVERTED_RANGE)
        with pytest.raises(ValueError, match="future"):
            query(date_range=future)
        with pytest.raises(ValueError, match="isoformat"):
            query(date_range={"start": "", "end": ""})
        with pytest.raises(KeyError, match="end"):
            query(date_range={"start": _SHORT_RANGE["start"]})

    assert guard.entered is False


@pytest.mark.unit
def test_empty_inputs_return_empty_catalog_shapes(monkeypatch: pytest.MonkeyPatch) -> None:
    """Omitted and empty filters return no rows and no numeric series."""
    session = _CatalogSession([])
    service, _cache = _install(monkeypatch, session)

    metrics = service.query_topic_metrics()
    assert metrics == []
    assert isinstance(metrics, list)
    assert len(session.calls) == 1
    metrics_sql, metrics_params = session.calls[0]
    _assert_topic_sql(metrics_sql)
    _assert_default_window(metrics_params)
    assert metrics_params["topic_ids"] is None
    assert metrics_params["limit"] == 1000

    empty_topics = service.query_topic_metrics(
        topic_ids=[],
        date_range=_SHORT_RANGE,
        device_id="",
        limit=5,
    )
    assert empty_topics == []
    _assert_topic_sql(session.calls[1][0])
    _assert_short_window(session.calls[1][1])
    assert session.calls[1][1]["topic_ids"] == []
    assert session.calls[1][1]["limit"] == 5

    health = service.query_feed_health()
    assert health == []
    assert isinstance(health, list)
    health_sql, health_params = session.calls[2]
    _assert_feed_sql(health_sql)
    _assert_default_window(health_params)
    assert health_params["feed_ids"] is None
    assert health_params["limit"] == 1000

    empty_feeds = service.query_feed_health(feed_ids=[], date_range=_SHORT_RANGE, limit=5)
    assert empty_feeds == []
    _assert_feed_sql(session.calls[3][0])
    assert session.calls[3][1]["feed_ids"] == []
    assert session.calls[3][1]["limit"] == 5

    long_range = service.query_feed_health(date_range=_LONG_RANGE)
    assert long_range == []
    assert session.calls[4][1]["start_date"] == datetime(2020, 1, 1, tzinfo=UTC)
    assert session.calls[4][1]["end_date"] == datetime(2022, 1, 1, tzinfo=UTC)

    omitted_graph = service.get_topic_graph_data()
    assert omitted_graph == {"nodes": [], "edges": []}
    assert isinstance(omitted_graph["nodes"], list)
    assert isinstance(omitted_graph["edges"], list)
    _assert_graph_sql(session.calls[5:7])
    assert session.calls[5][1]["topic_ids"] is None
    assert session.calls[6][1]["topic_ids"] is None

    cached_graph = service.get_topic_graph_data()
    assert cached_graph == {"nodes": [], "edges": []}
    assert len(session.calls) == 7

    empty_ids = service.get_topic_graph_data(topic_ids=[], device_id="")
    assert empty_ids == {"nodes": [], "edges": []}
    _assert_graph_sql(session.calls[7:9])
    assert session.calls[7][1]["topic_ids"] == []
    assert session.calls[8][1]["topic_ids"] == []
    assert len(session.calls) == 9


@pytest.mark.unit
def test_stored_catalog_rows_keep_return_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    """Rows from the catalog query are returned as-is, aside from date strings."""
    topics, edges = _graph_rows()
    session = _CatalogSession([_metric_rows(), _metric_rows(), _feed_rows(), topics, edges])
    service, cache = _install(monkeypatch, session)
    expected_metrics = _expected_metrics()
    expected_feed = _expected_feed()
    expected_graph = _expected_graph()

    first = service.query_topic_metrics(topic_ids=[7], date_range=dict(_SHORT_RANGE), limit=10)
    assert first == expected_metrics
    assert isinstance(first, list)
    assert isinstance(first[0], dict)
    assert isinstance(first[0]["date"], str)
    assert len(session.calls) == 1
    _assert_topic_sql(session.calls[0][0])
    assert session.calls[0][1]["topic_ids"] == [7]
    assert session.calls[0][1]["limit"] == 10

    cached = service.query_topic_metrics(topic_ids=[7], date_range=dict(_SHORT_RANGE), limit=10)
    assert cached == expected_metrics
    assert len(session.calls) == 1

    removed = service.invalidate_cache("topic_metrics")
    assert removed == 0
    assert isinstance(removed, int)
    again = service.query_topic_metrics(topic_ids=[7], date_range=dict(_SHORT_RANGE), limit=10)
    assert again == expected_metrics
    assert len(session.calls) == 2

    feeds = service.query_feed_health(feed_ids=["feed-stored"], date_range=dict(_SHORT_RANGE))
    assert feeds == expected_feed
    assert isinstance(feeds[0]["date"], str)
    _assert_feed_sql(session.calls[2][0])
    assert session.calls[2][1]["feed_ids"] == ["feed-stored"]

    graph = service.get_topic_graph_data(topic_ids=[3, 4, 5])
    assert graph == expected_graph
    assert set(graph) == {"nodes", "edges"}
    for node in graph["nodes"]:
        assert set(node) == {"id", "label", "facet", "description", "article_count"}
        assert isinstance(node["article_count"], int)
    for edge in graph["edges"]:
        assert set(edge) == {"source", "target", "type", "weight"}
    _assert_graph_sql(session.calls[3:5])
    assert session.calls[3][1]["topic_ids"] == [3, 4, 5]
    assert session.calls[4][1]["topic_ids"] == [3, 4, 5]

    cached_graph = service.get_topic_graph_data(topic_ids=[3, 4, 5])
    assert cached_graph == expected_graph
    assert len(session.calls) == 5

    stats = cache.get_stats()
    assert stats["cache_type"] == "memory"
    assert isinstance(stats["hits"], int)
    assert isinstance(stats["misses"], int)
    assert isinstance(stats["hit_rate"], float)
    assert isinstance(stats["total_requests"], int)
    assert set(stats) >= {"cache_type", "hits", "misses", "hit_rate", "total_requests"}


@pytest.mark.unit
def test_empty_cache_helpers_return_plain_values(monkeypatch: pytest.MonkeyPatch) -> None:
    """A fresh memory cache reports zeros and does not query."""
    guard = _Guard()
    service, _cache = _install(monkeypatch, guard)

    assert service.invalidate_cache() == 0
    assert service.invalidate_cache(None) == 0
    assert service.invalidate_cache("topic_metrics") == 0

    stats = service.get_cache_stats()
    assert stats == {
        "cache_type": "memory",
        "hits": 0,
        "misses": 0,
        "hit_rate": 0.0,
        "total_requests": 0,
    }
    assert guard.entered is False
