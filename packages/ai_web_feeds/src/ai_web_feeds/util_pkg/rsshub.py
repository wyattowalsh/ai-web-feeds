"""RSSHub feed URL generation."""

import re

from loguru import logger

from ai_web_feeds.util_pkg.namespace import lookup


def generate_rsshub_url(  # noqa: PLR0911
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
        parsed = lookup("urlparse")(url)
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
            if "company/" in path and (match := re.match(r"company/([^/]+)", path)):
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
