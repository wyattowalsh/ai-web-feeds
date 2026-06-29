"""Unit tests for ai_web_feeds.validate module."""

import json
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

import pytest
from ai_web_feeds.validate import (
    ValidationError,
    ValidationResult,
    calculate_health_score,
    mark_inactive_feeds,
    validate_feed_url,
    validate_feeds,
    validate_topics,
)
from ai_web_feeds.models import FeedSource, FeedValidationResult
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
                    "name": f"TopicNode {i}",
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

    @patch("ai_web_feeds.validate.feedparser.parse")
    @patch("ai_web_feeds.validate.httpx.AsyncClient")
    async def test_validate_feed_url_retries_on_rate_limit(
        self, mock_client_class, mock_parse
    ):
        """HTTP 429 should retry and succeed on a later attempt."""
        rate_limited = Mock(status_code=429, text="")
        success = Mock(status_code=200, text="<rss></rss>")
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[rate_limited, success])
        mock_client_class.return_value.__aenter__.return_value = mock_client

        mock_parse.return_value = ParsedFeed(
            feed={"title": "Rate Limited Feed"},
            entries=[{"title": "Entry 1"}],
        )

        result = await validate_feed_url("https://example.com/feed.xml")

        assert result["success"] is True
        assert mock_client.get.await_count == 2


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


@pytest.mark.unit
class TestHealthAndInactiveMarking:
    """Tests for calculate_health_score and mark_inactive_feeds (added coverage)."""

    def test_calculate_health_score_empty(self) -> None:
        """Empty results return 0.0 health."""
        assert calculate_health_score([]) == 0.0

    def test_calculate_health_score_all_success(self, mocker) -> None:
        """All valid recent results -> high score ~0.8+."""
        now = datetime.now()
        results = []
        for i in range(5):
            r = FeedValidationResult(
                feed_source_id=f"feed-{i}",
                is_valid=True,
                response_time_ms=200 + i * 10,
                validated_at=now,
            )
            results.append(r)
        score = calculate_health_score(results)
        assert 0.79 <= score <= 1.0

    def test_calculate_health_score_mixed_with_slow_responses(self) -> None:
        """Mixed success + slow responses yields moderate score."""
        base = datetime.now()
        results = [
            FeedValidationResult(
                feed_source_id="f1", is_valid=True, response_time_ms=800, validated_at=base
            ),
            FeedValidationResult(
                feed_source_id="f2", is_valid=False, response_time_ms=6000, validated_at=base
            ),
            FeedValidationResult(
                feed_source_id="f3", is_valid=True, response_time_ms=1200, validated_at=base
            ),
        ]
        score = calculate_health_score(results)
        assert 0.4 < score < 0.85

    def test_calculate_health_score_respects_max_results(self) -> None:
        """Only considers up to max_results."""
        base = datetime.now()
        many = [
            FeedValidationResult(feed_source_id=f"f{i}", is_valid=(i < 2), validated_at=base)
            for i in range(20)
        ]
        score_full = calculate_health_score(many, max_results=20)
        score_limited = calculate_health_score(many, max_results=2)
        # With only first 2 (both valid), higher than overall 2/20
        assert score_limited > score_full

    def test_mark_inactive_feeds_marks_on_no_recent_success(self, mocker) -> None:
        """Feeds without recent success are marked inactive."""
        cutoff = 30
        old_date = datetime.now() - timedelta(days=cutoff + 5)
        recent_date = datetime.now() - timedelta(days=1)

        # Use plain mocks (no strict spec) to allow dynamic is_active attr set by func
        active = mocker.Mock(id="active1")
        inactive1 = mocker.Mock(id="inactive1")
        inactive2 = mocker.Mock(id="inactive2")
        feeds = [active, inactive1, inactive2]

        history = {
            "active1": [
                FeedValidationResult(feed_source_id="active1", is_valid=True, validated_at=recent_date)
            ],
            "inactive1": [
                FeedValidationResult(feed_source_id="inactive1", is_valid=True, validated_at=old_date)
            ],
            "inactive2": [],  # no history -> skipped per impl
        }

        marked = mark_inactive_feeds(feeds, history, inactive_threshold_days=cutoff)
        assert "inactive1" in marked
        assert "inactive2" not in marked  # per current logic skips no-history
        assert inactive1.is_active is False
        assert getattr(active, "is_active", None) is not False

    def test_mark_inactive_feeds_returns_empty_for_no_history(self) -> None:
        feeds = [FeedSource(id="f1", title="F1", feed="u")]
        marked = mark_inactive_feeds(feeds, {}, inactive_threshold_days=30)
        assert marked == []

    def test_mark_inactive_feeds_with_recent_success_keeps_active(self, mocker) -> None:
        feed = mocker.Mock(id="f1")
        feed.is_active = True  # pre-set
        feeds = [feed]
        hist = {
            "f1": [FeedValidationResult(feed_source_id="f1", is_valid=True, validated_at=datetime.now())]
        }
        marked = mark_inactive_feeds(feeds, hist, inactive_threshold_days=30)
        assert marked == []
        assert feed.is_active is True


@pytest.mark.unit
class TestValidateAdditionalBranches:
    """Cover remaining branches in validate: feed validation, all, health, no-feed cases."""

    def test_validate_feed_no_url(self):
        from ai_web_feeds.models import FeedSource
        from ai_web_feeds.validate import validate_feed
        import asyncio

        fs = FeedSource(id="no", title="NoFeed", feed=None, url="http://ex")
        res = asyncio.run(validate_feed(fs))
        assert res.is_valid is False
        assert "No feed URL" in str(res.warnings or [])

    @pytest.mark.asyncio
    async def test_validate_all_feeds_no_progress(self, mocker):
        from ai_web_feeds.validate import validate_all_feeds
        from ai_web_feeds.models import FeedSource

        mock_v = mocker.patch("ai_web_feeds.validate.validate_feed", new_callable=mocker.AsyncMock)
        mock_v.return_value = FeedValidationResult(feed_source_id="x", is_valid=True)
        feeds = [FeedSource(id="f1", title="t", feed="https://ex/feed", url="s")]
        res = await validate_all_feeds(feeds, show_progress=False)
        assert len(res) == 1

    def test_calculate_health_score_edges(self):
        from ai_web_feeds.validate import calculate_health_score
        from ai_web_feeds.models import FeedValidationResult

        assert calculate_health_score([]) == 0.0
        res = [FeedValidationResult(feed_source_id="1", is_valid=True), FeedValidationResult(feed_source_id="2", is_valid=False)]
        score = calculate_health_score(res)
        assert 0.0 <= score <= 1.0

    @pytest.mark.asyncio
    async def test_validate_feed_url_timeout_path(self, mocker):
        from ai_web_feeds.validate import validate_feed_url
        mocker.patch("ai_web_feeds.validate.httpx.AsyncClient.get", new_callable=mocker.AsyncMock, side_effect=Exception("timeout sim"))
        r = await validate_feed_url("https://slow")
        assert r["success"] is False
        assert r["error_message"] is not None

    def test_validate_topics_non_list(self):
        from ai_web_feeds.validate import validate_topics
        # missing key uses default [], covers post-get code path without crash
        res = validate_topics({})
        assert isinstance(res, ValidationResult)
        # explicit list also
        res2 = validate_topics({"topics": []})
        assert isinstance(res2, ValidationResult)

    @pytest.mark.asyncio
    async def test_validate_single_feed_without_url_returns_warning(self):
        """Early-return when feed URL is missing."""
        from ai_web_feeds.models import FeedSource
        from ai_web_feeds.validate import validate_feed

        source = FeedSource(id="no-url", title="No URL Feed", feed=None, topics=["ai"])
        result = await validate_feed(source)
        assert result.is_valid is False
        assert result.warnings == ["No feed URL provided"]

    def test_validate_feeds_raises_when_jsonschema_missing(self, monkeypatch):
        """ImportError path when jsonschema is unavailable."""
        import builtins

        real_import = builtins.__import__

        def fake_import(name: str, *args, **kwargs):
            if name == "jsonschema":
                raise ImportError("blocked for test")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", fake_import)
        with pytest.raises(ImportError, match="jsonschema not installed"):
            validate_feeds({"sources": []})

    def test_validate_topics_raises_when_jsonschema_missing(self, monkeypatch):
        """validate_topics ImportError branch."""
        import builtins

        real_import = builtins.__import__

        def fake_import(name: str, *args, **kwargs):
            if name == "jsonschema":
                raise ImportError("blocked for test")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", fake_import)
        with pytest.raises(ImportError, match="jsonschema not installed"):
            validate_topics({"topics": []})

    @pytest.mark.asyncio
    async def test_validate_feed_maps_successful_url_result(self, mocker):
        """validate_feed conversion from validate_feed_url dict."""
        from datetime import datetime

        from ai_web_feeds.models import FeedSource
        from ai_web_feeds.validate import validate_feed

        source = FeedSource(
            id="ok-feed",
            title="OK Feed",
            feed="https://example.com/feed.xml",
            topics=["ai"],
        )
        payload = {
            "success": True,
            "status_code": 200,
            "response_time_ms": 42,
            "error_message": None,
            "entry_count": 3,
            "validated_at": datetime.now(),
        }
        mocker.patch(
            "ai_web_feeds.validate.validate_feed_url",
            new_callable=mocker.AsyncMock,
            return_value=payload,
        )
        result = await validate_feed(source)
        assert result.is_valid is True
        assert result.is_accessible is True
        assert result.item_count == 3
