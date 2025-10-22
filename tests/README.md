# AI Web Feeds - Test Suite

Comprehensive test suite for the ai-web-feeds project with unit, integration, and end-to-end tests.

## Running Tests

### Recommended: Use the CLI

All test execution logic is now centralized in the CLI (`apps/cli/ai_web_feeds/cli/commands/test.py`).

```bash
# From project root
uv run aiwebfeeds test all              # Run all tests
uv run aiwebfeeds test unit             # Run unit tests
uv run aiwebfeeds test unit --fast      # Run unit tests, skip slow ones
uv run aiwebfeeds test integration      # Run integration tests
uv run aiwebfeeds test e2e              # Run end-to-end tests
uv run aiwebfeeds test coverage         # Run with coverage report
uv run aiwebfeeds test coverage --open  # Run coverage and open in browser
uv run aiwebfeeds test quick            # Quick run (unit, no slow, fail fast)
uv run aiwebfeeds test debug            # Debug mode with pdb
uv run aiwebfeeds test watch            # Watch mode (re-run on changes)
uv run aiwebfeeds test file <path>      # Run specific test file
uv run aiwebfeeds test markers          # List available test markers
```

### Alternative: Use run_tests.py

The `run_tests.py` script delegates to the CLI for backward compatibility:

```bash
# From tests directory
./run_tests.py                  # Run all tests
./run_tests.py unit             # Run unit tests
./run_tests.py integration      # Run integration tests
./run_tests.py e2e              # Run end-to-end tests
./run_tests.py quick            # Quick run
./run_tests.py coverage         # With coverage
./run_tests.py debug            # Debug mode
./run_tests.py watch            # Watch mode
./run_tests.py help             # Show help
```

### Direct pytest (not recommended)

For advanced pytest features not exposed by the CLI:

```bash
cd tests
uv run pytest                   # Basic run
uv run pytest -v               # Verbose
uv run pytest -n auto          # Parallel execution
uv run pytest -k "test_name"   # Run tests matching keyword
```

## Test Structure

```
tests/
├── conftest.py                 # Shared fixtures and configuration
├── pytest.ini                  # Pytest configuration
├── pyproject.toml             # Test dependencies
├── run_tests.py               # Test runner (delegates to CLI)
├── apps/
│   └── cli/
│       ├── __init__.py
│       └── unit/
│           └── test_commands.py  # CLI command tests
└── packages/
    └── ai_web_feeds/
        ├── __init__.py
        ├── unit/                 # Unit tests (isolated components)
        │   ├── test_models.py
        │   ├── test_storage.py
        │   ├── test_fetcher.py
        │   └── test_config.py
        ├── integration/          # Integration tests (multiple components)
        │   └── test_integration.py
        └── e2e/                  # End-to-end tests (full workflows)
            └── test_workflows.py
```

## Test Categories

### Unit Tests (`@pytest.mark.unit`)
- Test individual components in isolation
- Fast execution
- No external dependencies
- Mock external services

**Examples:**
- Model validation
- Database operations
- Configuration loading
- Feed parsing logic

### Integration Tests (`@pytest.mark.integration`)
- Test multiple components working together
- Database + Storage + Models
- Fetcher + Parser + Storage
- May use real database (SQLite in-memory)

**Examples:**
- Fetch and store workflow
- Topic-feed relationships
- Fetch logging
- Data consistency

### E2E Tests (`@pytest.mark.e2e`)
- Test complete user workflows
- Full system integration
- Real-world scenarios
- May be slow

**Examples:**
- New user onboarding
- Feed management
- Bulk operations
- Data export

## Running Tests

### Run All Tests
```bash
cd tests
pytest
```

### Run Specific Test Categories
```bash
# Unit tests only (fast)
pytest -m unit

# Integration tests
pytest -m integration

# E2E tests
pytest -m e2e

# Exclude slow tests
pytest -m "not slow"

# Exclude network tests
pytest -m "not network"
```

### Run Specific Test Files
```bash
# Test models
pytest packages/ai_web_feeds/unit/test_models.py

# Test storage
pytest packages/ai_web_feeds/unit/test_storage.py

# Test CLI
pytest apps/cli/unit/test_commands.py
```

### Run Specific Test Classes or Functions
```bash
# Run a specific test class
pytest packages/ai_web_feeds/unit/test_models.py::TestFeedSource

# Run a specific test function
pytest packages/ai_web_feeds/unit/test_models.py::TestFeedSource::test_feed_source_creation

# Run tests matching a pattern
pytest -k "feed_source"
```

## Coverage Reports

### Generate Coverage Report
```bash
# HTML coverage report (opens in browser)
pytest --cov=ai_web_feeds --cov-report=html
open reports/coverage/index.html

# Terminal coverage report
pytest --cov=ai_web_feeds --cov-report=term-missing

# Combined
pytest --cov=ai_web_feeds --cov-report=html --cov-report=term-missing
```

### Coverage Targets
- Overall: 80%+
- Unit tests: 90%+
- Integration tests: 75%+
- E2E tests: 60%+

## Advanced Options

### Parallel Execution
```bash
# Run tests in parallel (requires pytest-xdist)
pytest -n auto
```

### Debugging
```bash
# Drop into debugger on failure
pytest --pdb

# Show print statements
pytest -s

# More verbose output
pytest -vv

# Show local variables on failure
pytest --showlocals
```

### Performance
```bash
# Show slowest tests
pytest --durations=10

# Profile test execution
pytest --profile

# Timeout protection
pytest --timeout=60
```

## Test Fixtures

Common fixtures available in `conftest.py`:

### Database Fixtures
- `temp_db_path` - Temporary database file path
- `db_engine` - Test database engine
- `db_session` - Test database session

### Model Fixtures
- `sample_feed_source` - Single feed source
- `sample_feed_sources` - Multiple feed sources
- `sample_feed_item` - Single feed item
- `sample_feed_items` - Multiple feed items
- `sample_topic` - Single topic
- `sample_fetch_log` - Feed fetch log

### Mock Fixtures
- `mock_httpx_response` - Mocked HTTP response
- `mock_feedparser_result` - Mocked feed parser result

### File Fixtures
- `temp_yaml_file` - Temporary YAML file
- `temp_opml_file` - Temporary OPML file
- `sample_rss_feed` - Sample RSS feed XML
- `sample_atom_feed` - Sample Atom feed XML

## Property-Based Testing

Tests use [Hypothesis](https://hypothesis.readthedocs.io/) for property-based testing:

```python
from hypothesis import given, strategies as st

@given(
    feed_id=st.text(min_size=1, max_size=100),
    title=st.text(min_size=1, max_size=200),
)
def test_feed_source_property_based(self, feed_id, title):
    feed = FeedSource(id=feed_id, title=title)
    assert feed.id == feed_id
```

## Continuous Integration

### GitHub Actions
Tests run automatically on:
- Every push to main
- Every pull request
- Scheduled daily runs

### Pre-commit Hooks
Run tests before committing:
```bash
# Install pre-commit
pip install pre-commit
pre-commit install

# Run manually
pre-commit run --all-files
```

## Writing New Tests

### Test Naming Convention
- File: `test_<module>.py`
- Class: `Test<Component>`
- Function: `test_<feature>_<scenario>`

### Example Unit Test
```python
@pytest.mark.unit
class TestMyComponent:
    def test_feature_success(self, sample_fixture):
        """Test successful feature execution."""
        result = my_component.do_something(sample_fixture)
        assert result is not None
        assert result.status == "success"
    
    def test_feature_failure(self):
        """Test feature handles errors gracefully."""
        with pytest.raises(ValueError):
            my_component.do_something(None)
```

### Example Integration Test
```python
@pytest.mark.integration
class TestComponentIntegration:
    def test_workflow(self, temp_db_path):
        """Test complete workflow across components."""
        db = DatabaseManager(f"sqlite:///{temp_db_path}")
        db.create_db_and_tables()
        
        # Test workflow steps
        result = component_a.process()
        stored = component_b.store(result)
        
        assert stored.id is not None
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure `ai_web_feeds` package is installed:
   ```bash
   cd packages/ai_web_feeds
   pip install -e .
   ```

2. **Database Errors**: Clear test database:
   ```bash
   rm -rf tests/*.db
   ```

3. **Coverage Not Working**: Reinstall coverage:
   ```bash
   pip install --upgrade pytest-cov
   ```

4. **Slow Tests**: Run only unit tests:
   ```bash
   pytest -m "unit and not slow"
   ```

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Hypothesis Documentation](https://hypothesis.readthedocs.io/)
- [pytest-cov Documentation](https://pytest-cov.readthedocs.io/)
- [Testing Best Practices](https://docs.python-guide.org/writing/tests/)
