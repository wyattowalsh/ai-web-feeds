"""ai_web_feeds.utils -- Utility functions for enrichment, OPML, and schema generation"""

from datetime import datetime
import json
from pathlib import Path
import re
from typing import Any
from urllib.parse import urlparse
from xml.dom.minidom import parseString
from xml.etree.ElementTree import Element, SubElement, tostring

import httpx
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential
import yaml

from ai_web_feeds.models import (
    FeedFormat,
    FeedSource,
)


# ============================================================================
# RSSHub Integration
# ============================================================================


def generate_rsshub_url(
    url: str, platform: str, rsshub_instance: str = "https://rsshub.app"
) -> str | None:
    """Generate RSSHub feed URL for platforms without native feeds.

    RSSHub provides RSS feeds for platforms that don't have native RSS support.
    Public instance: https://rsshub.app (rate-limited)
    Self-hosted recommended for production use.

    Args:
        url: Original URL (website, profile, etc.)
        platform: Platform name
        rsshub_instance: RSSHub instance URL (default: public instance)

    Returns:
        RSSHub feed URL or None

    Examples:
        >>> generate_rsshub_url("https://x.com/karpathy", "twitter")
        'https://rsshub.app/twitter/user/karpathy'

        >>> generate_rsshub_url("https://www.instagram.com/ai", "instagram")
        'https://rsshub.app/instagram/user/ai'
    """
    try:
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        rsshub_base = rsshub_instance.rstrip("/")

        # Twitter/X via RSSHub (alternative to Nitter)
        if platform == "twitter":
            if match := re.match(r"([A-Za-z0-9_]{1,15})(?:/.*)?$", path):
                username = match.group(1)
                if username.lower() not in [
                    "home",
                    "explore",
                    "notifications",
                    "messages",
                    "i",
                    "settings",
                    "search",
                ]:
                    return f"{rsshub_base}/twitter/user/{username}"

        # Instagram
        elif platform == "instagram":
            if match := re.match(r"([A-Za-z0-9._]+)", path):
                username = match.group(1)
                return f"{rsshub_base}/instagram/user/{username}"

        # TikTok
        elif platform == "tiktok":
            if match := re.match(r"@([A-Za-z0-9._]+)", path):
                username = match.group(1)
                return f"{rsshub_base}/tiktok/user/{username}"

        # Bilibili (Chinese video platform)
        elif platform == "bilibili":
            if match := re.match(r"(?:space|user)/(\d+)", path):
                user_id = match.group(1)
                return f"{rsshub_base}/bilibili/user/video/{user_id}"

        # Pixiv (art platform)
        elif platform == "pixiv":
            if match := re.match(r"(?:en/)?users/(\d+)", path):
                user_id = match.group(1)
                return f"{rsshub_base}/pixiv/user/{user_id}"

        # Telegram channels
        elif platform == "telegram":
            if match := re.match(r"(?:s/)?([A-Za-z0-9_]+)", path):
                channel = match.group(1)
                return f"{rsshub_base}/telegram/channel/{channel}"

        # LinkedIn company pages
        elif platform == "linkedin":
            if "company/" in path:
                if match := re.match(r"company/([^/]+)", path):
                    company = match.group(1)
                    return f"{rsshub_base}/linkedin/company/{company}"

        # Mastodon (requires instance)
        elif platform == "mastodon":
            instance = parsed.netloc
            if match := re.match(r"@([A-Za-z0-9_]+)", path):
                username = match.group(1)
                return f"{rsshub_base}/mastodon/user/{instance}/{username}"

        return None

    except Exception as e:
        logger.error(f"Error generating RSSHub URL: {e}")
        return None


# ============================================================================
# Platform-Specific Feed Discovery
# ============================================================================


def detect_platform(url: str) -> str | None:
    """Detect platform from URL.

    Args:
        url: URL to analyze

    Returns:
        Platform name (reddit, medium, youtube, github, twitter, instagram, etc.) or None
    """
    domain = urlparse(url).netloc.lower()

    platform_map = {
        "reddit.com": "reddit",
        "www.reddit.com": "reddit",
        "old.reddit.com": "reddit",
        "medium.com": "medium",
        "youtube.com": "youtube",
        "www.youtube.com": "youtube",
        "youtu.be": "youtube",
        "github.com": "github",
        "www.github.com": "github",
        "substack.com": "substack",
        "www.substack.com": "substack",
        "dev.to": "devto",
        "news.ycombinator.com": "hackernews",
        "twitter.com": "twitter",
        "www.twitter.com": "twitter",
        "x.com": "twitter",
        "www.x.com": "twitter",
        "arxiv.org": "arxiv",
        "www.arxiv.org": "arxiv",
        "export.arxiv.org": "arxiv",
        "instagram.com": "instagram",
        "www.instagram.com": "instagram",
        "tiktok.com": "tiktok",
        "www.tiktok.com": "tiktok",
        "linkedin.com": "linkedin",
        "www.linkedin.com": "linkedin",
        "t.me": "telegram",
        "telegram.me": "telegram",
        "bilibili.com": "bilibili",
        "www.bilibili.com": "bilibili",
        "pixiv.net": "pixiv",
        "www.pixiv.net": "pixiv",
    }

    # Check exact domain match
    if domain in platform_map:
        return platform_map[domain]

    # Check for Substack (subdomain.substack.com)
    if domain.endswith(".substack.com"):
        return "substack"

    # Check for Mastodon instances (various domains)
    # Common Mastodon instances
    mastodon_instances = [
        "mastodon.social",
        "mas.to",
        "fosstodon.org",
        "mstdn.social",
        "techhub.social",
    ]
    if domain in mastodon_instances or "mastodon" in domain:
        return "mastodon"

    # Check for custom Medium domains
    known_medium_domains = [
        "towardsdatascience.com",
        "betterprogramming.pub",
        "javascript.plainenglish.io",
        "python.plainenglish.io",
        "levelup.gitconnected.com",
    ]

    if domain in known_medium_domains or "medium.com" in domain:
        return "medium"

    return None


def generate_reddit_feed_url(url: str, platform_config: dict[str, Any] | None = None) -> str | None:
    """Generate Reddit RSS feed URL from subreddit or user URL.

    Args:
        url: Reddit URL (subreddit or user page)
        platform_config: Optional platform-specific configuration

    Returns:
        RSS feed URL or None
    """
    try:
        parsed = urlparse(url)
        path = parsed.path.strip("/")

        # Handle subreddit: /r/machinelearning
        if match := re.match(r"r/([A-Za-z0-9_]{3,21})", path):
            subreddit = match.group(1)
            sort = (
                platform_config.get("reddit", {}).get("sort", "hot") if platform_config else "hot"
            )
            time = (
                platform_config.get("reddit", {}).get("time", "all") if platform_config else "all"
            )

            base_url = f"https://www.reddit.com/r/{subreddit}"
            if sort == "top":
                return f"{base_url}/top/.rss?t={time}"
            return f"{base_url}/{sort}/.rss"

        # Handle user: /u/username or /user/username
        if match := re.match(r"u(?:ser)?/([A-Za-z0-9_-]{3,20})", path):
            username = match.group(1)
            return f"https://www.reddit.com/user/{username}/.rss"

        # If platform_config has explicit subreddit/username
        if platform_config and "reddit" in platform_config:
            reddit_cfg = platform_config["reddit"]
            if subreddit := reddit_cfg.get("subreddit"):
                sort = reddit_cfg.get("sort", "hot")
                time = reddit_cfg.get("time", "all")
                base_url = f"https://www.reddit.com/r/{subreddit}"
                if sort == "top":
                    return f"{base_url}/top/.rss?t={time}"
                return f"{base_url}/{sort}/.rss"
            if username := reddit_cfg.get("username"):
                return f"https://www.reddit.com/user/{username}/.rss"

        return None
    except Exception as e:
        logger.error(f"Error generating Reddit feed URL: {e}")
        return None


def generate_medium_feed_url(url: str, platform_config: dict[str, Any] | None = None) -> str | None:
    """Generate Medium RSS feed URL from publication or user URL.

    Args:
        url: Medium URL
        platform_config: Optional platform-specific configuration

    Returns:
        RSS feed URL or None
    """
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        path = parsed.path.strip("/")

        # Handle custom Medium domains (e.g., towardsdatascience.com)
        if domain != "medium.com" and not domain.startswith("www."):
            # Extract publication name from domain
            publication = domain.split(".")[0]
            return f"https://medium.com/feed/{publication}"

        # Handle user: /@username
        if path.startswith("@"):
            username = path.split("/")[0]
            return f"https://medium.com/feed/{username}"

        # Handle publication: /publication-name
        if path and not path.startswith("@") and not path.startswith("tag/"):
            publication = path.split("/")[0]
            return f"https://medium.com/feed/{publication}"

        # Handle tag: /tag/ai
        tag_match = re.match(r"tag/([^/]+)", path)
        if tag_match:
            tag = tag_match.group(1)
            return f"https://medium.com/feed/tag/{tag}"

        # If platform_config has explicit publication/username/tag
        if platform_config and "medium" in platform_config:
            medium_cfg = platform_config["medium"]
            if publication := medium_cfg.get("publication"):
                return f"https://medium.com/feed/{publication}"
            if username := medium_cfg.get("username"):
                username = username.lstrip("@")
                return f"https://medium.com/feed/@{username}"
            if tag := medium_cfg.get("tag"):
                return f"https://medium.com/feed/tag/{tag}"

        return None
    except Exception as e:
        logger.error(f"Error generating Medium feed URL: {e}")
        return None


def generate_youtube_feed_url(
    url: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Generate YouTube RSS feed URL from channel or playlist URL.

    Args:
        url: YouTube URL
        platform_config: Optional platform-specific configuration

    Returns:
        RSS feed URL or None
    """
    try:
        from urllib.parse import parse_qs

        parsed = urlparse(url)
        path = parsed.path.strip("/")

        # Handle channel ID: /channel/UCxxxxxx
        channel_match = re.match(r"channel/(UC[A-Za-z0-9_-]{22})", path)
        if channel_match:
            channel_id = channel_match.group(1)
            return f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"

        # Handle username: /user/username or /@username
        user_match = re.match(r"(?:user/|@)([A-Za-z0-9_-]+)", path)
        if user_match:
            username = user_match.group(1)
            # Note: YouTube is deprecating /user/ URLs, may need channel_id lookup
            return f"https://www.youtube.com/feeds/videos.xml?user={username}"

        # Handle playlist: /playlist?list=PLxxxxxx
        if "playlist" in path:
            query = parse_qs(parsed.query)
            if playlist_id := query.get("list", [None])[0]:
                return f"https://www.youtube.com/feeds/videos.xml?playlist_id={playlist_id}"

        # If platform_config has explicit channel_id/playlist_id/username
        if platform_config and "youtube" in platform_config:
            yt_cfg = platform_config["youtube"]
            if channel_id := yt_cfg.get("channel_id"):
                return f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
            if playlist_id := yt_cfg.get("playlist_id"):
                return f"https://www.youtube.com/feeds/videos.xml?playlist_id={playlist_id}"
            if username := yt_cfg.get("username"):
                return f"https://www.youtube.com/feeds/videos.xml?user={username}"

        return None
    except Exception as e:
        logger.error(f"Error generating YouTube feed URL: {e}")
        return None


def generate_github_feed_url(url: str, platform_config: dict[str, Any] | None = None) -> str | None:
    """Generate GitHub Atom feed URL from repository URL.

    Args:
        url: GitHub repository URL
        platform_config: Optional platform-specific configuration

    Returns:
        Atom feed URL or None
    """
    try:
        parsed = urlparse(url)
        path = parsed.path.strip("/")

        # Handle repo: /owner/repo
        if match := re.match(r"([a-z0-9-]+)/([A-Za-z0-9._-]+)", path, re.IGNORECASE):
            owner = match.group(1)
            repo = match.group(2)

            feed_type = "releases"
            branch = None

            if platform_config and "github" in platform_config:
                gh_cfg = platform_config["github"]
                feed_type = gh_cfg.get("feed_type", "releases")
                branch = gh_cfg.get("branch")

            if feed_type == "releases":
                return f"https://github.com/{owner}/{repo}/releases.atom"
            if feed_type == "tags":
                return f"https://github.com/{owner}/{repo}/tags.atom"
            if feed_type == "commits":
                if branch:
                    return f"https://github.com/{owner}/{repo}/commits/{branch}.atom"
                return f"https://github.com/{owner}/{repo}/commits.atom"
            if feed_type == "activity":
                return f"https://github.com/{owner}/{repo}/activity.atom"

        return None
    except Exception as e:
        logger.error(f"Error generating GitHub feed URL: {e}")
        return None


def generate_substack_feed_url(
    url: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Generate Substack RSS feed URL from publication URL.

    Args:
        url: Substack publication URL
        platform_config: Optional platform-specific configuration

    Returns:
        RSS feed URL or None
    """
    try:
        parsed = urlparse(url)

        # Substack URLs are typically: publication.substack.com
        if parsed.netloc.endswith(".substack.com"):
            return f"{parsed.scheme}://{parsed.netloc}/feed"

        # If platform_config has explicit publication
        if platform_config and "substack" in platform_config:
            publication = platform_config["substack"].get("publication")
            if publication:
                return f"https://{publication}.substack.com/feed"

        return None
    except Exception as e:
        logger.error(f"Error generating Substack feed URL: {e}")
        return None


def generate_devto_feed_url(url: str, platform_config: dict[str, Any] | None = None) -> str | None:
    """Generate Dev.to RSS feed URL from user or organization URL.

    Args:
        url: Dev.to URL
        platform_config: Optional platform-specific configuration

    Returns:
        RSS feed URL or None
    """
    try:
        parsed = urlparse(url)
        path = parsed.path.strip("/")

        # Handle user or organization
        if path:
            username_or_org = path.split("/")[0]
            return f"https://dev.to/feed/{username_or_org}"

        # Handle tag
        if match := re.match(r"t/([^/]+)", path):
            tag = match.group(1)
            return f"https://dev.to/feed/tag/{tag}"

        # If platform_config has explicit username/organization/tag
        if platform_config and "devto" in platform_config:
            devto_cfg = platform_config["devto"]
            if username := devto_cfg.get("username"):
                return f"https://dev.to/feed/{username}"
            if org := devto_cfg.get("organization"):
                return f"https://dev.to/feed/{org}"
            if tag := devto_cfg.get("tag"):
                return f"https://dev.to/feed/tag/{tag}"

        return None
    except Exception as e:
        logger.error(f"Error generating Dev.to feed URL: {e}")
        return None


def generate_hackernews_feed_url(
    url: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Generate Hacker News RSS feed URL.

    Args:
        url: Hacker News URL
        platform_config: Optional platform-specific configuration

    Returns:
        RSS feed URL or None
    """
    try:
        # HN official RSS feeds
        feed_type = "frontpage"

        if platform_config and "hackernews" in platform_config:
            hn_cfg = platform_config["hackernews"]
            feed_type = hn_cfg.get("feed_type", "frontpage")

        feed_urls = {
            "frontpage": "https://news.ycombinator.com/rss",
            "newest": "https://news.ycombinator.com/newest.rss",
            "best": "https://news.ycombinator.com/best.rss",
            "ask": "https://news.ycombinator.com/ask.rss",
            "show": "https://news.ycombinator.com/show.rss",
            "jobs": "https://news.ycombinator.com/jobs.rss",
        }

        return feed_urls.get(feed_type)
    except Exception as e:
        logger.error(f"Error generating Hacker News feed URL: {e}")
        return None


def generate_twitter_feed_url(
    url: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Generate Twitter/X RSS feed URL via Nitter.

    Args:
        url: Twitter/X URL
        platform_config: Optional platform-specific configuration

    Returns:
        RSS feed URL via Nitter or None
    """
    try:
        parsed = urlparse(url)
        path = parsed.path.strip("/")

        # Default Nitter instance
        nitter_instance = "nitter.net"

        if platform_config and "twitter" in platform_config:
            twitter_cfg = platform_config["twitter"]
            nitter_instance = twitter_cfg.get("nitter_instance", nitter_instance)

            # Explicit username
            if username := twitter_cfg.get("username"):
                return f"https://{nitter_instance}/{username}/rss"

            # List ID
            if list_id := twitter_cfg.get("list_id"):
                return f"https://{nitter_instance}/i/lists/{list_id}/rss"

            # Search query
            if search_query := twitter_cfg.get("search_query"):
                from urllib.parse import quote

                return f"https://{nitter_instance}/search/rss?q={quote(search_query)}"

        # Parse username from URL
        # Handle: twitter.com/username, x.com/username
        if match := re.match(r"([A-Za-z0-9_]{1,15})(?:/.*)?$", path):
            username = match.group(1)
            # Skip system paths
            if username.lower() not in [
                "home",
                "explore",
                "notifications",
                "messages",
                "i",
                "settings",
                "search",
            ]:
                return f"https://{nitter_instance}/{username}/rss"

        return None
    except Exception as e:
        logger.error(f"Error generating Twitter feed URL: {e}")
        return None


def generate_arxiv_feed_url(url: str, platform_config: dict[str, Any] | None = None) -> str | None:
    """Generate arXiv RSS/Atom feed URL.

    Args:
        url: arXiv URL
        platform_config: Optional platform-specific configuration

    Returns:
        RSS/Atom feed URL or None
    """
    try:
        parsed = urlparse(url)
        path = parsed.path.strip("/")

        max_results = 50

        if platform_config and "arxiv" in platform_config:
            arxiv_cfg = platform_config["arxiv"]
            max_results = arxiv_cfg.get("max_results", max_results)

            # Category-specific feed
            if category := arxiv_cfg.get("category"):
                return f"http://export.arxiv.org/rss/{category}"

            # Author-specific feed via API
            if author := arxiv_cfg.get("author"):
                from urllib.parse import quote

                return f"http://export.arxiv.org/api/query?search_query=au:{quote(author)}&max_results={max_results}&sortBy=submittedDate&sortOrder=descending"

            # Advanced search query
            if search_query := arxiv_cfg.get("search_query"):
                from urllib.parse import quote

                return f"http://export.arxiv.org/api/query?search_query={quote(search_query)}&max_results={max_results}&sortBy=submittedDate&sortOrder=descending"

        # Parse category from URL
        # Handle: arxiv.org/list/cs.LG/recent
        if match := re.match(r"list/([a-z-]+\.[A-Z]{2,3})", path):
            category = match.group(1)
            return f"http://export.arxiv.org/rss/{category}"

        # Handle: arxiv.org/abs/2101.12345 -> try to infer category
        # This is less useful but we can return general cs updates
        if "abs/" in path or "pdf/" in path:
            # Extract paper ID and return general feed
            # For now, return None as we can't determine specific category
            return None

        return None
    except Exception as e:
        logger.error(f"Error generating arXiv feed URL: {e}")
        return None


def generate_platform_feed_url(
    url: str, platform: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Generate platform-specific feed URL.

    Args:
        url: Platform URL
        platform: Platform name
        platform_config: Optional platform-specific configuration

    Returns:
        Feed URL or None
    """
    generators = {
        "reddit": generate_reddit_feed_url,
        "medium": generate_medium_feed_url,
        "youtube": generate_youtube_feed_url,
        "github": generate_github_feed_url,
        "substack": generate_substack_feed_url,
        "devto": generate_devto_feed_url,
        "hackernews": generate_hackernews_feed_url,
        "twitter": generate_twitter_feed_url,
        "arxiv": generate_arxiv_feed_url,
    }

    generator = generators.get(platform)
    if generator:
        return generator(url, platform_config)

    return None


# ============================================================================
# Feed Discovery and Enrichment
# ============================================================================


@retry(
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
    platform = detect_platform(site_url)
    if platform:
        feed_url = generate_platform_feed_url(site_url, platform, platform_config)
        if feed_url:
            logger.info(f"Generated {platform} feed URL: {feed_url}")
            return feed_url

    # Otherwise, try generic feed discovery
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(site_url, follow_redirects=True)
            response.raise_for_status()

            # Look for feed links in HTML
            html = response.text.lower()

            # Common feed link patterns
            patterns = [
                'type="application/rss+xml"',
                'type="application/atom+xml"',
                'type="application/json"',
                "/rss.xml",
                "/feed.xml",
                "/atom.xml",
                "/feed/",
                "/feeds/",
            ]

            for pattern in patterns:
                if pattern in html:
                    # Extract the href (simplified - would need proper HTML parsing)
                    logger.info(f"Found potential feed pattern: {pattern}")
                    # This is a placeholder - real implementation would parse HTML
                    # For now, we'll just return common feed URLs
                    break

            # Try common feed URLs
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
    use_rsshub: bool = True,
    rsshub_instance: str = "https://rsshub.app",
) -> dict[str, Any]:
    """Enrich a feed source with additional metadata.

    This function takes a minimal feed source (just URL and topics) and enriches it with:
    - Platform detection
    - Feed URL generation (for known platforms)
    - Feed discovery (for websites)
    - RSSHub fallback (for platforms without native feeds)
    - Title extraction (if not provided)
    - Format detection
    - Metadata

    Args:
        feed_source: Minimal feed source dict with 'url' and 'topics'.
                    Optional 'title' and 'notes' can be provided to override auto-enrichment.
        use_rsshub: Whether to use RSSHub as fallback for platforms without native feeds
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

    # Step 1: Detect platform
    platform = detect_platform(input_url)
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
        # These platforms don't have native RSS, will use RSSHub later
        platform_feed_url = generate_platform_feed_url(input_url, platform, platform_config)
        if platform_feed_url:
            feed_url = platform_feed_url
            enriched["meta"]["feed_source"] = f"{platform}_native"
            enriched["meta"]["input_type"] = "platform_url"
            logger.info(f"Generated {platform} feed URL: {feed_url}")

    # Step 3: If no feed URL yet, try generic feed discovery
    if not feed_url:
        try:
            discovered_url = await discover_feed_url(input_url, platform_config)
            if discovered_url:
                feed_url = discovered_url
                enriched["meta"]["feed_source"] = "discovered"
                enriched["meta"]["input_type"] = "website_url"
                logger.info(f"Discovered feed URL: {feed_url}")
        except Exception as e:
            logger.warning(f"Feed discovery failed for {input_url}: {e}")

    # Step 4: RSSHub fallback for platforms without native feeds
    if not feed_url and use_rsshub and platform:
        rsshub_url = generate_rsshub_url(input_url, platform, rsshub_instance)
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
            feed_format = await detect_feed_format(feed_url)
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


# ============================================================================
# OPML Generation
# ============================================================================


def generate_opml(feed_sources: list[FeedSource], title: str = "AI Web Feeds") -> str:
    """Generate OPML XML from feed sources.

    Args:
        feed_sources: List of FeedSource objects
        title: OPML document title

    Returns:
        OPML XML string
    """
    opml = Element("opml", version="2.0")

    # Head
    head = SubElement(opml, "head")
    SubElement(head, "title").text = title
    SubElement(head, "dateCreated").text = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
    SubElement(head, "dateModified").text = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
    SubElement(head, "ownerName").text = "AI Web Feeds"

    # Body
    body = SubElement(opml, "body")

    for feed in feed_sources:
        outline = SubElement(body, "outline")
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
    xml_str = tostring(opml, encoding="unicode")
    dom = parseString(xml_str)
    return dom.toprettyxml(indent="  ")


def generate_categorized_opml(
    feed_sources: list[FeedSource], title: str = "AI Web Feeds (Categorized)"
) -> str:
    """Generate categorized OPML XML from feed sources.

    Args:
        feed_sources: List of FeedSource objects
        title: OPML document title

    Returns:
        Categorized OPML XML string
    """
    opml = Element("opml", version="2.0")

    # Head
    head = SubElement(opml, "head")
    SubElement(head, "title").text = title
    SubElement(head, "dateCreated").text = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
    SubElement(head, "dateModified").text = datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
    SubElement(head, "ownerName").text = "AI Web Feeds"

    # Body - organize by source_type
    body = SubElement(opml, "body")

    # Group feeds by source_type
    categories: dict[str, list[FeedSource]] = {}
    for feed in feed_sources:
        category = feed.source_type.value if feed.source_type else "Uncategorized"
        categories.setdefault(category, []).append(feed)

    # Create outlines for each category
    for category, feeds in sorted(categories.items()):
        category_outline = SubElement(body, "outline")
        category_outline.set("text", category.title())
        category_outline.set("title", category.title())

        for feed in sorted(feeds, key=lambda f: f.title):
            feed_outline = SubElement(category_outline, "outline")
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
    xml_str = tostring(opml, encoding="unicode")
    dom = parseString(xml_str)
    return dom.toprettyxml(indent="  ")


def generate_filtered_opml(
    feed_sources: list[FeedSource],
    title: str,
    filter_fn: callable,
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
    return generate_opml(filtered_feeds, title=title)


# ============================================================================
# Schema Generation
# ============================================================================


def generate_enriched_schema() -> dict[str, Any]:
    """Generate JSON schema for enriched feeds.

    Returns:
        JSON schema dict
    """
    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://github.com/wyattowalsh/ai-web-feeds/raw/main/data/feeds.enriched.schema.json",
        "title": "AIWebFeeds — Enriched Feeds Schema",
        "description": "Fully enriched feed data with validated metadata, discovery results, and quality scores",
        "type": "object",
        "additionalProperties": False,
        "required": ["schema_version", "sources"],
        "properties": {
            "schema_version": {
                "type": "string",
                "pattern": "^feeds-enriched-1\\.[0-9]+\\.[0-9]+$",
                "default": "feeds-enriched-1.0.0",
            },
            "document_meta": {
                "type": "object",
                "properties": {
                    "created": {"type": "string", "format": "date-time"},
                    "updated": {"type": "string", "format": "date-time"},
                    "enriched_at": {"type": "string", "format": "date-time"},
                    "total_sources": {"type": "integer", "minimum": 0},
                    "notes": {"type": "string"},
                },
            },
            "sources": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["id", "title"],
                    "properties": {
                        "id": {"type": "string"},
                        "feed": {"type": "string"},
                        "site": {"type": "string"},
                        "title": {"type": "string"},
                        "source_type": {
                            "type": "string",
                            "enum": [
                                "blog",
                                "newsletter",
                                "podcast",
                                "journal",
                                "preprint",
                                "organization",
                                "aggregator",
                                "video",
                                "docs",
                                "forum",
                                "dataset",
                                "code-repo",
                                "newsroom",
                                "education",
                            ],
                        },
                        "mediums": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": ["text", "audio", "video", "code", "data"],
                            },
                        },
                        "tags": {"type": "array", "items": {"type": "string"}},
                        "topics": {"type": "array", "items": {"type": "string"}},
                        "topic_weights": {
                            "type": "object",
                            "additionalProperties": {
                                "type": "number",
                                "minimum": 0,
                                "maximum": 1,
                            },
                        },
                        "meta": {
                            "type": "object",
                            "properties": {
                                "language": {"type": "string"},
                                "format": {
                                    "type": "string",
                                    "enum": ["rss", "atom", "jsonfeed", "unknown"],
                                },
                                "updated": {"type": "string", "format": "date"},
                                "last_validated": {
                                    "type": "string",
                                    "format": "date-time",
                                },
                                "verified": {"type": "boolean"},
                                "contributor": {"type": "string"},
                                "discovered": {"type": "boolean"},
                                "discovered_at": {
                                    "type": "string",
                                    "format": "date-time",
                                },
                            },
                        },
                        "curation": {
                            "type": "object",
                            "properties": {
                                "status": {
                                    "type": "string",
                                    "enum": [
                                        "verified",
                                        "unverified",
                                        "archived",
                                        "experimental",
                                        "inactive",
                                    ],
                                },
                                "since": {"type": "string", "format": "date"},
                                "by": {"type": "string"},
                                "quality_score": {
                                    "type": "number",
                                    "minimum": 0,
                                    "maximum": 1,
                                },
                                "notes": {"type": "string"},
                            },
                        },
                        "provenance": {
                            "type": "object",
                            "properties": {
                                "source": {
                                    "type": "string",
                                    "enum": ["manual", "automation", "import"],
                                },
                                "from": {"type": "string"},
                                "license": {"type": "string"},
                            },
                        },
                        "relations": {"type": "object"},
                        "mappings": {"type": "object"},
                        "discover": {"oneOf": [{"type": "boolean"}, {"type": "object"}]},
                        "notes": {"type": "string"},
                    },
                },
            },
        },
    }
    return schema


# ============================================================================
# YAML Operations
# ============================================================================


def load_feeds_yaml(path: Path | str) -> dict[str, Any]:
    """Load feeds from YAML file.

    Args:
        path: Path to YAML file

    Returns:
        Parsed YAML data
    """
    path = Path(path)
    with path.open() as f:
        return yaml.safe_load(f)


def save_feeds_yaml(data: dict[str, Any], path: Path | str) -> None:
    """Save feeds to YAML file.

    Args:
        data: Feed data to save
        path: Path to YAML file
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w") as f:
        yaml.dump(
            data,
            f,
            default_flow_style=False,
            sort_keys=False,
            allow_unicode=True,
            width=120,
        )
    logger.info(f"Saved feeds YAML to {path}")


def save_json_schema(schema: dict[str, Any], path: Path | str) -> None:
    """Save JSON schema to file.

    Args:
        schema: JSON schema dict
        path: Path to schema file
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w") as f:
        json.dump(schema, f, indent=2)
    logger.info(f"Saved JSON schema to {path}")


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
