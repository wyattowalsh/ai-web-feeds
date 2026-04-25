"""Unit tests for ai_web_feeds.load module."""

import tempfile
from pathlib import Path

import pytest
import yaml
from ai_web_feeds.load import (
    load_feeds,
    load_topics,
    normalize_source_for_feed_source,
    save_feeds,
    save_topics,
)
from ai_web_feeds.models import SourceType
from ai_web_feeds.validate import validate_feeds, validate_topics
from hypothesis import given
from hypothesis import strategies as st

DATA_DIR = Path(__file__).resolve().parents[5] / "data"
FEEDS_SCHEMA_PATH = DATA_DIR / "feeds.schema.json"
TOPICS_SCHEMA_PATH = DATA_DIR / "topics.schema.json"
SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"


@pytest.mark.unit
class TestLoadFeeds:
    """Test load_feeds function."""

    def test_load_feeds_success(self, temp_yaml_file):
        """Test successful feed loading."""
        data = load_feeds(temp_yaml_file)

        assert isinstance(data, dict)
        assert data["schema_version"] == "feeds-2.1.0"
        assert "sources" in data
        assert isinstance(data["sources"], list)
        assert len(data["sources"]) == 1
        assert data["sources"][0]["url"] == "https://example.com/feed.xml"

        validation = validate_feeds(data, schema_path=FEEDS_SCHEMA_PATH)
        assert validation.valid is True

    def test_load_feeds_with_path_object(self, temp_yaml_file):
        """Test loading with Path object."""
        data = load_feeds(Path(temp_yaml_file))

        assert isinstance(data, dict)
        assert "sources" in data

    def test_load_feeds_file_not_found(self):
        """Test loading from non-existent file."""
        with pytest.raises(FileNotFoundError) as exc_info:
            load_feeds("/nonexistent/path/feeds.yaml")

        assert "Feeds file not found" in str(exc_info.value)

    def test_load_feeds_invalid_yaml(self):
        """Test loading invalid YAML."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("invalid: yaml: content:\n  - malformed")
            temp_path = Path(f.name)

        try:
            with pytest.raises(yaml.YAMLError):
                load_feeds(temp_path)
        finally:
            temp_path.unlink()

    def test_load_feeds_empty_file(self):
        """Empty feed files should load safely but fail schema validation."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("")
            temp_path = Path(f.name)

        try:
            data = load_feeds(temp_path)
            assert data == {}

            validation = validate_feeds(data, schema_path=FEEDS_SCHEMA_PATH)
            assert validation.valid is False
            assert any("Schema validation failed" in error for error in validation.errors)
        finally:
            temp_path.unlink()

    def test_load_feeds_with_sources_key(self):
        """Test loading feeds with canonical sources contract."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(
                """
schema_version: feeds-2.1.0
sources:
  - url: https://example.com/feed-1.xml
    title: Feed One
    topics: [ai]
  - url: https://example.com/feed-2.xml
    title: Feed Two
    topics: [ml]
"""
            )
            temp_path = Path(f.name)

        try:
            data = load_feeds(temp_path)

            assert "sources" in data
            assert len(data["sources"]) == 2

            validation = validate_feeds(data, schema_path=FEEDS_SCHEMA_PATH)
            assert validation.valid is True
        finally:
            temp_path.unlink()

    def test_load_feeds_unicode_content(self):
        """Test loading feeds with Unicode characters."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".yaml", delete=False, encoding="utf-8"
        ) as f:
            f.write(
                """
schema_version: feeds-2.1.0
sources:
  - url: https://example.com/unicode.xml
    title: "AI研究 - 人工智能 🤖"
    notes: "Émotions et IA"
    topics: [ai]
"""
            )
            temp_path = Path(f.name)

        try:
            data = load_feeds(temp_path)
            assert data["sources"][0]["title"] == "AI研究 - 人工智能 🤖"
            assert data["sources"][0]["notes"] == "Émotions et IA"
        finally:
            temp_path.unlink()

    def test_load_feeds_empty_sources_list_is_schema_invalid(self):
        """Empty source collections should load but fail schema validation."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(
                """
schema_version: feeds-2.1.0
sources: []
"""
            )
            temp_path = Path(f.name)

        try:
            data = load_feeds(temp_path)
            assert data["sources"] == []

            validation = validate_feeds(data, schema_path=FEEDS_SCHEMA_PATH)
            assert validation.valid is False
            assert any("Schema validation failed" in error for error in validation.errors)
        finally:
            temp_path.unlink()


@pytest.mark.unit
class TestNormalizeSourceForFeedSource:
    """Test canonical source normalization for FeedSource contract."""

    def test_normalize_direct_feed_url(self):
        """Direct feed URLs should map to feed field and inferred source type."""
        normalized = normalize_source_for_feed_source(
            {
                "url": "https://github.com/pytorch/pytorch",
                "topics": ["ml", "open-source"],
                "notes": "  test  ",
            }
        )

        assert normalized["id"]
        assert normalized["feed"] == "https://github.com/pytorch/pytorch/releases.atom"
        assert normalized["site"] == "https://github.com/pytorch/pytorch"
        assert normalized["source_type"] == SourceType.GITHUB
        assert normalized["topics"] == ["ml", "open-source"]
        assert normalized["notes"] == "  test  "

    def test_normalize_retains_valid_explicit_source_type(self):
        """Valid explicit source type should be preserved."""
        normalized = normalize_source_for_feed_source(
            {
                "url": "https://example.com/news",
                "source_type": "newsroom",
                "topics": ["research"],
            }
        )

        assert normalized["source_type"] == SourceType.NEWSROOM

    def test_normalize_deduplicates_topics(self):
        """Topics should be deduplicated while preserving order."""
        normalized = normalize_source_for_feed_source(
            {
                "url": "https://example.com/feed.xml",
                "topics": ["ml", "ml", "ai", "ai"],
            }
        )

        assert normalized["topics"] == ["ml", "ai"]


@pytest.mark.unit
class TestLoadTopics:
    """Test load_topics function."""

    def test_load_topics_success(self):
        """Test successful topic loading."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(
                """
topics:
  - id: ai
    label: Artificial Intelligence
    facet: domain
    description: AI research and applications
    parents: []
"""
            )
            temp_path = Path(f.name)

        try:
            data = load_topics(temp_path)
            assert isinstance(data, dict)
            assert "topics" in data
            assert len(data["topics"]) == 1
            assert data["topics"][0]["id"] == "ai"

            validation = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
            assert validation.valid is True
        finally:
            temp_path.unlink()

    def test_load_topics_file_not_found(self):
        """Test loading from non-existent file."""
        with pytest.raises(FileNotFoundError) as exc_info:
            load_topics("/nonexistent/path/topics.yaml")

        assert "Topics file not found" in str(exc_info.value)

    def test_load_topics_with_relations(self):
        """Test loading topics with canonical hierarchy and relations."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(
                """
topics:
  - id: ai
    label: Artificial Intelligence
    facet: domain
    parents: []
    relations:
      related_to:
        - ml
        - dl
  - id: ml
    label: Machine Learning
    facet: subfield
    parents: [ai]
  - id: dl
    label: Deep Learning
    facet: subfield
    parents: [ai]
"""
            )
            temp_path = Path(f.name)

        try:
            data = load_topics(temp_path)
            assert len(data["topics"]) == 3
            ai_topic = next(t for t in data["topics"] if t["id"] == "ai")
            assert ai_topic["relations"]["related_to"] == ["ml", "dl"]

            validation = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
            assert validation.valid is True
        finally:
            temp_path.unlink()

    def test_load_topics_empty_file(self):
        """Empty topic files should not crash and should remain schema-invalid."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("")
            temp_path = Path(f.name)

        try:
            data = load_topics(temp_path)
            assert data == {}

            validation = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
            assert validation.valid is False
            assert any("Schema validation failed" in error for error in validation.errors)
        finally:
            temp_path.unlink()

    def test_load_topics_partially_written_topics_key(self):
        """Partially written topic files should load without crashing for auditability."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("topics:\n")
            temp_path = Path(f.name)

        try:
            data = load_topics(temp_path)
            assert data == {"topics": None}

            validation = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
            assert validation.valid is False
            assert any("Schema validation failed" in error for error in validation.errors)
        finally:
            temp_path.unlink()

    def test_load_topics_empty_topics_list_is_schema_invalid(self):
        """Empty topic collections should load but fail schema validation."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("topics: []\n")
            temp_path = Path(f.name)

        try:
            data = load_topics(temp_path)
            assert data["topics"] == []

            validation = validate_topics(data, schema_path=TOPICS_SCHEMA_PATH)
            assert validation.valid is False
            assert any("Schema validation failed" in error for error in validation.errors)
        finally:
            temp_path.unlink()


@pytest.mark.unit
class TestSaveFeeds:
    """Test save_feeds function."""

    def test_save_feeds_success(self):
        """Test successful feed saving."""
        data = {
            "schema_version": "feeds-2.1.0",
            "document_meta": {"version": "1.0"},
            "sources": [
                {
                    "url": "https://example.com",
                    "title": "Test Feed",
                    "topics": ["ai"],
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "output" / "feeds.yaml"
            save_feeds(data, output_path)

            assert output_path.exists()

            loaded_data = load_feeds(output_path)
            assert loaded_data["sources"][0]["title"] == "Test Feed"

    def test_save_feeds_creates_directories(self):
        """Test that save_feeds creates parent directories."""
        data = {
            "schema_version": "feeds-2.1.0",
            "sources": [{"url": "https://example.com", "topics": ["ai"]}],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "deep" / "nested" / "path" / "feeds.yaml"
            save_feeds(data, output_path)

            assert output_path.exists()
            assert output_path.parent.exists()

    def test_save_feeds_unicode_content(self):
        """Test saving feeds with Unicode characters."""
        data = {
            "schema_version": "feeds-2.1.0",
            "sources": [
                {
                    "url": "https://example.com/unicode",
                    "title": "AI研究 - 人工智能 🤖",
                    "notes": "Émotions et IA",
                    "topics": ["ai"],
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.yaml"
            save_feeds(data, output_path)

            loaded_data = load_feeds(output_path)
            assert loaded_data["sources"][0]["title"] == "AI研究 - 人工智能 🤖"

    def test_save_feeds_preserves_structure(self):
        """Test that save_feeds preserves data structure."""
        data = {
            "schema_version": "feeds-2.1.0",
            "document_meta": {
                "version": "1.0",
                "updated": "2024-01-15",
            },
            "sources": [
                {
                    "url": "https://example.com/feed-1.xml",
                    "title": "Feed One",
                    "notes": "Tracked for AI updates",
                    "topics": ["artificial-intelligence"],
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.yaml"
            save_feeds(data, output_path)

            loaded_data = load_feeds(output_path)
            assert loaded_data["document_meta"]["version"] == "1.0"
            assert loaded_data["sources"][0]["topics"] == ["artificial-intelligence"]

    @given(
        feed_count=st.integers(min_value=1, max_value=10),
        feed_id_prefix=st.text(min_size=1, max_size=10, alphabet=SLUG_CHARS),
    )
    def test_save_feeds_property_based(self, feed_count, feed_id_prefix):
        """Property-based test for save_feeds."""
        data = {
            "schema_version": "feeds-2.1.0",
            "sources": [
                {
                    "url": f"https://example.com/{feed_id_prefix}-{i}",
                    "title": f"Feed {i}",
                    "topics": ["ai"],
                }
                for i in range(feed_count)
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.yaml"
            save_feeds(data, output_path)

            assert output_path.exists()
            loaded_data = load_feeds(output_path)
            assert len(loaded_data["sources"]) == feed_count


@pytest.mark.unit
class TestSaveTopics:
    """Test save_topics function."""

    def test_save_topics_success(self):
        """Test successful topic saving."""
        data = {
            "topics": [
                {
                    "id": "ai",
                    "label": "Artificial Intelligence",
                    "facet": "domain",
                    "description": "AI research",
                    "parents": [],
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "topics.yaml"
            save_topics(data, output_path)

            assert output_path.exists()

            loaded_data = load_topics(output_path)
            assert loaded_data["topics"][0]["id"] == "ai"

    def test_save_topics_with_relations(self):
        """Test saving topics with canonical relations."""
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
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "topics.yaml"
            save_topics(data, output_path)

            loaded_data = load_topics(output_path)
            ai_topic = next(t for t in loaded_data["topics"] if t["id"] == "ai")
            assert ai_topic["relations"]["related_to"] == ["ml", "dl"]

    def test_save_topics_empty_list_remains_schema_invalid(self):
        """Saving an empty topic collection should preserve data but fail schema validation."""
        data = {"topics": []}

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "topics.yaml"
            save_topics(data, output_path)

            assert output_path.exists()
            loaded_data = load_topics(output_path)
            assert loaded_data["topics"] == []

            validation = validate_topics(loaded_data, schema_path=TOPICS_SCHEMA_PATH)
            assert validation.valid is False

    def test_save_topics_creates_directories(self):
        """Test that save_topics creates parent directories."""
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

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "deep" / "nested" / "topics.yaml"
            save_topics(data, output_path)

            assert output_path.exists()
            assert output_path.parent.exists()


@pytest.mark.unit
class TestLoadSaveRoundTrip:
    """Test round-trip load/save operations."""

    def test_feeds_round_trip(self):
        """Test loading and saving feeds preserves data."""
        original_data = {
            "schema_version": "feeds-2.1.0",
            "document_meta": {"version": "1.0"},
            "sources": [
                {
                    "url": "https://example.com/feed-1.xml",
                    "title": "Feed One",
                    "notes": "Covers AI and ML",
                    "topics": ["artificial-intelligence"],
                },
                {
                    "url": "https://example.com/feed-2.xml",
                    "title": "Feed Two",
                    "notes": "Covers DL",
                    "topics": ["deep-learning"],
                },
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "feeds.yaml"

            save_feeds(original_data, path)
            loaded_data = load_feeds(path)

            assert loaded_data == original_data

    def test_topics_round_trip(self):
        """Test loading and saving topics preserves data."""
        original_data = {
            "topics": [
                {
                    "id": "ai",
                    "label": "Artificial Intelligence",
                    "facet": "domain",
                    "parents": [],
                    "relations": {"related_to": ["ml"]},
                },
                {
                    "id": "ml",
                    "label": "Machine Learning",
                    "facet": "subfield",
                    "parents": ["ai"],
                },
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "topics.yaml"

            save_topics(original_data, path)
            loaded_data = load_topics(path)

            assert loaded_data == original_data

    def test_unicode_round_trip(self):
        """Test Unicode content survives round-trip."""
        original_data = {
            "schema_version": "feeds-2.1.0",
            "sources": [
                {
                    "url": "https://example.com/unicode-test.xml",
                    "title": "测试 🚀 Tëst",
                    "notes": "Émotions et données 人工智能",
                    "topics": ["ai"],
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "feeds.yaml"

            save_feeds(original_data, path)
            loaded_data = load_feeds(path)

            assert loaded_data["sources"][0]["title"] == original_data["sources"][0]["title"]
            assert loaded_data["sources"][0]["notes"] == original_data["sources"][0]["notes"]
