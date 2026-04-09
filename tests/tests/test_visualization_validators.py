"""
Unit tests for visualization validators.

Tests input validation and sanitization functions.
"""

from datetime import datetime, timedelta

import pytest
from ai_web_feeds.visualization.validators import (
    CustomizationValidator,
    ValidationError,
    normalize_customization_payload,
    normalize_dashboard_widget_payload,
    normalize_filter_payload,
    normalize_forecast_payload,
    normalize_forecast_prediction_payload,
    sanitize_like_clause,
    validate_customization,
    validate_dashboard_constraints,
    validate_date_range,
    validate_forecast_data,
    validate_query_limit,
    validate_table_name,
    validation_error_detail,
)


class TestTableNameValidation:
    """Test table name validation (SQL injection prevention)."""

    def test_validate_table_name_valid(self):
        """Test valid table names."""
        valid_names = [
            "topic_metrics",
            "feed_health",
            "validation_logs",
            "article_metadata",
        ]

        for name in valid_names:
            assert validate_table_name(name) == name

    def test_validate_table_name_invalid(self):
        """Test invalid table names are rejected."""
        invalid_names = [
            "users; DROP TABLE",
            "../etc/passwd",
            "table_name'--",
            "invalid_table",
        ]

        for name in invalid_names:
            with pytest.raises(ValidationError):
                validate_table_name(name)

    def test_validate_table_name_case_sensitive(self):
        """Test table name validation is case-sensitive."""
        with pytest.raises(ValidationError):
            validate_table_name("TOPIC_METRICS")


class TestQueryLimitValidation:
    """Test query limit validation."""

    def test_validate_query_limit_valid(self):
        """Test valid query limits."""
        assert validate_query_limit(10) == 10
        assert validate_query_limit(50) == 50
        assert validate_query_limit(1000) == 1000

    def test_validate_query_limit_too_small(self):
        """Test limit below minimum is rejected."""
        with pytest.raises(ValidationError):
            validate_query_limit(0)

        with pytest.raises(ValidationError):
            validate_query_limit(-1)

    def test_validate_query_limit_too_large(self):
        """Test limit above maximum is capped."""
        # Should cap at max_limit (default 10000)
        assert validate_query_limit(20000) == 10000

    def test_validate_query_limit_custom_max(self):
        """Test custom maximum limit."""
        assert validate_query_limit(5000, max_limit=3000) == 3000


class TestDateRangeValidation:
    """Test date range validation."""

    def test_validate_date_range_valid(self):
        """Test valid date ranges."""
        start = "2024-01-01"
        end = "2024-01-31"

        validated_start, validated_end = validate_date_range(start, end)

        assert validated_start == start
        assert validated_end == end

    def test_validate_date_range_inverted(self):
        """Test start date after end date is rejected."""
        with pytest.raises(ValidationError):
            validate_date_range("2024-02-01", "2024-01-01")

    def test_validate_date_range_future(self):
        """Test future dates are rejected."""
        future_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        today = datetime.now().strftime("%Y-%m-%d")

        with pytest.raises(ValidationError):
            validate_date_range(today, future_date)

    def test_validate_date_range_invalid_format(self):
        """Test invalid date formats are rejected."""
        with pytest.raises(ValidationError):
            validate_date_range("01/01/2024", "01/31/2024")

    def test_validate_date_range_too_long(self):
        """Test date ranges exceeding max days are rejected."""
        start = "2020-01-01"
        end = "2024-01-01"  # > 3 years

        with pytest.raises(ValidationError):
            validate_date_range(start, end, max_days=365)


class TestLikeClauseSanitization:
    """Test LIKE clause sanitization (SQL injection prevention)."""

    def test_sanitize_like_clause_basic(self):
        """Test basic string sanitization."""
        assert sanitize_like_clause("test") == "test"

    def test_sanitize_like_clause_special_chars(self):
        """Test SQL special characters are escaped."""
        assert sanitize_like_clause("test%value") == "test\\%value"
        assert sanitize_like_clause("test_value") == "test\\_value"
        assert sanitize_like_clause("test'value") == "test''value"

    def test_sanitize_like_clause_sql_keywords(self):
        """Test SQL keywords are handled."""
        # Should escape special chars, not block keywords
        assert sanitize_like_clause("DROP TABLE") == "DROP TABLE"
        assert sanitize_like_clause("'; DROP--") == "''; DROP--"

    def test_sanitize_like_clause_empty(self):
        """Test empty string handling."""
        assert sanitize_like_clause("") == ""

    def test_sanitize_like_clause_unicode(self):
        """Test Unicode characters are preserved."""
        assert sanitize_like_clause("test café") == "test café"


class TestDashboardConstraints:
    """Test dashboard constraint validation."""

    def test_validate_dashboard_constraints_valid(self):
        """Test valid dashboard configuration."""
        widgets = [
            {"position_x": 0, "position_y": 0, "width": 6, "height": 4},
            {"position_x": 6, "position_y": 0, "width": 6, "height": 4},
        ]

        validate_dashboard_constraints(widgets)
        # Should not raise

    def test_validate_dashboard_constraints_too_many_widgets(self):
        """Test exceeding maximum widget count (FR-032a)."""
        widgets = [
            {"position_x": 0, "position_y": i * 4, "width": 12, "height": 4}
            for i in range(21)  # Max is 20
        ]

        with pytest.raises(ValidationError, match="maximum 20 widgets"):
            validate_dashboard_constraints(widgets)

    def test_validate_dashboard_constraints_overlap(self):
        """Test overlapping widgets are detected."""
        widgets = [
            {"position_x": 0, "position_y": 0, "width": 6, "height": 4},
            {"position_x": 2, "position_y": 2, "width": 6, "height": 4},  # Overlaps
        ]

        with pytest.raises(ValidationError, match="overlap"):
            validate_dashboard_constraints(widgets)

    def test_validate_dashboard_constraints_out_of_bounds(self):
        """Test widgets outside grid bounds."""
        widgets = [
            {"position_x": 10, "position_y": 0, "width": 6, "height": 4},  # Extends beyond 12
        ]

        with pytest.raises(ValidationError, match="out of bounds"):
            validate_dashboard_constraints(widgets)

    def test_validate_dashboard_constraints_invalid_size(self):
        """Test widget size constraints."""
        # Min size 2x2, max 12x12
        with pytest.raises(ValidationError):
            validate_dashboard_constraints(
                [{"position_x": 0, "position_y": 0, "width": 1, "height": 1}]
            )


class TestCustomizationValidation:
    """Test chart customization validation."""

    def test_validate_customization_valid(self):
        """Test valid customization options."""
        customization = {
            "title": "My Chart",
            "show_legend": True,
            "legend_position": "top",
            "colors": ["#ff0000", "#00ff00", "#0000ff"],
        }

        validate_customization(customization)
        # Should not raise

    def test_validate_customization_uses_canonical_title_limit(self):
        """Legacy wrapper should follow the canonical 200-character title limit."""
        validate_customization({"title": "A" * 150})
        truncated = CustomizationValidator.validate_title("B" * 205)

        assert truncated.endswith("...")
        assert len(truncated) == 203

    def test_validate_customization_invalid_color(self):
        """Test invalid color format."""
        customization = {
            "colors": ["invalid-color"],
        }

        with pytest.raises(ValidationError, match="color"):
            validate_customization(customization)

    def test_validate_customization_invalid_legend_position(self):
        """Test invalid legend position."""
        customization = {
            "legend_position": "invalid",
        }

        with pytest.raises(ValidationError, match="legend"):
            validate_customization(customization)

    def test_validate_customization_font_size_range(self):
        """Test font size constraints."""
        with pytest.raises(ValidationError):
            validate_customization({"title_font_size": 5})  # Too small

        with pytest.raises(ValidationError):
            validate_customization({"title_font_size": 100})  # Too large


class TestForecastDataValidation:
    """Test forecast data validation."""

    def test_validate_forecast_data_valid(self):
        """Test valid forecast data."""
        predictions = [
            {"date": "2024-02-01", "value": 100, "lower": 90, "upper": 110},
            {"date": "2024-02-02", "value": 105, "lower": 95, "upper": 115},
        ]

        validate_forecast_data(predictions, horizon_days=2)
        # Should not raise

    def test_validate_forecast_data_missing_fields(self):
        """Test forecast data with missing required fields."""
        predictions = [
            {"date": "2024-02-01", "value": 100},  # Missing lower/upper
        ]

        with pytest.raises(ValidationError, match="required fields"):
            validate_forecast_data(predictions, horizon_days=1)

    def test_validate_forecast_data_invalid_bounds(self):
        """Test forecast with invalid confidence bounds."""
        predictions = [
            {"date": "2024-02-01", "value": 100, "lower": 110, "upper": 90},  # Invalid
        ]

        with pytest.raises(ValidationError, match="lower.*upper"):
            validate_forecast_data(predictions, horizon_days=1)

    def test_validate_forecast_data_wrong_count(self):
        """Test forecast data count mismatch."""
        predictions = [
            {"date": "2024-02-01", "value": 100, "lower": 90, "upper": 110},
        ]

        with pytest.raises(ValidationError, match="predictions count"):
            validate_forecast_data(predictions, horizon_days=7)

    def test_validate_forecast_data_invalid_dates(self):
        """Test forecast with non-sequential dates."""
        predictions = [
            {"date": "2024-02-01", "value": 100, "lower": 90, "upper": 110},
            {"date": "2024-02-03", "value": 105, "lower": 95, "upper": 115},  # Gap
        ]

        with pytest.raises(ValidationError, match="sequential"):
            validate_forecast_data(predictions, horizon_days=2)


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_validate_empty_inputs(self):
        """Test validation with empty inputs."""
        with pytest.raises(ValidationError):
            validate_table_name("")

    def test_validate_none_inputs(self):
        """Test validation with None inputs."""
        with pytest.raises(ValidationError):
            validate_query_limit(None)

    def test_validate_unicode_edge_cases(self):
        """Test Unicode edge cases."""
        # Unicode in table names should fail (not in whitelist)
        with pytest.raises(ValidationError):
            validate_table_name("table_名前")

    def test_validate_extremely_large_numbers(self):
        """Test validation with extremely large numbers."""
        assert validate_query_limit(999999999) == 10000  # Capped


class TestNormalizationCompatibility:
    """Regression tests for legacy alias normalization."""

    def test_normalize_filter_payload_aliases(self):
        """Filter payloads should normalize camelCase keys used by older clients."""
        normalized = normalize_filter_payload(
            {
                "topicIds": [2, 1],
                "feedIds": ["feed-b", "feed-a"],
                "dateRange": {
                    "startDate": "2024-01-01",
                    "endDate": "2024-01-31",
                },
            }
        )

        assert normalized == {
            "topic_ids": [1, 2],
            "feed_ids": ["feed-a", "feed-b"],
            "date_range": {
                "start": "2024-01-01",
                "end": "2024-01-31",
            },
        }

    def test_normalize_customization_payload_aliases(self):
        """Customization payloads should normalize camelCase keys."""
        normalized = normalize_customization_payload(
            {
                "showLegend": True,
                "legendPosition": "bottom",
                "titleFontSize": 18,
                "gridLines": False,
            }
        )

        assert normalized["show_legend"] is True
        assert normalized["legend_position"] == "bottom"
        assert normalized["title_font_size"] == 18
        assert normalized["grid_lines"] is False

    def test_normalize_dashboard_widget_payload_aliases(self):
        """Dashboard widgets should normalize legacy coordinate aliases."""
        normalized = normalize_dashboard_widget_payload(
            {
                "position_x": 1,
                "position_y": 2,
                "width": 3,
                "height": 4,
            }
        )

        assert normalized["position"] == {"x": 1, "y": 2, "w": 3, "h": 4}

    def test_normalize_forecast_payload_aliases(self):
        """Forecast payloads should normalize horizon and metrics aliases."""
        normalized = normalize_forecast_payload(
            {
                "horizon_days": 30,
                "metrics": {"meanAbsoluteError": 1.5},
            }
        )

        assert normalized["forecast_horizon_days"] == 30
        assert normalized["accuracy_metrics"] == {"meanAbsoluteError": 1.5}

    def test_normalize_forecast_prediction_payload_aliases(self):
        """Forecast prediction intervals should normalize confidence aliases."""
        normalized = normalize_forecast_prediction_payload(
            {
                "date": "2024-02-01",
                "value": 100,
                "confidenceLower": 95,
                "confidenceUpper": 110,
            }
        )

        assert normalized["lower"] == 95
        assert normalized["upper"] == 110


class TestValidationErrorCompatibility:
    """Regression tests for the normalized validation error model."""

    def test_validation_error_detail_preserves_legacy_message(self):
        """ValidationError should keep its string form while exposing structured detail."""
        error = ValidationError(
            "Invalid legend position",
            code="invalid_customization",
            field="legend_position",
            details={"allowed_values": ["top", "bottom"]},
        )

        assert str(error) == "Invalid legend position"
        assert validation_error_detail(error) == {
            "code": "invalid_customization",
            "message": "Invalid legend position",
            "field": "legend_position",
            "details": {"allowed_values": ["top", "bottom"]},
        }

    def test_validate_date_range_error_has_normalized_detail(self):
        """Date-range validation should expose a stable error code for API consumers."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date_range("2024-02-01", "2024-01-01")

        assert exc_info.value.to_dict()["code"] == "invalid_date_range"
