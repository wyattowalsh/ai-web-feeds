# Test Suite - Agent Instructions

> **Component**: Comprehensive Test Suite  
> **Location**: `tests/`  
> **Parent**: [Root AGENTS.md](../AGENTS.md)

## 📍 Essential Links

- **Full Documentation**: [llms-full.txt#testing](https://aiwebfeeds.com/llms-full.txt#testing)
- **Root Instructions**: [../AGENTS.md](../AGENTS.md)
- **Core Package**: [../packages/ai_web_feeds/AGENTS.md](../packages/ai_web_feeds/AGENTS.md)
- **Contributing**: [../CONTRIBUTING.md](../CONTRIBUTING.md)

---

## 🎯 Purpose

Comprehensive testing infrastructure:
- **Unit Tests**: Isolated component tests
- **Integration Tests**: Multi-component interactions
- **E2E Tests**: Complete workflows
- **Property-Based**: Hypothesis-driven edge cases
- **Data Validation**: YAML/JSON schema compliance
- **Coverage**: ≥90% requirement

**Stack**: pytest 8.4+, pytest-cov, pytest-xdist, Hypothesis 6.141+

**Test Data**: Uses `data/feeds.yaml`, `data/topics.yaml` fixtures with schema validation

---

## 🏗️ Architecture

```
tests/
├── conftest.py           # Global fixtures (enhanced with export/validate fixtures)
├── pytest.ini            # Pytest config
├── run_tests.py          # Test runner
├── reports/              # Coverage + HTML reports
└── tests/
    ├── packages/         # Core package tests
    │   └── ai_web_feeds/
    │       ├── unit/     # Unit tests (11 test files, 100% module coverage)
    │       │   ├── test_load.py        # Load/save YAML operations
    │       │   ├── test_validate.py    # Validation logic & JSON schema
    │       │   ├── test_export.py      # JSON/OPML export functions
    │       │   ├── test_enrich.py      # Feed enrichment & scoring
    │       │   ├── test_logger.py      # Logger configuration
    │       │   ├── test_models.py      # SQLModel entities
    │       │   ├── test_storage.py     # Database operations
    │       │   ├── test_config.py      # Settings management
    │       │   ├── test_utils.py       # Utility functions
    │       │   ├── test_analytics.py   # Analytics (if applicable)
    │       │   └── test_fetcher.py     # Feed fetching (refactored)
    │       ├── integration/  # Multi-component workflows
    │       └── e2e/          # End-to-end tests
    └── cli/              # CLI tests
        ├── unit/
        └── integration/
```

**See**: [llms-full.txt#testing](https://aiwebfeeds.com/llms-full.txt#testing) for complete structure

**Recent Updates (October 2025)**:
- ✅ Full test coverage for `load`, `validate`, `export`, `enrich`, `logger` modules
- ✅ 1,600+ lines of new test code with comprehensive edge cases
- ✅ Property-based tests with Hypothesis for robustness
- ✅ Enhanced fixtures for validation results, feed/topic data structures
- ✅ All tests lint-clean (Ruff) and type-checked (mypy)

---

## 📐 Development Rules

### 1. Test Markers
```python
# Use markers for test classification
@pytest.mark.unit
def test_function():
    ...

@pytest.mark.integration
def test_workflow():
    ...

@pytest.mark.e2e
def test_complete_flow():
    ...
```

### 2. Fixtures
```python
# Use fixtures for setup/teardown
@pytest.fixture
def sample_feed():
    return Feed(url="https://example.com/feed")

def test_with_fixture(sample_feed):
    assert sample_feed.url
```

### 3. Mocking
```python
# Mock external dependencies
def test_fetch(mocker):
    mock_get = mocker.patch('httpx.get')
    mock_get.return_value.text = "<feed>...</feed>"
    result = fetch_feed("https://example.com")
    assert result
```

### 4. Property-Based
```python
# Use Hypothesis for edge cases
from hypothesis import given
from hypothesis.strategies import text

@given(text())
def test_parse_any_text(input_text):
    result = parse(input_text)
    assert isinstance(result, str)
```

---

## 🧪 Running Tests

```bash
# All tests with coverage
uv run pytest --cov

# Specific test type
uv run pytest -m unit
uv run pytest -m integration

# Specific file
uv run pytest tests/packages/ai_web_feeds/unit/test_fetcher.py

# Parallel execution
uv run pytest -n auto

# With HTML report
uv run pytest --html=reports/test_report.html
```

**See**: `pytest.ini` for all options

---

## 🔄 Common Tasks

### Adding Unit Test
1. Create `tests/packages/ai_web_feeds/unit/test_module.py`
2. Add `@pytest.mark.unit` decorator
3. Mock external dependencies
4. Run: `uv run pytest -m unit`

### Adding Integration Test
1. Create `tests/packages/ai_web_feeds/integration/test_feature.py`
2. Add `@pytest.mark.integration` decorator
3. Use test database fixtures
4. Verify coverage: `uv run pytest --cov`

### Adding Fixtures
- Edit `conftest.py` for global fixtures
- Or create local `conftest.py` in test subdirectory

---

## 🚨 Critical Patterns

### DO
✅ Write tests before implementation (TDD)  
✅ Use appropriate markers (`@pytest.mark.unit`)  
✅ Mock external dependencies  
✅ Maintain ≥90% coverage  
✅ Use descriptive test names  
✅ Test edge cases with Hypothesis

### DON'T
❌ Skip tests for new features  
❌ Use real APIs in unit tests  
❌ Hard-code test data  
❌ Leave failing tests  
❌ Commit without running tests  
❌ Skip coverage check

---

## 📚 Reference

**pytest docs**: [docs.pytest.org](https://docs.pytest.org)  
**Hypothesis docs**: [hypothesis.readthedocs.io](https://hypothesis.readthedocs.io)  
**Full testing guide**: [llms-full.txt#testing](https://aiwebfeeds.com/llms-full.txt#testing)  
**Root workflow**: [../AGENTS.md](../AGENTS.md#standard-workflow)

---

## 🆕 Recent Test Updates (October 2025)

### Major Test Synchronization - October 17, 2025

**New Comprehensive Test Files** (1,600+ lines):

1. **`test_load.py`** (500+ lines)
   - Full coverage for `load_feeds()`, `load_topics()`, `save_feeds()`, `save_topics()`
   - YAML parsing, file I/O, encoding handling
   - Unicode support and round-trip validation
   - Property-based tests with Hypothesis
   - Error handling: FileNotFoundError, YAML syntax errors

2. **`test_validate.py`** (490+ lines)
   - `ValidationResult` class complete coverage
   - `validate_feeds()` and `validate_topics()` with JSON schema
   - Duplicate ID detection, required field validation
   - Schema loading and error accumulation
   - Integration with load module

3. **`test_export.py`** (440+ lines)
   - `export_to_json()` with pretty-printing and Unicode
   - `export_to_opml()` flat and categorized structures
   - `export_all_formats()` multi-format output
   - Directory creation, round-trip verification
   - XML parsing and structure validation

4. **`test_enrich.py`** (180+ lines)
   - `FeedEnrichment` class and `AdvancedEnricher`
   - Async enrichment with mocked HTTP requests
   - Quality, health, and completeness scoring algorithms
   - Edge cases and boundary testing

5. **`test_logger.py`** (30+ lines)
   - Logger configuration and import verification
   - Basic logging functionality tests

**Enhanced Infrastructure**:
- Updated `conftest.py` with new fixtures:
  - `sample_feeds_data` - Complete feed structure
  - `sample_topics_data` - Topic taxonomy with relations
  - `sample_validation_result` - Validation utilities
- All tests pass Ruff linting and type checking
- Comprehensive edge case coverage
- Async test support with pytest-asyncio

**Coverage Status**:
- ✅ 11 test files covering all core modules
- ✅ Unit tests: load, validate, export, enrich, logger, models, storage, config, utils
- ✅ Property-based tests for robust edge case handling
- ✅ Mock/patch patterns for external dependencies
- 🎯 Target: ≥90% coverage (run `uv run aiwebfeeds test coverage`)

### Data Validation Tests (October 2025)

**Topic Taxonomy Tests**:

- Schema validation (`data/topics.schema.json`)
- Graph structure validation (no cycles, valid edges)
- Facet consistency checks
- Relation type validation

**Enriched Feeds Tests**:

- Schema compliance (`data/feeds.enriched.schema.json`)
- Topic mapping validation
- Embedding format checks

**Location**: `tests/tests/data/`

```python
@pytest.mark.unit
def test_topics_schema_valid():
    """Validate topics.yaml against JSON schema."""
    with open("data/topics.yaml") as f:
        topics = yaml.safe_load(f)
    with open("data/topics.schema.json") as f:
        schema = json.load(f)
    jsonschema.validate(topics, schema)
```

---

*Updated: October 17, 2025 · Version: 0.1.0*

    e2e: End-to-end tests (full workflows)
    slow: Slow running tests
    network: Tests requiring network access
    database: Tests requiring database
```

### Global Fixtures

**`conftest.py`** provides shared fixtures:

```python
import pytest
from pathlib import Path
from sqlmodel import create_engine, SQLModel
from ai_web_feeds.storage import FeedStorage
from ai_web_feeds.config import Settings


@pytest.fixture
def test_db(tmp_path: Path) -> str:
    """Provide temporary test database.
    
    Creates a fresh SQLite database for each test.
    """
    db_path = tmp_path / "test.db"
    database_url = f"sqlite:///{db_path}"
    
    # Create tables
    engine = create_engine(database_url)
    SQLModel.metadata.create_all(engine)
    
    yield database_url
    
    # Cleanup
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
def storage(test_db: str) -> FeedStorage:
    """Provide FeedStorage instance with test database."""
    return FeedStorage(database_url=test_db)


@pytest.fixture
def test_settings() -> Settings:
    """Provide test settings."""
    return Settings(
        database_url="sqlite:///:memory:",
        log_level="DEBUG",
        fetch_timeout=5,
        max_retries=1
    )


@pytest.fixture
def mock_httpx(mocker):
    """Mock httpx client for HTTP requests."""
    mock = mocker.patch("httpx.AsyncClient.get")
    return mock
```

---

## ✍️ Writing Tests

### Unit Test Example

```python
"""Unit tests for feed fetcher module."""

import pytest
import httpx
from unittest.mock import Mock, AsyncMock
from ai_web_feeds.fetcher import fetch_feed


class TestFetchFeed:
    """Tests for fetch_feed function."""
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_fetch_success(self, mock_httpx):
        """Test successful feed fetch."""
        # Arrange
        url = "https://example.com/feed.xml"
        expected_content = "<rss version='2.0'>...</rss>"
        
        mock_response = Mock(spec=httpx.Response)
        mock_response.text = expected_content
        mock_response.status_code = 200
        mock_httpx.return_value = mock_response
        
        # Act
        response = await fetch_feed(url)
        
        # Assert
        assert response.status_code == 200
        assert response.text == expected_content
        mock_httpx.assert_called_once()
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_fetch_timeout(self, mock_httpx):
        """Test fetch with timeout error."""
        url = "https://slow.example.com/feed.xml"
        mock_httpx.side_effect = httpx.TimeoutException("Request timeout")
        
        with pytest.raises(httpx.TimeoutException, match="Request timeout"):
            await fetch_feed(url, timeout=1)
    
    @pytest.mark.unit
    @pytest.mark.asyncio
    async def test_fetch_http_error(self, mock_httpx):
        """Test fetch with HTTP error."""
        url = "https://error.example.com/feed.xml"
        mock_response = Mock(spec=httpx.Response)
        mock_response.status_code = 404
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Not Found", request=Mock(), response=mock_response
        )
        mock_httpx.return_value = mock_response
        
        with pytest.raises(httpx.HTTPStatusError):
            await fetch_feed(url)
```

### Integration Test Example

```python
"""Integration tests for storage and fetcher."""

import pytest
from ai_web_feeds.fetcher import fetch_feed
from ai_web_feeds.storage import FeedStorage
from ai_web_feeds.models import Feed


class TestFeedIntegration:
    """Integration tests for feed operations."""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_fetch_and_store(self, storage, mock_httpx):
        """Test fetching feed and storing in database."""
        # Arrange
        url = "https://example.com/feed.xml"
        feed_xml = """
        <rss version="2.0">
            <channel>
                <title>Test Feed</title>
                <description>A test feed</description>
            </channel>
        </rss>
        """
        
        mock_response = Mock()
        mock_response.text = feed_xml
        mock_response.status_code = 200
        mock_httpx.return_value = mock_response
        
        # Act
        response = await fetch_feed(url)
        
        import feedparser
        parsed = feedparser.parse(response.text)
        
        feed = Feed(
            url=url,
            title=parsed.feed.title,
            description=parsed.feed.description
        )
        saved_feed = storage.add_feed(feed)
        
        # Assert
        assert saved_feed is not None
        assert saved_feed.id is not None
        
        # Verify in database
        retrieved = storage.get_feed_by_url(url)
        assert retrieved is not None
        assert retrieved.title == "Test Feed"
```

### Property-Based Test Example

```python
"""Property-based tests using Hypothesis."""

import pytest
from hypothesis import given, strategies as st
from ai_web_feeds.utils import generate_guid


class TestUtils:
    """Property-based tests for utility functions."""
    
    @pytest.mark.unit
    @given(
        url=st.text(min_size=1, max_size=100),
        title=st.text(min_size=1, max_size=100)
    )
    def test_generate_guid_deterministic(self, url: str, title: str):
        """Property: GUID generation is deterministic."""
        guid1 = generate_guid(url, title)
        guid2 = generate_guid(url, title)
        
        assert guid1 == guid2
        assert isinstance(guid1, str)
        assert len(guid1) == 64  # SHA256 hex length
    
    @pytest.mark.unit
    @given(
        url1=st.text(min_size=1),
        url2=st.text(min_size=1),
        title=st.text(min_size=1)
    )
    def test_generate_guid_unique(self, url1: str, url2: str, title: str):
        """Property: Different URLs produce different GUIDs."""
        if url1 != url2:
            guid1 = generate_guid(url1, title)
            guid2 = generate_guid(url2, title)
            assert guid1 != guid2
```

### Parametrized Tests

```python
@pytest.mark.unit
@pytest.mark.parametrize("url,expected_valid", [
    ("https://example.com/feed.xml", True),
    ("http://example.com/feed.xml", True),
    ("ftp://example.com/feed.xml", False),
    ("invalid-url", False),
    ("", False),
])
def test_url_validation(url: str, expected_valid: bool):
    """Test URL validation with various inputs."""
    from ai_web_feeds.models import Feed
    
    if expected_valid:
        feed = Feed(url=url)
        assert feed.url == url.lower().strip()
    else:
        with pytest.raises(ValueError):
            Feed(url=url)
```

---

## 🚀 Running Tests

### Basic Commands

```bash
cd tests

# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov

# Run specific test type
uv run pytest -m unit                    # Unit tests only
uv run pytest -m integration             # Integration tests only
uv run pytest -m e2e                     # E2E tests only

# Run specific module
uv run pytest tests/packages/ai_web_feeds/unit/test_fetcher.py

# Run specific test
uv run pytest tests/packages/ai_web_feeds/unit/test_fetcher.py::TestFetchFeed::test_fetch_success

# Run tests matching pattern
uv run pytest -k "fetch"                 # Tests with "fetch" in name
```

### Parallel Execution

```bash
# Run tests in parallel (auto-detect cores)
uv run pytest -n auto

# Specify number of workers
uv run pytest -n 4

# Parallel with coverage (slower but accurate)
uv run pytest -n auto --cov
```

### Verbose Output

```bash
# Extra verbose
uv run pytest -vv

# Show print statements
uv run pytest -s

# Show test durations
uv run pytest --durations=20

# Stop on first failure
uv run pytest -x

# Show full diff
uv run pytest -vv
```

### Coverage Reports

```bash
# Generate HTML coverage report
uv run pytest --cov --cov-report=html

# Open in browser
open reports/coverage/index.html

# Terminal coverage with missing lines
uv run pytest --cov --cov-report=term-missing

# Export coverage to XML (for CI)
uv run pytest --cov --cov-report=xml
```

---

## 📊 Coverage Requirements

### Target: ≥90% Coverage

**Per Module Requirements**:
- `fetcher.py`: ≥95%
- `storage.py`: ≥95%
- `models.py`: ≥90%
- `analytics.py`: ≥90%
- `config.py`: ≥85%
- `utils.py`: ≥90%

### Checking Coverage

```bash
# Overall coverage
uv run pytest --cov --cov-report=term

# Specific module
uv run pytest --cov=ai_web_feeds.fetcher --cov-report=term

# Branch coverage
uv run pytest --cov --cov-branch --cov-report=term
```

### Coverage Configuration

From `pyproject.toml`:

```toml
[tool.coverage.run]
source = ["ai_web_feeds"]
omit = [
    "*/tests/*",
    "*/test_*.py",
    "*/__pycache__/*",
]

[tool.coverage.report]
precision = 2
show_missing = true
skip_covered = false
```

---

## ✅ Best Practices

### Test Naming

```python
# Good: Descriptive test names
def test_fetch_feed_with_valid_url_returns_response():
    ...

def test_add_feed_with_duplicate_url_returns_none():
    ...

def test_calculate_stats_with_empty_database_returns_zeros():
    ...

# Avoid: Vague names
def test_fetch():
    ...

def test_1():
    ...
```

### Test Structure (AAA Pattern)

```python
def test_example():
    # Arrange: Set up test data
    url = "https://example.com/feed.xml"
    feed = Feed(url=url, title="Test")
    
    # Act: Execute the code being tested
    result = storage.add_feed(feed)
    
    # Assert: Verify the outcome
    assert result is not None
    assert result.id is not None
```

### Fixtures Over Global State

```python
# Good: Use fixtures
@pytest.fixture
def sample_feed():
    return Feed(url="https://example.com/feed.xml", title="Test")

def test_with_fixture(sample_feed):
    assert sample_feed.title == "Test"

# Avoid: Global variables
SAMPLE_FEED = Feed(url="...", title="Test")  # ❌

def test_with_global():
    assert SAMPLE_FEED.title == "Test"  # ❌
```

### Mocking External Dependencies

```python
# Good: Mock external calls
@pytest.mark.unit
async def test_fetch_with_mock(mock_httpx):
    mock_httpx.return_value = Mock(status_code=200, text="<rss/>")
    result = await fetch_feed("https://example.com/feed.xml")
    assert result.status_code == 200

# Avoid: Real network calls in unit tests
@pytest.mark.unit
async def test_fetch_real():  # ❌
    result = await fetch_feed("https://real-site.com/feed.xml")  # ❌
```

### Test Independence

```python
# Good: Each test is independent
def test_add_feed(storage):
    feed = Feed(url="https://example.com/feed.xml")
    result = storage.add_feed(feed)
    assert result is not None

def test_get_feed(storage):
    feed = Feed(url="https://example.com/feed.xml")
    storage.add_feed(feed)
    result = storage.get_feed_by_url(feed.url)
    assert result is not None

# Avoid: Tests depending on each other
def test_add_then_get(storage):  # ❌
    # Test does two things
    ...
```

---

## 🐛 Troubleshooting

### Tests Failing After Code Changes

```bash
# Check coverage to find untested code
uv run pytest --cov --cov-report=term-missing

# Run only failed tests
uv run pytest --lf

# Run failed tests first
uv run pytest --ff
```

### Slow Test Execution

```bash
# Find slowest tests
uv run pytest --durations=20

# Run in parallel
uv run pytest -n auto

# Skip slow tests
uv run pytest -m "not slow"
```

### Coverage Not Updating

```bash
# Clear coverage cache
rm -rf .coverage reports/coverage

# Regenerate coverage
uv run pytest --cov --cov-report=html
```

---

## 📚 Resources

- [pytest Documentation](https://docs.pytest.org/)
- [Hypothesis Documentation](https://hypothesis.readthedocs.io/)
- [pytest-cov Documentation](https://pytest-cov.readthedocs.io/)
- [pytest-asyncio Documentation](https://pytest-asyncio.readthedocs.io/)

---

*Last Updated: October 2025*
