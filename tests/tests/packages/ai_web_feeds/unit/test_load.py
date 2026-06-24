"""Unit tests for ai_web_feeds.load module."""

import tempfile
from pathlib import Path

import pytest
import yaml
from ai_web_feeds.load import (
    canonicalize_catalog,
    infer_source_type,
    load_feeds,
    load_topics,
    save_feeds,
    save_topics,
    _is_forum_domain,
    _is_docs_feed,
)
from hypothesis import given
from hypothesis import strategies as st


@pytest.mark.unit
class TestLoadFeeds:
    """Test load_feeds function."""

    def test_load_feeds_success(self, temp_yaml_file):
        """Test successful feed loading."""
        data = load_feeds(temp_yaml_file)

        assert isinstance(data, dict)
        assert "feeds" in data
        assert isinstance(data["feeds"], list)
        assert len(data["feeds"]) == 1
        assert data["feeds"][0]["id"] == "test-feed"

    def test_load_feeds_with_path_object(self, temp_yaml_file):
        """Test loading with Path object."""
        data = load_feeds(Path(temp_yaml_file))

        assert isinstance(data, dict)
        assert "feeds" in data

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
        """Test loading empty YAML file."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("")
            temp_path = Path(f.name)

        try:
            data = load_feeds(temp_path)
            # Empty YAML should return None, which we handle
            assert data is None or isinstance(data, dict)
        finally:
            temp_path.unlink()

    def test_load_feeds_with_sources_key(self):
        """Test loading feeds with 'sources' key."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("""
sources:
  - id: feed-1
    title: Feed One
  - id: feed-2
    title: Feed Two
""")
            temp_path = Path(f.name)

        try:
            data = load_feeds(temp_path)
            assert "sources" in data
            assert len(data["sources"]) == 2
        finally:
            temp_path.unlink()

    def test_load_feeds_unicode_content(self):
        """Test loading feeds with Unicode characters."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".yaml", delete=False, encoding="utf-8"
        ) as f:
            f.write("""
feeds:
  - id: unicode-feed
    title: "AI研究 - 人工智能 🤖"
    description: "Émotions et IA"
""")
            temp_path = Path(f.name)

        try:
            data = load_feeds(temp_path)
            assert data["feeds"][0]["title"] == "AI研究 - 人工智能 🤖"
            assert data["feeds"][0]["description"] == "Émotions et IA"
        finally:
            temp_path.unlink()


@pytest.mark.unit
class TestLoadTopics:
    """Test load_topics function."""

    def test_load_topics_success(self):
        """Test successful topic loading."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("""
topics:
  - id: ai
    name: Artificial Intelligence
    description: AI research and applications
""")
            temp_path = Path(f.name)

        try:
            data = load_topics(temp_path)
            assert isinstance(data, dict)
            assert "topics" in data
            assert len(data["topics"]) == 1
            assert data["topics"][0]["id"] == "ai"
        finally:
            temp_path.unlink()

    def test_load_topics_file_not_found(self):
        """Test loading from non-existent file."""
        with pytest.raises(FileNotFoundError) as exc_info:
            load_topics("/nonexistent/path/topics.yaml")

        assert "Topics file not found" in str(exc_info.value)

    def test_load_topics_with_relations(self):
        """Test loading topics with parent-child relations."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("""
topics:
  - id: ai
    name: Artificial Intelligence
    children:
      - ml
      - dl
  - id: ml
    name: Machine Learning
    parent: ai
  - id: dl
    name: Deep Learning
    parent: ai
""")
            temp_path = Path(f.name)

        try:
            data = load_topics(temp_path)
            assert len(data["topics"]) == 3
            ai_topic = next(t for t in data["topics"] if t["id"] == "ai")
            assert "children" in ai_topic
            assert len(ai_topic["children"]) == 2
        finally:
            temp_path.unlink()

    def test_load_topics_empty_topics_list(self):
        """Test loading with empty topics list."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("topics: []\n")
            temp_path = Path(f.name)

        try:
            data = load_topics(temp_path)
            assert data["topics"] == []
        finally:
            temp_path.unlink()


@pytest.mark.unit
class TestCanonicalizeCatalog:
    """Test canonical catalog normalization helpers."""

    def test_canonicalize_catalog_adds_stable_minimal_fields_without_mutation(self):
        catalog = {
            "sources": [
                {
                    "url": "https://example.com/feed.xml",
                    "title": "Example Feed",
                    "topics": ["agents", "agents", "ml"],
                }
            ]
        }

        canonical = canonicalize_catalog(catalog)

        assert canonical["sources"][0]["id"] == "7a775db75c1d6d17"
        assert canonical["sources"][0]["feed"] == "https://example.com/feed.xml"
        assert canonical["sources"][0]["tags"] == ["agents", "ml"]
        assert canonical["sources"][0]["topics"] == ["agents", "ml"]
        assert "id" not in catalog["sources"][0]

    def test_canonicalize_catalog_enriched_infers_source_type_and_total(self):
        catalog = {
            "document_meta": {"created": "2025-10-15"},
            "sources": [
                {
                    "url": "https://www.youtube.com/channel/example",
                    "title": "Research Videos",
                    "topics": ["research", "videos"],
                }
            ],
        }

        canonical = canonicalize_catalog(catalog, enriched=True)

        assert canonical["document_meta"]["total_sources"] == 1
        assert canonical["sources"][0]["source_type"] == "youtube"
        assert canonical["sources"][0]["tags"] == ["research", "videos"]
        assert canonical["sources"][0]["tags"] is not canonical["sources"][0]["topics"]

    @pytest.mark.parametrize(
        ("source", "expected"),
        [
            ({"url": "https://importai.substack.com/feed", "topics": []}, "substack"),
            ({"url": "https://github.com/pytorch/pytorch", "topics": []}, "github"),
            ({"url": "https://example.com/podcast.xml", "topics": ["podcasts"]}, "podcast"),
            ({"url": "https://example.com", "topics": ["industry", "product"]}, "organization"),
            ({"url": "https://example.com", "topics": ["blogs"]}, "blog"),
        ],
    )
    def test_infer_source_type_uses_url_and_topic_hints(self, source, expected):
        assert infer_source_type(source) == expected


@pytest.mark.unit
class TestSaveFeeds:
    """Test save_feeds function."""

    def test_save_feeds_success(self):
        """Test successful feed saving."""
        data = {
            "document_meta": {"version": "1.0"},
            "sources": [
                {
                    "id": "test-feed",
                    "title": "Test Feed",
                    "feed": "https://example.com/feed.xml",
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "output" / "feeds.yaml"
            save_feeds(data, output_path)

            assert output_path.exists()

            # Verify content
            loaded_data = load_feeds(output_path)
            assert loaded_data["sources"][0]["id"] == "test-feed"

    def test_save_feeds_creates_directories(self):
        """Test that save_feeds creates parent directories."""
        data = {"sources": []}

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "deep" / "nested" / "path" / "feeds.yaml"
            save_feeds(data, output_path)

            assert output_path.exists()
            assert output_path.parent.exists()

    def test_save_feeds_unicode_content(self):
        """Test saving feeds with Unicode characters."""
        data = {
            "sources": [
                {
                    "id": "unicode-feed",
                    "title": "AI研究 - 人工智能 🤖",
                    "description": "Émotions et IA",
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.yaml"
            save_feeds(data, output_path)

            # Verify Unicode is preserved
            loaded_data = load_feeds(output_path)
            assert loaded_data["sources"][0]["title"] == "AI研究 - 人工智能 🤖"

    def test_save_feeds_preserves_structure(self):
        """Test that save_feeds preserves data structure."""
        data = {
            "document_meta": {
                "version": "1.0",
                "updated": "2024-01-15",
            },
            "sources": [
                {
                    "id": "feed-1",
                    "title": "Feed One",
                    "tags": ["ai", "ml"],
                    "topics": ["artificial-intelligence"],
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.yaml"
            save_feeds(data, output_path)

            loaded_data = load_feeds(output_path)
            assert loaded_data["document_meta"]["version"] == "1.0"
            assert loaded_data["sources"][0]["tags"] == ["ai", "ml"]

    @given(
        feed_count=st.integers(min_value=0, max_value=10),
        feed_id_prefix=st.text(
            min_size=1, max_size=10, alphabet=st.characters(whitelist_categories=("L", "N"))
        ),
    )
    def test_save_feeds_property_based(self, feed_count, feed_id_prefix):
        """Property-based test for save_feeds."""
        data = {
            "sources": [
                {
                    "id": f"{feed_id_prefix}-{i}",
                    "title": f"Feed {i}",
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
                    "name": "Artificial Intelligence",
                    "description": "AI research",
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "topics.yaml"
            save_topics(data, output_path)

            assert output_path.exists()

            # Verify content
            loaded_data = load_topics(output_path)
            assert loaded_data["topics"][0]["id"] == "ai"

    def test_save_topics_with_relations(self):
        """Test saving topics with parent-child relations."""
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
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "topics.yaml"
            save_topics(data, output_path)

            loaded_data = load_topics(output_path)
            ai_topic = next(t for t in loaded_data["topics"] if t["id"] == "ai")
            assert ai_topic["children"] == ["ml", "dl"]

    def test_save_topics_empty_list(self):
        """Test saving empty topics list."""
        data = {"topics": []}

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "topics.yaml"
            save_topics(data, output_path)

            assert output_path.exists()
            loaded_data = load_topics(output_path)
            assert loaded_data["topics"] == []

    def test_save_topics_creates_directories(self):
        """Test that save_topics creates parent directories."""
        data = {"topics": []}

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
            "document_meta": {"version": "1.0"},
            "sources": [
                {
                    "id": "feed-1",
                    "title": "Feed One",
                    "feed": "https://example.com/feed1.xml",
                    "tags": ["ai", "ml"],
                },
                {
                    "id": "feed-2",
                    "title": "Feed Two",
                    "feed": "https://example.com/feed2.xml",
                    "tags": ["dl"],
                },
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "feeds.yaml"

            # Save and load
            save_feeds(original_data, path)
            loaded_data = load_feeds(path)

            # Verify data is preserved
            assert loaded_data == original_data

    def test_topics_round_trip(self):
        """Test loading and saving topics preserves data."""
        original_data = {
            "topics": [
                {
                    "id": "ai",
                    "name": "Artificial Intelligence",
                    "children": ["ml"],
                },
                {
                    "id": "ml",
                    "name": "Machine Learning",
                    "parent": "ai",
                },
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "topics.yaml"

            # Save and load
            save_topics(original_data, path)
            loaded_data = load_topics(path)

            # Verify data is preserved
            assert loaded_data == original_data

    def test_unicode_round_trip(self):
        """Test Unicode content survives round-trip."""
        original_data = {
            "sources": [
                {
                    "id": "unicode-test",
                    "title": "测试 🚀 Tëst",
                    "description": "Émotions et données 人工智能",
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "feeds.yaml"

            save_feeds(original_data, path)
            loaded_data = load_feeds(path)

            assert loaded_data["sources"][0]["title"] == original_data["sources"][0]["title"]
            assert (
                loaded_data["sources"][0]["description"]
                == original_data["sources"][0]["description"]
            )


@pytest.mark.unit
class TestForumAndDocsDetection:
    """Tests for private forum/docs helpers and infer_source_type forum/docs paths."""

    @pytest.mark.parametrize(
        ("domain", "expected"),
        [
            ("discuss.pytorch.org", True),
            ("stackoverflow.com", True),
            ("stackexchange.com", True),
            ("community.example.com", True),
            ("forum.ai.org", True),
            ("example.com", False),
            ("blog.example.com", False),
            ("", False),
        ],
    )
    def test_is_forum_domain(self, domain: str, expected: bool) -> None:
        """Test forum domain detection markers."""
        assert _is_forum_domain(domain) is expected

    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            ("/releases.atom", True),
            ("/changelog", True),
            ("/docs/index.html", True),
            ("/releases/v1.0", True),
            ("/feed.xml", False),
            ("/blog/posts", False),
            ("", False),
            ("/random", False),
        ],
    )
    def test_is_docs_feed(self, path: str, expected: bool) -> None:
        """Test docs feed path detection."""
        assert _is_docs_feed(path) is expected

    @pytest.mark.parametrize(
        ("source", "expected"),
        [
            ({"url": "https://discuss.pytorch.org/t/feed", "topics": []}, "forum"),
            ({"url": "https://community.openai.com/feed", "topics": ["community"]}, "forum"),
            ({"url": "https://forum.example.com/rss", "topics": []}, "forum"),
            (
                {"url": "https://github.com/org/repo/releases.atom", "topics": []},
                "docs",
            ),
            ({"url": "https://example.com/docs/feed.xml", "topics": ["docs"]}, "docs"),
            (
                {"url": "https://example.com/changelog", "topics": ["documentation"]},
                "docs",
            ),
            ({"url": "https://example.com/feed", "topics": ["forum"]}, "forum"),
        ],
    )
    def test_infer_source_type_forum_and_docs_paths(self, source: dict, expected: str) -> None:
        """Test infer_source_type for forum and docs paths (load.py update)."""
        assert infer_source_type(source) == expected
