"""Feed link extraction, discovery, and source enrichment."""

import re
from datetime import datetime
from html.parser import HTMLParser
from typing import Any, ClassVar
from urllib.parse import urljoin

import httpx
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from ai_web_feeds.models import FeedFormat
from ai_web_feeds.util_pkg.namespace import lookup


class _FeedLinkParser(HTMLParser):
    """Extract feed alternate links from an HTML document."""

    FEED_TYPES: ClassVar[set[str]] = {
        "application/rss+xml",
        "application/atom+xml",
        "application/feed+json",
        "application/json",
    }

    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "link":
            return

        attr_map = {key.lower(): value for key, value in attrs if value is not None}
        rel_values = {value.lower() for value in attr_map.get("rel", "").split()}
        link_type = attr_map.get("type", "").lower()
        href = attr_map.get("href")

        if "alternate" in rel_values and href and link_type in self.FEED_TYPES:
            self.links.append(urljoin(self.base_url, href))


def _extract_feed_links(html: str, base_url: str) -> list[str]:
    """Return feed links advertised by HTML alternate-link tags."""

    parser = _FeedLinkParser(base_url)
    parser.feed(html)
    return list(dict.fromkeys(parser.links))


@retry(  # type: ignore[misc]
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
)
async def discover_feed_url(
    site_url: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Discover feed URL from a website.

    Args:
        site_url: Website URL to discover feed from
        platform_config: Optional platform-specific configuration

    Returns:
        Discovered feed URL or None
    """
    # First, check if this is a known platform
    platform = lookup("detect_platform")(site_url)
    if platform:
        feed_url = lookup("generate_platform_feed_url")(site_url, platform, platform_config)
        if feed_url:
            logger.info(f"Generated {platform} feed URL: {feed_url}")
            return feed_url

    # Otherwise, try generic feed discovery
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(site_url, follow_redirects=True)
            response.raise_for_status()

            for feed_url in lookup("_extract_feed_links")(response.text, str(response.url)):
                try:
                    feed_resp = await client.get(feed_url, follow_redirects=True)
                    if feed_resp.status_code == 200:
                        content_type = feed_resp.headers.get("content-type", "")
                        if any(t in content_type for t in ["xml", "rss", "atom", "feed", "json"]):
                            logger.info(f"Discovered feed from HTML metadata: {feed_url}")
                            return feed_url
                except httpx.HTTPError:
                    continue

            common_feeds = [
                f"{site_url.rstrip('/')}/feed",
                f"{site_url.rstrip('/')}/feed.xml",
                f"{site_url.rstrip('/')}/rss.xml",
                f"{site_url.rstrip('/')}/atom.xml",
                f"{site_url.rstrip('/')}/feeds/all.atom.xml",
            ]

            for feed_url in common_feeds:
                try:
                    feed_resp = await client.get(feed_url, follow_redirects=True)
                    if feed_resp.status_code == 200:
                        content_type = feed_resp.headers.get("content-type", "")
                        if any(t in content_type for t in ["xml", "rss", "atom", "feed", "json"]):
                            logger.info(f"Discovered feed: {feed_url}")
                            return feed_url
                except httpx.HTTPError:
                    continue

            return None

    except Exception as e:
        logger.error(f"Error discovering feed for {site_url}: {e}")
        return None


async def enrich_feed_source(
    feed_source: dict[str, Any],
    rsshub_instance: str = "https://rsshub.app",
) -> dict[str, Any]:
    """Enrich a feed source with additional metadata.

    This function takes a minimal feed source (just URL and topics) and enriches it with:
    - Platform detection
    - Feed URL generation (for known platforms)
    - Feed discovery (for websites)
    - RSSHub generation when explicitly requested by `discover.strategy: rsshub`
    - Title extraction (if not provided)
    - Format detection
    - Metadata

    Args:
        feed_source: Minimal feed source dict with 'url' and 'topics'.
                    Optional 'title' and 'notes' can be provided to override auto-enrichment.
        rsshub_instance: RSSHub instance URL (default: public instance)

    Returns:
        Enriched feed source dict with feed URL, title, and metadata
    """
    enriched = feed_source.copy()
    input_url = enriched.get("url")

    if not input_url:
        logger.error("Feed source missing 'url' field")
        return enriched

    # Preserve custom title and notes if provided
    custom_title = enriched.get("title")
    custom_notes = enriched.get("notes")

    platform_config = enriched.get("platform_config")
    enriched["meta"] = enriched.get("meta", {})
    discover_value = enriched.get("discover")
    discover_config = discover_value if isinstance(discover_value, dict) else {}
    rsshub_requested = discover_config.get("strategy") == "rsshub"

    # Step 1: Detect platform
    platform = lookup("detect_platform")(input_url)
    if platform:
        enriched["meta"]["platform"] = platform
        logger.info(f"Detected platform: {platform} for {input_url}")

    # Step 2: Try to generate platform-specific feed URL
    feed_url = None

    # Check if input URL is already a feed URL
    if any(
        pattern in input_url.lower()
        for pattern in ["/feed", "/rss", "/atom", ".xml", ".rss", ".atom"]
    ):
        feed_url = input_url
        enriched["meta"]["input_type"] = "direct_feed"
        logger.info(f"Input URL appears to be a direct feed: {input_url}")

    # Try platform-specific feed generation
    elif platform and platform not in ["instagram", "tiktok", "telegram", "linkedin", "mastodon"]:
        platform_feed_url = lookup("generate_platform_feed_url")(
            input_url, platform, platform_config
        )
        if platform_feed_url:
            feed_url = platform_feed_url
            enriched["meta"]["feed_source"] = f"{platform}_native"
            enriched["meta"]["input_type"] = "platform_url"
            logger.info(f"Generated {platform} feed URL: {feed_url}")

    # Step 3: If no feed URL yet, try generic feed discovery
    if not feed_url:
        try:
            discovered_url = await lookup("discover_feed_url")(input_url, platform_config)
            if discovered_url:
                feed_url = discovered_url
                enriched["meta"]["feed_source"] = "discovered"
                enriched["meta"]["input_type"] = "website_url"
                logger.info(f"Discovered feed URL: {feed_url}")
        except Exception as e:
            logger.warning(f"Feed discovery failed for {input_url}: {e}")

    # Step 4: explicit RSSHub generation for platforms without native feeds
    if not feed_url and rsshub_requested and platform:
        rsshub_url = lookup("generate_rsshub_url")(input_url, platform, rsshub_instance)
        if rsshub_url:
            feed_url = rsshub_url
            enriched["meta"]["feed_source"] = "rsshub"
            enriched["meta"]["rsshub_instance"] = rsshub_instance
            enriched["meta"]["input_type"] = "platform_url"
            logger.info(f"Using RSSHub for {platform}: {feed_url}")

    # Step 5: Set the feed URL
    if feed_url:
        enriched["feed"] = feed_url
        enriched["site"] = (
            input_url if enriched["meta"].get("input_type") != "direct_feed" else None
        )
    else:
        # No feed URL could be generated
        enriched["site"] = input_url
        enriched["meta"]["enrichment_status"] = "no_feed_found"
        logger.warning(f"Could not generate or discover feed URL for: {input_url}")

    # Step 6: Detect feed format
    if feed_url:
        try:
            feed_format = await lookup("detect_feed_format")(feed_url)
            if feed_format:
                enriched["meta"]["format"] = feed_format
        except Exception as e:
            logger.warning(f"Could not detect format for {feed_url}: {e}")

    # Step 7: Extract title (only if not provided by user)
    if not custom_title and feed_url:
        try:
            # Try to fetch and parse feed to get title
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(feed_url, follow_redirects=True)
                if response.status_code == 200:
                    # Simple title extraction from feed
                    content = response.text
                    title_pattern = r"<title>([^<]+)</title>"
                    if title_match := re.search(title_pattern, content, re.IGNORECASE):
                        title = title_match.group(1).strip()
                        enriched["title"] = title
                        enriched["meta"]["title_source"] = "auto_extracted"
                        logger.info(f"Auto-extracted title: {title}")
        except Exception as e:
            logger.warning(f"Could not extract title from {feed_url}: {e}")
    elif custom_title:
        # User provided custom title - preserve it
        enriched["title"] = custom_title
        enriched["meta"]["title_source"] = "user_provided"
        logger.info(f"Using custom title: {custom_title}")

    # Preserve custom notes if provided
    if custom_notes:
        enriched["notes"] = custom_notes
        enriched["meta"]["notes_source"] = "user_provided"

    # Step 8: Set enrichment timestamp
    enriched["meta"]["enriched_at"] = datetime.now().isoformat()
    status = enriched["meta"].get("enrichment_status", "success")
    enriched["meta"]["enrichment_status"] = status

    return enriched


async def detect_feed_format(feed_url: str) -> str | None:
    """Detect feed format by fetching and analyzing the feed.

    Args:
        feed_url: Feed URL to check

    Returns:
        Feed format (rss, atom, jsonfeed) or None
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(feed_url, follow_redirects=True)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "").lower()

            if "json" in content_type:
                return FeedFormat.JSONFEED.value

            content = response.text.lower()
            if "<rss" in content:
                return FeedFormat.RSS.value
            if "<feed" in content and 'xmlns="http://www.w3.org/2005/atom' in content:
                return FeedFormat.ATOM.value

            return FeedFormat.UNKNOWN.value

    except Exception as e:
        logger.error(f"Error detecting format for {feed_url}: {e}")
        return None
