"""Unit tests for ai_web_feeds.validate module."""

import json
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

import pytest
import yaml
from ai_web_feeds.load import load_feeds
from ai_web_feeds.models import CurationStatus, FeedSource, FeedValidationResult
from ai_web_feeds.validate import (
    ValidationError,
    ValidationResult,
    calculate_health_score,
    mark_inactive_feeds,
    validate_feed,
    validate_feed_url,
    validate_feeds,
    validate_topics,
)
from hypothesis import given
from hypothesis import strategies as st

DATA_DIR = Path(__file__).resolve().parents[5] / "data"
FEEDS_SCHEMA_PATH = DATA_DIR / "feeds.schema.json"
TOPICS_SCHEMA_PATH = DATA_DIR / "topics.schema.json"
SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"


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
            "schema_version": "feeds-2.1.0",
            "sources": [
                {
                    "url": "https://example.com/feed.xml",
                    "topics": ["ai"],
                }
            ],
        }

        result = validate_feeds(data, schema_path=FEEDS_SCHEMA_PATH)
        assert result.valid is True
        assert len(result.errors) == 0

    def test_validate_feeds_missing_url(self):
        """Test validation fails when no URL-like field is provided."""
        data = {
            "sources": [
                {
                    "title": "Test Feed",
                    "topics": ["ai"],
                }
            ]
        }

        result = validate_feeds(data)
        assert result.valid is False
        assert any("requires a URL" in e for e in result.errors)

    def test_validate_feeds_missing_topics(self):
        """Test validation fails for missing topics."""
        data = {
            "sources": [
                {
                    "url": "https://example.com/feed.xml",
                }
            ]
        }

        result = validate_feeds(data)
        assert result.valid is False
        assert any("missing required field: topics" in e for e in result.errors)

    def test_validate_feeds_duplicate_ids(self):
        """Test validation fails for duplicate canonical IDs."""
        data = {
            "sources": [
                {"url": "https://example.com/feed.xml", "topics": ["ai"]},
                {"url": "https://example.com/feed.xml", "topics": ["ml"]},
            ]
        }

        result = validate_feeds(data)
        assert result.valid is False
        assert any("Duplicate canonical IDs" in e for e in result.errors)

    def test_validate_feeds_empty_sources(self):
        """Empty source collections should fail the canonical schema."""
        data = {"schema_version": "feeds-2.1.0", "sources": []}

        result = validate_feeds(data, schema_path=FEEDS_SCHEMA_PATH)
        assert result.valid is False
        assert any("Schema validation failed" in e for e in result.errors)

    def test_validate_feeds_no_sources_key(self):
        """Missing canonical sources key should fail the schema contract."""
        data = {"schema_version": "feeds-2.1.0"}

        result = validate_feeds(data, schema_path=FEEDS_SCHEMA_PATH)
        assert result.valid is False
        assert any("Schema validation failed" in e for e in result.errors)

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
                        "required": ["url", "topics"],
                        "properties": {
                            "url": {"type": "string"},
                            "topics": {"type": "array"},
                        },
                    },
                }
            },
        }

        data = {
            "sources": [
                {
                    "url": "https://example.com/feed.xml",
                    "topics": ["ai"],
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
                        "required": ["url", "topics"],
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
                {},  # Missing URL and topics
                {"url": "https://example.com/feed.xml"},  # Missing topics
                {"title": "Feed 2", "topics": ["ai"]},  # Missing URL
            ]
        }

        result = validate_feeds(data)
        assert result.valid is False
        assert len(result.errors) >= 3

    @given(
        feed_count=st.integers(min_value=1, max_value=5),
        feed_id_prefix=st.text(min_size=1, max_size=10, alphabet=SLUG_CHARS),
    )
    def test_validate_feeds_property_based(self, feed_count, feed_id_prefix):
        """Property-based test for feed validation."""
        data = {
            "schema_version": "feeds-2.1.0",
            "sources": [
                {
                    "url": f"https://example.com/{feed_id_prefix}-{i}.xml",
                    "topics": ["ai"],
                }
                for i in range(feed_count)
            ],
        }

        result = validate_feeds(data, schema_path=FEEDS_SCHEMA_PATH)
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
                    "label": "Artificial Intelligence",
                    "facet": "domain",
                    "parents": [],
                }
            ]
        }

        result = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
        assert result.valid is True
        assert len(result.errors) == 0

    def test_validate_topics_duplicate_ids(self):
        """Test validation fails for duplicate topic IDs."""
        data = {
            "topics": [
                {"id": "ai", "label": "AI", "facet": "domain", "parents": []},
                {"id": "ai", "label": "Artificial Intelligence", "facet": "domain", "parents": []},
            ]
        }

        result = validate_topics(data)
        assert result.valid is False
        assert any("Duplicate topic IDs" in e for e in result.errors)

    def test_validate_topics_empty_topics(self):
        """Empty topic collections should fail the canonical schema."""
        data = {"topics": []}

        result = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
        assert result.valid is False
        assert any("Schema validation failed" in e for e in result.errors)

    def test_validate_topics_no_topics_key(self):
        """Missing topics key should fail the canonical schema."""
        data = {}

        result = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
        assert result.valid is False
        assert any("Schema validation failed" in e for e in result.errors)

    def test_validate_topics_with_valid_schema(self):
        """Test topic validation against the repository canonical schema."""
        data = {
            "topics": [
                {
                    "id": "ai",
                    "label": "Artificial Intelligence",
                    "facet": "domain",
                    "parents": [],
                }
            ]
        }

        result = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
        assert result.valid is True

    def test_validate_topics_with_relations(self):
        """Test validation of topics with parent-child relations."""
        data = {
            "topics": [
                {
                    "id": "ai",
                    "label": "Artificial Intelligence",
                    "facet": "domain",
                    "parents": [],
                    "relations": {"related_to": ["ml", "dl"]},
                },
                {
                    "id": "ml",
                    "label": "Machine Learning",
                    "facet": "subfield",
                    "parents": ["ai"],
                },
                {
                    "id": "dl",
                    "label": "Deep Learning",
                    "facet": "subfield",
                    "parents": ["ai"],
                },
            ]
        }

        result = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
        assert result.valid is True

    @given(
        topic_count=st.integers(min_value=1, max_value=5),
        topic_id_prefix=st.text(min_size=1, max_size=10, alphabet=SLUG_CHARS),
    )
    def test_validate_topics_property_based(self, topic_count, topic_id_prefix):
        """Property-based test for topic validation."""
        data = {
            "topics": [
                {
                    "id": f"{topic_id_prefix}-{i}",
                    "label": f"Topic {i}",
                    "facet": "domain",
                    "parents": [],
                }
                for i in range(topic_count)
            ]
        }

        result = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
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


class ParsedFeed(dict):
    """Small helper to mimic feedparser results in tests."""

    def __init__(
        self,
        *,
        version: str = "rss20",
        feed: dict[str, str] | None = None,
        entries: list[dict[str, str]] | None = None,
        bozo: bool = False,
        bozo_exception: Exception | None = None,
    ):
        super().__init__(version=version, feed=feed or {}, entries=entries or [])
        self.bozo = bozo
        self.bozo_exception = bozo_exception


@pytest.mark.unit
@pytest.mark.asyncio
class TestValidateFeedUrl:
    """Test async feed URL validation."""

    @patch("ai_web_feeds.validate.feedparser.parse")
    @patch("ai_web_feeds.validate.httpx.AsyncClient")
    async def test_validate_feed_url_success_with_entries(self, mock_client_class, mock_parse):
        """A parsed feed with entries should validate successfully."""
        mock_response = Mock(status_code=200, text="<rss></rss>")
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        mock_parse.return_value = ParsedFeed(
            feed={"title": "Example Feed"},
            entries=[{"title": "Entry 1"}],
        )

        result = await validate_feed_url("https://example.com/feed.xml")

        assert result["success"] is True
        assert result["feed_format"] == "rss"
        assert result["entry_count"] == 1
        assert result["error_message"] is None

    @patch("ai_web_feeds.validate.feedparser.parse")
    @patch("ai_web_feeds.validate.httpx.AsyncClient")
    async def test_validate_feed_url_bozo_without_entries_fails(
        self, mock_client_class, mock_parse
    ):
        """Parser errors without entries should not be treated as success."""
        mock_response = Mock(status_code=200, text="<rss></rss>")
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client

        parse_error = ValueError("mismatched tag")
        mock_parse.return_value = ParsedFeed(
            feed={"title": "Broken Feed"},
            entries=[],
            bozo=True,
            bozo_exception=parse_error,
        )

        result = await validate_feed_url("https://example.com/broken-feed.xml")

        assert result["success"] is False
        assert result["entry_count"] == 0
        assert result["error_message"] == "Feed parse error: mismatched tag"


@pytest.mark.unit
@pytest.mark.asyncio
class TestValidateFeedModelContract:
    """Ensure validate_feed maps to current FeedValidationResult contract."""

    @patch("ai_web_feeds.validate.validate_feed_url", new_callable=AsyncMock)
    async def test_validate_feed_maps_runtime_fields(self, mock_validate_feed_url):
        """validate_feed should populate current model fields (is_valid/http_status/item_count)."""
        now = datetime.utcnow()
        mock_validate_feed_url.return_value = {
            "url": "https://example.com/feed.xml",
            "success": True,
            "status_code": 200,
            "response_time_ms": 123.4,
            "error_message": None,
            "feed_format": "rss",
            "entry_count": 4,
            "validated_at": now,
        }
        source = FeedSource(id="feed-1", title="Feed 1", feed="https://example.com/feed.xml")

        result = await validate_feed(source)

        assert result.is_valid is True
        assert result.is_accessible is True
        assert result.http_status == 200
        assert result.item_count == 4
        assert result.validation_report["success"] is True

    def test_mark_inactive_feeds_uses_curation_status(self):
        """Inactive marking should update curation_status, not removed is_active field."""
        source = FeedSource(
            id="feed-2",
            title="Feed 2",
            feed="https://example.com/feed2.xml",
            curation_status=CurationStatus.VERIFIED,
        )
        old_result = FeedValidationResult(
            feed_source_id=source.id,
            is_valid=False,
            validated_at=datetime.utcnow() - timedelta(days=45),
        )

        marked = mark_inactive_feeds(
            [source],
            validation_history={source.id: [old_result]},
            inactive_threshold_days=30,
        )

        assert marked == [source.id]
        assert source.curation_status == CurationStatus.INACTIVE

    def test_calculate_health_score_uses_is_valid(self):
        """Health score should use is_valid field from current validation contract."""
        results = [
            FeedValidationResult(feed_source_id="a", is_valid=True, response_time_ms=500),
            FeedValidationResult(feed_source_id="a", is_valid=False, response_time_ms=500),
        ]

        score = calculate_health_score(results)
        assert 0.0 <= score <= 1.0
        assert score < 1.0


@pytest.mark.unit
class TestValidationIntegration:
    """Integration tests for validation module."""

    def test_load_and_validate_workflow(self):
        """Test loading and validating feeds workflow."""
        # Create temp feed file
        feed_data = {
            "sources": [
                {
                    "url": "https://example.com/feed.xml",
                    "topics": ["ai"],
                }
            ]
        }

        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump(feed_data, f)
            temp_path = Path(f.name)

        try:
            # Load and validate
            data = load_feeds(temp_path)
            result = validate_feeds(data)

            assert result.valid is True
        finally:
            temp_path.unlink()

    def test_validation_result_in_conditional(self):
        """Test using ValidationResult in conditional statements."""
        valid_data = {"sources": [{"url": "https://example.com/feed.xml", "topics": ["ai"]}]}
        invalid_data = {"sources": [{"title": "Missing URL", "topics": ["ai"]}]}

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
