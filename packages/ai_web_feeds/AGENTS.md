# Core Package - Agent Instructions

> **Component**: `ai_web_feeds` - Core Python library for feed management  
> **Location**: `packages/ai_web_feeds/`  
> **Parent**: [Root AGENTS.md](../../AGENTS.md)

## ⚠️ CRITICAL: Documentation Policy - READ THIS FIRST!

**🚫 ABSOLUTE RULE: NO `.md` FILES IN THIS PACKAGE FOR DOCUMENTATION**

**If you need to document ANYTHING about this package:**

1. ✅ Create `.mdx` file in `../../apps/web/content/docs/`
   - Database docs → `apps/web/content/docs/development/database.mdx`
   - API guides → `apps/web/content/docs/guides/api-usage.mdx`
   - Architecture → `apps/web/content/docs/development/architecture.mdx`
   - Features → `apps/web/content/docs/features/*.mdx`
2. ✅ Add frontmatter: `title` and `description`
3. ✅ Update `../../apps/web/content/docs/meta.json`
4. ❌ NEVER create `.md` files here - EVER!

**❌ FORBIDDEN FILES IN THIS PACKAGE:**
```
❌ packages/ai_web_feeds/DATABASE.md
❌ packages/ai_web_feeds/GUIDE.md
❌ packages/ai_web_feeds/QUICKSTART.md
❌ packages/ai_web_feeds/ARCHITECTURE.md
❌ packages/ai_web_feeds/API_REFERENCE.md
❌ packages/ai_web_feeds/SIMPLIFIED_ARCHITECTURE.md
❌ packages/ai_web_feeds/DEVELOPMENT.md
❌ ANY other .md file except AGENTS.md
```

**✅ ONLY ALLOWED IN THIS PACKAGE:**
- Python source code: `src/ai_web_feeds/*.py`
- Configuration: `pyproject.toml`, `.python-version`
- This file: `AGENTS.md`
- Tests: `../../tests/packages/ai_web_feeds/`

**NO EXCEPTIONS - NO TEMPORARY DOCS - NO SUPPLEMENTARY .md FILES!**

## 📍 Essential Links

- **Full Documentation**: [llms-full.txt#core-package](https://aiwebfeeds.com/llms-full.txt#core-package)
- **Root Instructions**: [../../AGENTS.md](../../AGENTS.md)
- **Testing Guide**: [../../tests/AGENTS.md](../../tests/AGENTS.md)
- **Contributing**: [../../CONTRIBUTING.md](../../CONTRIBUTING.md)

---

## 🎯 Purpose

Core library providing:
- **Fetching**: HTTP client with retry logic (`fetcher.py`)
- **Parsing**: RSS/Atom XML processing (`feedparser`)
- **Storage**: SQLAlchemy ORM + migrations (`storage.py`, `models.py`)
- **Analytics**: Feed metrics and insights (`analytics.py`)
- **Topics**: Topic taxonomy management with graph structure (`topics.yaml`)
- **Enrichment**: AI-powered feed metadata enhancement (`feeds.enriched.yaml`)
- **Config**: Environment-based settings (`config.py`)
- **Logging**: Structured logging (`logger.py`)

**Stack**: Python 3.13+, uv, SQLAlchemy 2.0, Pydantic v2, httpx, Loguru

**Data**: YAML/JSON feeds, topic graphs, JSON Schema validation, SQLite cache

---

## 🏗️ Architecture

```
src/ai_web_feeds/
├── __init__.py       # Public API exports
├── config.py         # Settings (Pydantic) ✅ test_config.py
├── enrich.py         # Feed enrichment & AI metadata ✅ test_enrich.py
├── export.py         # JSON/OPML export ✅ test_export.py
├── load.py           # YAML load/save operations ✅ test_load.py
├── logger.py         # Logging setup ✅ test_logger.py
├── models.py         # ORM models (SQLModel) ✅ test_models.py
├── storage.py        # Database operations ✅ test_storage.py
├── utils.py          # Helper functions ✅ test_utils.py
└── validate.py       # JSON schema validation ✅ test_validate.py
```

**Testing**: All core modules have comprehensive test coverage in `../../tests/tests/packages/ai_web_feeds/unit/`

**Recent Updates (October 2025)**:
- ✅ Complete test synchronization across all modules
- ✅ New modules: `load.py`, `validate.py`, `export.py`, `enrich.py`
- ✅ 100% module coverage with 1,600+ lines of test code

**See**: [llms-full.txt](https://aiwebfeeds.com/llms-full.txt) for detailed module documentation

---

## 📐 Development Rules

### 1. Type Safety
```python
# ✅ Always include type hints
def fetch_feed(url: str, timeout: int = 30) -> Optional[Feed]:
    ...

# ❌ Never omit types
def fetch_feed(url, timeout=30):
    ...
```

### 2. Pydantic Models
```python
# Use for validation, not just ORM
class FeedMetadata(BaseModel):
    title: str
    url: HttpUrl  # Validated URL
    updated: datetime
```

### 3. Error Handling
```python
# Use tenacity for retries
@retry(stop=stop_after_attempt(3), wait=wait_exponential())
async def fetch_with_retry(url: str) -> bytes:
    ...
```

### 4. Database Patterns
```python
# Use context managers
with get_session() as session:
    feed = session.get(Feed, feed_id)
    ...
```

---

## 🧪 Testing Requirements

- **Coverage**: ≥90% for all modules
- **Fixtures**: Use `conftest.py` for shared setups
- **Isolation**: Mock HTTP calls, use temporary DBs
- **See**: [../../tests/AGENTS.md](../../tests/AGENTS.md)

```bash
# Run core package tests
cd ../../tests && uv run pytest tests/packages/ai_web_feeds/ -v --cov=ai_web_feeds
```

---

## 🔄 Common Tasks

### Adding a New Model
1. Define in `models.py` (SQLModel + Pydantic)
2. Create migration: `alembic revision --autogenerate -m "add_model"`
3. Add tests in `tests/packages/ai_web_feeds/test_models.py`
4. **REQUIRED**: Create/update `.mdx` in `apps/web/content/docs/development/` and update `meta.json`
5. **FORBIDDEN**: Do NOT create `.md` files like `DATABASE.md` or `MODELS.md`

### Adding a New Fetcher Method
1. Add to `fetcher.py` with type hints
2. Add retry logic via `@retry` decorator
3. Write unit tests with mocked HTTP
4. **REQUIRED**: Document in `apps/web/content/docs/` as `.mdx` (not standalone `.md`)

### Modifying Database Schema
1. Edit model in `models.py`
2. Generate migration: `alembic revision --autogenerate`
3. Review migration in `alembic/versions/`
4. Test migration up/down
5. Update seed data in `data/`

---

## 🚨 Critical Patterns

### DO
✅ Use type hints everywhere  
✅ Validate inputs with Pydantic  
✅ Use context managers for DB sessions  
✅ Log errors with structured data (Loguru)  
✅ Add docstrings (Google style)  
✅ Write tests before implementation (TDD)
✅ **Update web docs** at `apps/web/content/docs/*.mdx` with navigation in `meta.json`

### DON'T
❌ Commit without tests  
❌ Skip type hints  
❌ Use bare `except:` clauses  
❌ Leave TODO comments without issues  
❌ Modify DB schema without migrations  
❌ Import from `src/` (use package name)
❌ **NEVER create standalone `.md` files** for documentation (use web docs `.mdx` only)

---

## 📚 Reference

**Full implementation details**: [llms-full.txt](https://aiwebfeeds.com/llms-full.txt#core-package)  
**Testing patterns**: [../../tests/AGENTS.md](../../tests/AGENTS.md)  
**Root workflow**: [../../AGENTS.md](../../AGENTS.md#standard-workflow)

---

## 📊 Data Management

### Topic Taxonomy (`data/topics.yaml`)

**Purpose**: Graph-structured topic taxonomy for feed categorization and semantic search.

**Structure**:
- **Topics**: ID, label, facet, description, aliases
- **Relations**: Graph edges (depends_on, implements, influences, related_to, contrasts_with)
- **Facets**: Grouping by type (domain, task, methodology, governance, operational, etc.)
- **Mappings**: External identifiers (Wikidata, ArXiv, HuggingFace, Schema.org)

**Schema**: `data/topics.schema.json`

**Example Topic**:

```yaml
- id: llm
  label: Large Language Models
  facet: task
  facet_group: conceptual
  parents: [genai, nlp]
  relations:
    depends_on: [training, data, compilers]
    influences: [product, education]
    related_to: [agents, evaluation, inference]
  rank_hint: 0.99
  tags: [embed:title,summary,content]
  mappings:
    wikidata: Q124351267
```

### Enriched Feeds (`data/feeds.enriched.yaml`)

**Purpose**: AI-enhanced feed metadata with topics, embeddings, and categorization.

**Schema**: `data/feeds.enriched.schema.json`

**Key Fields**:
- `inferred_topics`: Auto-assigned topics from taxonomy
- `enrichment_metadata`: AI model version, confidence scores
- `semantic_embeddings`: Vector representations for similarity search

---

*Updated: October 15, 2025 · Version: 0.1.0*

**Example Implementation**:

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from loguru import logger


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
async def fetch_feed(
    url: str,
    timeout: int = 30,
    headers: Optional[dict[str, str]] = None
) -> httpx.Response:
    """Fetch feed with retry logic and timeout handling.
    
    Args:
        url: Feed URL to fetch
        timeout: Request timeout in seconds
        headers: Optional HTTP headers
        
    Returns:
        HTTP response object
        
    Raises:
        httpx.HTTPError: On request failure after retries
        httpx.TimeoutException: On timeout after retries
    """
    default_headers = {
        "User-Agent": "AIWebFeeds/0.1.0",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"
    }
    if headers:
        default_headers.update(headers)
    
    logger.debug(f"Fetching feed from {url}")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            timeout=timeout,
            headers=default_headers,
            follow_redirects=True
        )
        response.raise_for_status()
        
    logger.info(f"Successfully fetched feed from {url}")
    return response
```

---

### `models.py` - Data Models

**Purpose**: Type-safe data structures using Pydantic and SQLModel

**Best Practices**:
- Use `Optional` for nullable fields
- Add `Field(index=True)` for frequently queried columns
- Implement validators for data integrity
- Use `datetime` for timestamps (UTC)
- Keep models focused and single-purpose

**Example Models**:

```python
from sqlmodel import SQLModel, Field
from pydantic import HttpUrl, validator
from datetime import datetime
from typing import Optional


class Feed(SQLModel, table=True):
    """RSS/Atom feed database model."""
    
    id: Optional[int] = Field(default=None, primary_key=True)
    url: str = Field(index=True, unique=True)
    title: Optional[str] = None
    description: Optional[str] = None
    last_fetched: Optional[datetime] = None
    last_modified: Optional[str] = None
    etag: Optional[str] = None
    is_active: bool = Field(default=True)
    
    @validator('url')
    def validate_url(cls, v: str) -> str:
        """Ensure URL is valid and normalized."""
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        return v.lower().strip()


class FeedItem(SQLModel, table=True):
    """Individual feed entry/article."""
    
    id: Optional[int] = Field(default=None, primary_key=True)
    feed_id: int = Field(foreign_key="feed.id", index=True)
    title: Optional[str] = None
    link: Optional[str] = None
    published: Optional[datetime] = None
    content: Optional[str] = None
    author: Optional[str] = None
    guid: str = Field(unique=True, index=True)
```

---

### `storage.py` - Database Layer

**Purpose**: SQLAlchemy session management and CRUD operations

**Key Patterns**:
- Use context managers for session handling
- Always commit within session context
- Refresh objects after commit to get DB-assigned values
- Use `select()` for type-safe queries
- Handle `IntegrityError` for unique constraints

**Example Implementation**:

```python
from sqlmodel import Session, create_engine, select
from sqlalchemy.exc import IntegrityError
from typing import Optional
from loguru import logger


class FeedStorage:
    """Database operations for feed management."""
    
    def __init__(self, database_url: str = "sqlite:///data/aiwebfeeds.db"):
        """Initialize storage with database connection."""
        self.engine = create_engine(
            database_url,
            echo=False,
            connect_args={"check_same_thread": False}
        )
        SQLModel.metadata.create_all(self.engine)
        logger.info(f"Database initialized: {database_url}")
    
    def add_feed(self, feed: Feed) -> Optional[Feed]:
        """Add a new feed to database.
        
        Returns:
            Feed with database-assigned ID, or None if already exists
        """
        try:
            with Session(self.engine) as session:
                session.add(feed)
                session.commit()
                session.refresh(feed)
                logger.info(f"Added feed: {feed.url}")
                return feed
        except IntegrityError:
            logger.warning(f"Feed already exists: {feed.url}")
            return None
    
    def get_all_feeds(self, active_only: bool = True) -> list[Feed]:
        """Retrieve all feeds."""
        with Session(self.engine) as session:
            statement = select(Feed)
            if active_only:
                statement = statement.where(Feed.is_active == True)
            feeds = session.exec(statement).all()
            logger.debug(f"Retrieved {len(feeds)} feeds")
            return feeds
```

---

### `analytics.py` - Feed Analytics

**Purpose**: Statistical analysis and metrics calculation

**Example Implementation**:

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from collections import Counter


@dataclass
class FeedStats:
    """Feed statistics container."""
    
    total_feeds: int
    active_feeds: int
    total_items: int
    items_per_feed: float
    most_recent_update: Optional[datetime]
    most_active_feeds: list[tuple[str, int]]


class FeedAnalytics:
    """Analytics engine for feed data."""
    
    def __init__(self, storage: FeedStorage):
        self.storage = storage
    
    def calculate_stats(self) -> FeedStats:
        """Calculate comprehensive feed statistics."""
        feeds = self.storage.get_all_feeds(active_only=False)
        active = [f for f in feeds if f.is_active]
        
        # Calculate metrics
        return FeedStats(
            total_feeds=len(feeds),
            active_feeds=len(active),
            total_items=0,  # Calculate from FeedItem table
            items_per_feed=0.0,
            most_recent_update=None,
            most_active_feeds=[]
        )
```

---

### `config.py` - Configuration Management

**Purpose**: Environment-based configuration with Pydantic Settings

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    """Application configuration."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Database
    database_url: str = "sqlite:///data/aiwebfeeds.db"
    
    # Logging
    log_level: str = "INFO"
    
    # Fetching
    fetch_timeout: int = 30
    max_retries: int = 3
    user_agent: str = "AIWebFeeds/0.1.0"
    
    # Paths
    data_dir: Path = Path("data")


settings = Settings()
```

---

### `logger.py` - Logging Configuration

**Purpose**: Structured logging with Loguru

```python
from loguru import logger
import sys
from ai_web_feeds.config import settings


def configure_logger() -> None:
    """Configure application logger."""
    logger.remove()
    
    logger.add(
        sys.stderr,
        level=settings.log_level,
        colorize=True,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | {message}"
    )
    
    logger.add(
        settings.data_dir / "logs" / "aiwebfeeds.log",
        rotation="10 MB",
        retention="5 files",
        level="DEBUG"
    )


configure_logger()
```

---

## 🛠️ Development Guidelines

### Code Quality Checklist

- [ ] All functions have type hints
- [ ] All public functions have docstrings (Google style)
- [ ] Imports are sorted (via Ruff)
- [ ] Code is formatted (via Ruff)
- [ ] No linting errors (`uv run ruff check`)
- [ ] Type checking passes (`uv run mypy`)
- [ ] Tests achieve ≥90% coverage
- [ ] Tests pass (`cd tests && uv run pytest`)

### Running Quality Checks

```bash
# From package directory
cd packages/ai_web_feeds

# Linting & formatting
uv run ruff check src/
uv run ruff format src/

# Type checking
uv run mypy src/

# From tests directory
cd ../../tests
uv run pytest tests/packages/ai_web_feeds/ --cov=ai_web_feeds
```

---

## 🧪 Testing Requirements

### Test Organization

```
tests/tests/packages/ai_web_feeds/
├── unit/                          # Unit tests (isolated)
│   ├── test_analytics.py
│   ├── test_config.py
│   ├── test_fetcher.py
│   ├── test_models.py
│   ├── test_storage.py
│   └── test_utils.py
├── integration/                   # Integration tests
│   └── test_integration.py
└── e2e/                          # End-to-end tests
    └── test_workflows.py
```

### Test Example

```python
import pytest
from ai_web_feeds.models import Feed
from ai_web_feeds.storage import FeedStorage


class TestFeedStorage:
    """Tests for FeedStorage class."""
    
    @pytest.mark.unit
    def test_add_feed(self, test_db):
        """Test adding feed to database."""
        storage = FeedStorage(database_url=test_db)
        feed = Feed(url="https://example.com/feed.xml", title="Test")
        
        saved_feed = storage.add_feed(feed)
        
        assert saved_feed is not None
        assert saved_feed.id is not None
        assert saved_feed.url == feed.url
```

### Running Tests

```bash
cd tests

# All package tests
uv run pytest tests/packages/ai_web_feeds/

# With coverage
uv run pytest tests/packages/ai_web_feeds/ --cov=ai_web_feeds --cov-report=html

# Specific module
uv run pytest tests/packages/ai_web_feeds/unit/test_fetcher.py -v
```

---

## 🎯 Common Tasks

### Adding a New Module

1. Create file in `src/ai_web_feeds/new_module.py`
2. Add type hints and docstrings
3. Export in `__init__.py`:

```python
from ai_web_feeds.new_module import NewClass

__all__ = ["NewClass", ...]
```

4. Add tests in `tests/tests/packages/ai_web_feeds/unit/test_new_module.py`
5. Update this AGENTS.md

### Adding Dependencies

```bash
cd packages/ai_web_feeds
uv add package-name
uv sync
```

---

## 🗄️ Database Management

### Initialize Database

```bash
uv run python packages/ai_web_feeds/scripts/init_alembic.py
```

### Migrations

```bash
cd packages/ai_web_feeds

# Create migration
uv run alembic revision --autogenerate -m "description"

# Apply migrations
uv run alembic upgrade head

# Rollback
uv run alembic downgrade -1
```

---

## 📚 Resources

- [SQLModel Documentation](https://sqlmodel.tiangolo.com/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Loguru Documentation](https://loguru.readthedocs.io/)
- [httpx Documentation](https://www.python-httpx.org/)

---

*Last Updated: October 2025*