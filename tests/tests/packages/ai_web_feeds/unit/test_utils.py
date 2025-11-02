"""Unit tests for ai_web_feeds.utils module."""

import pytest
from hypothesis import given
from hypothesis import strategies as st


@pytest.mark.unit
class TestUtilityFunctions:
    """Test utility functions."""

    def test_utils_module_exists(self):
        """Test that utils module can be imported."""
        try:
            from ai_web_feeds import utils

            assert utils is not None
        except ImportError:
            pytest.skip("Utils module not yet implemented")

    def test_sanitize_url(self):
        """Test URL sanitization."""
        try:
            from ai_web_feeds.utils import sanitize_url

            assert sanitize_url("https://example.com") == "https://example.com"
            assert sanitize_url("http://example.com/") == "http://example.com"
        except ImportError:
            pytest.skip("sanitize_url not yet implemented")

    @given(st.text())
    def test_sanitize_text_property_based(self, text):
        """Property-based test for text sanitization."""
        try:
            from ai_web_feeds.utils import sanitize_text

            result = sanitize_text(text)
            # Result should be string type
            assert isinstance(result, str)
        except ImportError:
            pytest.skip("sanitize_text not yet implemented")


@pytest.mark.unit
class TestHashingFunctions:
    """Test hashing and ID generation functions."""

    def test_generate_feed_id(self):
        """Test feed ID generation."""
        try:
            from ai_web_feeds.utils import generate_feed_id

            url = "https://example.com/feed.xml"
            id1 = generate_feed_id(url)
            id2 = generate_feed_id(url)

            # Same URL should generate same ID
            assert id1 == id2

            # Different URL should generate different ID
            id3 = generate_feed_id("https://different.com/feed.xml")
            assert id1 != id3
        except ImportError:
            pytest.skip("generate_feed_id not yet implemented")


@pytest.mark.unit
class TestDateTimeFunctions:
    """Test datetime utility functions."""

    def test_parse_datetime(self):
        """Test datetime parsing."""
        try:
            from ai_web_feeds.utils import parse_datetime

            # ISO format
            result = parse_datetime("2024-01-15T10:30:00Z")
            assert result is not None

            # RFC 2822 format
            result = parse_datetime("Mon, 15 Jan 2024 10:30:00 GMT")
            assert result is not None
        except ImportError:
            pytest.skip("parse_datetime not yet implemented")


@pytest.mark.unit
class TestValidationFunctions:
    """Test validation utility functions."""

    @pytest.mark.parametrize(
        "url,expected",
        [
            ("https://example.com", True),
            ("http://example.com", True),
            ("https://example.com/feed.xml", True),
            ("not-a-url", False),
            ("", False),
            ("ftp://example.com", False),
        ],
    )
    def test_is_valid_url(self, url, expected):
        """Test URL validation."""
        try:
            from ai_web_feeds.utils import is_valid_url

            assert is_valid_url(url) == expected
        except ImportError:
            pytest.skip("is_valid_url not yet implemented")


@pytest.mark.unit
class TestPlatformDetection:
    """Test platform detection from URLs."""

    @pytest.mark.parametrize(
        "url,expected_platform",
        [
            ("https://twitter.com/karpathy", "twitter"),
            ("https://www.twitter.com/elonmusk", "twitter"),
            ("https://x.com/sama", "twitter"),
            ("https://www.x.com/gdb", "twitter"),
            ("https://arxiv.org/list/cs.LG/recent", "arxiv"),
            ("https://www.arxiv.org/abs/2101.12345", "arxiv"),
            ("http://export.arxiv.org/rss/cs.LG", "arxiv"),
            ("https://reddit.com/r/machinelearning", "reddit"),
            ("https://medium.com/@user", "medium"),
            ("https://youtube.com/channel/UCxxxxxx", "youtube"),
            ("https://github.com/owner/repo", "github"),
        ],
    )
    def test_detect_platform(self, url, expected_platform):
        """Test platform detection for various URLs."""
        from ai_web_feeds.utils import detect_platform

        assert detect_platform(url) == expected_platform


@pytest.mark.unit
class TestTwitterIntegration:
    """Test Twitter/X feed URL generation."""

    def test_generate_twitter_feed_from_url(self):
        """Test Twitter feed generation from URL."""
        from ai_web_feeds.utils import generate_twitter_feed_url

        url = "https://twitter.com/karpathy"
        feed_url = generate_twitter_feed_url(url)

        assert feed_url is not None
        assert "nitter.net" in feed_url
        assert "karpathy/rss" in feed_url

    def test_generate_twitter_feed_with_username_config(self):
        """Test Twitter feed with explicit username in config."""
        from ai_web_feeds.utils import generate_twitter_feed_url

        url = "https://twitter.com"
        config = {"twitter": {"username": "karpathy"}}
        feed_url = generate_twitter_feed_url(url, config)

        assert feed_url is not None
        assert "nitter.net/karpathy/rss" in feed_url

    def test_generate_twitter_feed_with_custom_nitter(self):
        """Test Twitter feed with custom Nitter instance."""
        from ai_web_feeds.utils import generate_twitter_feed_url

        url = "https://twitter.com/sama"
        config = {"twitter": {"username": "sama", "nitter_instance": "nitter.example.com"}}
        feed_url = generate_twitter_feed_url(url, config)

        assert feed_url is not None
        assert "nitter.example.com" in feed_url
        assert "sama/rss" in feed_url

    def test_generate_twitter_list_feed(self):
        """Test Twitter list feed generation."""
        from ai_web_feeds.utils import generate_twitter_feed_url

        url = "https://twitter.com"
        config = {"twitter": {"list_id": "1234567890"}}
        feed_url = generate_twitter_feed_url(url, config)

        assert feed_url is not None
        assert "i/lists/1234567890/rss" in feed_url

    def test_generate_twitter_search_feed(self):
        """Test Twitter search feed generation."""
        from ai_web_feeds.utils import generate_twitter_feed_url

        url = "https://twitter.com"
        config = {"twitter": {"search_query": "LLM OR large language model"}}
        feed_url = generate_twitter_feed_url(url, config)

        assert feed_url is not None
        assert "search/rss?q=" in feed_url

    def test_twitter_skip_system_paths(self):
        """Test that system paths are skipped."""
        from ai_web_feeds.utils import generate_twitter_feed_url

        urls = [
            "https://twitter.com/home",
            "https://twitter.com/explore",
            "https://twitter.com/notifications",
            "https://twitter.com/messages",
            "https://twitter.com/i/lists",
            "https://twitter.com/settings",
        ]

        for url in urls:
            feed_url = generate_twitter_feed_url(url)
            assert feed_url is None

    def test_twitter_platform_feed_url(self):
        """Test platform feed URL generation for Twitter."""
        from ai_web_feeds.utils import generate_platform_feed_url

        url = "https://twitter.com/karpathy"
        feed_url = generate_platform_feed_url(url, "twitter")

        assert feed_url is not None
        assert "nitter.net/karpathy/rss" in feed_url


@pytest.mark.unit
class TestArxivIntegration:
    """Test arXiv feed URL generation."""

    def test_generate_arxiv_category_feed_from_url(self):
        """Test arXiv category feed generation from URL."""
        from ai_web_feeds.utils import generate_arxiv_feed_url

        url = "https://arxiv.org/list/cs.LG/recent"
        feed_url = generate_arxiv_feed_url(url)

        assert feed_url is not None
        assert "export.arxiv.org/rss/cs.LG" in feed_url

    def test_generate_arxiv_feed_with_category_config(self):
        """Test arXiv feed with explicit category in config."""
        from ai_web_feeds.utils import generate_arxiv_feed_url

        url = "https://arxiv.org"
        config = {"arxiv": {"category": "cs.LG"}}
        feed_url = generate_arxiv_feed_url(url, config)

        assert feed_url is not None
        assert "export.arxiv.org/rss/cs.LG" in feed_url

    def test_generate_arxiv_author_feed(self):
        """Test arXiv author feed generation."""
        from ai_web_feeds.utils import generate_arxiv_feed_url

        url = "https://arxiv.org"
        config = {"arxiv": {"author": "Yoshua Bengio"}}
        feed_url = generate_arxiv_feed_url(url, config)

        assert feed_url is not None
        assert "export.arxiv.org/api/query" in feed_url
        assert "au:" in feed_url
        assert "Yoshua" in feed_url

    def test_generate_arxiv_search_query_feed(self):
        """Test arXiv search query feed generation."""
        from ai_web_feeds.utils import generate_arxiv_feed_url

        url = "https://arxiv.org"
        config = {"arxiv": {"search_query": "all:neural+network"}}
        feed_url = generate_arxiv_feed_url(url, config)

        assert feed_url is not None
        assert "export.arxiv.org/api/query" in feed_url
        assert "search_query=" in feed_url

    def test_generate_arxiv_with_max_results(self):
        """Test arXiv feed with custom max results."""
        from ai_web_feeds.utils import generate_arxiv_feed_url

        url = "https://arxiv.org"
        config = {"arxiv": {"author": "Geoffrey Hinton", "max_results": 100}}
        feed_url = generate_arxiv_feed_url(url, config)

        assert feed_url is not None
        assert "max_results=100" in feed_url

    def test_generate_arxiv_stat_ml_category(self):
        """Test arXiv stat.ML category feed."""
        from ai_web_feeds.utils import generate_arxiv_feed_url

        url = "https://arxiv.org/list/stat.ML/recent"
        feed_url = generate_arxiv_feed_url(url)

        assert feed_url is not None
        assert "export.arxiv.org/rss/stat.ML" in feed_url

    def test_arxiv_platform_feed_url(self):
        """Test platform feed URL generation for arXiv."""
        from ai_web_feeds.utils import generate_platform_feed_url

        url = "https://arxiv.org/list/cs.AI/recent"
        feed_url = generate_platform_feed_url(url, "arxiv")

        assert feed_url is not None
        assert "export.arxiv.org/rss/cs.AI" in feed_url


@pytest.mark.unit
class TestSourceTypes:
    """Test that Twitter and arXiv are valid source types."""

    def test_twitter_source_type_exists(self):
        """Test that TWITTER is a valid SourceType."""
        from ai_web_feeds.models import SourceType

        assert hasattr(SourceType, "TWITTER")
        assert SourceType.TWITTER.value == "twitter"

    def test_arxiv_source_type_exists(self):
        """Test that ARXIV is a valid SourceType."""
        from ai_web_feeds.models import SourceType

        assert hasattr(SourceType, "ARXIV")
        assert SourceType.ARXIV.value == "arxiv"
