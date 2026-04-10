"""ai_web_feeds.export -- Export feed data to various formats"""

import json
from pathlib import Path
from typing import Any, cast
from xml.etree.ElementTree import Element, SubElement, indent, tostring  # nosec B405

from defusedxml.ElementTree import fromstring
from loguru import logger

OPML_ROOT_FOLDER = "aiwebfeeds"


def export_to_json(data: dict[str, Any], output_path: Path | str) -> None:
    """Export feed data to JSON format.

    Args:
        data: Feed data dictionary
        output_path: Output file path
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Exporting to JSON: {output_path}")

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    logger.info(f"Exported {len(data.get('sources', []))} sources to {output_path}")


def export_to_opml(
    data: dict[str, Any], output_path: Path | str, categorized: bool = False
) -> None:
    """Export feed data to OPML format.

    Args:
        data: Feed data dictionary
        output_path: Output file path
        categorized: Whether to organize by categories/topics
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Exporting to OPML: {output_path}")

    # Create OPML structure
    opml = Element("opml", version="2.0")
    head = SubElement(opml, "head")
    SubElement(head, "title").text = data.get("document_meta", {}).get("title", "AI Web Feeds")
    body = SubElement(opml, "body")

    sources = data.get("sources", [])

    if categorized:
        # Group by topics
        categories: dict[str, list[dict[str, Any]]] = {}
        for source in sources:
            topics = source.get("topics", ["Uncategorized"])
            if not topics:
                topics = ["Uncategorized"]
            for topic in topics:
                categories.setdefault(topic, []).append(source)

        # Create outline elements for each category
        for category, category_sources in sorted(categories.items()):
            outline = SubElement(body, "outline", text=category, title=category)
            for source in category_sources:
                _add_feed_outline(outline, source)
    else:
        # Flat list
        for source in sources:
            _add_feed_outline(body, source)

    # Pretty print and save
    xml_str = wrap_opml_with_root_folder(_serialize_xml(opml))
    with output_path.open("w", encoding="utf-8") as f:
        f.write(xml_str)

    logger.info(f"Exported {len(sources)} sources to {output_path}")


def _add_feed_outline(parent: Element, source: dict[str, Any]) -> None:
    """Add a feed outline element.

    Args:
        parent: Parent XML element
        source: Feed source dictionary
    """
    attrs = {
        "type": "rss",
        "text": source.get("title", ""),
        "title": source.get("title", ""),
    }

    if source.get("feed"):
        attrs["xmlUrl"] = source["feed"]
    if source.get("site"):
        attrs["htmlUrl"] = source["site"]
    if source.get("description"):
        attrs["description"] = source["description"]

    SubElement(parent, "outline", **attrs)


def wrap_opml_with_root_folder(opml_xml: str, folder_name: str = OPML_ROOT_FOLDER) -> str:
    """Wrap an OPML document body in a top-level folder outline.

    Args:
        opml_xml: OPML XML string to wrap.
        folder_name: Top-level folder name to insert.

    Returns:
        OPML XML string with a single wrapper folder inside the body.
    """

    root = fromstring(opml_xml)
    body = root.find("body")
    if body is None:
        return opml_xml

    existing_outlines = [child for child in list(body) if child.tag == "outline"]
    if len(existing_outlines) == 1 and _outline_matches_folder(existing_outlines[0], folder_name):
        return _serialize_xml(root)

    wrapper = Element("outline", text=folder_name, title=folder_name)
    for child in list(body):
        body.remove(child)
        wrapper.append(child)

    body.append(wrapper)
    return _serialize_xml(root)


def _outline_matches_folder(outline: Element, folder_name: str) -> bool:
    """Return whether an outline element already matches the wrapper folder."""

    return outline.get("text") == folder_name and outline.get("title") == folder_name


def _serialize_xml(root: Element) -> str:
    """Serialize XML with stable indentation and an XML declaration."""

    indent(root, space="  ")
    xml_bytes = cast(bytes, tostring(root, encoding="utf-8", xml_declaration=True))
    return xml_bytes.decode("utf-8")


def export_all_formats(
    data: dict[str, Any],
    base_path: Path | str = "data",
    prefix: str = "feeds.enriched",
) -> None:
    """Export feed data to all supported formats.

    Args:
        data: Feed data dictionary
        base_path: Base directory for output files
        prefix: File name prefix
    """
    base_path = Path(base_path)
    base_path.mkdir(parents=True, exist_ok=True)

    logger.info("Exporting to all formats...")

    # Export to JSON
    export_to_json(data, base_path / f"{prefix}.json")

    # Export to OPML (both flat and categorized)
    export_to_opml(data, base_path / f"{prefix}.opml", categorized=False)
    export_to_opml(data, base_path / f"{prefix}.categorized.opml", categorized=True)

    logger.info("Export complete")
