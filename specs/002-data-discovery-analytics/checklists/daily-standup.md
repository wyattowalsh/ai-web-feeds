# Daily Standup Checklist

**Feature**: Phase 1 - Data Discovery & Analytics  
**Branch**: `002-data-discovery-analytics`

---

## Daily Progress Template

**Date**: YYYY-MM-DD  
**Phase**: [ ] P1-Setup | [ ] P2-Database | [ ] P3-Analytics | [ ] P4-Search | [ ] P5-Recommendations | [ ] P6-Validation

### ✅ Yesterday's Completed Tasks

- [ ] Task ID: Brief description
- [ ] Task ID: Brief description
- [ ] Task ID: Brief description

### 🎯 Today's Focus

**Primary Goal**: [e.g., Complete analytics backend functions]

- [ ] Task ID: Brief description (Priority: High/Medium/Low)
- [ ] Task ID: Brief description (Priority: High/Medium/Low)
- [ ] Task ID: Brief description (Priority: High/Medium/Low)

### 🚧 Blockers & Issues

- [ ] **Blocker**: Description | **Action**: Next steps
- [ ] **Issue**: Description | **Status**: In Progress/Resolved

### 📊 Progress Metrics

- **Tasks Completed Today**: X / Y planned
- **Phase Progress**: X% (Z of N tasks complete)
- **Overall Progress**: X% (Z of 209 tasks complete)
- **Test Coverage**: X% (current coverage via `uv run pytest --cov`)

### 🔍 Today's Test Results

- [ ] Unit tests passing: ✅/❌ (X/Y tests)
- [ ] Integration tests passing: ✅/❌ (X/Y tests)
- [ ] Linter passing: ✅/❌ (`uv run ruff check`)
- [ ] Type checker passing: ✅/❌ (`uv run mypy`)

### 💡 Notes & Learnings

- Key decision: [e.g., Chose sqlite-vec over NumPy BLOB for performance]
- Technical insight: [e.g., FTS5 tokenization requires custom porter stemmer]
- Documentation update: [e.g., Updated analytics.mdx with caching strategy]

---

## Phase Progress Tracking

### Phase 1: Setup (15 tasks)
**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete  
**Progress**: ☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐ 0/15

### Phase 2: Database Foundation (10 tasks)
**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete  
**Progress**: ☐☐☐☐☐☐☐☐☐☐ 0/10

### Phase 3: US1 Analytics (45 tasks)
**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete  
**Progress**: ☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐☐ 0/45

### Phase 4: US2 Search (77 tasks)
**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete  
**Progress**: [77 boxes] 0/77

### Phase 5: US3 Recommendations (52 tasks)
**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete  
**Progress**: [52 boxes] 0/52

### Phase 6: Performance & Quality (10 tasks)
**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete  
**Progress**: ☐☐☐☐☐☐☐☐☐☐ 0/10

---

## Quick Commands Reference

```bash
# Run tests with coverage
uv run pytest --cov --cov-report=html

# Run linter
uv run ruff check --fix .

# Run type checker
uv run mypy packages/ai_web_feeds/src/

# Start web dev server
cd apps/web && pnpm dev

# Run CLI validation
uv run aiwebfeeds validate http --concurrency 10

# View coverage report
open tests/reports/coverage/index.html
```

---

## Constitution Compliance Quick Check

- [ ] All new code has type hints (Principle III)
- [ ] Tests written for today's code (Principle IV, ≥90% coverage)
- [ ] Documentation updated in .mdx files (Principle I)
- [ ] Linter passes (Principle VII)
- [ ] No circular dependencies (Principle II)

