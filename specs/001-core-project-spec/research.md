# Phase 0 Research: Technology Decisions & Best Practices

**Feature**: AIWebFeeds - AI/ML Feed Aggregator Platform\
**Branch**: `001-core-project-spec`\
**Date**: 2025-10-22\
**Status**: Complete

## Overview

This document consolidates research findings for technology choices, implementation
patterns, and best practices for the AIWebFeeds platform. All decisions are informed by
the constitution principles, specification requirements, and clarification session
outcomes.

______________________________________________________________________

## 1. Feed Parsing Libraries

### Decision: `feedparser` + `httpx` + `tenacity`

**Rationale**:

- **feedparser** (v6.0+): Industry-standard Python library for RSS/Atom/JSON Feed
  parsing

  - Handles all major feed formats (RSS 0.90-2.0, Atom 1.0, JSON Feed 1.1)
  - Robust error handling and malformed feed tolerance
  - Active maintenance, 20+ years of production use
  - MIT license, no restrictive dependencies

- **httpx**: Modern async HTTP client for feed fetching

  - Full async/await support for concurrent validation
  - HTTP/2 support, connection pooling
  - Automatic redirect following (up to configured limit)
  - Compatible with tenacity for retry logic

- **tenacity**: Declarative retry logic with exponential backoff

  - `@retry` decorator pattern for clean code
  - Configurable wait strategies (exponential, fixed, random)
  - Exception-specific retry policies
  - Stop conditions (max attempts, timeout)

**Alternatives Considered**:

- **aiohttp** + **BeautifulSoup**: More manual parsing, less feed-specific
- **scrapy**: Overkill for simple feed fetching, steeper learning curve
- **requests**: Synchronous only, doesn't support async validation

**Implementation Pattern**:

```python
from httpx import AsyncClient
from tenacity import retry, stop_after_attempt, wait_exponential
import feedparser


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def fetch_feed(url: str, timeout: int = 30) -> dict:
    """Fetch and parse feed with retry logic."""
    async with AsyncClient() as client:
        response = await client.get(url, timeout=timeout, follow_redirects=True)
        response.raise_for_status()
        return feedparser.parse(response.text)
```

______________________________________________________________________

## 2. Topic Graph Storage

### Decision: SQLAlchemy with Self-Referential Relationships

**Rationale**:

- **SQLAlchemy 2.0 + SQLModel**: Already required for feed/validation storage
- **Self-referential many-to-many**: Clean implementation of DAG structure
- **Directed vs Symmetric**: Separate tables for different relation types
  - `topic_directed_relations` (depends_on, implements, influences)
  - `topic_symmetric_relations` (related_to, contrasts_with)
- **Cycle Detection**: Application-level validation during topic creation/update
- **Query Performance**: Indexes on parent_id, child_id, relation_type
- **Recursive Queries**: SQLAlchemy supports CTEs for ancestor/descendant traversal

**Alternatives Considered**:

- **Graph Database (Neo4j)**: Additional infrastructure, overkill for \<1000 nodes
- **Adjacency List in JSON**: No referential integrity, slow queries
- **Materialized Path**: Harder to maintain for DAG (not strict tree)

**Implementation Pattern**:

```python
from sqlmodel import SQLModel, Field, Relationship
from enum import Enum


class RelationType(str, Enum):
    DEPENDS_ON = "depends_on"
    IMPLEMENTS = "implements"
    INFLUENCES = "influences"
    RELATED_TO = "related_to"
    CONTRASTS_WITH = "contrasts_with"


class TopicRelation(SQLModel, table=True):
    """Directed or symmetric topic relationships."""

    id: int | None = Field(default=None, primary_key=True)
    source_topic_id: str = Field(foreign_key="topic.id", index=True)
    target_topic_id: str = Field(foreign_key="topic.id", index=True)
    relation_type: RelationType
    is_directed: bool = Field(default=True)  # False for symmetric relations


class Topic(SQLModel, table=True):
    """Topic taxonomy node."""

    id: str = Field(primary_key=True)  # e.g., "llm", "cv", "mlops"
    label: str
    description: str | None = None
    facet: str  # domain, task, methodology, tool, governance

    # Relations via junction table
    outgoing_relations: list["TopicRelation"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[TopicRelation.source_topic_id]"}
    )
```

**Cycle Detection**:

```python
def has_cycle(topic_id: str, target_id: str, session: Session) -> bool:
    """Check if adding edge (topic_id -> target_id) creates a cycle."""
    visited = set()

    def dfs(node_id: str) -> bool:
        if node_id in visited:
            return False
        if node_id == topic_id:
            return True  # Cycle detected
        visited.add(node_id)

        # Get all outgoing directed relations
        relations = session.exec(
            select(TopicRelation).where(
                TopicRelation.source_topic_id == node_id,
                TopicRelation.is_directed == True,
            )
        ).all()

        return any(dfs(rel.target_topic_id) for rel in relations)

    return dfs(target_id)
```

______________________________________________________________________

## 3. Observability Stack

### Decision: Loguru + Prometheus + OpenTelemetry + Grafana

**Rationale**:

- **Loguru**: Structured JSON logging with correlation IDs

  - Zero configuration, works out of the box
  - Automatic rotation, compression, retention
  - Colorized console output for development
  - JSON serialization for production

- **Prometheus**: Metrics collection and storage

  - Industry standard for time-series metrics
  - Python client library (`prometheus-client`)
  - Histogram metrics for latency (p50/p95/p99)
  - Counter metrics for requests, errors, validations

- **OpenTelemetry**: Distributed tracing

  - Vendor-neutral instrumentation
  - Automatic context propagation
  - Integration with FastAPI/Next.js
  - Export to Jaeger or compatible backends

- **Grafana**: Dashboards and alerting

  - Pre-built dashboards for common metrics
  - Custom dashboards for validation, API, feed health
  - Alert rules for SLA violations
  - Integrates with Prometheus data source

**Alternatives Considered**:

- **ELK Stack**: Heavier infrastructure, more operational complexity
- **Datadog/New Relic**: Commercial solutions, cost at scale
- **Cloud-native** (CloudWatch, Azure Monitor): Vendor lock-in

**Implementation Pattern**:

```python
from loguru import logger
import sys
from prometheus_client import Counter, Histogram, Gauge
from opentelemetry import trace
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

# Logging setup
logger.remove()  # Remove default handler
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | {message}",
    level="INFO",
)
logger.add(
    "logs/aiwebfeeds.log",
    rotation="10 MB",
    retention="30 days",
    serialize=True,  # JSON format
    level="DEBUG",
)

# Metrics
validation_counter = Counter(
    "feed_validations_total", "Total feed validations", ["status"]
)
validation_duration = Histogram(
    "feed_validation_duration_seconds", "Validation duration"
)
active_feeds = Gauge("active_feeds_total", "Total active feeds")

# Tracing
tracer = trace.get_tracer(__name__)
HTTPXClientInstrumentor().instrument()  # Auto-instrument httpx


@tracer.start_as_current_span("validate_feed")
def validate_feed(feed_url: str):
    with validation_duration.time():
        try:
            result = fetch_and_parse(feed_url)
            validation_counter.labels(status="success").inc()
            return result
        except Exception as e:
            validation_counter.labels(status="failure").inc()
            logger.error(f"Validation failed for {feed_url}: {e}")
            raise
```

**Deployment Configuration**:

- Prometheus scrapes metrics endpoint: `/metrics`
- Grafana connects to Prometheus data source
- OpenTelemetry exports to Jaeger (development) or cloud collector (production)
- Log aggregation: Loki (optional) or cloud logging service

______________________________________________________________________

## 4. Contribution Workflow

### Decision: GitHub PR + Automated Validation + Manual Review Queue

**Rationale**:

- **GitHub PRs**: Standard open-source contribution model

  - Fork-and-PR workflow for external contributors
  - Branch protection rules on `main`
  - Required checks before merge

- **Automated Validation**: GitHub Actions workflow

  - Feed accessibility check (HTTP status 200)
  - Format validation (RSS/Atom/JSON Feed parseable)
  - Duplicate detection (URL canonicalization + matching)
  - JSON schema validation
  - PR comment with validation results

- **Manual Review Queue**: Curator interface

  - Web UI at `/curator/pending` (authenticated)
  - Shows pending feeds with validation results
  - One-click approve/reject with optional feedback
  - Approval commits directly to main branch

- **Submission Status Tracking**: Database table

  - `contribution_submissions` table with status (pending, approved, rejected)
  - Contributor can check status via CLI or web UI
  - Email notification on status change (optional)

**Implementation Pattern**:

**GitHub Actions** (`.github/workflows/validate-contribution.yml`):

```yaml
name: Validate Feed Contribution

on:
  pull_request:
    paths:
      - 'data/feeds.yaml'
      - 'data/topics.yaml'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      
      - name: Install uv
        run: pip install uv
      
      - name: Install dependencies
        run: uv sync
      
      - name: Validate feeds
        run: |
          uv run aiwebfeeds validate all --format json > validation-results.json
      
      - name: Post results as comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('validation-results.json'));
            const body = `## Validation Results\n\n${formatResults(results)}`;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.name,
              body: body
            });
```

**Review Queue Interface** (Next.js API route):

```typescript
// app/api/curator/pending/route.ts
import { getSession } from '@/lib/auth';  // Authentication
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session || !session.user.isCurator) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const pending = await db.contribution.findMany({
    where: { status: 'pending' },
    include: { validationResult: true }
  });
  
  return Response.json(pending);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session || !session.user.isCurator) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const { contributionId, action, feedback } = await request.json();
  
  if (action === 'approve') {
    // Commit to main branch via GitHub API
    await approveContribution(contributionId);
  } else if (action === 'reject') {
    await rejectContribution(contributionId, feedback);
  }
  
  return Response.json({ success: true });
}
```

______________________________________________________________________

## 5. OPML Generation

### Decision: Custom OPML 2.0 Builder with XML Escaping

**Rationale**:

- **xml.etree.ElementTree**: Python standard library for XML generation

  - Built-in proper escaping (prevents XML injection)
  - OPML 2.0 compliance (validate against spec)
  - Hierarchical structure support (nested <outline> elements)

- **Validation**: xmlschema library for OPML 2.0 schema validation

  - Ensures generated OPML is spec-compliant
  - Catches structure errors before export

- **Formats**: Three OPML types as specified

  - **All feeds**: Flat list, single folder
  - **Categorized**: Grouped by source type (blog, podcast, newsletter, etc.)
  - **Filtered**: Topic-based, verification status, custom criteria

**Implementation Pattern**:

```python
import xml.etree.ElementTree as ET
from datetime import datetime, UTC


def generate_opml(feeds: list[FeedSource], title: str = "AI Web Feeds") -> str:
    """Generate OPML 2.0 XML for feed collection."""
    opml = ET.Element("opml", version="2.0")

    # Head section
    head = ET.SubElement(opml, "head")
    ET.SubElement(head, "title").text = title
    ET.SubElement(head, "dateCreated").text = datetime.now(UTC).strftime(
        "%a, %d %b %Y %H:%M:%S GMT"
    )
    ET.SubElement(head, "ownerName").text = "AIWebFeeds"
    ET.SubElement(head, "docs").text = "http://opml.org/spec2.opml"

    # Body section
    body = ET.SubElement(opml, "body")

    for feed in feeds:
        outline = ET.SubElement(
            body,
            "outline",
            type="rss",
            text=feed.title,
            title=feed.title,
            xmlUrl=feed.url,
            htmlUrl=feed.site,
        )

        # Add optional attributes
        if feed.topics:
            outline.set("category", ",".join(feed.topics))

    # Pretty print with proper indentation
    ET.indent(opml, space="  ")
    return ET.tostring(opml, encoding="unicode", xml_declaration=True)


def generate_categorized_opml(feeds: list[FeedSource], title: str) -> str:
    """Generate OPML with nested folders by source type."""
    opml = ET.Element("opml", version="2.0")
    head = ET.SubElement(opml, "head")
    ET.SubElement(head, "title").text = title

    body = ET.SubElement(opml, "body")

    # Group feeds by source type
    from collections import defaultdict

    by_type = defaultdict(list)
    for feed in feeds:
        by_type[feed.source_type].append(feed)

    # Create folder for each source type
    for source_type, type_feeds in sorted(by_type.items()):
        folder = ET.SubElement(
            body, "outline", text=source_type.title(), title=source_type.title()
        )

        for feed in type_feeds:
            ET.SubElement(
                folder,
                "outline",
                type="rss",
                text=feed.title,
                title=feed.title,
                xmlUrl=feed.url,
                htmlUrl=feed.site,
            )

    ET.indent(opml, space="  ")
    return ET.tostring(opml, encoding="unicode", xml_declaration=True)
```

**OPML 2.0 Compliance Checklist**:

- ✅ XML declaration: `<?xml version="1.0" encoding="UTF-8"?>`
- ✅ Root `<opml version="2.0">` element
- ✅ `<head>` with title, dateCreated, ownerName, docs
- ✅ `<body>` containing `<outline>` elements
- ✅ Required attributes: type, text, title, xmlUrl
- ✅ Proper XML escaping (quotes, ampersands, angle brackets)
- ✅ Valid UTF-8 encoding
- ✅ Well-formed XML (balanced tags, no invalid characters)

______________________________________________________________________

## 6. FumaDocs Integration

### Decision: Python Generates JSON Assets → Next.js Build Consumes

**Rationale**:

- **Build-Time Integration**: Python CLI generates JSON files, Next.js imports during
  build

  - `data/feeds.json`: Complete feed collection with metadata
  - `data/topics.json`: Topic taxonomy with relationships
  - `data/stats.json`: Collection statistics and health metrics

- **FumaDocs Content**: `.mdx` files in `apps/web/content/docs/`

  - Auto-generated API reference from JSON schemas
  - Manual documentation for features, guides, tutorials
  - `meta.json` defines navigation structure

- **Dynamic Routes**: Next.js API routes serve JSON for explorer

  - `/api/feeds` → paginated feed list
  - `/api/topics` → topic graph data
  - `/api/feeds/[id]` → single feed details

- **Build Process**: Vercel/GitHub Actions

  1. Run `uv run aiwebfeeds export all` (generates JSON/OPML)
  1. Run `pnpm build` in `apps/web/` (Next.js build consumes JSON)
  1. Deploy static site + API routes

**Implementation Pattern**:

**Python Asset Generation**:

```python
# packages/ai_web_feeds/src/ai_web_feeds/export.py
import json
from pathlib import Path


def export_to_json(feeds: list[FeedSource], output_path: Path):
    """Export feed collection to JSON for Next.js consumption."""
    data = {
        "feeds": [
            {
                "id": feed.id,
                "url": feed.url,
                "site": feed.site,
                "title": feed.title,
                "topics": feed.topics,
                "sourceType": feed.source_type,
                "verified": feed.verified,
                "lastValidated": (
                    feed.last_validated.isoformat() if feed.last_validated else None
                ),
            }
            for feed in feeds
        ],
        "meta": {
            "totalFeeds": len(feeds),
            "generated": datetime.now(UTC).isoformat(),
            "version": "1.0.0",
        },
    }

    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


# CLI command
@app.command()
def export(output_dir: Path = Path("data/")):
    """Export all data formats for web consumption."""
    feeds = load_feeds()
    topics = load_topics()

    export_to_json(feeds, output_dir / "feeds.json")
    export_topics_to_json(topics, output_dir / "topics.json")
    export_stats(feeds, output_dir / "stats.json")
```

**Next.js Consumption**:

```typescript
// app/explorer/page.tsx
import feedsData from '@/../../data/feeds.json';
import topicsData from '@/../../data/topics.json';

export default function ExplorerPage() {
  // feedsData and topicsData are statically imported at build time
  return (
    <div>
      <FeedExplorer feeds={feedsData.feeds} topics={topicsData.topics} />
    </div>
  );
}
```

**Build Script** (`package.json`):

```json
{
  "scripts": {
    "prebuild": "cd ../.. && uv run aiwebfeeds export all",
    "build": "next build",
    "dev": "next dev"
  }
}
```

**CI/CD** (`.github/workflows/deploy.yml`):

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python & uv
        run: pip install uv
      
      - name: Generate data assets
        run: |
          uv sync
          uv run aiwebfeeds export all
      
      - name: Set up Node.js & pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Build Next.js site
        run: |
          cd apps/web
          pnpm install
          pnpm build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

______________________________________________________________________

## 7. Testing Strategy

### Decision: pytest + Hypothesis + pytest-asyncio + Coverage.py

**Rationale**:

- **pytest**: Industry-standard Python testing framework

  - Fixtures for dependency injection
  - Parametrization for test data permutations
  - Markers for test organization (unit, integration, e2e)
  - Rich assertion introspection

- **Hypothesis**: Property-based testing for edge cases

  - Generate random test data within constraints
  - Discovers edge cases humans miss
  - Shrinks failing examples to minimal cases
  - Example: Test feed URL parsing with arbitrary URLs

- **pytest-asyncio**: Async test support

  - `@pytest.mark.asyncio` decorator
  - Fixtures can be async
  - Essential for testing async feed fetching

- **pytest-cov**: Coverage reporting

  - Integration with coverage.py
  - HTML reports for visualization
  - Branch coverage tracking
  - Fail on coverage < 90%

**Test Organization**:

```
tests/
├── conftest.py                    # Global fixtures
├── pytest.ini                     # Configuration
└── tests/
    ├── packages/ai_web_feeds/
    │   ├── unit/                  # Unit tests (mirror source structure)
    │   │   ├── test_models.py
    │   │   ├── test_storage.py
    │   │   ├── test_validate.py
    │   │   ├── test_export.py
    │   │   └── test_enrich.py
    │   ├── integration/           # Integration tests
    │   │   ├── test_validation_workflow.py
    │   │   └── test_export_workflow.py
    │   └── e2e/                   # End-to-end tests
    │       └── test_complete_workflows.py
    └── cli/
        ├── unit/
        └── integration/
```

**Implementation Patterns**:

**Unit Test with Mocks**:

```python
import pytest
from unittest.mock import AsyncMock, Mock
from ai_web_feeds.validate import validate_feed


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validate_feed_success(mocker):
    """Test successful feed validation."""
    # Arrange
    mock_httpx = mocker.patch("ai_web_feeds.validate.httpx.AsyncClient")
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.text = "<rss version='2.0'><channel></channel></rss>"
    mock_httpx.return_value.__aenter__.return_value.get = AsyncMock(
        return_value=mock_response
    )

    # Act
    result = await validate_feed("https://example.com/feed.xml")

    # Assert
    assert result.success is True
    assert result.status_code == 200
```

**Property-Based Test with Hypothesis**:

```python
from hypothesis import given, strategies as st
from ai_web_feeds.utils import canonicalize_url


@pytest.mark.unit
@given(st.text(min_size=1, max_size=200))
def test_canonicalize_url_deterministic(url_string):
    """Property: URL canonicalization is deterministic."""
    try:
        result1 = canonicalize_url(url_string)
        result2 = canonicalize_url(url_string)
        assert result1 == result2
    except ValueError:
        # Invalid URLs should consistently raise ValueError
        with pytest.raises(ValueError):
            canonicalize_url(url_string)


@pytest.mark.unit
@given(
    scheme=st.sampled_from(["http", "https"]),
    domain=st.from_regex(r"[a-z0-9-]+\.[a-z]{2,}", fullmatch=True),
    path=st.text(alphabet=st.characters(categories=["Lu", "Ll", "Nd"]), max_size=50),
)
def test_canonicalize_url_properties(scheme, domain, path):
    """Property: Canonicalized URLs are lowercase and scheme-normalized."""
    url = f"{scheme}://{domain}/{path}"
    canonical = canonicalize_url(url)

    assert canonical.startswith(("http://", "https://"))
    assert canonical.islower() or not canonical.isalpha()  # Lowercase letters
```

**Integration Test with Test Database**:

```python
import pytest
from sqlmodel import Session, create_engine, SQLModel
from ai_web_feeds.storage import FeedStorage
from ai_web_feeds.models import FeedSource


@pytest.fixture
def test_db(tmp_path):
    """Provide temporary test database."""
    db_path = tmp_path / "test.db"
    database_url = f"sqlite:///{db_path}"
    engine = create_engine(database_url)
    SQLModel.metadata.create_all(engine)
    yield database_url
    db_path.unlink(missing_ok=True)


@pytest.mark.integration
def test_feed_storage_workflow(test_db):
    """Test complete feed storage workflow."""
    storage = FeedStorage(database_url=test_db)

    # Add feed
    feed = FeedSource(
        id="test-feed",
        url="https://example.com/feed.xml",
        title="Test Feed",
        topics=["test"],
    )
    saved = storage.add_feed(feed)
    assert saved.id is not None

    # Retrieve feed
    retrieved = storage.get_feed("test-feed")
    assert retrieved.title == "Test Feed"

    # Update feed
    retrieved.title = "Updated Feed"
    storage.update_feed(retrieved)

    # Verify update
    updated = storage.get_feed("test-feed")
    assert updated.title == "Updated Feed"
```

**pytest Configuration** (`pytest.ini`):

```ini
[pytest]
minversion = 8.0
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    --strict-markers
    --cov=ai_web_feeds
    --cov-report=term-missing
    --cov-report=html:tests/reports/coverage
    --cov-report=json:tests/reports/coverage.json
    --cov-fail-under=90
    -ra
    -vv
markers =
    unit: Unit tests (mock external boundaries)
    integration: Integration tests (real dependencies)
    e2e: End-to-end tests (complete workflows)
    slow: Slow running tests
```

______________________________________________________________________

## 8. Configuration Management

### Decision: pydantic-settings

**Rationale**:

- **pydantic-settings**: Official Pydantic extension for settings management
  - Type-safe configuration with Pydantic v2 models
  - Automatic environment variable loading with .env support
  - Validation of configuration values at startup
  - Nested settings support for complex configurations
  - IDE autocomplete for settings attributes
  - Seamless integration with existing Pydantic models

**Alternatives Considered**:

- **python-decouple**: Simpler but no type validation
- **dynaconf**: More features but heavier dependency
- **configparser**: Standard library but no type safety

**Implementation Pattern**:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, HttpUrl


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_prefix="AIWEBFEEDS_",
    )

    # Database
    database_url: str = Field(
        default="sqlite:///data/aiwebfeeds.db", description="Database connection URL"
    )

    # Feed validation
    validation_timeout: int = Field(default=30, ge=5, le=120)
    validation_max_retries: int = Field(default=3, ge=1, le=10)
    validation_concurrency: int = Field(default=10, ge=1, le=50)

    # API
    api_rate_limit: int = Field(default=1000, ge=100)
    api_base_url: HttpUrl = Field(default="https://aiwebfeeds.com")

    # Logging
    log_level: str = Field(
        default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$"
    )
    log_json: bool = Field(default=False, description="JSON logging for production")

    # Features
    enable_enrichment: bool = Field(default=True)
    enable_contributions: bool = Field(default=True)


# Usage
settings = Settings()  # Loads from .env and environment variables
print(f"Database: {settings.database_url}")
print(f"Timeout: {settings.validation_timeout}s")
```

**Environment Variables** (`.env` example):

```bash
# Database
AIWEBFEEDS_DATABASE_URL=postgresql://user:pass@localhost/aiwebfeeds

# Validation
AIWEBFEEDS_VALIDATION_TIMEOUT=60
AIWEBFEEDS_VALIDATION_CONCURRENCY=20

# API
AIWEBFEEDS_API_RATE_LIMIT=5000

# Logging
AIWEBFEEDS_LOG_LEVEL=DEBUG
AIWEBFEEDS_LOG_JSON=true
```

______________________________________________________________________

## 9. Progress Indication

### Decision: tqdm

**Rationale**:

- **tqdm**: Industry-standard progress bar library
  - Fast, extensible, minimal overhead
  - Works with async iterators (tqdm.asyncio)
  - Automatic rate and ETA calculation
  - Supports nested progress bars
  - Rich formatting options (color, units, descriptions)
  - Logging-friendly (no interference with Loguru)
  - Jupyter notebook support (bonus)

**Alternatives Considered**:

- **rich.progress**: Beautiful but heavier dependency
- **progressbar2**: Less maintained, clunkier API
- **click.progressbar**: CLI-focused, less flexible

**Implementation Pattern**:

```python
from tqdm import tqdm
from tqdm.asyncio import tqdm as atqdm
import asyncio


# Synchronous iteration
def load_feeds(feed_urls: list[str]) -> list[FeedSource]:
    """Load feeds with progress bar."""
    feeds = []
    for url in tqdm(feed_urls, desc="Loading feeds", unit="feed"):
        feed = load_feed(url)
        feeds.append(feed)
    return feeds


# Async iteration with concurrent validation
async def validate_feeds(feeds: list[FeedSource]) -> list[ValidationResult]:
    """Validate feeds concurrently with progress bar."""
    results = []

    async with atqdm(total=len(feeds), desc="Validating feeds", unit="feed") as pbar:

        async def validate_with_progress(feed: FeedSource):
            result = await validate_feed(feed)
            pbar.update(1)
            return result

        # Validate with concurrency limit
        semaphore = asyncio.Semaphore(10)

        async def bounded_validate(feed):
            async with semaphore:
                return await validate_with_progress(feed)

        results = await asyncio.gather(*[bounded_validate(f) for f in feeds])

    return results


# Nested progress bars for complex operations
def process_all_feeds():
    """Process feeds with nested progress tracking."""
    categories = ["blog", "podcast", "newsletter", "preprint"]

    with tqdm(
        total=len(categories), desc="Processing categories", position=0
    ) as category_bar:
        for category in categories:
            feeds = get_feeds_by_category(category)

            with tqdm(
                total=len(feeds), desc=f"  {category.title()}", position=1, leave=False
            ) as feed_bar:
                for feed in feeds:
                    process_feed(feed)
                    feed_bar.update(1)

            category_bar.update(1)


# Progress with custom formatting
def export_opml_with_progress(feeds: list[FeedSource], output_path: Path):
    """Export OPML with detailed progress."""
    with tqdm(
        feeds,
        desc="Generating OPML",
        unit="feed",
        unit_scale=True,
        colour="green",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
    ) as pbar:
        opml_entries = []
        for feed in pbar:
            pbar.set_postfix_str(f"Processing: {feed.title[:30]}")
            entry = feed_to_opml_entry(feed)
            opml_entries.append(entry)

        write_opml(opml_entries, output_path)
```

**CLI Integration** (with Typer):

```python
import typer
from tqdm import tqdm


@app.command()
def validate(
    all_feeds: bool = typer.Option(False, "--all", help="Validate all feeds"),
    show_progress: bool = typer.Option(True, help="Show progress bar"),
):
    """Validate feeds with optional progress tracking."""
    feeds = load_all_feeds() if all_feeds else load_active_feeds()

    if show_progress:
        results = []
        for feed in tqdm(feeds, desc="Validating", unit="feed"):
            result = validate_feed_sync(feed)
            results.append(result)
    else:
        # Silent validation for scripting
        results = [validate_feed_sync(f) for f in feeds]

    # Display summary
    success_count = sum(1 for r in results if r.success)
    typer.echo(f"✓ Validated {len(results)} feeds: {success_count} successful")
```

______________________________________________________________________

## Summary of Decisions

| Area              | Decision                                         | Key Reason                                           |
| ----------------- | ------------------------------------------------ | ---------------------------------------------------- |
| **Feed Parsing**  | feedparser + httpx + tenacity                    | Industry standard, async support, robust retry       |
| **Topic Graph**   | SQLAlchemy self-referential                      | Leverages existing ORM, clean DAG implementation     |
| **Observability** | Loguru + Prometheus + OpenTelemetry + Grafana    | Full stack (logs, metrics, traces, dashboards)       |
| **Contributions** | GitHub PR + automated validation + manual review | Standard OSS workflow with quality control           |
| **OPML**          | Custom builder with xml.etree                    | OPML 2.0 compliance, proper escaping                 |
| **FumaDocs**      | Python generates JSON → Next.js consumes         | Build-time integration, static optimization          |
| **Testing**       | pytest + Hypothesis + asyncio + coverage         | 90%+ coverage, property-based edge cases             |
| **Configuration** | pydantic-settings                                | Type-safe config with env vars, Pydantic integration |
| **Progress Bars** | tqdm                                             | Fast, async-compatible, nested progress support      |

______________________________________________________________________

## Next Steps

With research complete, proceed to **Phase 1: Design Artifacts**:

1. `data-model.md`: Entity schemas, relationships, validation rules
1. `contracts/`: OpenAPI spec, JSON schemas
1. `quickstart.md`: Setup guide, development workflow

______________________________________________________________________

*Research Version*: 1.0.0 | *Completed*: 2025-10-22
