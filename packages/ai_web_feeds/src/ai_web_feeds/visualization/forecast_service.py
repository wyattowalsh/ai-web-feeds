"""Disabled time-series forecast service.

Forecast operations stay off. Stored rows may be reshaped into ds/y columns.
This module does not sample a demo series or fit a model.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any

from sqlalchemy.orm import Session

_FORECAST_DISABLED: MappingProxyType[str, bool | str] = MappingProxyType(
    {
        "enabled": False,
        "reason": "forecast is not enabled",
    }
)


@dataclass
class ForecastResult:
    """Result from forecast generation."""

    predictions: list[dict[str, Any]]
    metrics: dict[str, float]
    model_params: dict[str, Any]


def _disabled_forecast(*_args: object, **_kwargs: object) -> Mapping[str, bool | str]:
    """Return the shared disabled payload without reading inputs."""
    return _FORECAST_DISABLED


def _empty_series() -> dict[str, list[Any]]:
    """Return an empty ds/y shape. No generated values."""
    return {"ds": [], "y": []}


class ForecastService:
    """Service for time-series forecasting. Operations stay disabled."""

    def __init__(self, session: Session) -> None:
        """
        Initialize forecast service.

        Args:
            session: Database session. Stored only. Forecasts are not read or written.
        """
        self.session = session

    async def generate_forecast(
        self,
        device_id: str,
        data_source: str,
        historical_data: object,
        horizon_days: int = 30,
        confidence_level: float = 0.95,
        seasonality_mode: str = "multiplicative",
        include_holidays: bool = True,
    ) -> Mapping[str, bool | str]:
        """
        Forecasting stays disabled.

        Args:
            device_id: Device identifier. Not used to build a series.
            data_source: Data source name. Not used to build a series.
            historical_data: Stored rows, if any. Not used to build a series.
            horizon_days: Requested horizon. Not used to build a series.
            confidence_level: Requested interval. Not used to build a series.
            seasonality_mode: Requested seasonality. Not used to build a series.
            include_holidays: Holiday flag. Not used to build a series.

        Returns:
            Frozen payload ``{"enabled": False, "reason": "forecast is not enabled"}``.
        """
        return _disabled_forecast(
            self.session,
            device_id,
            data_source,
            historical_data,
            horizon_days,
            confidence_level,
            seasonality_mode,
            include_holidays,
        )

    async def get_forecast(
        self,
        forecast_id: int,
        device_id: str,
    ) -> Mapping[str, bool | str]:
        """
        Forecast lookup stays disabled.

        Args:
            forecast_id: Forecast identifier. Not queried.
            device_id: Device identifier. Not queried.

        Returns:
            Frozen disabled payload.
        """
        return _disabled_forecast(self.session, forecast_id, device_id)

    async def list_forecasts(
        self,
        device_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> Mapping[str, bool | str]:
        """
        Forecast listing stays disabled.

        Args:
            device_id: Device identifier. Not queried.
            limit: Requested page size. Not queried.
            offset: Requested offset. Not queried.

        Returns:
            Frozen disabled payload.
        """
        return _disabled_forecast(self.session, device_id, limit, offset)

    async def delete_forecast(
        self,
        forecast_id: int,
        device_id: str,
    ) -> Mapping[str, bool | str]:
        """
        Forecast deletion stays disabled.

        Args:
            forecast_id: Forecast identifier. Not deleted.
            device_id: Device identifier. Not queried.

        Returns:
            Frozen disabled payload.
        """
        return _disabled_forecast(self.session, forecast_id, device_id)


def prepare_historical_data(
    data: list[dict[str, Any]],
    date_column: str = "date",
    value_column: str = "count",
) -> dict[str, list[Any]]:
    """
    Reshape stored rows into ds/y columns.

    Empty input stays offline and returns an empty series. Values are copied
    from the given rows and are not invented.

    Args:
        data: Stored data points.
        date_column: Name of the date field on each row.
        value_column: Name of the value field on each row.

    Returns:
        Mapping with ``ds`` and ``y`` lists.
    """
    if not data:
        return _empty_series()

    pairs = [(row[date_column], row[value_column]) for row in data]
    pairs.sort(key=lambda pair: pair[0])
    dates, values = zip(*pairs, strict=True)
    return {"ds": list(dates), "y": list(values)}


def generate_sample_time_series(
    start_date: str = "2023-01-01",
    days: int = 365,
    trend_slope: float = 0.5,
    seasonal_amplitude: float = 10.0,
    noise_level: float = 5.0,
) -> dict[str, list[Any]]:
    """
    Return an empty offline series.

    No numeric demo series is generated.

    Args:
        start_date: Accepted for callers. Not used to invent rows.
        days: Caller-facing length. Must be non-negative. Not used to invent rows.
        trend_slope: Accepted for callers. Not used to invent rows.
        seasonal_amplitude: Accepted for callers. Not used to invent rows.
        noise_level: Accepted for callers. Not used to invent rows.

    Returns:
        Empty ``ds`` and ``y`` lists.
    """
    del start_date, trend_slope, seasonal_amplitude, noise_level
    if days < 0:
        msg = "days must be non-negative"
        raise ValueError(msg)
    return _empty_series()
