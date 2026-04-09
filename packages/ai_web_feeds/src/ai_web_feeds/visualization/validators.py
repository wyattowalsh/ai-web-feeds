"""Input validation for visualization queries and data.

Implements FR-011d and FR-032e:
- Query parameter validation (whitelist, limits, ranges)
- Dashboard constraint validation
- Input sanitization
"""

import re
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from typing import Any

from loguru import logger
from pydantic import BaseModel, Field, field_validator
from pydantic import ValidationError as PydanticValidationError

# Allowed table names for direct queries
ALLOWED_TABLES = frozenset(
    [
        "topic_metrics",
        "feed_health",
        "validation_logs",
        "article_metadata",
    ]
)

# Maximum query result size
MAX_QUERY_RESULTS = 100_000

# Dashboard constraints
MAX_WIDGETS_PER_DASHBOARD = 20
MIN_WIDGET_WIDTH = 2
MIN_WIDGET_HEIGHT = 2
MAX_GRID_COLUMN = 11  # 0-indexed, so 12 columns = 0-11


class ValidationError(Exception):
    """Validation error with stable compatibility metadata."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "validation_error",
        field: str | None = None,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.field = field
        self.details = details or {}

    @classmethod
    def from_pydantic_error(
        cls,
        error: dict[str, Any],
        *,
        code: str = "validation_error",
    ) -> "ValidationError":
        """Build a normalized validation error from a Pydantic error payload."""
        raw_location = [str(part) for part in error.get("loc", ()) if part != "__root__"]
        field = ".".join(raw_location) or None

        details: dict[str, Any] = {}
        error_type = error.get("type")
        if isinstance(error_type, str) and error_type:
            details["type"] = error_type

        return cls(
            str(error.get("msg", "Validation error")),
            code=code,
            field=field,
            details=details or None,
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize the error to an API-friendly detail payload."""
        payload: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
        }
        if self.field is not None:
            payload["field"] = self.field
        if self.details:
            payload["details"] = self.details
        return payload


def validation_error_detail(
    error: ValidationError | str,
    *,
    code: str = "validation_error",
) -> dict[str, Any]:
    """Return a normalized error detail payload for API responses."""
    if isinstance(error, ValidationError):
        return error.to_dict()
    return ValidationError(str(error), code=code).to_dict()


_DATE_RANGE_ALIASES = {
    "startDate": "start",
    "start_date": "start",
    "endDate": "end",
    "end_date": "end",
}
_FILTER_ALIASES = {
    "topicIds": "topic_ids",
    "feedIds": "feed_ids",
    "datePreset": "date_preset",
    "dateRange": "date_range",
}
_CUSTOMIZATION_ALIASES = {
    "showLegend": "show_legend",
    "legendPosition": "legend_position",
    "titleFontSize": "title_font_size",
    "xAxisLabel": "x_axis_label",
    "yAxisLabel": "y_axis_label",
    "gridLines": "grid_lines",
    "showTooltips": "show_tooltips",
}
_FORECAST_ALIASES = {
    "horizon_days": "forecast_horizon_days",
    "metrics": "accuracy_metrics",
}
_FORECAST_PREDICTION_ALIASES = {
    "confidence_lower": "lower",
    "confidenceLower": "lower",
    "confidence_upper": "upper",
    "confidenceUpper": "upper",
}


def _normalize_mapping_aliases(
    payload: dict[str, Any],
    aliases: dict[str, str],
) -> dict[str, Any]:
    normalized = dict(payload)
    for legacy_key, canonical_key in aliases.items():
        if legacy_key in normalized and canonical_key not in normalized:
            normalized[canonical_key] = normalized.pop(legacy_key)
    return normalized


def normalize_cache_payload(payload: Any) -> Any:
    """Canonicalize compatible cache inputs before key generation."""
    if isinstance(payload, dict):
        normalized = _normalize_mapping_aliases(dict(payload), _FILTER_ALIASES)
        normalized = _normalize_mapping_aliases(normalized, _DATE_RANGE_ALIASES)
        normalized = _normalize_mapping_aliases(normalized, _CUSTOMIZATION_ALIASES)

        return {key: normalize_cache_payload(value) for key, value in normalized.items()}

    if isinstance(payload, list):
        normalized_items = [normalize_cache_payload(item) for item in payload]
        if all(not isinstance(item, dict | list) for item in normalized_items):
            try:
                return sorted(normalized_items)
            except TypeError:
                return normalized_items
        return normalized_items

    return payload


def normalize_date_range_payload(date_range: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize legacy date-range aliases to the canonical API shape."""
    if not isinstance(date_range, dict):
        return {}
    return normalize_cache_payload(date_range)


def normalize_filter_payload(filters: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize visualization filter aliases used by web and legacy clients."""
    if not isinstance(filters, dict):
        return {}
    return normalize_cache_payload(filters)


def normalize_customization_payload(customization: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize chart customization aliases to snake_case keys."""
    if not isinstance(customization, dict):
        return {}
    return normalize_cache_payload(customization)


def normalize_dashboard_widget_payload(widget: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize legacy dashboard widget coordinates to a position object."""
    if not isinstance(widget, dict):
        return {}

    normalized = dict(widget)
    position = normalized.get("position")
    if isinstance(position, dict):
        normalized["position"] = {
            "x": position.get("x", position.get("position_x", 0)),
            "y": position.get("y", position.get("position_y", 0)),
            "w": position.get("w", position.get("width", 12)),
            "h": position.get("h", position.get("height", 4)),
        }
        return normalized

    if any(key in normalized for key in ("position_x", "position_y", "width", "height")):
        normalized["position"] = {
            "x": normalized.pop("position_x", 0),
            "y": normalized.pop("position_y", 0),
            "w": normalized.pop("width", 12),
            "h": normalized.pop("height", 4),
        }

    return normalized


def normalize_forecast_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize forecast request/response aliases to canonical field names."""
    if not isinstance(payload, dict):
        return {}

    normalized = _normalize_mapping_aliases(payload, _FORECAST_ALIASES)
    if isinstance(normalized.get("accuracy_metrics"), dict):
        normalized["accuracy_metrics"] = normalize_cache_payload(normalized["accuracy_metrics"])
    return normalized


def normalize_forecast_prediction_payload(
    prediction: dict[str, Any] | None,
) -> dict[str, Any]:
    """Normalize forecast prediction interval aliases."""
    if not isinstance(prediction, dict):
        return {}

    return _normalize_mapping_aliases(prediction, _FORECAST_PREDICTION_ALIASES)


class DateRangeValidator(BaseModel):
    """Validate date range parameters."""

    start: datetime = Field(description="Start date (inclusive)")
    end: datetime = Field(description="End date (inclusive)")

    @field_validator("start", "end")
    @classmethod
    def normalize_to_utc(cls, v: datetime) -> datetime:
        """Normalize datetimes to UTC while tolerating naive input."""
        if v.tzinfo is None:
            return v.replace(tzinfo=UTC)
        return v.astimezone(UTC)

    @field_validator("end")
    @classmethod
    def validate_end_after_start(cls, v: datetime, info) -> datetime:
        """Ensure end date is after start date."""
        start = info.data.get("start")
        if start and v < start:
            raise ValueError("End date must be after start date")
        return v

    @field_validator("start", "end")
    @classmethod
    def validate_not_future(cls, v: datetime) -> datetime:
        """Ensure dates are not in the future."""
        if v > datetime.now(UTC):
            raise ValueError("Date cannot be in the future")
        return v

    def validate_max_range(self, max_days: int = 365) -> None:
        """Validate maximum date range.

        Args:
            max_days: Maximum allowed days in range

        Raises:
            ValidationError: If range exceeds maximum
        """
        delta = self.end - self.start
        if delta.days > max_days:
            raise ValidationError(
                f"Date range exceeds maximum of {max_days} days (requested: {delta.days} days)"
            )


class QueryValidator:
    """Validate database query parameters."""

    @staticmethod
    def validate_table_name(table_name: str) -> str:
        """Validate table name against whitelist.

        Args:
            table_name: Requested table name

        Returns:
            Validated table name

        Raises:
            ValidationError: If table not in whitelist
        """
        if table_name not in ALLOWED_TABLES:
            raise ValidationError(
                f"Table '{table_name}' not allowed. "
                f"Allowed tables: {', '.join(sorted(ALLOWED_TABLES))}",
                code="invalid_table_name",
                field="table_name",
                details={"allowed_values": sorted(ALLOWED_TABLES)},
            )
        return table_name

    @staticmethod
    def validate_result_limit(limit: int) -> int:
        """Validate query result limit.

        Args:
            limit: Requested limit

        Returns:
            Validated limit

        Raises:
            ValidationError: If limit exceeds maximum
        """
        if limit <= 0:
            raise ValidationError(
                "Limit must be positive",
                code="invalid_limit",
                field="limit",
            )
        if limit > MAX_QUERY_RESULTS:
            raise ValidationError(
                f"Limit exceeds maximum of {MAX_QUERY_RESULTS:,} rows (requested: {limit:,})",
                code="invalid_limit",
                field="limit",
                details={"max_limit": MAX_QUERY_RESULTS, "requested": limit},
            )
        return limit

    @staticmethod
    def sanitize_like_clause(value: str) -> str:
        """Sanitize LIKE clause input to prevent SQL injection.

        Args:
            value: User input for LIKE clause

        Returns:
            Sanitized value

        Raises:
            ValidationError: If value contains suspicious patterns
        """
        # Check for SQL injection patterns
        suspicious_patterns = [
            r"--",  # SQL comment
            r";",  # Statement terminator
            r"\bDROP\b",
            r"\bDELETE\b",
            r"\bINSERT\b",
            r"\bUPDATE\b",
            r"\bEXEC\b",
            r"\bUNION\b",
            r"\bSELECT\b",
        ]

        value_upper = value.upper()
        for pattern in suspicious_patterns:
            if re.search(pattern, value_upper, re.IGNORECASE):
                raise ValidationError(f"Input contains suspicious pattern: {pattern}")

        # Escape special characters for LIKE
        # User wants literal %, _ → escape them
        value = value.replace("%", r"\%").replace("_", r"\_")

        return value


class DashboardValidator:
    """Validate dashboard configuration and constraints."""

    @staticmethod
    def validate_widget_count(widget_count: int) -> int:
        """Validate widget count doesn't exceed limit.

        Args:
            widget_count: Number of widgets

        Returns:
            Validated count

        Raises:
            ValidationError: If count exceeds limit
        """
        if widget_count > MAX_WIDGETS_PER_DASHBOARD:
            raise ValidationError(
                f"Dashboard cannot have more than {MAX_WIDGETS_PER_DASHBOARD} widgets "
                f"(requested: {widget_count})"
            )
        return widget_count

    @staticmethod
    def validate_widget_position(position: dict[str, int]) -> dict[str, int]:
        """Validate widget grid position.

        Args:
            position: Position dict with {x, y, w, h}

        Returns:
            Validated position

        Raises:
            ValidationError: If position is invalid
        """
        required_keys = {"x", "y", "w", "h"}
        if not required_keys.issubset(position.keys()):
            raise ValidationError(f"Position must contain keys: {', '.join(required_keys)}")

        x, y, w, h = position["x"], position["y"], position["w"], position["h"]

        # Validate dimensions
        if w < MIN_WIDGET_WIDTH:
            raise ValidationError(f"Widget width must be at least {MIN_WIDGET_WIDTH} (got: {w})")
        if h < MIN_WIDGET_HEIGHT:
            raise ValidationError(f"Widget height must be at least {MIN_WIDGET_HEIGHT} (got: {h})")

        # Validate column boundaries
        if x < 0 or x > MAX_GRID_COLUMN:
            raise ValidationError(f"Widget x position must be 0-{MAX_GRID_COLUMN} (got: {x})")

        if x + w > MAX_GRID_COLUMN + 1:  # +1 because width is inclusive
            raise ValidationError(f"Widget extends beyond grid boundary (x={x}, w={w})")

        # Validate row boundaries
        if y < 0:
            raise ValidationError(f"Widget y position must be non-negative (got: {y})")

        return position

    @staticmethod
    def check_widget_overlap(positions: list[dict[str, int]]) -> list[tuple[int, int]]:
        """Check for overlapping widgets.

        Args:
            positions: List of widget positions

        Returns:
            List of (index1, index2) tuples for overlapping widgets

        Raises:
            ValidationError: If widgets overlap
        """
        overlaps = []

        for i, pos1 in enumerate(positions):
            for j, pos2 in enumerate(positions[i + 1 :], start=i + 1):
                # Check if rectangles overlap
                if (
                    pos1["x"] < pos2["x"] + pos2["w"]
                    and pos1["x"] + pos1["w"] > pos2["x"]
                    and pos1["y"] < pos2["y"] + pos2["h"]
                    and pos1["y"] + pos1["h"] > pos2["y"]
                ):
                    overlaps.append((i, j))

        if overlaps:
            overlap_desc = ", ".join(f"widgets {i} and {j}" for i, j in overlaps)
            raise ValidationError(f"Widget overlap detected: {overlap_desc}")

        return overlaps


class CustomizationValidator:
    """Validate chart customization values."""

    MAX_TITLE_LENGTH = 200
    MAX_COLOR_COUNT = 50
    MIN_FONT_SIZE = 8
    MAX_FONT_SIZE = 72
    MIN_OPACITY = 0
    MAX_OPACITY = 100

    @staticmethod
    def validate_title(title: str) -> str:
        """Validate and truncate chart title.

        Args:
            title: Chart title

        Returns:
            Validated title (truncated if too long)
        """
        if len(title) > CustomizationValidator.MAX_TITLE_LENGTH:
            logger.warning(
                f"Title truncated from {len(title)} to "
                f"{CustomizationValidator.MAX_TITLE_LENGTH} characters"
            )
            return title[: CustomizationValidator.MAX_TITLE_LENGTH] + "..."
        return title

    @staticmethod
    def validate_colors(colors: list[str]) -> list[str]:
        """Validate color palette.

        Args:
            colors: List of hex color codes

        Returns:
            Validated colors

        Raises:
            ValidationError: If too many colors or invalid format
        """
        if len(colors) > CustomizationValidator.MAX_COLOR_COUNT:
            raise ValidationError(
                f"Color palette exceeds maximum of "
                f"{CustomizationValidator.MAX_COLOR_COUNT} colors "
                f"(provided: {len(colors)})"
            )

        # Validate hex color format
        hex_pattern = re.compile(r"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$")
        for color in colors:
            if not hex_pattern.match(color):
                raise ValidationError(f"Invalid hex color code: {color}")

        return colors

    @staticmethod
    def validate_font_size(size: int) -> int:
        """Validate font size within allowed range.

        Args:
            size: Font size in pixels

        Returns:
            Clamped font size

        Raises:
            ValidationError: If size is outside allowed range
        """
        if size < CustomizationValidator.MIN_FONT_SIZE:
            raise ValidationError(
                f"Font size must be at least {CustomizationValidator.MIN_FONT_SIZE}px "
                f"(got: {size}px)"
            )
        if size > CustomizationValidator.MAX_FONT_SIZE:
            raise ValidationError(
                f"Font size must be at most {CustomizationValidator.MAX_FONT_SIZE}px "
                f"(got: {size}px)"
            )
        return size

    @staticmethod
    def validate_opacity(opacity: int) -> int:
        """Validate opacity percentage.

        Args:
            opacity: Opacity value (0-100)

        Returns:
            Clamped opacity

        Raises:
            ValidationError: If opacity is outside 0-100 range
        """
        if opacity < CustomizationValidator.MIN_OPACITY:
            raise ValidationError(f"Opacity must be at least 0 (got: {opacity})")
        if opacity > CustomizationValidator.MAX_OPACITY:
            raise ValidationError(f"Opacity must be at most 100 (got: {opacity})")
        return opacity


class ForecastValidator:
    """Validate forecasting input parameters."""

    MIN_DATA_DAYS = 60
    RECOMMENDED_DATA_DAYS = 90
    MAX_DATA_GAP_DAYS = 14
    MIN_COMPLETENESS = 0.5  # 50% minimum data completeness

    @staticmethod
    def validate_training_data(
        data_points: int,
        date_range_days: int,
        gaps: list[int],
    ) -> None:
        """Validate forecasting training data quality.

        Args:
            data_points: Number of data points
            date_range_days: Total days in date range
            gaps: List of gap sizes in days

        Raises:
            ValidationError: If data is insufficient
        """
        # Check minimum data requirement
        if date_range_days < ForecastValidator.MIN_DATA_DAYS:
            raise ValidationError(
                f"Insufficient data for forecast: {date_range_days} days "
                f"(minimum: {ForecastValidator.MIN_DATA_DAYS} days)"
            )

        # Warn about recommended minimum
        if date_range_days < ForecastValidator.RECOMMENDED_DATA_DAYS:
            logger.warning(
                f"Limited data may reduce accuracy: {date_range_days} days "
                f"(recommended: {ForecastValidator.RECOMMENDED_DATA_DAYS}+ days)"
            )

        # Check for large data gaps
        large_gaps = [g for g in gaps if g > ForecastValidator.MAX_DATA_GAP_DAYS]
        if large_gaps:
            logger.warning(f"Data gap detected: {max(large_gaps)} days (may affect accuracy)")

        # Check data completeness
        completeness = data_points / date_range_days
        if completeness < ForecastValidator.MIN_COMPLETENESS:
            raise ValidationError(
                f"Data quality too low: {completeness:.1%} completeness "
                f"(minimum: {ForecastValidator.MIN_COMPLETENESS:.1%})"
            )


def validate_table_name(table_name: str) -> str:
    """Compatibility wrapper for direct table-name validation."""
    if not isinstance(table_name, str) or not table_name:
        raise ValidationError(
            "Table name must be a non-empty string",
            code="invalid_table_name",
            field="table_name",
        )
    return QueryValidator.validate_table_name(table_name)


def validate_query_limit(limit: int | None, max_limit: int = 10_000) -> int:
    """Compatibility wrapper that caps large limits instead of raising."""
    if limit is None or limit <= 0:
        raise ValidationError(
            "Limit must be positive",
            code="invalid_limit",
            field="limit",
        )
    return min(limit, max_limit)


def validate_date_range(
    start: str,
    end: str,
    max_days: int = 365,
) -> tuple[str, str]:
    """Validate ISO date strings and preserve the original string representation."""
    try:
        start_dt = datetime.fromisoformat(start)
        end_dt = datetime.fromisoformat(end)
    except ValueError as exc:
        raise ValidationError(
            "Date range must use YYYY-MM-DD format",
            code="invalid_date_range",
            field="date_range",
        ) from exc

    try:
        validator = DateRangeValidator(start=start_dt, end=end_dt)
    except PydanticValidationError as exc:
        raise ValidationError.from_pydantic_error(
            exc.errors()[0],
            code="invalid_date_range",
        ) from exc
    validator.validate_max_range(max_days=max_days)
    return start, end


def sanitize_like_clause(value: str) -> str:
    """Compatibility helper that escapes LIKE special characters only."""
    if not isinstance(value, str):
        raise ValidationError("LIKE clause must be a string")
    return value.replace("'", "''").replace("%", r"\%").replace("_", r"\_")


def validate_dashboard_constraints(widgets: list[dict[str, int]]) -> None:
    """Validate legacy dashboard widget payloads."""
    try:
        DashboardValidator.validate_widget_count(len(widgets))
    except ValidationError as exc:
        if "more than" in str(exc):
            raise ValidationError(
                f"Dashboard supports a maximum {MAX_WIDGETS_PER_DASHBOARD} widgets"
            ) from exc
        raise

    normalized_positions = []
    for widget in widgets:
        normalized_widget = normalize_dashboard_widget_payload(widget)
        position = normalized_widget.get("position")
        if not isinstance(position, dict):
            raise ValidationError("Widget position must contain x, y, w, and h values")
        try:
            DashboardValidator.validate_widget_position(position)
        except ValidationError as exc:
            message = str(exc)
            if "boundary" in message:
                raise ValidationError("Widget is out of bounds") from exc
            raise
        normalized_positions.append(position)

    DashboardValidator.check_widget_overlap(normalized_positions)


def validate_customization(customization: dict[str, Any]) -> None:
    """Validate the legacy customization payload shape."""
    normalized = normalize_customization_payload(customization)

    title = normalized.get("title")
    if isinstance(title, str):
        CustomizationValidator.validate_title(title)

    legend_position = normalized.get("legend_position")
    if legend_position and legend_position not in {"top", "bottom", "left", "right"}:
        raise ValidationError(
            "Invalid legend position",
            code="invalid_customization",
            field="legend_position",
            details={"allowed_values": ["top", "bottom", "left", "right"]},
        )

    colors = normalized.get("colors")
    if colors:
        CustomizationValidator.validate_colors(colors)

    title_font_size = normalized.get("title_font_size")
    if title_font_size is not None:
        CustomizationValidator.validate_font_size(title_font_size)


def validate_forecast_data(predictions: list[dict[str, Any]], horizon_days: int) -> None:
    """Validate the legacy forecast payload shape."""
    if len(predictions) != horizon_days:
        raise ValidationError("Forecast predictions count does not match horizon days")

    required_fields = {"date", "value", "lower", "upper"}
    parsed_dates: list[datetime] = []
    for raw_prediction in predictions:
        prediction = normalize_forecast_prediction_payload(raw_prediction)
        if not required_fields.issubset(prediction):
            raise ValidationError("Forecast predictions must include required fields")

        if prediction["lower"] > prediction["upper"]:
            raise ValidationError("Forecast lower bound must not exceed upper bound")
        if prediction["lower"] > prediction["value"] or prediction["value"] > prediction["upper"]:
            raise ValidationError("Forecast value must be between lower and upper bounds")

        try:
            parsed_dates.append(datetime.fromisoformat(prediction["date"]))
        except ValueError as exc:
            raise ValidationError("Forecast dates must use YYYY-MM-DD format") from exc

    for previous, current in pairwise(parsed_dates):
        if current - previous != timedelta(days=1):
            raise ValidationError("Forecast dates must be sequential")
