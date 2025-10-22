# Pull Request Review Checklist

**Feature**: Phase 1 - Data Discovery & Analytics  
**Branch**: `002-data-discovery-analytics`

---

## Pre-Submission Checklist (Author)

### 📝 Code Quality

- [ ] All new functions have type hints (Python) or strict types (TypeScript)
- [ ] All functions have docstrings (Python) or JSDoc comments (TypeScript)
- [ ] No `type: ignore` or `@ts-ignore` without explicit justification in comments
- [ ] Imports are absolute (not relative)
- [ ] Error handling is comprehensive with actionable messages
- [ ] No `print()` statements (use `logger` for Python, `console` for TS)
- [ ] Variable/function names are descriptive and follow conventions (snake_case Python, camelCase TS)
- [ ] Code follows existing patterns in codebase

### 🧪 Testing

- [ ] Unit tests added for all new functions (≥90% coverage target)
- [ ] Integration tests added for new workflows
- [ ] All tests pass locally: `uv run pytest --cov`
- [ ] Test coverage report generated: `tests/reports/coverage/`
- [ ] Coverage is ≥90% for modified modules
- [ ] Property-based tests added for edge cases (if applicable)
- [ ] Mocks used for external boundaries (network, DB, filesystem)
- [ ] Test names clearly describe what is being tested

### 🔍 Static Analysis

- [ ] Ruff linter passes: `uv run ruff check .`
- [ ] MyPy type checker passes: `uv run mypy packages/ai_web_feeds/src/`
- [ ] ESLint passes (if TypeScript): `cd apps/web && pnpm lint`
- [ ] TypeScript compiler passes: `cd apps/web && pnpm tsc --noEmit`
- [ ] No warnings in build output

### 📚 Documentation

- [ ] Feature documentation updated in `.mdx` files (not `.md`)
- [ ] Frontmatter includes `title` and `description`
- [ ] Navigation updated in `apps/web/content/docs/meta.json`
- [ ] API contracts updated in `contracts/openapi.yaml` (if applicable)
- [ ] README updated (if user-facing changes)
- [ ] CHANGELOG.md updated with user-facing changes

### 🏗️ Constitution Compliance

- [ ] **Principle I**: All docs are `.mdx` in `apps/web/content/docs/`
- [ ] **Principle II**: No circular dependencies between components
- [ ] **Principle III**: All code has type annotations
- [ ] **Principle IV**: ≥90% test coverage maintained
- [ ] **Principle V**: Data schemas validated (if data model changes)
- [ ] **Principle VI**: Modern stack used (Python 3.13+, Next.js 15+)
- [ ] **Principle VII**: Code quality tools pass (ruff, mypy, eslint)

### 🚀 Functionality

- [ ] Feature works as described in `spec.md`
- [ ] Edge cases handled (see spec.md Edge Cases section)
- [ ] Error messages are user-friendly
- [ ] Performance meets NFRs (if applicable, see spec.md NFR section)
- [ ] Logging is appropriate (not too verbose, not too sparse)
- [ ] No TODOs or FIXMEs left in code without tracking issue

### 🔒 Security & Privacy

- [ ] No secrets or API keys hardcoded
- [ ] User input is validated and sanitized
- [ ] SQL queries use parameterized statements (no raw SQL concatenation)
- [ ] File paths are validated to prevent path traversal
- [ ] Rate limiting considered (if API endpoint)

### 📦 Dependencies

- [ ] New dependencies justified in PR description
- [ ] Dependencies added to `pyproject.toml` or `package.json`
- [ ] Dependency versions pinned or use compatible version ranges
- [ ] License compatibility verified (all deps must be permissive: MIT, Apache 2.0, BSD)

---

## Review Checklist (Reviewer)

### 🎯 Correctness

- [ ] Code logic is correct and matches spec requirements
- [ ] Algorithm complexity is appropriate (no unnecessary O(n²) loops)
- [ ] Data structures are optimal for access patterns
- [ ] Concurrency is handled correctly (no race conditions)
- [ ] Memory management is efficient (no leaks, streaming for large data)

### 🧪 Test Quality

- [ ] Tests cover happy path, edge cases, and error conditions
- [ ] Test names are descriptive: `test_<function>_<scenario>_<expected_outcome>`
- [ ] Mocks are appropriate and minimal
- [ ] Assertions are specific (not just `assert result`)
- [ ] Test data is realistic and representative

### 📖 Readability

- [ ] Code is self-documenting (clear names, good structure)
- [ ] Comments explain "why", not "what"
- [ ] Complex logic is broken into smaller functions
- [ ] Magic numbers are replaced with named constants
- [ ] Code follows single responsibility principle

### 🔧 Maintainability

- [ ] Code is modular and reusable
- [ ] Dependencies are minimal and decoupled
- [ ] Configuration is externalized (no hardcoded values)
- [ ] Code is easy to extend (follows open/closed principle)

### 🚀 Performance

- [ ] Database queries are optimized (indexes used where appropriate)
- [ ] No N+1 query problems
- [ ] Caching is used appropriately
- [ ] Async/await used for I/O operations
- [ ] Large datasets are paginated or streamed

### 🎨 UI/UX (if applicable)

- [ ] Component is accessible (WCAG 2.1 AA)
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Loading states are shown for async operations
- [ ] Error states are user-friendly
- [ ] Design tokens used consistently

---

## Review Comments Template

### Blocking Issues (Must Fix Before Merge)

```markdown
**[BLOCKING]** Missing test coverage for `function_name()`
- **Impact**: Violates Principle IV (≥90% coverage)
- **Action**: Add unit tests with edge cases
- **Reference**: tasks.md T060a-T060j
```

### Non-Blocking Suggestions (Consider for Future)

```markdown
**[SUGGESTION]** Consider caching this computation
- **Why**: This function is called in a loop (O(n²) complexity)
- **Alternative**: Precompute and cache results, or use memoization
- **Reference**: NFR-007 (caching strategy)
```

### Praise (Highlight Good Practices)

```markdown
**[EXCELLENT]** Great use of property-based testing with Hypothesis
- **Why**: This caught edge cases that unit tests missed
- **Impact**: Improves code robustness significantly
```

---

## Merge Criteria (All Must Be ✅)

### Required Checks

- [ ] All CI/CD checks passing
- [ ] Code review approved by at least 1 maintainer
- [ ] No unresolved blocking comments
- [ ] Test coverage ≥90% for modified modules
- [ ] Documentation updated
- [ ] Constitution compliance verified (7/7 principles)

### Optional Pre-Merge Tasks

- [ ] Squash commits for clean history
- [ ] Update PR description with final implementation notes
- [ ] Add screenshots/demo for UI changes
- [ ] Notify relevant stakeholders

---

## Post-Merge Tasks

- [ ] Verify deployment (if applicable)
- [ ] Monitor logs for errors (first 24 hours)
- [ ] Update project board/tracking tool
- [ ] Close related issues
- [ ] Celebrate! 🎉

