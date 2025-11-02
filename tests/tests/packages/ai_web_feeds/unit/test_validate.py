"""Unit tests for ai_web_feeds.validate module."""

import json
import tempfile
from pathlib import Path

import pytest
from ai_web_feeds.validate import (
    ValidationError,
    ValidationResult,
    validate_feeds,
    validate_topics,
)
from hypothesis import given
from hypothesis import strategies as st


@pytest.mark.unit
class TestValidationResult:
    """Test ValidationResult class."""

    def test_init_default(self):
        """Test default initialization."""
        result = ValidationResult()
        assert result.valid is True
        assert result.errors == []

    def test_init_with_errors(self):
        """Test initialization with errors."""
        errors = ["Error 1", "Error 2"]
        result = ValidationResult(valid=False, errors=errors)
        assert result.valid is False
        assert result.errors == errors

    def test_add_error(self):
        """Test adding an error."""
        result = ValidationResult()
        assert result.valid is True

        result.add_error("Test error")
        assert result.valid is False
        assert "Test error" in result.errors

    def test_add_multiple_errors(self):
        """Test adding multiple errors."""
        result = ValidationResult()
        result.add_error("Error 1")
        result.add_error("Error 2")

        assert result.valid is False
        assert len(result.errors) == 2

    def test_bool_conversion(self):
        """Test boolean conversion."""
        result = ValidationResult(valid=True)
        assert bool(result) is True

        result.add_error("Error")
        assert bool(result) is False

    def test_truthy_falsy(self):
        """Test truthy/falsy behavior."""
        valid_result = ValidationResult(valid=True)
        invalid_result = ValidationResult(valid=False)

        if valid_result:
            assert True
        else:
            pytest.fail("Valid result should be truthy")

        if invalid_result:
            pytest.fail("Invalid result should be falsy")


@pytest.mark.unit
class TestValidateFeeds:
    """Test validate_feeds function."""

    def test_validate_feeds_success(self):
        """Test successful feed validation."""
        data = {
            "sources": [
                {
                    "id": "test-feed",
                    "title": "Test Feed",
                }
            ]
        }

        result = validate_feeds(data)
        assert result.valid is True
        assert len(result.errors) == 0

    def test_validate_feeds_missing_id(self):
        """Test validation fails for missing ID."""
        data = {
            "sources": [
                {
                    "title": "Test Feed",
                }
            ]
        }

        result = validate_feeds(data)
        assert result.valid is False
        assert any("missing required field: id" in e for e in result.errors)

    def test_validate_feeds_missing_title(self):
        """Test validation fails for missing title."""
        data = {
            "sources": [
                {
                    "id": "test-feed",
                }
            ]
        }

        result = validate_feeds(data)
        assert result.valid is False
        assert any("missing required field: title" in e for e in result.errors)

    def test_validate_feeds_duplicate_ids(self):
        """Test validation fails for duplicate IDs."""
        data = {
            "sources": [
                {"id": "duplicate-feed", "title": "Feed 1"},
                {"id": "duplicate-feed", "title": "Feed 2"},
            ]
        }

        result = validate_feeds(data)
        assert result.valid is False
        assert any("Duplicate IDs" in e for e in result.errors)

    def test_validate_feeds_empty_sources(self):
        """Test validation with empty sources list."""
        data = {"sources": []}

        result = validate_feeds(data)
        assert result.valid is True

    def test_validate_feeds_no_sources_key(self):
        """Test validation with missing sources key."""
        data = {}

        result = validate_feeds(data)
        assert result.valid is True  # No sources is valid

    def test_validate_feeds_with_valid_schema(self):
        """Test validation with JSON schema."""
        schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
                "sources": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "title"],
                        "properties": {
                            "id": {"type": "string"},
                            "title": {"type": "string"},
                        },
                    },
                }
            },
        }

        data = {
            "sources": [
                {
                    "id": "test-feed",
                    "title": "Test Feed",
                }
            ]
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(schema, f)
            schema_path = Path(f.name)

        try:
            result = validate_feeds(data, schema_path=schema_path)
            assert result.valid is True
        finally:
            schema_path.unlink()

    def test_validate_feeds_with_invalid_schema(self):
        """Test validation fails with invalid data against schema."""
        schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
                "sources": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "title"],
                    },
                }
            },
        }

        data = {
            "sources": "not-an-array"  # Invalid: should be array
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(schema, f)
            schema_path = Path(f.name)

        try:
            result = validate_feeds(data, schema_path=schema_path)
            assert result.valid is False
            assert any("Schema validation failed" in e for e in result.errors)
        finally:
            schema_path.unlink()

    def test_validate_feeds_schema_not_found(self):
        """Test validation with non-existent schema file."""
        data = {"sources": []}
        result = validate_feeds(data, schema_path="/nonexistent/schema.json")

        # Should still validate (schema is optional)
        assert result.valid is True

    def test_validate_feeds_multiple_errors(self):
        """Test accumulation of multiple validation errors."""
        data = {
            "sources": [
                {},  # Missing both id and title
                {"id": "feed-1"},  # Missing title
                {"title": "Feed 2"},  # Missing id
            ]
        }

        result = validate_feeds(data)
        assert result.valid is False
        assert len(result.errors) >= 3

    @given(
        feed_count=st.integers(min_value=0, max_value=5),
        feed_id_prefix=st.text(
            min_size=1,
            max_size=10,
            alphabet=st.characters(whitelist_categories=("L", "N")),
        ),
    )
    def test_validate_feeds_property_based(self, feed_count, feed_id_prefix):
        """Property-based test for feed validation."""
        data = {
            "sources": [
                {
                    "id": f"{feed_id_prefix}-{i}",
                    "title": f"Feed {i}",
                }
                for i in range(feed_count)
            ]
        }

        result = validate_feeds(data)
        assert result.valid is True


@pytest.mark.unit
class TestValidateTopics:
    """Test validate_topics function."""

    def test_validate_topics_success(self):
        """Test successful topic validation."""
        data = {
            "topics": [
                {
                    "id": "ai",
                    "name": "Artificial Intelligence",
                }
            ]
        }

        result = validate_topics(data)
        assert result.valid is True
        assert len(result.errors) == 0

    def test_validate_topics_duplicate_ids(self):
        """Test validation fails for duplicate topic IDs."""
        data = {
            "topics": [
                {"id": "ai", "name": "AI"},
                {"id": "ai", "name": "Artificial Intelligence"},
            ]
        }

        result = validate_topics(data)
        assert result.valid is False
        assert any("Duplicate topic IDs" in e for e in result.errors)

    def test_validate_topics_empty_topics(self):
        """Test validation with empty topics list."""
        data = {"topics": []}

        result = validate_topics(data)
        assert result.valid is True

    def test_validate_topics_no_topics_key(self):
        """Test validation with missing topics key."""
        data = {}

        result = validate_topics(data)
        assert result.valid is True

    def test_validate_topics_with_valid_schema(self):
        """Test topic validation with JSON schema."""
        schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
                "topics": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "name"],
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                        },
                    },
                }
            },
        }

        data = {
            "topics": [
                {
                    "id": "ai",
                    "name": "Artificial Intelligence",
                }
            ]
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(schema, f)
            schema_path = Path(f.name)

        try:
            result = validate_topics(data, schema_path=schema_path)
            assert result.valid is True
        finally:
            schema_path.unlink()

    def test_validate_topics_with_relations(self):
        """Test validation of topics with parent-child relations."""
        data = {
            "topics": [
                {
                    "id": "ai",
                    "name": "Artificial Intelligence",
                    "children": ["ml", "dl"],
                },
                {
                    "id": "ml",
                    "name": "Machine Learning",
                    "parent": "ai",
                },
                {
                    "id": "dl",
                    "name": "Deep Learning",
                    "parent": "ai",
                },
            ]
        }

        result = validate_topics(data)
        assert result.valid is True

    @given(
        topic_count=st.integers(min_value=0, max_value=5),
        topic_id_prefix=st.text(
            min_size=1,
            max_size=10,
            alphabet=st.characters(whitelist_categories=("L", "N")),
        ),
    )
    def test_validate_topics_property_based(self, topic_count, topic_id_prefix):
        """Property-based test for topic validation."""
        data = {
            "topics": [
                {
                    "id": f"{topic_id_prefix}-{i}",
                    "name": f"Topic {i}",
                }
                for i in range(topic_count)
            ]
        }

        result = validate_topics(data)
        # Should be valid if no duplicates
        if topic_count <= 1:
            assert result.valid is True


@pytest.mark.unit
class TestValidationError:
    """Test ValidationError exception."""

    def test_validation_error_creation(self):
        """Test creating ValidationError."""
        error = ValidationError("Test error")
        assert str(error) == "Test error"

    def test_validation_error_inheritance(self):
        """Test ValidationError inherits from Exception."""
        assert issubclass(ValidationError, Exception)

    def test_validation_error_raise(self):
        """Test raising ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            raise ValidationError("Custom validation error")

        assert "Custom validation error" in str(exc_info.value)


@pytest.mark.unit
class TestValidationIntegration:
    """Integration tests for validation module."""

    def test_load_and_validate_workflow(self):
        """Test loading and validating feeds workflow."""
        # Create temp feed file
        feed_data = {
            "sources": [
                {
                    "id": "test-feed",
                    "title": "Test Feed",
                    "feed": "https://example.com/feed.xml",
                }
            ]
        }

        import yaml

        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(feed_data, f)
            temp_path = Path(f.name)

        try:
            # Load and validate
            from ai_web_feeds.load import load_feeds

            data = load_feeds(temp_path)
            result = validate_feeds(data)

            assert result.valid is True
        finally:
            temp_path.unlink()

    def test_validation_result_in_conditional(self):
        """Test using ValidationResult in conditional statements."""
        valid_data = {"sources": [{"id": "test", "title": "Test"}]}
        invalid_data = {"sources": [{"title": "Missing ID"}]}

        valid_result = validate_feeds(valid_data)
        invalid_result = validate_feeds(invalid_data)

        # Use in conditional
        if valid_result:
            passed = True
        else:
            passed = False

        assert passed is True

        if invalid_result:
            passed = True
        else:
            passed = False

        assert passed is False

    def test_error_accumulation(self):
        """Test that errors accumulate correctly."""
        result = ValidationResult()
        assert len(result.errors) == 0

        for i in range(5):
            result.add_error(f"Error {i}")

        assert len(result.errors) == 5
        assert result.valid is False
