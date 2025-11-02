"""Input validation for visualization queries and data.

Implements FR-011d and FR-032e:
- Query parameter validation (whitelist, limits, ranges)
- Dashboard constraint validation
- Input sanitization
"""

import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from loguru import logger


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
    """Validation error with detailed message."""

    pass


class DateRangeValidator(BaseModel):
    """Validate date range parameters."""

    start: datetime = Field(description="Start date (inclusive)")
    end: datetime = Field(description="End date (inclusive)")

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
        if v > datetime.utcnow():
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
                f"Date range exceeds maximum of {max_days} days "
                f"(requested: {delta.days} days)"
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
                f"Allowed tables: {', '.join(sorted(ALLOWED_TABLES))}"
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
            raise ValidationError("Limit must be positive")
        if limit > MAX_QUERY_RESULTS:
            raise ValidationError(
                f"Limit exceeds maximum of {MAX_QUERY_RESULTS:,} rows "
                f"(requested: {limit:,})"
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
                raise ValidationError(
                    f"Input contains suspicious pattern: {pattern}"
                )

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
            raise ValidationError(
                f"Position must contain keys: {', '.join(required_keys)}"
            )

        x, y, w, h = position["x"], position["y"], position["w"], position["h"]

        # Validate dimensions
        if w < MIN_WIDGET_WIDTH:
            raise ValidationError(
                f"Widget width must be at least {MIN_WIDGET_WIDTH} "
                f"(got: {w})"
            )
        if h < MIN_WIDGET_HEIGHT:
            raise ValidationError(
                f"Widget height must be at least {MIN_WIDGET_HEIGHT} "
                f"(got: {h})"
            )

        # Validate column boundaries
        if x < 0 or x > MAX_GRID_COLUMN:
            raise ValidationError(
                f"Widget x position must be 0-{MAX_GRID_COLUMN} (got: {x})"
            )

        if x + w > MAX_GRID_COLUMN + 1:  # +1 because width is inclusive
            raise ValidationError(
                f"Widget extends beyond grid boundary (x={x}, w={w})"
            )

        # Validate row boundaries
        if y < 0:
            raise ValidationError(f"Widget y position must be non-negative (got: {y})")

        return position

    @staticmethod
    def check_widget_overlap(
        positions: list[dict[str, int]]
    ) -> list[tuple[int, int]]:
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
            overlap_desc = ", ".join(
                f"widgets {i} and {j}" for i, j in overlaps
            )
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
            logger.warning(
                f"Data gap detected: {max(large_gaps)} days "
                f"(may affect accuracy)"
            )

        # Check data completeness
        completeness = data_points / date_range_days
        if completeness < ForecastValidator.MIN_COMPLETENESS:
            raise ValidationError(
                f"Data quality too low: {completeness:.1%} completeness "
                f"(minimum: {ForecastValidator.MIN_COMPLETENESS:.1%})"
            )
