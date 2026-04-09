"""ai_web_feeds.export -- Export feed data to various formats"""

import json
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.etree.ElementTree import Element, ElementTree, SubElement, indent

from loguru import logger

from ai_web_feeds.load import canonicalize_catalog

_MINIMAL_SOURCE_KEYS = {"url", "topics", "title", "notes"}
_LEGACY_OPML_ALIASES = {
    "feeds.opml": "all.opml",
    "feeds.categorized.opml": "categorized.opml",
}


def _uses_enriched_contract(data: dict[str, Any]) -> bool:
    """Infer whether a source collection already targets the enriched contract."""
    for source in data.get("sources", []):
        if isinstance(source, dict) and set(source) - _MINIMAL_SOURCE_KEYS:
            return True
    return False


def build_export_data(data: dict[str, Any]) -> dict[str, Any]:
    """Build canonical export data from a raw catalog."""
    return canonicalize_catalog(data, enriched=_uses_enriched_contract(data))


def build_opml_category_map(data: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Build the canonical topic → source mapping used by categorized OPML exports."""
    export_data = build_export_data(data)
    return _group_sources_by_topic(export_data.get("sources", []))


def render_opml(data: dict[str, Any], categorized: bool = False) -> str:
    """Render canonical OPML content without writing it to disk."""
    export_data = build_export_data(data)

    opml = Element("opml", version="2.0")
    head = SubElement(opml, "head")
    SubElement(head, "title").text = export_data.get("document_meta", {}).get(
        "title", "AI Web Feeds"
    )
    body = SubElement(opml, "body")

    sources = export_data.get("sources", [])

    if categorized:
        for category, category_sources in _group_sources_by_topic(sources).items():
            outline = SubElement(body, "outline", text=category, title=category)
            for source in category_sources:
                _add_feed_outline(outline, source)
    else:
        for source in sources:
            _add_feed_outline(body, source)

    tree = ElementTree(opml)
    indent(tree, space="  ")
    buffer = BytesIO()
    tree.write(buffer, encoding="utf-8", xml_declaration=True)
    return buffer.getvalue().decode("utf-8")


def export_to_json(data: dict[str, Any], output_path: Path | str) -> None:
    """Export feed data to JSON format.

    Args:
        data: Feed data dictionary
        output_path: Output file path
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Exporting to JSON: {output_path}")
    export_data = build_export_data(data)

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False)

    logger.info(f"Exported {len(export_data.get('sources', []))} sources to {output_path}")


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
    xml_str = render_opml(data, categorized=categorized)
    sources = build_export_data(data).get("sources", [])
    with output_path.open("w", encoding="utf-8") as f:
        f.write(xml_str)

    logger.info(f"Exported {len(sources)} sources to {output_path}")


def build_opml_outline_attributes(source: dict[str, Any]) -> dict[str, str]:
    """Build the serialized OPML attributes for a canonical source."""
    title = source.get("title") or source.get("url") or source.get("feed") or ""
    attrs = {
        "type": "rss",
        "text": title,
        "title": title,
    }

    xml_url = source.get("feed") or source.get("url")
    html_url = source.get("site")
    if xml_url:
        attrs["xmlUrl"] = xml_url
    if html_url:
        attrs["htmlUrl"] = html_url

    description = _resolve_opml_description(source)
    if description:
        attrs["description"] = description

    return attrs


def _group_sources_by_topic(sources: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Group canonical sources by topic for categorized OPML exports."""
    categories: dict[str, list[dict[str, Any]]] = {}
    for source in sources:
        for topic in _resolve_opml_topics(source):
            categories.setdefault(topic, []).append(source)

    return dict(sorted(categories.items()))


def _resolve_opml_description(source: dict[str, Any]) -> str | None:
    """Resolve the best available OPML description field for a source."""
    meta = source.get("meta")
    candidates = [
        source.get("description"),
        meta.get("description") if isinstance(meta, dict) else None,
    ]
    for candidate in candidates:
        if isinstance(candidate, str):
            normalized = candidate.strip()
            if normalized:
                return normalized
    return None


def _resolve_opml_topics(source: dict[str, Any]) -> list[str]:
    """Resolve the topic placements used by categorized OPML exports."""
    topics = source.get("topics")
    if not isinstance(topics, list):
        return ["Uncategorized"]

    normalized_topics: list[str] = []
    seen: set[str] = set()
    for topic in topics:
        if isinstance(topic, str) and topic and topic not in seen:
            seen.add(topic)
            normalized_topics.append(topic)

    return normalized_topics or ["Uncategorized"]


def _add_feed_outline(parent: Element, source: dict[str, Any]) -> None:
    """Add a feed outline element.

    Args:
        parent: Parent XML element
        source: Feed source dictionary
    """
    SubElement(parent, "outline", **build_opml_outline_attributes(source))


def export_all_formats(
    data: dict[str, Any],
    base_path: Path | str = "data",
    prefix: str = "feeds",
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
    opml_path = base_path / f"{prefix}.opml"
    categorized_opml_path = base_path / f"{prefix}.categorized.opml"
    export_to_opml(data, opml_path, categorized=False)
    export_to_opml(data, categorized_opml_path, categorized=True)

    if prefix == "feeds":
        export_to_opml(data, base_path / _LEGACY_OPML_ALIASES[opml_path.name], categorized=False)
        export_to_opml(
            data,
            base_path / _LEGACY_OPML_ALIASES[categorized_opml_path.name],
            categorized=True,
        )

    logger.info("Export complete")
