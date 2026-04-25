"""Unit tests for visualization validators."""

from datetime import UTC, datetime, timedelta

import pytest
from ai_web_feeds.visualization.validators import (
    CustomizationValidator,
    DashboardValidator,
    DateRangeValidator,
    ForecastValidator,
    QueryValidator,
    ValidationError,
)


class TestTableNameValidation:
    """Test table name validation."""

    def test_validate_table_name_valid(self):
        """Whitelisted table names should pass."""
        assert QueryValidator.validate_table_name("topic_metrics") == "topic_metrics"

    def test_validate_table_name_invalid(self):
        """Unexpected table names should be rejected."""
        with pytest.raises(ValidationError):
            QueryValidator.validate_table_name("users")


class TestQueryLimitValidation:
    """Test query result limit validation."""

    def test_validate_query_limit_valid(self):
        """A reasonable limit should pass unchanged."""
        assert QueryValidator.validate_result_limit(500) == 500

    def test_validate_query_limit_too_small(self):
        """Zero and negative limits should fail."""
        with pytest.raises(ValidationError):
            QueryValidator.validate_result_limit(0)

    def test_validate_query_limit_too_large(self):
        """Excessive limits should fail rather than silently clamp."""
        with pytest.raises(ValidationError):
            QueryValidator.validate_result_limit(200_000)


class TestDateRangeValidation:
    """Test date range validation."""

    def test_validate_date_range_valid(self):
        """A valid range should normalize to UTC."""
        validator = DateRangeValidator.model_validate(
            {
                "start": "2024-01-01T00:00:00Z",
                "end": "2024-01-31T00:00:00Z",
            }
        )

        assert validator.start.tzinfo == UTC
        assert validator.end.tzinfo == UTC

    def test_validate_date_range_inverted(self):
        """End dates before start should fail."""
        with pytest.raises(ValueError):
            DateRangeValidator.model_validate(
                {
                    "start": "2024-02-01T00:00:00Z",
                    "end": "2024-01-01T00:00:00Z",
                }
            )

    def test_validate_date_range_future(self):
        """Future dates should be rejected."""
        future = (datetime.now(UTC) + timedelta(days=10)).isoformat()
        today = datetime.now(UTC).isoformat()

        with pytest.raises(ValueError):
            DateRangeValidator.model_validate({"start": today, "end": future})

    def test_validate_date_range_max_days(self):
        """Very large ranges should fail max-range validation."""
        validator = DateRangeValidator.model_validate(
            {
                "start": "2020-01-01T00:00:00Z",
                "end": "2024-01-01T00:00:00Z",
            }
        )

        with pytest.raises(ValidationError):
            validator.validate_max_range(max_days=365)


class TestLikeClauseSanitization:
    """Test LIKE clause sanitization."""

    def test_sanitize_like_clause_basic(self):
        """Plain text should pass through unchanged."""
        assert QueryValidator.sanitize_like_clause("test") == "test"

    def test_sanitize_like_clause_special_chars(self):
        """Wildcard characters should be escaped."""
        assert QueryValidator.sanitize_like_clause("test%value") == r"test\%value"
        assert QueryValidator.sanitize_like_clause("test_value") == r"test\_value"

    def test_sanitize_like_clause_sql_keywords(self):
        """Suspicious SQL patterns should be rejected."""
        with pytest.raises(ValidationError):
            QueryValidator.sanitize_like_clause("DROP TABLE")


class TestDashboardConstraints:
    """Test dashboard validation rules."""

    def test_validate_widget_count(self):
        """A valid widget count should pass."""
        assert DashboardValidator.validate_widget_count(2) == 2

    def test_validate_widget_count_too_many(self):
        """Widget count above the cap should fail."""
        with pytest.raises(ValidationError):
            DashboardValidator.validate_widget_count(21)

    def test_validate_widget_position_valid(self):
        """Valid widget positions should pass."""
        position = {"x": 0, "y": 0, "w": 6, "h": 4}
        assert DashboardValidator.validate_widget_position(position) == position

    def test_validate_widget_position_out_of_bounds(self):
        """Widgets extending past the grid should fail."""
        with pytest.raises(ValidationError):
            DashboardValidator.validate_widget_position({"x": 10, "y": 0, "w": 6, "h": 4})

    def test_validate_widget_overlap(self):
        """Overlapping widgets should be detected."""
        positions = [
            {"x": 0, "y": 0, "w": 6, "h": 4},
            {"x": 2, "y": 2, "w": 6, "h": 4},
        ]
        with pytest.raises(ValidationError):
            DashboardValidator.check_widget_overlap(positions)


class TestCustomizationValidation:
    """Test chart customization validation."""

    def test_validate_title_truncates(self):
        """Long titles should be truncated rather than rejected."""
        title = "A" * 250

        result = CustomizationValidator.validate_title(title)

        assert len(result) == CustomizationValidator.MAX_TITLE_LENGTH + 3
        assert result.endswith("...")

    def test_validate_colors(self):
        """Valid hex colors should be preserved."""
        colors = ["#ff0000", "#00ff00", "#0000ff"]
        assert CustomizationValidator.validate_colors(colors) == colors

    def test_validate_colors_invalid(self):
        """Invalid hex colors should fail."""
        with pytest.raises(ValidationError):
            CustomizationValidator.validate_colors(["invalid-color"])

    def test_validate_font_size_range(self):
        """Font sizes outside the supported range should fail."""
        with pytest.raises(ValidationError):
            CustomizationValidator.validate_font_size(5)

        with pytest.raises(ValidationError):
            CustomizationValidator.validate_font_size(100)

    def test_validate_opacity_range(self):
        """Opacity outside 0-100 should fail."""
        with pytest.raises(ValidationError):
            CustomizationValidator.validate_opacity(-1)

        with pytest.raises(ValidationError):
            CustomizationValidator.validate_opacity(101)


class TestForecastDataValidation:
    """Test forecast data validation."""

    def test_validate_forecast_data_valid(self):
        """Adequate training data should pass."""
        ForecastValidator.validate_training_data(
            data_points=75,
            date_range_days=90,
            gaps=[1, 2, 5],
        )

    def test_validate_forecast_data_insufficient_range(self):
        """Insufficient training history should fail."""
        with pytest.raises(ValidationError):
            ForecastValidator.validate_training_data(
                data_points=20,
                date_range_days=30,
                gaps=[],
            )

    def test_validate_forecast_data_low_completeness(self):
        """Sparse historical data should fail completeness checks."""
        with pytest.raises(ValidationError):
            ForecastValidator.validate_training_data(
                data_points=20,
                date_range_days=90,
                gaps=[1],
            )
