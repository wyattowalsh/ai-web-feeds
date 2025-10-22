"""Pytest configuration and fixtures for ai-web-feeds tests."""

import tempfile
from collections.abc import Generator
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import Mock

import pytest
from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel

from ai_web_feeds.models import (
    CurationStatus,
    FeedFetchLog,
    FeedItem,
    FeedSource,
    Medium,
    SourceType,
    Topic,
)


# ============================================================================
# Pytest Configuration
# ============================================================================


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "unit: Unit tests")
    config.addinivalue_line("markers", "integration: Integration tests")
    config.addinivalue_line("markers", "e2e: End-to-end tests")
    config.addinivalue_line("markers", "slow: Slow running tests")
    config.addinivalue_line("markers", "network: Tests requiring network access")


# ============================================================================
# Database Fixtures
# ============================================================================


@pytest.fixture
def temp_db_path() -> Generator[Path]:
    """Create a temporary database file path."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = Path(f.name)
    yield db_path
    # Cleanup
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
def db_engine(temp_db_path: Path):
    """Create a test database engine."""
    engine = create_engine(
        f"sqlite:///{temp_db_path}",
        connect_args={"check_same_thread": False},
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine) -> Generator[Session]:
    """Create a test database session."""
    with Session(db_engine) as session:
        yield session
        session.rollback()


# ============================================================================
# Model Fixtures
# ============================================================================


@pytest.fixture
def sample_feed_source() -> FeedSource:
    """Create a sample feed source."""
    return FeedSource(
        id="test-blog-ai",
        feed="https://example.com/feed.xml",
        site="https://example.com",
        title="Test AI Blog",
        source_type=SourceType.BLOG,
        mediums=[Medium.TEXT],
        tags=["ai", "ml", "deep-learning"],
        topics=["artificial-intelligence", "machine-learning"],
        curation_status=CurationStatus.VERIFIED,
        language="en",
    )


@pytest.fixture
def sample_feed_sources() -> list[FeedSource]:
    """Create multiple sample feed sources."""
    return [
        FeedSource(
            id="blog-1",
            feed="https://blog1.com/feed.xml",
            site="https://blog1.com",
            title="AI Research Blog",
            source_type=SourceType.BLOG,
            mediums=[Medium.TEXT],
            tags=["ai", "research"],
            topics=["artificial-intelligence"],
            curation_status=CurationStatus.VERIFIED,
        ),
        FeedSource(
            id="newsletter-1",
            feed="https://newsletter1.com/rss",
            site="https://newsletter1.com",
            title="ML Weekly Newsletter",
            source_type=SourceType.NEWSLETTER,
            mediums=[Medium.TEXT],
            tags=["ml", "weekly"],
            topics=["machine-learning"],
            curation_status=CurationStatus.VERIFIED,
        ),
        FeedSource(
            id="podcast-1",
            feed="https://podcast1.com/feed",
            site="https://podcast1.com",
            title="Data Science Podcast",
            source_type=SourceType.PODCAST,
            mediums=[Medium.AUDIO],
            tags=["data-science", "audio"],
            topics=["data-science"],
            curation_status=CurationStatus.UNVERIFIED,
        ),
    ]


@pytest.fixture
def sample_feed_item() -> FeedItem:
    """Create a sample feed item."""
    return FeedItem(
        feed_source_id="test-blog-ai",
        guid="item-123",
        title="Introduction to Neural Networks",
        link="https://example.com/neural-networks",
        published=datetime(2024, 1, 15, 10, 30, tzinfo=UTC),
        updated=datetime(2024, 1, 15, 11, 0, tzinfo=UTC),
        author="Test Author",
        description="A comprehensive introduction to neural networks",
        content="Full article content here...",
        tags=["neural-networks", "deep-learning"],
        enclosures=[],
    )


@pytest.fixture
def sample_feed_items() -> list[FeedItem]:
    """Create multiple sample feed items."""
    base_time = datetime(2024, 1, 1, 12, 0, tzinfo=UTC)
    return [
        FeedItem(
            feed_source_id="blog-1",
            guid=f"item-{i}",
            title=f"Article {i}",
            link=f"https://blog1.com/article-{i}",
            published=base_time,
            description=f"Summary of article {i}",
        )
        for i in range(5)
    ]


@pytest.fixture
def sample_topic() -> Topic:
    """Create a sample topic."""
    return Topic(
        id="artificial-intelligence",
        name="Artificial Intelligence",
        description="AI and machine learning research and applications",
        aliases=["ai", "ml"],
        parent_id=None,
    )


@pytest.fixture
def sample_fetch_log() -> FeedFetchLog:
    """Create a sample feed fetch log."""
    return FeedFetchLog(
        feed_source_id="test-blog-ai",
        fetch_url="https://example.com/feed.xml",
        fetched_at=datetime(2024, 1, 15, 12, 0, tzinfo=UTC),
        status_code=200,
        success=True,
        items_found=10,
        items_new=3,
        error_message=None,
        fetch_duration_ms=1234,
    )


# ============================================================================
# Mock Fixtures
# ============================================================================


@pytest.fixture
def mock_httpx_response():
    """Create a mock httpx response."""
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.text = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Test Feed</title>
        <link>https://example.com</link>
        <description>A test feed</description>
        <item>
            <title>Test Article</title>
            <link>https://example.com/article</link>
            <description>Test description</description>
            <pubDate>Mon, 15 Jan 2024 12:00:00 GMT</pubDate>
        </item>
    </channel>
</rss>"""
    mock_response.raise_for_status = Mock()
    return mock_response


@pytest.fixture
def mock_feedparser_result():
    """Create a mock feedparser result."""
    return {
        "feed": {
            "title": "Test Feed",
            "link": "https://example.com",
            "description": "A test feed",
        },
        "entries": [
            {
                "title": "Test Article",
                "link": "https://example.com/article",
                "summary": "Test description",
                "published_parsed": (2024, 1, 15, 12, 0, 0, 0, 15, 0),
            }
        ],
        "bozo": False,
    }


# ============================================================================
# File Fixtures
# ============================================================================


@pytest.fixture
def temp_yaml_file() -> Generator[Path]:
    """Create a temporary YAML file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        f.write(
            """feeds:
  - id: test-feed
    feed: https://example.com/feed.xml
    site: https://example.com
    title: Test Feed
    source_type: blog
    mediums:
      - text
    tags:
      - test
    topics:
      - testing
"""
        )
        temp_path = Path(f.name)
    yield temp_path
    if temp_path.exists():
        temp_path.unlink()


@pytest.fixture
def temp_opml_file() -> Generator[Path]:
    """Create a temporary OPML file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".opml", delete=False) as f:
        f.write(
            """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test Feeds</title>
    </head>
    <body>
        <outline text="Test Category" title="Test Category">
            <outline type="rss" text="Test Feed" title="Test Feed"
                     xmlUrl="https://example.com/feed.xml"
                     htmlUrl="https://example.com"/>
        </outline>
    </body>
</opml>"""
        )
        temp_path = Path(f.name)
    yield temp_path
    if temp_path.exists():
        temp_path.unlink()


# ============================================================================
# Utility Fixtures
# ============================================================================


@pytest.fixture
def sample_rss_feed() -> str:
    """Return sample RSS feed XML."""
    return """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>AI Research Blog</title>
        <link>https://ai-research.example.com</link>
        <description>Latest AI research and insights</description>
        <language>en-us</language>
        <item>
            <title>Transformer Models Explained</title>
            <link>https://ai-research.example.com/transformers</link>
            <description>Deep dive into transformer architecture</description>
            <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
            <author>researcher@example.com (AI Researcher)</author>
            <category>Deep Learning</category>
        </item>
        <item>
            <title>LLM Fine-tuning Guide</title>
            <link>https://ai-research.example.com/fine-tuning</link>
            <description>How to fine-tune large language models</description>
            <pubDate>Wed, 10 Jan 2024 14:30:00 GMT</pubDate>
            <author>researcher@example.com (AI Researcher)</author>
            <category>NLP</category>
        </item>
    </channel>
</rss>"""


@pytest.fixture
def sample_atom_feed() -> str:
    """Return sample Atom feed XML."""
    return """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <title>ML Newsletter</title>
    <link href="https://ml-newsletter.example.com"/>
    <updated>2024-01-15T10:00:00Z</updated>
    <author>
        <name>ML Team</name>
    </author>
    <id>https://ml-newsletter.example.com</id>
    <entry>
        <title>Understanding GANs</title>
        <link href="https://ml-newsletter.example.com/gans"/>
        <id>https://ml-newsletter.example.com/gans</id>
        <updated>2024-01-15T10:00:00Z</updated>
        <summary>Introduction to Generative Adversarial Networks</summary>
    </entry>
</feed>"""


# ============================================================================
# Additional Fixtures for New Tests
# ============================================================================


@pytest.fixture
def sample_feeds_data() -> dict:
    """Return sample feeds data structure."""
    return {
        "document_meta": {
            "version": "1.0",
            "title": "Test Feeds Collection",
        },
        "sources": [
            {
                "id": "feed-1",
                "title": "AI Research Blog",
                "feed": "https://ai-research.example.com/feed.xml",
                "site": "https://ai-research.example.com",
                "tags": ["ai", "research"],
                "topics": ["artificial-intelligence"],
            },
            {
                "id": "feed-2",
                "title": "ML Newsletter",
                "feed": "https://ml-news.example.com/rss",
                "site": "https://ml-news.example.com",
                "tags": ["ml", "weekly"],
                "topics": ["machine-learning"],
            },
        ],
    }


@pytest.fixture
def sample_topics_data() -> dict:
    """Return sample topics data structure."""
    return {
        "topics": [
            {
                "id": "artificial-intelligence",
                "name": "Artificial Intelligence",
                "description": "AI research and applications",
                "children": ["machine-learning", "deep-learning"],
            },
            {
                "id": "machine-learning",
                "name": "Machine Learning",
                "description": "ML algorithms and techniques",
                "parent": "artificial-intelligence",
            },
            {
                "id": "deep-learning",
                "name": "Deep Learning",
                "description": "Neural networks and DL",
                "parent": "artificial-intelligence",
            },
        ],
    }


@pytest.fixture
def sample_validation_result():
    """Return a sample ValidationResult."""
    from ai_web_feeds.validate import ValidationResult

    return ValidationResult(valid=True, errors=[])
