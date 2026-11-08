"""Unit tests for the OPML 2.0 structural check."""

import pytest
from ai_web_feeds.export import (
    OpmlStructureError,
    check_opml_structure,
    wrap_opml_with_root_folder,
)
from ai_web_feeds.models import FeedSource, SourceType
from ai_web_feeds.utils import generate_opml


@pytest.mark.unit
class TestOpmlStructure:
    """Check OPML the CLI already writes, not a second catalog."""

    def test_cli_generated_opml_is_structurally_valid(self) -> None:
        """generate_opml plus the CLI root folder is OPML 2.0 with outlines."""
        sources = [
            FeedSource(
                id="test-feed",
                title="Test Feed",
                feed="https://example.com/feed.xml",
                site="https://example.com",
                source_type=SourceType.BLOG,
            )
        ]
        opml_xml = wrap_opml_with_root_folder(
            generate_opml(sources, title="AI Web Feeds - All Feeds")
        )

        root = check_opml_structure(opml_xml)
        body = root.find("body")
        assert body is not None
        outlines = list(body.iter("outline"))

        assert root.tag == "opml"
        assert root.get("version") == "2.0"
        assert outlines
        assert any(outline.get("xmlUrl") == "https://example.com/feed.xml" for outline in outlines)

    def test_opml_without_outlines_fails_structural_check(self) -> None:
        """Versioned opml with a body but no outlines is a structural failure."""
        opml_xml = (
            '<?xml version="1.0" encoding="utf-8"?>'
            '<opml version="2.0"><head><title>Empty</title></head><body></body></opml>'
        )

        with pytest.raises(OpmlStructureError, match="outline"):
            check_opml_structure(opml_xml)
