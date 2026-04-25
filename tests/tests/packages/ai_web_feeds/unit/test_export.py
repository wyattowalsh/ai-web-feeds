"""Unit tests for ai_web_feeds.export module."""

import json
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

import pytest
import yaml
from ai_web_feeds.export import (
    _add_feed_outline,
    build_opml_category_map,
    export_all_formats,
    export_to_json,
    export_to_opml,
)
from ai_web_feeds.load import load_feeds
from hypothesis import given
from hypothesis import strategies as st


def _get_opml_wrapper(output_path: Path) -> ET.Element:
    tree = ET.parse(output_path)
    root = tree.getroot()
    body = root.find("body")

    assert body is not None

    outlines = body.findall("outline")
    assert len(outlines) == 1

    wrapper = outlines[0]
    assert wrapper.attrib["text"] == "aiwebfeeds"
    assert wrapper.attrib["title"] == "aiwebfeeds"
    return wrapper


@pytest.mark.unit
class TestExportToJson:
    """Test export_to_json function."""

    def test_export_json_success(self):
        """Test successful JSON export."""
        data = {
            "sources": [
                {
                    "url": "https://example.com/feed.xml",
                    "topics": ["ai"],
                    "title": "Test Feed",
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

            assert loaded_data["sources"][0]["id"]
            assert loaded_data["sources"][0]["feed"] == "https://example.com/feed.xml"
            assert loaded_data["sources"][0]["title"] == "Test Feed"
            assert loaded_data["sources"][0]["topics"] == ["ai"]

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
                    "url": "https://example.com/feed.xml",
                    "topics": ["ai"],
                    "title": "AI研究 🤖",
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
            assert loaded_data["sources"][0]["topics"] == ["ai"]

    def test_export_json_pretty_format(self):
        """Test that exported JSON is pretty-formatted."""
        data = {
            "sources": [
                {"url": "https://example.com/feed-1.xml", "topics": ["ai"], "title": "Feed One"},
                {"url": "https://example.com/feed-2.xml", "topics": ["ml"], "title": "Feed Two"},
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
        data = {
            "sources": [
                {
                    "url": f"https://example.com/feed-{i}.xml",
                    "topics": ["ai"],
                    "title": f"Feed {i}",
                }
                for i in range(feed_count)
            ]
        }

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
            root = ET.parse(output_path).getroot()
            body = root.find("body")
            wrapper = _get_opml_wrapper(output_path)
            outline = wrapper.find("outline")

            assert root.tag == "opml"
            assert root.attrib["version"] == "2.0"
            assert body is not None
            assert outline is not None
            assert outline.attrib["title"] == "Test Feed"

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

            wrapper = _get_opml_wrapper(output_path)
            outlines = wrapper.findall("outline")
            assert len(outlines) == 2
            assert outlines[0].attrib["title"] == "Feed One"
            assert outlines[1].attrib["title"] == "Feed Two"

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

            wrapper = _get_opml_wrapper(output_path)

            category_outlines = wrapper.findall("outline")
            assert len(category_outlines) == 2  # Two categories
            assert category_outlines[0].attrib["text"] == "artificial-intelligence"
            assert category_outlines[1].attrib["text"] == "machine-learning"

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

            wrapper = _get_opml_wrapper(output_path)

            # Should have "Uncategorized" category
            category_outline = wrapper.find("outline")
            assert category_outline is not None
            assert category_outline.attrib["text"] == "Uncategorized"
            assert category_outline.find("outline") is not None

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

    def test_export_opml_prefers_meta_description_over_notes(self):
        """Enriched OPML should prefer the enriched meta description over raw notes."""
        data = {
            "sources": [
                {
                    "id": "enriched-feed",
                    "title": "Test Feed",
                    "feed": "https://example.com/feed.xml",
                    "topics": ["ai"],
                    "notes": "Fallback note",
                    "meta": {"description": "Preferred enriched description"},
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "feeds.opml"
            export_to_opml(data, output_path)

            tree = ET.parse(output_path)
            root = tree.getroot()
            body = root.find("body")
            outline = body.find("outline")

            assert outline is not None
            assert outline.attrib["description"] == "Preferred enriched description"


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

    def test_build_opml_category_map_uses_canonical_topic_grouping(self):
        """Categorized OPML topic grouping should mirror canonical export semantics."""
        data = {
            "sources": [
                {
                    "url": "https://example.com/feed.xml",
                    "topics": ["ml", "ai", "ml"],
                    "title": "Deduplicated Feed",
                },
                {
                    "url": "https://example.com/untagged.xml",
                    "topics": [],
                    "title": "Uncategorized Feed",
                },
            ]
        }

        category_map = build_opml_category_map(data)

        assert set(category_map) == {"Uncategorized", "ai", "ml"}
        assert len(category_map["ai"]) == 1
        assert len(category_map["ml"]) == 1
        assert len(category_map["Uncategorized"]) == 1

    def test_export_all_formats_success(self):
        """Test exporting to all formats."""
        data = {
            "sources": [
                {
                    "url": "https://example.com/feed.xml",
                    "topics": ["ai"],
                    "title": "Test Feed",
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
            assert _get_opml_wrapper(opml_file).find("outline") is not None
            assert _get_opml_wrapper(categorized_opml).find("outline") is not None

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
            assert _get_opml_wrapper(custom_opml) is not None

    def test_export_all_formats_default_feeds_prefix_writes_legacy_opml_aliases(self):
        """Default feeds exports should also write legacy OPML aliases."""
        data = {
            "sources": [
                {
                    "url": "https://example.com/feed.xml",
                    "topics": ["ai"],
                    "title": "Test Feed",
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            export_all_formats(data, base_path=tmpdir)

            assert (Path(tmpdir) / "feeds.json").exists()
            assert (Path(tmpdir) / "feeds.opml").exists()
            assert (Path(tmpdir) / "feeds.categorized.opml").exists()
            assert (Path(tmpdir) / "all.opml").exists()
            assert (Path(tmpdir) / "categorized.opml").exists()


@pytest.mark.unit
class TestExportIntegration:
    """Integration tests for export module."""

    def test_load_and_export_workflow(self):
        """Test loading and exporting feeds workflow."""
        # Create temp feed file
        feed_data = {
            "sources": [
                {
                    "url": "https://example.com/feed.xml",
                    "topics": ["ai"],
                    "title": "Test Feed",
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create YAML file
            yaml_path = Path(tmpdir) / "feeds.yaml"
            with yaml_path.open("w", encoding="utf-8") as f:
                yaml.dump(feed_data, f)

            # Load and export
            data = load_feeds(yaml_path)

            # Export to JSON
            json_path = Path(tmpdir) / "feeds.json"
            export_to_json(data, json_path)

            assert json_path.exists()

            # Verify round-trip
            with json_path.open(encoding="utf-8") as f:
                exported_data = json.load(f)

            assert exported_data["sources"][0]["feed"] == "https://example.com/feed.xml"
            assert exported_data["sources"][0]["topics"] == ["ai"]

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
