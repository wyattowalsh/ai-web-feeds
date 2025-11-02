"""Unit tests for ai_web_feeds.export module."""

import json
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

import pytest
from ai_web_feeds.export import (
    _add_feed_outline,
    export_all_formats,
    export_to_json,
    export_to_opml,
)
from hypothesis import given
from hypothesis import strategies as st


@pytest.mark.unit
class TestExportToJson:
    """Test export_to_json function."""

    def test_export_json_success(self):
        """Test successful JSON export."""
        data = {
            "sources": [
                {
                    "id": "test-feed",
                    "title": "Test Feed",
                    "feed": "https://example.com/feed.xml",
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.json"
            export_to_json(data, output_path)

            assert output_path.exists()

            # Verify content
            with output_path.open(encoding="utf-8") as f:
                loaded_data = json.load(f)

            assert loaded_data == data

    def test_export_json_creates_directories(self):
        """Test that export_to_json creates parent directories."""
        data = {"sources": []}

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "deep" / "nested" / "feeds.json"
            export_to_json(data, output_path)

            assert output_path.exists()
            assert output_path.parent.exists()

    def test_export_json_unicode_content(self):
        """Test exporting JSON with Unicode characters."""
        data = {
            "sources": [
                {
                    "id": "unicode-feed",
                    "title": "AI研究 🤖",
                    "description": "Émotions et IA",
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.json"
            export_to_json(data, output_path)

            # Verify Unicode is preserved
            with output_path.open(encoding="utf-8") as f:
                loaded_data = json.load(f)

            assert loaded_data["sources"][0]["title"] == "AI研究 🤖"
            assert loaded_data["sources"][0]["description"] == "Émotions et IA"

    def test_export_json_pretty_format(self):
        """Test that exported JSON is pretty-formatted."""
        data = {
            "sources": [
                {"id": "feed-1", "title": "Feed One"},
                {"id": "feed-2", "title": "Feed Two"},
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.json"
            export_to_json(data, output_path)

            # Check that file has proper indentation
            with output_path.open(encoding="utf-8") as f:
                content = f.read()

            assert "  " in content  # Has indentation
            assert "\n" in content  # Has newlines

    @given(
        feed_count=st.integers(min_value=0, max_value=10),
    )
    def test_export_json_property_based(self, feed_count):
        """Property-based test for JSON export."""
        data = {"sources": [{"id": f"feed-{i}", "title": f"Feed {i}"} for i in range(feed_count)]}

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.json"
            export_to_json(data, output_path)

            assert output_path.exists()

            with output_path.open(encoding="utf-8") as f:
                loaded_data = json.load(f)

            assert len(loaded_data["sources"]) == feed_count


@pytest.mark.unit
class TestExportToOpml:
    """Test export_to_opml function."""

    def test_export_opml_success(self):
        """Test successful OPML export."""
        data = {
            "document_meta": {"title": "Test Feeds"},
            "sources": [
                {
                    "id": "feed-1",
                    "title": "Test Feed",
                    "feed": "https://example.com/feed.xml",
                    "site": "https://example.com",
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.opml"
            export_to_opml(data, output_path)

            assert output_path.exists()

            # Parse and verify OPML structure
            tree = ET.parse(output_path)
            root = tree.getroot()

            assert root.tag == "opml"
            assert root.attrib["version"] == "2.0"

    def test_export_opml_flat_structure(self):
        """Test OPML export with flat structure."""
        data = {
            "sources": [
                {"id": "feed-1", "title": "Feed One", "feed": "https://example.com/1"},
                {"id": "feed-2", "title": "Feed Two", "feed": "https://example.com/2"},
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.opml"
            export_to_opml(data, output_path, categorized=False)

            tree = ET.parse(output_path)
            root = tree.getroot()
            body = root.find("body")

            assert body is not None
            outlines = body.findall("outline")
            assert len(outlines) == 2

    def test_export_opml_categorized_structure(self):
        """Test OPML export with categorized structure."""
        data = {
            "sources": [
                {
                    "id": "feed-1",
                    "title": "AI Feed",
                    "feed": "https://example.com/ai",
                    "topics": ["artificial-intelligence"],
                },
                {
                    "id": "feed-2",
                    "title": "ML Feed",
                    "feed": "https://example.com/ml",
                    "topics": ["machine-learning"],
                },
                {
                    "id": "feed-3",
                    "title": "Another AI Feed",
                    "feed": "https://example.com/ai2",
                    "topics": ["artificial-intelligence"],
                },
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.opml"
            export_to_opml(data, output_path, categorized=True)

            tree = ET.parse(output_path)
            root = tree.getroot()
            body = root.find("body")

            assert body is not None
            # Should have category outlines
            category_outlines = body.findall("outline")
            assert len(category_outlines) == 2  # Two categories

    def test_export_opml_uncategorized_feeds(self):
        """Test OPML export with feeds without topics."""
        data = {
            "sources": [
                {"id": "feed-1", "title": "Uncategorized Feed", "feed": "https://example.com/unc"},
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.opml"
            export_to_opml(data, output_path, categorized=True)

            tree = ET.parse(output_path)
            root = tree.getroot()
            body = root.find("body")

            # Should have "Uncategorized" category
            category_outline = body.find("outline")
            assert category_outline is not None
            assert category_outline.attrib["text"] == "Uncategorized"

    def test_export_opml_creates_directories(self):
        """Test that export_to_opml creates parent directories."""
        data = {"sources": []}

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "deep" / "nested" / "feeds.opml"
            export_to_opml(data, output_path)

            assert output_path.exists()

    def test_export_opml_title_in_head(self):
        """Test that OPML has title in head element."""
        data = {
            "document_meta": {"title": "Custom Feed Collection"},
            "sources": [],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.opml"
            export_to_opml(data, output_path)

            tree = ET.parse(output_path)
            root = tree.getroot()
            head = root.find("head")
            title = head.find("title")

            assert title is not None
            assert title.text == "Custom Feed Collection"


@pytest.mark.unit
class TestAddFeedOutline:
    """Test _add_feed_outline function."""

    def test_add_feed_outline_basic(self):
        """Test adding a basic feed outline."""
        parent = ET.Element("body")
        source = {
            "title": "Test Feed",
            "feed": "https://example.com/feed.xml",
            "site": "https://example.com",
        }

        _add_feed_outline(parent, source)

        outline = parent.find("outline")
        assert outline is not None
        assert outline.attrib["type"] == "rss"
        assert outline.attrib["title"] == "Test Feed"
        assert outline.attrib["xmlUrl"] == "https://example.com/feed.xml"
        assert outline.attrib["htmlUrl"] == "https://example.com"

    def test_add_feed_outline_with_description(self):
        """Test adding feed outline with description."""
        parent = ET.Element("body")
        source = {
            "title": "Test Feed",
            "feed": "https://example.com/feed.xml",
            "description": "A test feed description",
        }

        _add_feed_outline(parent, source)

        outline = parent.find("outline")
        assert outline is not None
        assert outline.attrib["description"] == "A test feed description"

    def test_add_feed_outline_minimal(self):
        """Test adding feed outline with minimal data."""
        parent = ET.Element("body")
        source = {"title": "Minimal Feed"}

        _add_feed_outline(parent, source)

        outline = parent.find("outline")
        assert outline is not None
        assert outline.attrib["title"] == "Minimal Feed"
        assert "xmlUrl" not in outline.attrib
        assert "htmlUrl" not in outline.attrib


@pytest.mark.unit
class TestExportAllFormats:
    """Test export_all_formats function."""

    def test_export_all_formats_success(self):
        """Test exporting to all formats."""
        data = {
            "sources": [
                {
                    "id": "test-feed",
                    "title": "Test Feed",
                    "feed": "https://example.com/feed.xml",
                    "topics": ["ai"],
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            export_all_formats(data, base_path=tmpdir, prefix="test")

            # Check all files were created
            json_file = Path(tmpdir) / "test.json"
            opml_file = Path(tmpdir) / "test.opml"
            categorized_opml = Path(tmpdir) / "test.categorized.opml"

            assert json_file.exists()
            assert opml_file.exists()
            assert categorized_opml.exists()

    def test_export_all_formats_creates_base_directory(self):
        """Test that export_all_formats creates base directory."""
        data = {"sources": []}

        with tempfile.TemporaryDirectory() as tmpdir:
            base_path = Path(tmpdir) / "output" / "exports"
            export_all_formats(data, base_path=base_path)

            assert base_path.exists()

    def test_export_all_formats_custom_prefix(self):
        """Test export_all_formats with custom prefix."""
        data = {"sources": []}

        with tempfile.TemporaryDirectory() as tmpdir:
            export_all_formats(data, base_path=tmpdir, prefix="custom")

            custom_json = Path(tmpdir) / "custom.json"
            custom_opml = Path(tmpdir) / "custom.opml"

            assert custom_json.exists()
            assert custom_opml.exists()


@pytest.mark.unit
class TestExportIntegration:
    """Integration tests for export module."""

    def test_load_and_export_workflow(self):
        """Test loading and exporting feeds workflow."""
        import yaml

        # Create temp feed file
        feed_data = {
            "sources": [
                {
                    "id": "test-feed",
                    "title": "Test Feed",
                    "feed": "https://example.com/feed.xml",
                    "topics": ["ai"],
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create YAML file
            yaml_path = Path(tmpdir) / "feeds.yaml"
            with yaml_path.open("w", encoding="utf-8") as f:
                yaml.dump(feed_data, f)

            # Load and export
            from ai_web_feeds.load import load_feeds

            data = load_feeds(yaml_path)

            # Export to JSON
            json_path = Path(tmpdir) / "feeds.json"
            export_to_json(data, json_path)

            assert json_path.exists()

            # Verify round-trip
            with json_path.open(encoding="utf-8") as f:
                exported_data = json.load(f)

            assert exported_data == data

    def test_export_round_trip_json(self):
        """Test JSON export and import round-trip."""
        original_data = {
            "document_meta": {"version": "1.0"},
            "sources": [
                {
                    "id": "feed-1",
                    "title": "Feed One",
                    "feed": "https://example.com/1",
                    "tags": ["ai", "ml"],
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "feeds.json"

            # Export
            export_to_json(original_data, json_path)

            # Import
            with json_path.open(encoding="utf-8") as f:
                imported_data = json.load(f)

            assert imported_data == original_data
