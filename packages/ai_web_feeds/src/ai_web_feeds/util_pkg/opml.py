"""OPML document generation and file output."""

import xml.etree.ElementTree as ET  # nosec B405
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from defusedxml.minidom import parseString
from loguru import logger

from ai_web_feeds.models import FeedSource
from ai_web_feeds.util_pkg.namespace import lookup


def generate_opml(feed_sources: list[FeedSource], title: str = "AI Web Feeds") -> str:
    """Generate OPML XML from feed sources.

    Args:
        feed_sources: List of FeedSource objects
        title: OPML document title

    Returns:
        OPML XML string
    """
    opml = ET.Element("opml", version="2.0")

    # Head
    head = ET.SubElement(opml, "head")
    ET.SubElement(head, "title").text = title
    ET.SubElement(head, "dateCreated").text = datetime.now(UTC).strftime(
        "%a, %d %b %Y %H:%M:%S GMT"
    )
    ET.SubElement(head, "dateModified").text = datetime.now(UTC).strftime(
        "%a, %d %b %Y %H:%M:%S GMT"
    )
    ET.SubElement(head, "ownerName").text = "AI Web Feeds"

    # Body
    body = ET.SubElement(opml, "body")

    for feed in feed_sources:
        outline = ET.SubElement(body, "outline")
        outline.set("text", feed.title)
        outline.set("title", feed.title)
        outline.set("type", "rss")

        if feed.feed:
            outline.set("xmlUrl", feed.feed)
        if feed.site:
            outline.set("htmlUrl", feed.site)
        if feed.tags:
            outline.set("category", ",".join(feed.tags))

    # Pretty print
    xml_str = ET.tostring(opml, encoding="unicode")
    dom = parseString(xml_str)
    return dom.toprettyxml(indent="  ")


def generate_categorized_opml(
    feed_sources: list[FeedSource], title: str = "AI Web Feeds (Categorized)"
) -> str:
    """Generate topic-grouped OPML XML from feed sources.

    Args:
        feed_sources: List of FeedSource objects
        title: OPML document title

    Returns:
        Categorized OPML XML string
    """
    opml = ET.Element("opml", version="2.0")

    # Head
    head = ET.SubElement(opml, "head")
    ET.SubElement(head, "title").text = title
    ET.SubElement(head, "dateCreated").text = datetime.now(UTC).strftime(
        "%a, %d %b %Y %H:%M:%S GMT"
    )
    ET.SubElement(head, "dateModified").text = datetime.now(UTC).strftime(
        "%a, %d %b %Y %H:%M:%S GMT"
    )
    ET.SubElement(head, "ownerName").text = "AI Web Feeds"

    body = ET.SubElement(opml, "body")

    topic_groups: dict[str, list[FeedSource]] = {}
    for feed in feed_sources:
        topics = feed.topics or ["Uncategorized"]
        for topic in topics:
            topic_groups.setdefault(topic, []).append(feed)

    for topic, feeds in sorted(topic_groups.items()):
        category_outline = ET.SubElement(body, "outline")
        category_outline.set("text", topic)
        category_outline.set("title", topic)

        for feed in sorted(feeds, key=lambda f: f.title):
            feed_outline = ET.SubElement(category_outline, "outline")
            feed_outline.set("text", feed.title)
            feed_outline.set("title", feed.title)
            feed_outline.set("type", "rss")

            if feed.feed:
                feed_outline.set("xmlUrl", feed.feed)
            if feed.site:
                feed_outline.set("htmlUrl", feed.site)
            if feed.tags:
                feed_outline.set("category", ",".join(feed.tags))

    # Pretty print
    xml_str = ET.tostring(opml, encoding="unicode")
    dom = parseString(xml_str)
    return dom.toprettyxml(indent="  ")


def generate_filtered_opml(
    feed_sources: list[FeedSource],
    title: str,
    filter_fn: Callable[[FeedSource], bool],
) -> str:
    """Generate filtered OPML XML from feed sources.

    Args:
        feed_sources: List of FeedSource objects
        title: OPML document title
        filter_fn: Function to filter feed sources

    Returns:
        Filtered OPML XML string
    """
    filtered_feeds = [f for f in feed_sources if filter_fn(f)]
    return lookup("generate_opml")(filtered_feeds, title=title)


def save_opml(opml_xml: str, path: Path | str) -> None:
    """Save OPML XML to file.

    Args:
        opml_xml: OPML XML string
        path: Path to OPML file
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w") as f:
        f.write(opml_xml)
    logger.info(f"Saved OPML to {path}")
