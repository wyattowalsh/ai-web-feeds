"""Forecasts stay disabled. No synthetic series and no seeded generator."""

from __future__ import annotations

import importlib
import inspect
import socket
import types
from collections.abc import Coroutine, Mapping
from typing import TypeGuard, cast

import pytest

_FORECAST_MODULE = "ai_web_feeds.visualization.forecast_service"
_PUBLIC_FUNCTIONS = ("generate_sample_time_series", "prepare_historical_data")
_PUBLIC_METHODS = ("generate_forecast", "get_forecast", "list_forecasts", "delete_forecast")
_PUBLIC_TYPES = ("ForecastService", "ForecastResult")
_DISABLED = {"enabled": False, "reason": "forecast is not enabled"}
_EMPTY_SERIES = {"ds": [], "y": []}


class _OfflineSession:
    """Session stand-in that fails if a forecast operation touches storage."""

    def execute(self, *_args: object, **_kwargs: object) -> object:
        message = "forecast operation touched the session"
        raise AssertionError(message)

    def add(self, *_args: object, **_kwargs: object) -> object:
        message = "forecast operation touched the session"
        raise AssertionError(message)

    def commit(self, *_args: object, **_kwargs: object) -> object:
        message = "forecast operation touched the session"
        raise AssertionError(message)

    def delete(self, *_args: object, **_kwargs: object) -> object:
        message = "forecast operation touched the session"
        raise AssertionError(message)


def _refuse_network(*_args: object, **_kwargs: object) -> None:
    message = "forecast source opened a network socket"
    raise AssertionError(message)


def _block_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(socket, "socket", _refuse_network)
    monkeypatch.setattr(socket, "create_connection", _refuse_network)


def _load_forecast_service(monkeypatch: pytest.MonkeyPatch) -> types.ModuleType:
    _block_network(monkeypatch)
    module = importlib.import_module(_FORECAST_MODULE)
    assert isinstance(module, types.ModuleType)
    return module


def _is_str_mapping(value: object) -> TypeGuard[Mapping[str, object]]:
    return isinstance(value, Mapping)


def _assert_disabled(payload: object) -> None:
    assert _is_str_mapping(payload)
    assert dict(payload) == _DISABLED
    assert payload["enabled"] is False
    assert payload["reason"] == "forecast is not enabled"
    with pytest.raises(TypeError):
        cast(dict[str, object], payload)["enabled"] = True


def _finish_without_io(coro: Coroutine[object, object, object]) -> object:
    """Run a coroutine that must return without awaiting I/O."""
    try:
        yielded = coro.send(None)
    except StopIteration as stop:
        return stop.value
    coro.close()
    message = f"forecast operation awaited {yielded!r}"
    raise AssertionError(message)


def _assert_empty_column(value: Mapping[str, object], name: str) -> None:
    column = value[name]
    assert isinstance(column, list)
    assert column == []


def _assert_empty_series(value: object) -> None:
    assert value == _EMPTY_SERIES
    assert _is_str_mapping(value)
    _assert_empty_column(value, "y")
    _assert_empty_column(value, "ds")


@pytest.mark.unit
def test_forecast_source_has_no_seeded_series(monkeypatch: pytest.MonkeyPatch) -> None:
    """Disabled forecasts do not keep a seeded numeric generator in source."""
    module = _load_forecast_service(monkeypatch)
    source = inspect.getsource(module)
    assert "forecast is not enabled" in source
    assert "default_rng" not in source
    assert "np.random" not in source
    assert "numpy.random" not in source


@pytest.mark.unit
def test_generate_sample_time_series_is_empty_offline(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sample series stays importable and empty. No numeric demo values."""
    module = _load_forecast_service(monkeypatch)
    generate = module.generate_sample_time_series
    assert callable(generate)
    assert getattr(generate, "__name__", None) == "generate_sample_time_series"

    _assert_empty_series(generate())
    _assert_empty_series(generate(days=4, noise_level=5.0))
    _assert_empty_series(generate(days=0))
    with pytest.raises(ValueError, match="non-negative"):
        generate(days=-1)


@pytest.mark.unit
def test_forecast_operations_and_empty_inputs_stay_offline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Forecast operations return one frozen disabled payload and do not go online."""
    module = _load_forecast_service(monkeypatch)
    for name in _PUBLIC_FUNCTIONS:
        function = getattr(module, name)
        assert callable(function)
        assert getattr(function, "__name__", None) == name
    for name in _PUBLIC_TYPES:
        assert isinstance(getattr(module, name), type)
    for name in _PUBLIC_METHODS:
        method = getattr(module.ForecastService, name)
        assert callable(method)

    service = module.ForecastService(session=cast(object, _OfflineSession()))
    generated = _finish_without_io(
        service.generate_forecast("device", "topics", [], horizon_days=0)
    )
    fetched = _finish_without_io(service.get_forecast(1, "device"))
    listed = _finish_without_io(service.list_forecasts("device"))
    deleted = _finish_without_io(service.delete_forecast(1, "device"))
    assert generated is fetched is listed is deleted
    for payload in (generated, fetched, listed, deleted):
        _assert_disabled(payload)

    prepare = module.prepare_historical_data
    _assert_empty_series(prepare([]))
    assert prepare([{"date": "2024-01-02", "count": 1}]) == {
        "ds": ["2024-01-02"],
        "y": [1],
    }
    assert prepare(
        [
            {"date": "2024-01-03", "count": 4},
            {"date": "2024-01-02", "count": 1},
        ]
    ) == {"ds": ["2024-01-02", "2024-01-03"], "y": [1, 4]}
