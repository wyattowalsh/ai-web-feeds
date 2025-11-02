# Test Coverage Checklist

**Feature**: Phase 1 - Data Discovery & Analytics  
**Branch**: `002-data-discovery-analytics`  
**Target**: ≥90% coverage per constitution (Principle IV)

---

## Module Coverage Targets

### Phase 3: US1 Analytics

| Module | Functions | Unit Tests | Integration Tests | Coverage Target | Current |
|--------|-----------|------------|-------------------|-----------------|---------|
| `analytics.py` | 7 | T060a-g | T060h-j | ≥90% | ☐ |
| `storage.py` (analytics extensions) | 4 | Covered in analytics tests | T060h | ≥90% | ☐ |
| **Total** | **11** | **7** | **3** | **≥90%** | **☐** |

**Files to Create**:
- [ ] `tests/tests/packages/ai_web_feeds/test_analytics.py`

### Phase 4: US2 Search & Discovery

| Module | Functions | Unit Tests | Integration Tests | Coverage Target | Current |
|--------|-----------|------------|-------------------|-----------------|---------|
| `embeddings.py` | 6 | T117a-f | T117r | ≥90% | ☐ |
| `search.py` | 9 | T117g-l | T117q, T117s | ≥90% | ☐ |
| `autocomplete.py` | 4 | T117m-p | - | ≥90% | ☐ |
| `storage.py` (search extensions) | 5 | Covered in search tests | T117t | ≥90% | ☐ |
| **Total** | **24** | **16** | **4** | **≥90%** | **☐** |

**Files to Create**:
- [ ] `tests/tests/packages/ai_web_feeds/test_embeddings.py`
- [ ] `tests/tests/packages/ai_web_feeds/test_search.py`
- [ ] `tests/tests/packages/ai_web_feeds/test_autocomplete.py`

### Phase 5: US3 Recommendations

| Module | Functions | Unit Tests | Integration Tests | Coverage Target | Current |
|--------|-----------|------------|-------------------|-----------------|---------|
| `recommendations.py` | 12 | T156a-j | T156k | ≥90% | ☐ |
| `storage.py` (recommendations extensions) | 3 | Covered in recommendations tests | T156l, T156m | ≥90% | ☐ |
| **Total** | **15** | **10** | **3** | **≥90%** | **☐** |

**Files to Create**:
- [ ] `tests/tests/packages/ai_web_feeds/test_recommendations.py`

---

## Per-Function Test Checklist

### 📋 Test Coverage Template

For each function, ensure these test scenarios exist:

#### Happy Path Tests
- [ ] Test with typical valid input
- [ ] Test with minimal valid input
- [ ] Test with maximal valid input

#### Edge Case Tests
- [ ] Test with empty input (if applicable)
- [ ] Test with single-item input (if applicable)
- [ ] Test with boundary values (0, -1, MAX_INT, etc.)
- [ ] Test with Unicode/special characters (if string handling)

#### Error Condition Tests
- [ ] Test with invalid input types
- [ ] Test with null/None input
- [ ] Test with out-of-range values
- [ ] Test with malformed data

#### Concurrency Tests (if applicable)
- [ ] Test with concurrent reads
- [ ] Test with concurrent writes
- [ ] Test for race conditions
- [ ] Test for deadlocks

#### Performance Tests (if critical path)
- [ ] Test with small dataset (< 100 items)
- [ ] Test with medium dataset (1K-10K items)
- [ ] Test with large dataset (50K+ items)
- [ ] Verify O(n) complexity claims

---

## Test Quality Criteria

### Unit Test Requirements

- [ ] **Isolation**: All external dependencies mocked (network, DB, filesystem, time)
- [ ] **Determinism**: Tests pass consistently (no flaky tests)
- [ ] **Speed**: Unit tests complete in < 1 second each
- [ ] **Clarity**: Test names follow `test_<function>_<scenario>_<expected_outcome>` format
- [ ] **Specificity**: Assertions are precise (not just `assert result`)
- [ ] **Independence**: Tests can run in any order

### Integration Test Requirements

- [ ] **Realistic**: Use actual database (SQLite in-memory or test file)
- [ ] **Cleanup**: Teardown ensures no state leakage
- [ ] **Data**: Use representative test data (not trivial examples)
- [ ] **Transactions**: Verify ACID properties
- [ ] **Performance**: Integration tests complete in < 5 seconds each

### Property-Based Test Requirements (using Hypothesis)

- [ ] **Strategies**: Use appropriate Hypothesis strategies (`st.text()`, `st.integers()`, etc.)
- [ ] **Invariants**: Test properties that should always hold
- [ ] **Edge Cases**: Let Hypothesis discover edge cases automatically
- [ ] **Shrinking**: Verify minimal failing examples are reported

---

## Coverage Measurement Commands

### Run Coverage for All Modules

```bash
# Full coverage report
cd /Users/ww/dev/projects/ai-web-feeds
uv run pytest --cov=packages/ai_web_feeds/src/ai_web_feeds --cov-report=html --cov-report=term

# View HTML report
open tests/reports/coverage/index.html
```

### Run Coverage for Specific Module

```bash
# Analytics only
uv run pytest tests/tests/packages/ai_web_feeds/test_analytics.py --cov=ai_web_feeds.analytics --cov-report=term

# Search only
uv run pytest tests/tests/packages/ai_web_feeds/test_search.py --cov=ai_web_feeds.search --cov-report=term

# Embeddings only
uv run pytest tests/tests/packages/ai_web_feeds/test_embeddings.py --cov=ai_web_feeds.embeddings --cov-report=term

# Recommendations only
uv run pytest tests/tests/packages/ai_web_feeds/test_recommendations.py --cov=ai_web_feeds.recommendations --cov-report=term
```

### Run Coverage with Failure Details

```bash
# Show missing lines
uv run pytest --cov=ai_web_feeds --cov-report=term-missing

# Generate JSON report for CI/CD
uv run pytest --cov=ai_web_feeds --cov-report=json -o tests/reports/coverage.json
```

---

## Coverage Enforcement

### Pre-Commit Checks

```bash
# Run before committing
uv run pytest --cov=ai_web_feeds --cov-fail-under=90

# If coverage < 90%, commit will be blocked
```

### CI/CD Pipeline Checks

```yaml
# .github/workflows/test.yml example
- name: Run tests with coverage
  run: |
    uv run pytest --cov=ai_web_feeds --cov-report=xml --cov-fail-under=90
    
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage.xml
    fail_ci_if_error: true
```

---

## Coverage Gaps Analysis

### Identify Uncovered Code

```bash
# Show uncovered lines in terminal
uv run pytest --cov=ai_web_feeds --cov-report=term-missing | grep -A 5 "TOTAL"

# Generate annotated source files
uv run pytest --cov=ai_web_feeds --cov-report=annotate
```

### Common Reasons for Coverage Gaps

1. **Error handling branches**: Test with invalid inputs to trigger `except` blocks
2. **Edge case branches**: Test boundary conditions to trigger `if` conditions
3. **Defensive code**: Test with None, empty, or malformed data
4. **Async code**: Ensure all `await` paths are tested
5. **Configuration code**: Test with different config values

### Acceptable Coverage Exceptions

The following may have <90% coverage with justification:

- [ ] **Generated code**: Auto-generated files (migrations, protobuf)
- [ ] **Trivial code**: Simple getters/setters with no logic
- [ ] **Unreachable code**: Defensive assertions that should never trigger
- [ ] **Deprecated code**: Code scheduled for removal

**Document exceptions in**: `tests/COVERAGE_EXCEPTIONS.md`

---

## Test Execution Matrix

### By Test Type

| Test Type | Command | Expected Duration | Pass Criteria |
|-----------|---------|-------------------|---------------|
| **Unit** | `uv run pytest -m unit` | < 30 seconds | 100% pass |
| **Integration** | `uv run pytest -m integration` | < 2 minutes | 100% pass |
| **E2E** | `uv run pytest -m e2e` | < 5 minutes | 100% pass |
| **Property-Based** | `uv run pytest -m property` | < 1 minute | 100% pass |

### By Phase

| Phase | Test Files | Task IDs | Coverage Target |
|-------|------------|----------|-----------------|
| **Phase 3 (Analytics)** | `test_analytics.py` | T060a-j | ≥90% |
| **Phase 4 (Search)** | `test_embeddings.py`, `test_search.py`, `test_autocomplete.py` | T117a-t | ≥90% |
| **Phase 5 (Recommendations)** | `test_recommendations.py` | T156a-m | ≥90% |

---

## Coverage Reporting

### Weekly Coverage Report Template

```markdown
## Test Coverage Report - Week of [Date]

**Overall Coverage**: X.X% (Target: ≥90%)

### Module Breakdown

| Module | Coverage | Change | Status |
|--------|----------|--------|--------|
| analytics.py | X.X% | +Y.Y% | ✅/⚠️/❌ |
| search.py | X.X% | +Y.Y% | ✅/⚠️/❌ |
| embeddings.py | X.X% | +Y.Y% | ✅/⚠️/❌ |
| autocomplete.py | X.X% | +Y.Y% | ✅/⚠️/❌ |
| recommendations.py | X.X% | +Y.Y% | ✅/⚠️/❌ |

### Action Items

- [ ] Module X: Add tests for functions Y, Z (lines 120-150)
- [ ] Module A: Improve edge case coverage for function B

### Wins This Week

- ✅ analytics.py reached 95% coverage (+15%)
- ✅ All integration tests passing consistently
```

---

## Quick Reference

### Coverage Goals

- **Minimum**: 90% (constitution requirement)
- **Target**: 95% (best practice)
- **Stretch**: 99% (exceptional quality)

### Test Pyramid

```
       /\
      /E2\    10% - End-to-End (slow, fragile)
     /----\
    / INT  \  20% - Integration (medium, stable)
   /--------\
  /   UNIT   \ 70% - Unit (fast, reliable)
 /____________\
```

### When to Write Tests

1. **Before code** (TDD): Write failing test → Implement → Test passes ✅
2. **With code** (concurrent): Implement function → Write tests immediately ✅
3. **After code** (reactive): Implement → Tests later ⚠️ (not recommended)

**Constitution Principle IV**: "Tests MUST be written before or concurrently with implementation"

