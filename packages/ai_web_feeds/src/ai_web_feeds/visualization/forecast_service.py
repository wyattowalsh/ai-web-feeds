"""
Time-series forecasting service using Prophet.

Implements Phase 6 (US4): T058-T074
- Prophet model training
- Forecast generation
- Confidence intervals
- Model evaluation metrics
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from loguru import logger
from prophet import Prophet
from sqlalchemy.orm import Session

from ai_web_feeds.visualization.models import Forecast


@dataclass
class ForecastResult:
    """Result from forecast generation."""

    predictions: list[dict[str, Any]]
    metrics: dict[str, float]
    model_params: dict[str, Any]


class ForecastService:
    """Service for time-series forecasting."""

    def __init__(self, session: Session):
        """
        Initialize forecast service.

        Args:
            session: Database session
        """
        self.session = session

    async def generate_forecast(
        self,
        device_id: str,
        data_source: str,
        historical_data: pd.DataFrame,
        horizon_days: int = 30,
        confidence_level: float = 0.95,
        seasonality_mode: str = "multiplicative",
        include_holidays: bool = True,
    ) -> Forecast:
        """
        Generate time-series forecast using Prophet.

        Args:
            device_id: Device identifier
            data_source: Data source (topics, feeds, articles)
            historical_data: Historical time series (columns: ds, y)
            horizon_days: Number of days to forecast
            confidence_level: Confidence interval (0.80, 0.95, 0.99)
            seasonality_mode: 'additive' or 'multiplicative'
            include_holidays: Include US holidays

        Returns:
            Forecast object with predictions and metrics
        """
        logger.info(f"Generating {horizon_days}-day forecast for {data_source}")

        # Validate input data
        if not {"ds", "y"}.issubset(historical_data.columns):
            msg = "Historical data must have 'ds' (date) and 'y' (value) columns"
            raise ValueError(msg)

        # Prepare Prophet model
        model = Prophet(
            interval_width=confidence_level,
            seasonality_mode=seasonality_mode,
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=True,
        )

        if include_holidays:
            # Add US holidays
            from prophet.utilities import regressor_coefficients

            model.add_country_holidays(country_name="US")

        # Fit model
        try:
            model.fit(historical_data)
        except Exception as e:
            logger.error(f"Failed to fit Prophet model: {e}")
            raise

        # Make future dataframe
        future = model.make_future_dataframe(periods=horizon_days)

        # Generate predictions
        forecast_df = model.predict(future)

        # Extract predictions for future dates only
        future_predictions = forecast_df.tail(horizon_days)

        predictions = []
        for _, row in future_predictions.iterrows():
            predictions.append({
                "date": row["ds"].strftime("%Y-%m-%d"),
                "value": float(row["yhat"]),
                "lower": float(row["yhat_lower"]),
                "upper": float(row["yhat_upper"]),
                "trend": float(row["trend"]),
                "seasonal": float(row.get("weekly", 0) + row.get("yearly", 0)),
            })

        # Calculate evaluation metrics on historical data
        metrics = self._calculate_metrics(historical_data, forecast_df.head(len(historical_data)))

        # Create and save forecast
        forecast = Forecast(
            device_id=device_id,
            data_source=data_source,
            horizon_days=horizon_days,
            confidence_level=confidence_level,
            predictions=predictions,
            metrics=metrics,
        )

        self.session.add(forecast)
        self.session.commit()

        logger.info(f"Forecast created with MAE={metrics['mae']:.2f}, RMSE={metrics['rmse']:.2f}")

        return forecast

    def _calculate_metrics(
        self,
        actual: pd.DataFrame,
        predicted: pd.DataFrame,
    ) -> dict[str, float]:
        """
        Calculate forecast evaluation metrics.

        Args:
            actual: Actual values (columns: ds, y)
            predicted: Predicted values (columns: ds, yhat)

        Returns:
            Dictionary of metrics
        """
        # Merge actual and predicted
        merged = actual.merge(predicted[["ds", "yhat"]], on="ds", how="inner")

        y_true = merged["y"].values
        y_pred = merged["yhat"].values

        # Calculate metrics
        mae = float(np.mean(np.abs(y_true - y_pred)))
        rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
        mape = float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100)

        # R-squared
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        r2 = float(1 - (ss_res / ss_tot))

        return {
            "mae": mae,
            "rmse": rmse,
            "mape": mape,
            "r2": r2,
        }

    async def get_forecast(
        self,
        forecast_id: int,
        device_id: str,
    ) -> Forecast | None:
        """
        Get forecast by ID.

        Args:
            forecast_id: Forecast identifier
            device_id: Device identifier

        Returns:
            Forecast object or None
        """
        return (
            self.session.query(Forecast)
            .filter(
                Forecast.id == forecast_id,
                Forecast.device_id == device_id,
            )
            .first()
        )

    async def list_forecasts(
        self,
        device_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Forecast]:
        """
        List forecasts for a device.

        Args:
            device_id: Device identifier
            limit: Maximum number of results
            offset: Pagination offset

        Returns:
            List of forecasts
        """
        return (
            self.session.query(Forecast)
            .filter(Forecast.device_id == device_id)
            .order_by(Forecast.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

    async def delete_forecast(
        self,
        forecast_id: int,
        device_id: str,
    ) -> bool:
        """
        Delete a forecast.

        Args:
            forecast_id: Forecast identifier
            device_id: Device identifier

        Returns:
            True if deleted, False if not found
        """
        forecast = await self.get_forecast(forecast_id, device_id)

        if not forecast:
            return False

        self.session.delete(forecast)
        self.session.commit()

        logger.info(f"Deleted forecast {forecast_id}")
        return True


def prepare_historical_data(
    data: list[dict[str, Any]],
    date_column: str = "date",
    value_column: str = "count",
) -> pd.DataFrame:
    """
    Prepare historical data for Prophet.

    Args:
        data: List of data points
        date_column: Name of date column
        value_column: Name of value column

    Returns:
        DataFrame with 'ds' and 'y' columns
    """
    df = pd.DataFrame(data)

    # Rename columns to Prophet format
    df = df.rename(columns={date_column: "ds", value_column: "y"})

    # Convert date to datetime
    df["ds"] = pd.to_datetime(df["ds"])

    # Sort by date
    df = df.sort_values("ds")

    return df[["ds", "y"]]


def generate_sample_time_series(
    start_date: str = "2023-01-01",
    days: int = 365,
    trend_slope: float = 0.5,
    seasonal_amplitude: float = 10.0,
    noise_level: float = 5.0,
) -> pd.DataFrame:
    """
    Generate sample time series data for testing.

    Args:
        start_date: Start date (YYYY-MM-DD)
        days: Number of days
        trend_slope: Linear trend slope
        seasonal_amplitude: Seasonal component amplitude
        noise_level: Random noise standard deviation

    Returns:
        DataFrame with 'ds' and 'y' columns
    """
    dates = pd.date_range(start=start_date, periods=days, freq="D")

    # Generate components
    trend = np.arange(days) * trend_slope
    seasonal = seasonal_amplitude * np.sin(2 * np.pi * np.arange(days) / 7)  # Weekly
    noise = np.random.normal(0, noise_level, days)

    # Combine
    values = 100 + trend + seasonal + noise

    return pd.DataFrame({"ds": dates, "y": values})
