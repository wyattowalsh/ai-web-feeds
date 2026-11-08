"""Characterization of current ai_web_feeds.utils branches.

Success paths assert today's concrete results. Failure and empty-input paths assert
the None, empty, or exception behavior the module already implements. Network clients
are mocked. Files stay under pytest's tmp_path.
"""

import json
import xml.etree.ElementTree as ET
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
import pytest
import yaml
from ai_web_feeds.models import FeedSource
from ai_web_feeds.utils import (
    _extract_feed_links,
    detect_feed_format,
    detect_platform,
    discover_feed_url,
    enrich_feed_source,
    generate_arxiv_feed_url,
    generate_categorized_opml,
    generate_devto_feed_url,
    generate_enriched_schema,
    generate_feed_id,
    generate_filtered_opml,
    generate_github_feed_url,
    generate_hackernews_feed_url,
    generate_medium_feed_url,
    generate_opml,
    generate_platform_feed_url,
    generate_reddit_feed_url,
    generate_rsshub_url,
    generate_substack_feed_url,
    generate_twitter_feed_url,
    generate_youtube_feed_url,
    is_valid_url,
    load_feeds_yaml,
    parse_datetime,
    sanitize_text,
    sanitize_url,
    save_feeds_yaml,
    save_json_schema,
    save_opml,
)
from pytest_mock import MockerFixture

_CHANNEL_ID = "UC" + ("a" * 22)


def _response(
    mocker: MockerFixture,
    *,
    text: str = "",
    status_code: int = 200,
    content_type: str = "",
    url: str = "https://example.com/",
) -> Any:
    response = mocker.Mock()
    response.text = text
    response.status_code = status_code
    response.headers = {"content-type": content_type}
    response.url = url
    response.raise_for_status = mocker.Mock()
    return response


def _mount_client(mocker: MockerFixture, side_effect: Any) -> Any:
    """Replace httpx.AsyncClient with a mock that never opens a socket."""
    client = mocker.Mock()
    client.get = mocker.AsyncMock(side_effect=side_effect)
    async_client = mocker.patch("ai_web_feeds.utils.httpx.AsyncClient")
    context = async_client.return_value
    context.__aenter__ = mocker.AsyncMock(return_value=client)
    context.__aexit__ = mocker.AsyncMock(return_value=False)
    return client


def _parse_opml(xml: str) -> ET.Element:
    return ET.fromstring(xml)


@pytest.mark.unit
class TestStringAndUrlBranches:
    """URL, text, id, and timestamp helpers."""

    def test_sanitize_url_strips_root_and_path_slashes(self) -> None:
        assert sanitize_url("  https://example.com/  ") == "https://example.com"
        assert sanitize_url("https://example.com/a/") == "https://example.com/a"
        assert sanitize_url("  https://example.com/a  ") == "https://example.com/a"

    def test_sanitize_url_empty_stays_empty(self) -> None:
        assert sanitize_url("") == ""
        assert sanitize_url("   ") == ""

    def test_sanitize_text_collapses_whitespace_and_stringifies(self) -> None:
        assert sanitize_text("  a \n\t b  ") == "a b"
        assert sanitize_text(12) == "12"
        assert sanitize_text(None) == "None"

    def test_sanitize_text_empty_is_empty(self) -> None:
        assert sanitize_text("") == ""
        assert sanitize_text(" \n\t ") == ""

    def test_generate_feed_id_normalizes_host_and_is_stable(self) -> None:
        with_www = generate_feed_id("https://www.Example.com/Foo_Bar/")
        without_www = generate_feed_id("https://example.com/foo_bar")

        assert with_www == "example-com-foo-bar-15825c4bf4"
        assert with_www == generate_feed_id("https://www.Example.com/Foo_Bar/")
        assert without_www == "example-com-foo-bar-423cdb291f"
        assert generate_feed_id("https://example.com") == "example-com-100680ad54"

    def test_generate_feed_id_empty_url_uses_feed_slug(self) -> None:
        assert generate_feed_id("") == "feed-e3b0c44298"

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("2024-01-15T10:30:00Z", datetime(2024, 1, 15, 10, 30, tzinfo=UTC)),
            ("2024-01-15T10:30:00", datetime(2024, 1, 15, 10, 30, tzinfo=UTC)),
            (
                "2024-01-15T10:30:00+02:00",
                datetime(2024, 1, 15, 10, 30, tzinfo=timezone(timedelta(hours=2))),
            ),
            ("Mon, 15 Jan 2024 10:30:00 GMT", datetime(2024, 1, 15, 10, 30, tzinfo=UTC)),
        ],
    )
    def test_parse_datetime_success_formats(self, value: str, expected: datetime) -> None:
        assert parse_datetime(value) == expected

    @pytest.mark.parametrize("value", ["", "   ", "not-a-date", "2024-13-40"])
    def test_parse_datetime_empty_or_invalid_returns_none(self, value: str) -> None:
        assert parse_datetime(value) is None

    @pytest.mark.parametrize(
        ("url", "expected"),
        [
            ("https://example.com/feed.xml", True),
            (" http://example.com ", True),
            ("", False),
            ("   ", False),
            ("https://", False),
            ("ftp://example.com", False),
            ("/feed.xml", False),
        ],
    )
    def test_is_valid_url_http_family_only(self, url: str, expected: bool) -> None:
        assert is_valid_url(url) is expected


@pytest.mark.unit
class TestPlatformFeedBranches:
    """Platform detection and native or RSSHub feed URL generation."""

    @pytest.mark.parametrize(
        ("url", "expected"),
        [
            ("https://old.reddit.com/r/python", "reddit"),
            ("https://foo.substack.com/archive", "substack"),
            ("https://fosstodon.org/@ada", "mastodon"),
            ("https://my-mastodon.example.com/@ada", "mastodon"),
            ("https://javascript.plainenglish.io/x", "medium"),
            ("https://blog.medium.com/x", "medium"),
            ("https://youtu.be/abc", "youtube"),
            ("https://dev.to/alice", "devto"),
            ("https://news.ycombinator.com", "hackernews"),
            ("https://www.x.com/ada", "twitter"),
            ("http://export.arxiv.org/rss/cs.LG", "arxiv"),
            ("https://t.me/channel", "telegram"),
            ("https://www.bilibili.com/space/1", "bilibili"),
            ("https://example.com/feed", None),
        ],
    )
    def test_detect_platform_known_and_unknown(self, url: str, expected: str | None) -> None:
        assert detect_platform(url) == expected

    def test_rsshub_success_paths(self) -> None:
        assert generate_rsshub_url("https://x.com/Karpathy", "twitter") == (
            "https://rsshub.app/twitter/user/Karpathy"
        )
        assert (
            generate_rsshub_url(
                "https://www.instagram.com/ai/",
                "instagram",
                "https://rss.example/base/",
            )
            == "https://rss.example/base/instagram/user/ai"
        )
        assert generate_rsshub_url("https://www.tiktok.com/@name", "tiktok") == (
            "https://rsshub.app/tiktok/user/name"
        )
        assert generate_rsshub_url("https://www.bilibili.com/space/12345", "bilibili") == (
            "https://rsshub.app/bilibili/user/video/12345"
        )
        assert generate_rsshub_url("https://www.pixiv.net/en/users/987", "pixiv") == (
            "https://rsshub.app/pixiv/user/987"
        )
        assert generate_rsshub_url("https://t.me/s/mychannel", "telegram") == (
            "https://rsshub.app/telegram/channel/mychannel"
        )
        assert (
            generate_rsshub_url(
                "https://www.linkedin.com/company/acme/posts",
                "linkedin",
            )
            == "https://rsshub.app/linkedin/company/acme"
        )
        assert generate_rsshub_url("https://mastodon.social/@alice", "mastodon") == (
            "https://rsshub.app/mastodon/user/mastodon.social/alice"
        )

    @pytest.mark.parametrize(
        ("url", "platform"),
        [
            ("https://x.com/home", "twitter"),
            ("https://www.tiktok.com/name", "tiktok"),
            ("https://www.linkedin.com/in/someone", "linkedin"),
            ("https://mastodon.social/alice", "mastodon"),
            ("https://example.com/a", "not-a-platform"),
            ("https://x.com/", "twitter"),
        ],
    )
    def test_rsshub_unrecognized_paths_return_none(self, url: str, platform: str) -> None:
        assert generate_rsshub_url(url, platform) is None

    def test_reddit_path_and_config_branches(self) -> None:
        assert generate_reddit_feed_url("https://www.reddit.com/r/python") == (
            "https://www.reddit.com/r/python/hot/.rss"
        )
        assert (
            generate_reddit_feed_url(
                "https://old.reddit.com/r/python",
                {"reddit": {"subreddit": "ml", "sort": "top", "time": "day"}},
            )
            == "https://www.reddit.com/r/python/top/.rss?t=day"
        )
        assert generate_reddit_feed_url("https://www.reddit.com/user/karpathy") == (
            "https://www.reddit.com/user/karpathy/.rss"
        )
        assert (
            generate_reddit_feed_url(
                "https://www.reddit.com/",
                {"reddit": {"subreddit": "ml", "sort": "new"}},
            )
            == "https://www.reddit.com/r/ml/new/.rss"
        )
        assert (
            generate_reddit_feed_url(
                "https://www.reddit.com/",
                {"reddit": {"username": "ada"}},
            )
            == "https://www.reddit.com/user/ada/.rss"
        )

    @pytest.mark.parametrize(
        "url",
        ["https://www.reddit.com/r/ab", "https://www.reddit.com/", "https://www.reddit.com/wiki"],
    )
    def test_reddit_unmatched_url_returns_none(self, url: str) -> None:
        assert generate_reddit_feed_url(url) is None

    def test_medium_path_domain_and_config_branches(self) -> None:
        assert generate_medium_feed_url("https://medium.com/@user/story") == (
            "https://medium.com/feed/@user"
        )
        assert generate_medium_feed_url("https://medium.com/towards-data-science/story") == (
            "https://medium.com/feed/towards-data-science"
        )
        assert generate_medium_feed_url("https://medium.com/tag/machine-learning") == (
            "https://medium.com/feed/tag/machine-learning"
        )
        assert generate_medium_feed_url("https://towardsdatascience.com/foo") == (
            "https://medium.com/feed/towardsdatascience"
        )
        assert generate_medium_feed_url("https://www.towardsdatascience.com/foo") == (
            "https://medium.com/feed/foo"
        )
        assert (
            generate_medium_feed_url(
                "https://medium.com",
                {"medium": {"publication": "foo"}},
            )
            == "https://medium.com/feed/foo"
        )
        assert (
            generate_medium_feed_url(
                "https://medium.com",
                {"medium": {"username": "@bar"}},
            )
            == "https://medium.com/feed/@bar"
        )
        assert (
            generate_medium_feed_url(
                "https://medium.com/",
                {"medium": {"tag": "baz"}},
            )
            == "https://medium.com/feed/tag/baz"
        )

    def test_medium_empty_page_without_config_returns_none(self) -> None:
        assert generate_medium_feed_url("https://medium.com") is None

    def test_youtube_channel_user_playlist_and_config(self) -> None:
        channel = f"https://www.youtube.com/channel/{_CHANNEL_ID}"
        assert generate_youtube_feed_url(channel) == (
            f"https://www.youtube.com/feeds/videos.xml?channel_id={_CHANNEL_ID}"
        )
        assert generate_youtube_feed_url("https://www.youtube.com/@Name") == (
            "https://www.youtube.com/feeds/videos.xml?user=Name"
        )
        assert generate_youtube_feed_url("https://www.youtube.com/playlist?list=PLabc") == (
            "https://www.youtube.com/feeds/videos.xml?playlist_id=PLabc"
        )
        assert (
            generate_youtube_feed_url(
                "https://www.youtube.com/playlist",
                {"youtube": {"playlist_id": "PLz"}},
            )
            == "https://www.youtube.com/feeds/videos.xml?playlist_id=PLz"
        )
        assert (
            generate_youtube_feed_url(
                "https://www.youtube.com/watch",
                {"youtube": {"channel_id": _CHANNEL_ID, "playlist_id": "PLz"}},
            )
            == f"https://www.youtube.com/feeds/videos.xml?channel_id={_CHANNEL_ID}"
        )

    def test_youtube_unmatched_url_returns_none(self) -> None:
        assert generate_youtube_feed_url("https://www.youtube.com/watch?v=1") is None
        assert generate_youtube_feed_url("https://www.youtube.com/channel/UCshort") is None

    def test_github_feed_type_branches(self) -> None:
        assert generate_github_feed_url("https://github.com/Owner/Repo.Name") == (
            "https://github.com/Owner/Repo.Name/releases.atom"
        )
        assert (
            generate_github_feed_url(
                "https://github.com/o/r",
                {"github": {"feed_type": "tags"}},
            )
            == "https://github.com/o/r/tags.atom"
        )
        assert (
            generate_github_feed_url(
                "https://github.com/o/r",
                {"github": {"feed_type": "commits", "branch": "main"}},
            )
            == "https://github.com/o/r/commits/main.atom"
        )
        assert (
            generate_github_feed_url(
                "https://github.com/o/r",
                {"github": {"feed_type": "commits"}},
            )
            == "https://github.com/o/r/commits.atom"
        )
        assert (
            generate_github_feed_url(
                "https://github.com/o/r",
                {"github": {"feed_type": "activity"}},
            )
            == "https://github.com/o/r/activity.atom"
        )

    def test_github_unknown_type_or_path_returns_none(self) -> None:
        assert (
            generate_github_feed_url("https://github.com/o/r", {"github": {"feed_type": "issues"}})
            is None
        )
        assert generate_github_feed_url("https://github.com/onlyowner") is None

    def test_substack_devto_and_hackernews_branches(self) -> None:
        assert generate_substack_feed_url("http://foo.substack.com/archive") == (
            "http://foo.substack.com/feed"
        )
        assert (
            generate_substack_feed_url(
                "https://other.example",
                {"substack": {"publication": "pub"}},
            )
            == "https://pub.substack.com/feed"
        )
        assert generate_substack_feed_url("https://other.example") is None
        assert (
            generate_substack_feed_url("https://other.example", {"substack": {"publication": ""}})
            is None
        )

        assert generate_devto_feed_url("https://dev.to/user/article") == "https://dev.to/feed/user"
        assert generate_devto_feed_url("https://dev.to/t/python") == "https://dev.to/feed/t"
        assert (
            generate_devto_feed_url(
                "https://dev.to",
                {"devto": {"username": "u", "organization": "o"}},
            )
            == "https://dev.to/feed/u"
        )
        assert (
            generate_devto_feed_url(
                "https://dev.to/",
                {"devto": {"organization": "o", "tag": "t"}},
            )
            == "https://dev.to/feed/o"
        )
        assert generate_devto_feed_url("https://dev.to", {"devto": {"tag": "t"}}) == (
            "https://dev.to/feed/tag/t"
        )
        assert generate_devto_feed_url("https://dev.to") is None

        assert generate_hackernews_feed_url("https://news.ycombinator.com") == (
            "https://news.ycombinator.com/rss"
        )
        assert (
            generate_hackernews_feed_url(
                "",
                {"hackernews": {"feed_type": "newest"}},
            )
            == "https://news.ycombinator.com/newest.rss"
        )
        assert generate_hackernews_feed_url("", {"hackernews": {"feed_type": "nope"}}) is None

    def test_hackernews_config_lookup_failure_returns_none(self) -> None:
        class RaisingConfig(dict[str, Any]):
            def __contains__(self, key: object) -> bool:
                raise RuntimeError("config lookup failed")

        config: dict[str, Any] = RaisingConfig({"hackernews": {}})
        assert generate_hackernews_feed_url("https://news.ycombinator.com", config) is None

    def test_twitter_and_arxiv_branches(self) -> None:
        assert generate_twitter_feed_url("https://x.com/karpathy/status/1") == (
            "https://nitter.net/karpathy/rss"
        )
        assert generate_twitter_feed_url("https://twitter.com/search") is None
        assert (
            generate_twitter_feed_url(
                "https://x.com/home",
                {"twitter": {"username": "ada", "nitter_instance": "nitter.example"}},
            )
            == "https://nitter.example/ada/rss"
        )
        assert (
            generate_twitter_feed_url(
                "https://x.com/home",
                {"twitter": {"list_id": "99", "nitter_instance": "nitter.example"}},
            )
            == "https://nitter.example/i/lists/99/rss"
        )
        assert (
            generate_twitter_feed_url(
                "https://x.com/home",
                {"twitter": {"search_query": "a b&c"}},
            )
            == "https://nitter.net/search/rss?q=a%20b%26c"
        )
        assert generate_twitter_feed_url("https://x.com/") is None

        assert generate_arxiv_feed_url("https://arxiv.org/list/cs.LG/recent") == (
            "http://export.arxiv.org/rss/cs.LG"
        )
        assert generate_arxiv_feed_url("https://arxiv.org/list/stat.ML/recent") == (
            "http://export.arxiv.org/rss/stat.ML"
        )
        assert generate_arxiv_feed_url("https://arxiv.org/list/cs.lg/recent") is None
        assert generate_arxiv_feed_url("https://arxiv.org/abs/2101.12345") is None
        assert generate_arxiv_feed_url("https://arxiv.org/pdf/2101.12345") is None
        assert (
            generate_arxiv_feed_url(
                "https://arxiv.org/abs/1",
                {"arxiv": {"category": "cs.CL", "author": "Ignored"}},
            )
            == "http://export.arxiv.org/rss/cs.CL"
        )
        assert generate_arxiv_feed_url(
            "https://arxiv.org/",
            {"arxiv": {"author": "Yann LeCun", "max_results": 10}},
        ) == (
            "http://export.arxiv.org/api/query?search_query=au:Yann%20LeCun"
            "&max_results=10&sortBy=submittedDate&sortOrder=descending"
        )
        assert generate_arxiv_feed_url(
            "https://arxiv.org/",
            {"arxiv": {"search_query": "cat:cs.LG"}},
        ) == (
            "http://export.arxiv.org/api/query?search_query=cat%3Acs.LG"
            "&max_results=50&sortBy=submittedDate&sortOrder=descending"
        )
        assert generate_arxiv_feed_url("https://arxiv.org/") is None

    def test_platform_dispatch_known_and_unknown(self) -> None:
        assert generate_platform_feed_url("https://www.reddit.com/r/python", "reddit") == (
            "https://www.reddit.com/r/python/hot/.rss"
        )
        assert generate_platform_feed_url("https://news.ycombinator.com", "hackernews") == (
            "https://news.ycombinator.com/rss"
        )
        assert generate_platform_feed_url("https://www.bilibili.com/space/1", "bilibili") is None
        assert generate_platform_feed_url("https://example.com", "not-a-platform") is None

    @pytest.mark.parametrize(
        ("generator", "args"),
        [
            (generate_rsshub_url, ("https://x.com/karpathy", "twitter")),
            (generate_reddit_feed_url, ("https://www.reddit.com/r/python",)),
            (generate_medium_feed_url, ("https://medium.com/@user",)),
            (generate_youtube_feed_url, ("https://www.youtube.com/@Name",)),
            (generate_github_feed_url, ("https://github.com/o/r",)),
            (generate_substack_feed_url, ("http://foo.substack.com",)),
            (generate_devto_feed_url, ("https://dev.to/user",)),
            (generate_twitter_feed_url, ("https://x.com/karpathy",)),
            (generate_arxiv_feed_url, ("https://arxiv.org/list/cs.LG/recent",)),
        ],
    )
    def test_generators_return_none_when_urlparse_fails(
        self,
        mocker: MockerFixture,
        generator: Any,
        args: tuple[str, ...],
    ) -> None:
        mocker.patch("ai_web_feeds.utils.urlparse", side_effect=ValueError("bad url"))
        assert generator(*args) is None


@pytest.mark.unit
class TestFeedLinkParser:
    """HTML alternate-link extraction."""

    def test_extracts_feed_types_and_drops_duplicates(self) -> None:
        html = """
        <html>
          <div>nope</div>
          <link rel="stylesheet" type="application/rss+xml" href="/skip.xml">
          <link rel="alternate" type="text/html" href="/page">
          <link rel="alternate">
          <link rel="alternate" type="application/rss+xml" href="">
          <LINK REL="alternate" TYPE="Application/Atom+XML" HREF="feed.xml">
          <link rel="alternate" type="application/rss+xml" href="/feed.xml">
          <link rel="alternate" type="application/rss+xml" href="https://example.com/feed.xml">
          <link rel="alternate" type="application/feed+json" href="https://example.com/feed.json">
        </html>
        """
        assert _extract_feed_links(html, "https://example.com/blog/index.html") == [
            "https://example.com/blog/feed.xml",
            "https://example.com/feed.xml",
            "https://example.com/feed.json",
        ]

    def test_empty_html_has_no_links(self) -> None:
        assert _extract_feed_links("", "https://example.com") == []


@pytest.mark.unit
class TestDiscoverFeedUrl:
    """discover_feed_url with the HTTP client mocked."""

    @pytest.mark.asyncio
    async def test_known_platform_skips_network(self, mocker: MockerFixture) -> None:
        async_client = mocker.patch("ai_web_feeds.utils.httpx.AsyncClient")

        found = await discover_feed_url(
            "https://news.ycombinator.com/news",
            {"hackernews": {"feed_type": "ask"}},
        )

        assert found == "https://news.ycombinator.com/ask.rss"
        async_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_html_alternate_link_success(self, mocker: MockerFixture) -> None:
        page = _response(
            mocker,
            text='<link rel="alternate" type="application/atom+xml" href="feed.xml">',
            url="https://example.com/blog/index.html",
        )
        feed = _response(mocker, content_type="application/atom+xml")
        client = _mount_client(mocker, [page, feed])

        found = await discover_feed_url("https://example.com/blog/")

        assert found == "https://example.com/blog/feed.xml"
        assert client.get.await_count == 2
        assert client.get.await_args_list[0].kwargs == {"follow_redirects": True}

    @pytest.mark.asyncio
    async def test_skips_non_feed_response_then_uses_next_link(
        self,
        mocker: MockerFixture,
    ) -> None:
        page = _response(
            mocker,
            text=(
                '<link rel="alternate" type="application/rss+xml" href="/first.xml">'
                '<link rel="alternate" type="application/rss+xml" href="/second.xml">'
            ),
            url="https://example.com/",
        )
        html_feed = _response(mocker, status_code=200, content_type="text/html")
        rss_feed = _response(mocker, status_code=200, content_type="application/rss+xml")
        client = _mount_client(mocker, [page, html_feed, rss_feed])

        found = await discover_feed_url("https://example.com")

        assert found == "https://example.com/second.xml"
        assert client.get.await_count == 3

    @pytest.mark.asyncio
    async def test_common_path_after_link_error(self, mocker: MockerFixture) -> None:
        page = _response(
            mocker,
            text='<link rel="alternate" type="application/rss+xml" href="/ads.xml">',
            url="https://example.com/blog/",
        )
        missed = _response(mocker, status_code=404, content_type="application/rss+xml")
        html_hit = _response(mocker, status_code=200, content_type="text/html")
        atom = _response(mocker, status_code=200, content_type="application/atom+xml")
        client = _mount_client(
            mocker,
            [
                page,
                httpx.HTTPError("link down"),
                missed,
                html_hit,
                httpx.HTTPError("rss down"),
                atom,
            ],
        )

        found = await discover_feed_url("https://example.com/blog/")

        assert found == "https://example.com/blog/atom.xml"
        assert client.get.await_count == 6

    @pytest.mark.asyncio
    async def test_nothing_discovered_returns_none(self, mocker: MockerFixture) -> None:
        page = _response(mocker, text="<html></html>", url="https://example.com/")
        missed = _response(mocker, status_code=404, content_type="text/html")
        client = _mount_client(mocker, [page, missed, missed, missed, missed, missed])

        assert await discover_feed_url("https://example.com") is None
        assert client.get.await_count == 6

    @pytest.mark.asyncio
    async def test_page_fetch_error_returns_none(self, mocker: MockerFixture) -> None:
        client = _mount_client(mocker, httpx.HTTPError("down"))

        assert await discover_feed_url("https://example.com") is None
        assert client.get.await_count == 1


@pytest.mark.unit
class TestDetectFeedFormat:
    """detect_feed_format content-type and body branches."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("content_type", "body", "expected"),
        [
            ("application/feed+json", "<rss>", "jsonfeed"),
            ("application/xml", "<RSS version='2.0'></RSS>", "rss"),
            ("text/xml", '<feed xmlns="http://www.w3.org/2005/atom"></feed>', "atom"),
            ("text/xml", "<feed></feed>", "unknown"),
            ("text/plain", "hello", "unknown"),
        ],
    )
    async def test_format_detection_success(
        self,
        mocker: MockerFixture,
        content_type: str,
        body: str,
        expected: str,
    ) -> None:
        response = _response(mocker, text=body, content_type=content_type)
        _mount_client(mocker, [response])

        assert await detect_feed_format("https://example.com/feed") == expected

    @pytest.mark.asyncio
    async def test_http_error_returns_none(self, mocker: MockerFixture) -> None:
        response = _response(mocker, text="<rss></rss>", content_type="application/rss+xml")
        response.raise_for_status.side_effect = httpx.HTTPError("status")
        _mount_client(mocker, [response])

        assert await detect_feed_format("https://example.com/missing") is None

    @pytest.mark.asyncio
    async def test_client_error_returns_none(self, mocker: MockerFixture) -> None:
        _mount_client(mocker, httpx.HTTPError("down"))

        assert await detect_feed_format("https://example.com/missing") is None


@pytest.mark.unit
class TestEnrichFeedSource:
    """enrich_feed_source decision branches. HTTP is mocked."""

    @pytest.mark.asyncio
    async def test_direct_feed_extracts_format_and_title(self, mocker: MockerFixture) -> None:
        discover = mocker.patch("ai_web_feeds.utils.discover_feed_url", new=mocker.AsyncMock())
        body = "<rss><title>Channel Title</title></rss>"
        response = _response(mocker, text=body, content_type="application/rss+xml")
        _mount_client(mocker, [response, response])
        source = {"url": "https://example.com/feed.xml", "notes": "keep"}
        original = dict(source)

        result = await enrich_feed_source(source)

        discover.assert_not_called()
        assert source == original
        assert result["feed"] == "https://example.com/feed.xml"
        assert result["site"] is None
        assert result["title"] == "Channel Title"
        assert result["notes"] == "keep"
        assert result["meta"]["input_type"] == "direct_feed"
        assert result["meta"]["format"] == "rss"
        assert result["meta"]["title_source"] == "auto_extracted"
        assert result["meta"]["notes_source"] == "user_provided"
        assert result["meta"]["enrichment_status"] == "success"
        datetime.fromisoformat(result["meta"]["enriched_at"])

    @pytest.mark.asyncio
    async def test_rss_substring_counts_as_direct_feed(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "ai_web_feeds.utils.detect_feed_format",
            new=mocker.AsyncMock(return_value=None),
        )
        response = _response(mocker, text="<rss></rss>", status_code=404)
        _mount_client(mocker, [response])

        result = await enrich_feed_source({"url": "https://example.com/rss-roundup"})

        assert result["feed"] == "https://example.com/rss-roundup"
        assert result["meta"]["input_type"] == "direct_feed"
        assert "title" not in result
        assert "format" not in result["meta"]

    @pytest.mark.asyncio
    async def test_reddit_native_feed_skips_discovery(self, mocker: MockerFixture) -> None:
        discover = mocker.patch("ai_web_feeds.utils.discover_feed_url", new=mocker.AsyncMock())
        body = '<feed xmlns="http://www.w3.org/2005/atom"><title>Py</title></feed>'
        response = _response(mocker, text=body, content_type="application/atom+xml")
        _mount_client(mocker, [response, response])

        result = await enrich_feed_source({"url": "https://www.reddit.com/r/python"})

        discover.assert_not_called()
        assert result["feed"] == "https://www.reddit.com/r/python/hot/.rss"
        assert result["site"] == "https://www.reddit.com/r/python"
        assert result["title"] == "Py"
        assert result["meta"]["platform"] == "reddit"
        assert result["meta"]["feed_source"] == "reddit_native"
        assert result["meta"]["input_type"] == "platform_url"
        assert result["meta"]["format"] == "atom"

    @pytest.mark.asyncio
    async def test_explicit_rsshub_after_discovery_miss(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "ai_web_feeds.utils.discover_feed_url",
            new=mocker.AsyncMock(return_value=None),
        )
        mocker.patch(
            "ai_web_feeds.utils.detect_feed_format",
            new=mocker.AsyncMock(return_value="jsonfeed"),
        )
        response = _response(mocker, text="<rss><title>IG</title></rss>")
        client = _mount_client(mocker, [response])
        source = {
            "url": "https://www.instagram.com/openai",
            "discover": {"strategy": "rsshub"},
        }

        result = await enrich_feed_source(source, rsshub_instance="https://rss.example/base/")

        assert result["feed"] == "https://rss.example/base/instagram/user/openai"
        assert result["site"] == source["url"]
        assert result["title"] == "IG"
        assert result["meta"]["feed_source"] == "rsshub"
        assert result["meta"]["rsshub_instance"] == "https://rss.example/base/"
        assert result["meta"]["input_type"] == "platform_url"
        assert result["meta"]["format"] == "jsonfeed"
        assert client.get.await_count == 1

    @pytest.mark.asyncio
    async def test_rsshub_miss_records_no_feed(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "ai_web_feeds.utils.discover_feed_url",
            new=mocker.AsyncMock(return_value=None),
        )
        async_client = mocker.patch("ai_web_feeds.utils.httpx.AsyncClient")

        result = await enrich_feed_source(
            {
                "url": "https://www.instagram.com/",
                "discover": {"strategy": "rsshub"},
            }
        )

        async_client.assert_not_called()
        assert "feed" not in result
        assert result["site"] == "https://www.instagram.com/"
        assert result["meta"]["platform"] == "instagram"
        assert result["meta"]["enrichment_status"] == "no_feed_found"

    @pytest.mark.asyncio
    async def test_boolean_discover_does_not_request_rsshub(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "ai_web_feeds.utils.discover_feed_url",
            new=mocker.AsyncMock(return_value=None),
        )
        rsshub = mocker.patch("ai_web_feeds.utils.generate_rsshub_url")

        result = await enrich_feed_source(
            {"url": "https://www.instagram.com/openai", "discover": True}
        )

        rsshub.assert_not_called()
        assert result["meta"]["enrichment_status"] == "no_feed_found"
        assert "feed" not in result

    @pytest.mark.asyncio
    async def test_discovered_feed_wins_over_rsshub_strategy(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "ai_web_feeds.utils.discover_feed_url",
            new=mocker.AsyncMock(return_value="https://example.com/feed"),
        )
        rsshub = mocker.patch("ai_web_feeds.utils.generate_rsshub_url")
        mocker.patch(
            "ai_web_feeds.utils.detect_feed_format",
            new=mocker.AsyncMock(return_value="rss"),
        )
        response = _response(mocker, text="<rss><title>Found</title></rss>")
        _mount_client(mocker, [response])

        result = await enrich_feed_source(
            {
                "url": "https://example.com/news",
                "discover": {"strategy": "rsshub"},
                "meta": {"language": "en"},
            }
        )

        rsshub.assert_not_called()
        assert result["feed"] == "https://example.com/feed"
        assert result["site"] == "https://example.com/news"
        assert result["title"] == "Found"
        assert result["meta"]["language"] == "en"
        assert result["meta"]["feed_source"] == "discovered"
        assert result["meta"]["input_type"] == "website_url"
        assert result["meta"]["format"] == "rss"
        assert result["meta"]["enrichment_status"] == "success"

    @pytest.mark.asyncio
    async def test_discovery_exception_has_no_feed(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "ai_web_feeds.utils.discover_feed_url",
            new=mocker.AsyncMock(side_effect=RuntimeError("down")),
        )

        result = await enrich_feed_source({"url": "https://example.com/news"})

        assert "feed" not in result
        assert result["site"] == "https://example.com/news"
        assert result["meta"]["enrichment_status"] == "no_feed_found"

    @pytest.mark.asyncio
    async def test_format_detection_error_still_extracts_title(
        self,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "ai_web_feeds.utils.detect_feed_format",
            new=mocker.AsyncMock(side_effect=RuntimeError("fmt")),
        )
        response = _response(mocker, text="<rss><title>Still Here</title></rss>")
        _mount_client(mocker, [response])

        result = await enrich_feed_source({"url": "https://example.com/feed.xml"})

        assert result["feed"] == "https://example.com/feed.xml"
        assert result["title"] == "Still Here"
        assert "format" not in result["meta"]
        assert result["meta"]["enrichment_status"] == "success"

    @pytest.mark.asyncio
    async def test_title_fetch_error_keeps_format(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "ai_web_feeds.utils.detect_feed_format",
            new=mocker.AsyncMock(return_value="rss"),
        )
        mocker.patch("ai_web_feeds.utils.httpx.AsyncClient", side_effect=httpx.HTTPError("down"))

        result = await enrich_feed_source({"url": "https://example.com/feed.xml"})

        assert result["meta"]["format"] == "rss"
        assert "title" not in result
        assert result["meta"]["enrichment_status"] == "success"

    @pytest.mark.asyncio
    async def test_custom_title_skips_title_fetch(self, mocker: MockerFixture) -> None:
        mocker.patch(
            "ai_web_feeds.utils.detect_feed_format",
            new=mocker.AsyncMock(return_value="atom"),
        )
        async_client = mocker.patch("ai_web_feeds.utils.httpx.AsyncClient")

        result = await enrich_feed_source(
            {"url": "https://example.com/feed.xml", "title": "Mine", "notes": "n"}
        )

        async_client.assert_not_called()
        assert result["title"] == "Mine"
        assert result["notes"] == "n"
        assert result["meta"]["title_source"] == "user_provided"
        assert result["meta"]["notes_source"] == "user_provided"
        assert result["meta"]["format"] == "atom"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("source", [{}, {"url": ""}, {"url": None}])
    async def test_missing_url_returns_copy_without_network(
        self,
        mocker: MockerFixture,
        source: dict[str, Any],
    ) -> None:
        async_client = mocker.patch("ai_web_feeds.utils.httpx.AsyncClient")

        result = await enrich_feed_source(source)

        async_client.assert_not_called()
        assert result == source
        assert result is not source


@pytest.mark.unit
class TestOpmlBranches:
    """OPML outlines omit empty feed, site, and tag fields."""

    def test_generate_opml_includes_only_present_fields(self) -> None:
        full = FeedSource(
            id="full",
            title="Full",
            feed="https://example.com/a.xml",
            site="https://example.com/a",
            tags=["z", "a"],
            topics=["alpha"],
        )
        bare = FeedSource(id="bare", title="Bare", topics=[])

        root = _parse_opml(generate_opml([full, bare], title="Branch Feeds"))
        head = root.find("head")
        body = root.find("body")
        assert head is not None
        assert body is not None
        assert root.get("version") == "2.0"
        assert head.findtext("title") == "Branch Feeds"
        assert head.findtext("ownerName") == "AI Web Feeds"

        outlines = list(body.findall("outline"))
        assert outlines[0].attrib == {
            "text": "Full",
            "title": "Full",
            "type": "rss",
            "xmlUrl": "https://example.com/a.xml",
            "htmlUrl": "https://example.com/a",
            "category": "z,a",
        }
        assert outlines[1].attrib == {"text": "Bare", "title": "Bare", "type": "rss"}

    def test_generate_opml_empty_sources_have_no_outlines(self) -> None:
        root = _parse_opml(generate_opml([], title="Empty"))
        body = root.find("body")
        assert body is not None
        assert list(body) == []
        assert root.findtext("head/title") == "Empty"

    def test_categorized_opml_groups_sorts_and_fills_uncategorized(self) -> None:
        apple = FeedSource(
            id="apple",
            title="Apple",
            feed="https://example.com/a.xml",
            site="https://example.com/a",
            tags=["ml"],
            topics=["beta"],
        )
        zebra = FeedSource(id="zebra", title="Zebra", topics=["beta", "alpha"])
        bare = FeedSource(id="bare", title="Bare", topics=[])

        root = _parse_opml(generate_categorized_opml([zebra, bare, apple], title="Grouped"))
        body = root.find("body")
        assert body is not None
        categories = list(body)

        assert [node.get("text") for node in categories] == ["Uncategorized", "alpha", "beta"]
        assert [node.get("title") for node in categories[0]] == ["Bare"]
        assert [node.get("title") for node in categories[1]] == ["Zebra"]
        assert [node.get("title") for node in categories[2]] == ["Apple", "Zebra"]
        assert categories[2][0].get("xmlUrl") == "https://example.com/a.xml"
        assert categories[2][0].get("category") == "ml"
        assert categories[2][1].get("xmlUrl") is None
        assert root.findtext("head/title") == "Grouped"

    def test_categorized_opml_empty_input(self) -> None:
        root = _parse_opml(generate_categorized_opml([]))
        body = root.find("body")
        assert body is not None
        assert list(body) == []

    def test_filtered_opml_keeps_matches_only(self) -> None:
        kept = FeedSource(id="kept", title="Keep", feed="https://example.com/k.xml", topics=["t"])
        dropped = FeedSource(id="dropped", title="Drop", feed="https://example.com/d.xml")

        root = _parse_opml(
            generate_filtered_opml(
                [kept, dropped],
                "Filtered",
                lambda feed: feed.title == "Keep",
            )
        )
        body = root.find("body")
        assert body is not None
        outlines = list(body)
        assert root.findtext("head/title") == "Filtered"
        assert [node.get("title") for node in outlines] == ["Keep"]
        assert outlines[0].get("xmlUrl") == "https://example.com/k.xml"

    def test_filtered_opml_empty_when_nothing_matches(self) -> None:
        source = FeedSource(id="one", title="One", feed="https://example.com/1.xml")
        root = _parse_opml(generate_filtered_opml([source], "None", lambda _feed: False))
        body = root.find("body")
        assert body is not None
        assert list(body) == []


@pytest.mark.unit
class TestSchemaAndFiles:
    """Schema document and YAML, JSON, and OPML file helpers."""

    def test_enriched_schema_declares_required_document(self) -> None:
        schema = generate_enriched_schema()

        assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
        assert schema["type"] == "object"
        assert schema["additionalProperties"] is False
        assert schema["required"] == ["schema_version", "sources"]
        assert (
            "arxiv" in schema["properties"]["sources"]["items"]["properties"]["source_type"]["enum"]
        )
        assert schema["properties"]["schema_version"]["default"] == "feeds.enriched-3.0.0"

    def test_load_feeds_yaml_round_trip(self, tmp_path: Path) -> None:
        data = {"sources": [{"title": "héllo — feeds", "url": "https://example.com"}]}
        path = tmp_path / "nested" / "feeds.yaml"

        save_feeds_yaml(data, path)

        assert path.is_file()
        assert "héllo" in path.read_text(encoding="utf-8")
        assert load_feeds_yaml(str(path)) == data

    @pytest.mark.parametrize("contents", ["", "null\n"])
    def test_load_empty_yaml_returns_empty_dict(self, tmp_path: Path, contents: str) -> None:
        path = tmp_path / "empty.yaml"
        path.write_text(contents, encoding="utf-8")

        assert load_feeds_yaml(path) == {}

    def test_load_missing_yaml_raises(self, tmp_path: Path) -> None:
        missing = tmp_path / "missing.yaml"
        with pytest.raises(FileNotFoundError, match=r"missing\.yaml"):
            load_feeds_yaml(missing)

    def test_load_invalid_yaml_raises(self, tmp_path: Path) -> None:
        path = tmp_path / "bad.yaml"
        path.write_text("[", encoding="utf-8")
        with pytest.raises(yaml.YAMLError):
            load_feeds_yaml(path)

    def test_save_json_schema_and_opml_create_parents(self, tmp_path: Path) -> None:
        schema = {"title": "Branch", "nested": {"a": 1}}
        schema_path = tmp_path / "schemas" / "feeds.json"
        opml_path = tmp_path / "exports" / "feeds.opml"
        opml_xml = "<opml version='2.0'></opml>\n"

        save_json_schema(schema, schema_path)
        save_opml(opml_xml, str(opml_path))

        assert schema_path.read_text(encoding="utf-8") == json.dumps(schema, indent=2)
        assert opml_path.read_text(encoding="utf-8") == opml_xml
