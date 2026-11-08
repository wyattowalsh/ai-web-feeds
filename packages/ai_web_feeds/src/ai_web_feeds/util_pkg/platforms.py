"""Platform detection and native feed URL generation."""

import re
from typing import Any
from urllib.parse import parse_qs, quote

from loguru import logger

from ai_web_feeds.util_pkg.namespace import lookup


def detect_platform(url: str) -> str | None:
    """Detect platform from URL.

    Args:
        url: URL to analyze

    Returns:
        Platform name (reddit, medium, youtube, github, twitter, instagram, etc.) or None
    """
    domain = lookup("urlparse")(url).netloc.lower()

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


def generate_reddit_feed_url(  # noqa: PLR0911
    url: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Generate Reddit RSS feed URL from subreddit or user URL.

    Args:
        url: Reddit URL (subreddit or user page)
        platform_config: Optional platform-specific configuration

    Returns:
        RSS feed URL or None
    """
    try:
        parsed = lookup("urlparse")(url)
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
        if match := re.match(r"u(?:ser)?/([A-Za-z0-9_-]{3,20})", path):  # codespell:ignore ser
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


def generate_medium_feed_url(  # noqa: PLR0911
    url: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Generate Medium RSS feed URL from publication or user URL.

    Args:
        url: Medium URL
        platform_config: Optional platform-specific configuration

    Returns:
        RSS feed URL or None
    """
    try:
        parsed = lookup("urlparse")(url)
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


def generate_youtube_feed_url(  # noqa: PLR0911
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
        parsed = lookup("urlparse")(url)
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


def generate_github_feed_url(  # noqa: PLR0911
    url: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Generate GitHub Atom feed URL from repository URL.

    Args:
        url: GitHub repository URL
        platform_config: Optional platform-specific configuration

    Returns:
        Atom feed URL or None
    """
    try:
        parsed = lookup("urlparse")(url)
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
        parsed = lookup("urlparse")(url)

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


def generate_devto_feed_url(  # noqa: PLR0911
    url: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Generate Dev.to RSS feed URL from user or organization URL.

    Args:
        url: Dev.to URL
        platform_config: Optional platform-specific configuration

    Returns:
        RSS feed URL or None
    """
    try:
        parsed = lookup("urlparse")(url)
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
    _url: str, platform_config: dict[str, Any] | None = None
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
        parsed = lookup("urlparse")(url)
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


def generate_arxiv_feed_url(  # noqa: PLR0911
    url: str, platform_config: dict[str, Any] | None = None
) -> str | None:
    """Generate arXiv RSS/Atom feed URL.

    Args:
        url: arXiv URL
        platform_config: Optional platform-specific configuration

    Returns:
        RSS/Atom feed URL or None
    """
    try:
        parsed = lookup("urlparse")(url)
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
                return (
                    f"http://export.arxiv.org/api/query?search_query=au:{quote(author)}"
                    f"&max_results={max_results}&sortBy=submittedDate&sortOrder=descending"
                )

            # Advanced search query
            if search_query := arxiv_cfg.get("search_query"):
                return (
                    f"http://export.arxiv.org/api/query?search_query={quote(search_query)}"
                    f"&max_results={max_results}&sortBy=submittedDate&sortOrder=descending"
                )

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
        "reddit": lookup("generate_reddit_feed_url"),
        "medium": lookup("generate_medium_feed_url"),
        "youtube": lookup("generate_youtube_feed_url"),
        "github": lookup("generate_github_feed_url"),
        "substack": lookup("generate_substack_feed_url"),
        "devto": lookup("generate_devto_feed_url"),
        "hackernews": lookup("generate_hackernews_feed_url"),
        "twitter": lookup("generate_twitter_feed_url"),
        "arxiv": lookup("generate_arxiv_feed_url"),
    }

    generator = generators.get(platform)
    if generator:
        return generator(url, platform_config)

    return None
