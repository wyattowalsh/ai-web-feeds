<!--
SYNC IMPACT REPORT
==================
Version Change: Initial → 1.0.0
Created: 2025-10-22
Rationale: Initial constitution establishing core governance principles for AIWebFeeds

Modified Principles: N/A (Initial version)
Added Sections: All sections (new constitution)
Removed Sections: None

Templates Status:
✅ plan-template.md - Reviewed, aligned with principles
✅ spec-template.md - Reviewed, aligned with principles
✅ tasks-template.md - Reviewed, aligned with principles

Follow-up TODOs: None
-->

# AIWebFeeds Project Constitution

**Project**: AIWebFeeds - AI/ML Web Feed Aggregator, Toolkit, and Web App  
**Repository**: [github.com/wyattowalsh/ai-web-feeds](https://github.com/wyattowalsh/ai-web-feeds)  
**License**: Apache 2.0

---

## Core Principles

### I. Documentation-First Development (NON-NEGOTIABLE)

**The Rule**: ALL project documentation MUST exist as `.mdx` files in `apps/web/content/docs/` with proper frontmatter and navigation entries in `meta.json`. Standalone `.md` files for documentation purposes are ABSOLUTELY PROHIBITED except for: `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `AGENTS.md`, and `WARP.md` in the workspace root.

**Requirements**:
- Every new feature, API, or architectural decision MUST be documented in `.mdx` format
- Documentation updates MUST occur simultaneously with code changes, not as an afterthought
- All documentation MUST include `title` and `description` frontmatter
- Navigation MUST be updated in `apps/web/content/docs/meta.json` for discoverability
- LLM-optimized formats (`/llms-full.txt`, `/llms.txt`) MUST auto-generate from web docs

**Rationale**: Single source of truth prevents documentation drift, ensures discoverability, enables automated LLM context generation, and maintains professional standards for public-facing documentation sites.

**Validation**:
- No `.md` files exist in `packages/`, `apps/cli/`, `data/` directories
- All documentation pages have valid frontmatter with `title` and `description`
- All pages are registered in `meta.json` navigation
- LLM formats successfully generate without errors

---

### II. Component Isolation & Modularity

**The Rule**: The project MUST maintain strict separation between three primary components (Core Package, CLI, Web App), each with dedicated `AGENTS.md` files defining component-specific patterns, dependencies, and contracts.

**Requirements**:
- Core Package (`packages/ai_web_feeds/`) MUST be self-contained, providing pure Python library functionality
- CLI (`apps/cli/`) MUST only orchestrate Core Package functionality, not implement business logic
- Web App (`apps/web/`) MUST consume data files and provide documentation/exploration interfaces
- Cross-component changes MUST update all relevant `AGENTS.md` files
- No circular dependencies between components
- Each component MUST have independent test suites

**Rationale**: Modularity enables independent development, testing, and deployment. Clear boundaries prevent coupling and facilitate maintainability. Component-specific documentation reduces cognitive load.

**Validation**:
- Import analysis shows no circular dependencies
- Each component's test suite can run independently
- `AGENTS.md` files exist for each component and are synchronized
- Core Package has no dependencies on CLI or Web

---

### III. Type Safety & Data Integrity (NON-NEGOTIABLE)

**The Rule**: ALL code MUST use comprehensive type annotations. ALL data structures MUST be validated against JSON Schemas or Pydantic models. No runtime type violations are acceptable.

**Requirements**:
- **Python**: Type hints on all functions, mypy strict mode, Pydantic v2 models for validation
- **TypeScript**: Strict mode enabled, no `any` types, proper interface definitions
- **Data Files**: JSON Schema validation for `feeds.yaml`, `topics.yaml`, `feeds.enriched.yaml`
- **Database**: SQLModel models with proper constraints and relationships
- Type checking MUST pass before commits (`mypy` for Python, `tsc` for TypeScript)

**Rationale**: Type safety prevents entire classes of bugs at compile time. Schema validation ensures data integrity. Explicit types serve as inline documentation and enable better IDE support.

**Validation**:
- `uv run mypy` passes with no errors on Python codebase
- `pnpm tsc --noEmit` passes with no errors on TypeScript codebase
- All data files validate against their respective JSON schemas
- No `type: ignore` or `@ts-ignore` comments without explicit justification

---

### IV. Test-First Development (NON-NEGOTIABLE)

**The Rule**: Minimum 90% test coverage MUST be maintained. Tests MUST be written before or concurrently with implementation. TDD (Test-Driven Development) is the preferred workflow.

**Requirements**:
- **Unit Tests**: Mirror source tree structure, mock all external boundaries
- **Integration Tests**: Exercise actual integrations with minimal mocks
- **E2E Tests**: Verify complete user workflows
- **Property-Based Tests**: Use Hypothesis for edge case exploration
- All tests MUST be deterministic (no flaky tests)
- Coverage reports MUST be generated with every test run
- Tests MUST use appropriate markers (`@pytest.mark.unit`, etc.)

**Rationale**: High coverage catches regressions early. TDD encourages better design. Property-based testing discovers edge cases humans miss. Deterministic tests enable reliable CI/CD.

**Validation**:
- `uv run pytest --cov` shows ≥90% coverage for all modules
- No tests are marked as `skip` or `xfail` without justification
- Coverage HTML reports are generated in `tests/reports/coverage/`
- All tests pass consistently across multiple runs

---

### V. Data Schema Compliance

**The Rule**: ALL data files MUST conform to their respective JSON Schemas. Schema changes MUST be versioned and documented. Schema violations MUST prevent data loading.

**Requirements**:
- `data/feeds.yaml` MUST validate against `data/feeds.schema.json`
- `data/topics.yaml` MUST validate against `data/topics.schema.json`
- `data/feeds.enriched.yaml` MUST validate against `data/feeds.enriched.schema.json`
- Schema files MUST use JSON Schema Draft 7 or later
- Schema validation MUST run in CI/CD pipeline
- Breaking schema changes MUST increment major version

**Rationale**: Schemas enforce data contracts. Validation prevents corrupt data from entering the system. Versioning enables backward compatibility management.

**Validation**:
- `uv run aiwebfeeds validate all` passes without errors
- All data files parse successfully in Python and TypeScript
- No schema validation errors in CI logs
- Schema files are valid JSON Schema documents

---

### VI. Modern Stack Commitment

**The Rule**: The project MUST use modern, actively maintained dependencies. Minimum versions are enforced: Python 3.13+, Next.js 15+, React 19+, Pydantic v2, SQLAlchemy 2.0.

**Requirements**:
- Dependencies MUST be pinned in lock files (`uv.lock`, `pnpm-lock.yaml`)
- Security updates MUST be applied within 30 days of disclosure
- Major version updates MUST be evaluated quarterly
- Deprecated dependencies MUST be replaced before EOL
- New dependencies MUST be justified in documentation

**Rationale**: Modern tools provide better performance, security, and developer experience. Staying current reduces technical debt and security risks.

**Validation**:
- `uv sync` and `pnpm install` succeed without warnings
- No critical security vulnerabilities in dependency scans
- All dependencies are within supported versions
- No usage of deprecated APIs in codebase

---

### VII. Code Quality & Conventions (NON-NEGOTIABLE)

**The Rule**: ALL code MUST pass linting and formatting checks before commit. Conventional commits MUST be used. Code reviews MUST verify compliance with all principles.

**Requirements**:
- **Python**: Ruff linting and formatting, Google-style docstrings
- **TypeScript**: ESLint 9, consistent naming conventions
- **Commits**: Conventional format (`feat|fix|docs|test|refactor(scope): message`)
- **Imports**: Absolute imports only, no relative imports
- **Naming**: Clear, self-documenting names; avoid abbreviations
- **Error Handling**: Comprehensive error handling with actionable messages

**Rationale**: Consistent style reduces cognitive load. Linting catches common mistakes. Conventional commits enable automated changelog generation. Clear naming serves as documentation.

**Validation**:
- `uv run ruff check --fix .` passes with no errors
- `pnpm lint --fix` passes with no errors
- All commits follow conventional format
- No relative imports in codebase
- All public functions have docstrings

---

## Additional Standards

### Performance & Scalability

**Requirements**:
- Feed fetching MUST implement retry logic with exponential backoff
- Database queries MUST use indexes for frequently accessed fields
- Async/await patterns MUST be used for I/O-bound operations
- Web app MUST achieve Lighthouse scores: Performance ≥90, Accessibility ≥95
- API response times MUST be ≤200ms for p95

**Rationale**: Performance affects user experience and resource costs. Scalability ensures the system can grow without architectural rewrites.

---

### Security & Privacy

**Requirements**:
- No API keys or secrets MUST be committed to repository
- All external HTTP requests MUST use secure protocols (HTTPS)
- User input MUST be validated and sanitized
- Dependencies MUST be scanned for vulnerabilities
- Security patches MUST be prioritized

**Rationale**: Security breaches have severe consequences. Privacy violations erode user trust. Proactive security prevents incidents.

---

### Data Management

**Requirements**:
- Feed data MUST be canonical (deduplicated URLs)
- Topic taxonomy MUST be a valid directed acyclic graph (no cycles)
- Database migrations MUST be reversible
- Data exports MUST support OPML, JSON, and YAML formats
- Cache invalidation MUST be explicit and traceable

**Rationale**: Data quality determines system usefulness. Migrations enable schema evolution. Multiple export formats support diverse use cases.

---

## Development Workflow

### Standard Process

1. **Read Documentation**: Root `AGENTS.md` → Component `AGENTS.md` → LLM docs
2. **Create Feature Branch**: `git checkout -b feat/component-description`
3. **Write Tests First**: TDD approach, ensure tests fail before implementation
4. **Implement**: Follow type safety, error handling, and naming conventions
5. **Lint & Format**: `uv run ruff check --fix` or `pnpm lint --fix`
6. **Update Documentation**: Edit `.mdx` files in `apps/web/content/docs/`, update `meta.json`
7. **Verify Coverage**: `uv run pytest --cov` (ensure ≥90%)
8. **Commit**: Conventional commit format with clear message
9. **Code Review**: Verify all principles are satisfied

---

## Quality Gates

### Pre-Commit

- [ ] All linters pass (Ruff, ESLint, mypy)
- [ ] All tests pass (unit, integration, e2e)
- [ ] Test coverage ≥90%
- [ ] No type errors
- [ ] Documentation updated
- [ ] Conventional commit format

### Pre-Merge

- [ ] All pre-commit checks pass
- [ ] Code review approved
- [ ] CI/CD pipeline green
- [ ] No merge conflicts
- [ ] Schema validation passes
- [ ] No security vulnerabilities

### Pre-Release

- [ ] All pre-merge checks pass
- [ ] Documentation complete and accurate
- [ ] Changelog updated
- [ ] Version bumped appropriately
- [ ] Migration guides written (if breaking changes)
- [ ] LLM docs regenerated successfully

---

## Governance

### Amendment Process

1. **Proposal**: Document proposed change with rationale in `.mdx` file
2. **Discussion**: Review with maintainers and stakeholders
3. **Approval**: Requires unanimous consent from core maintainers
4. **Implementation**: Update constitution, templates, and dependent files
5. **Versioning**: Increment constitution version according to semantic rules
6. **Migration**: Update existing code/docs to comply with new principles

### Version Semantics

- **MAJOR**: Backward-incompatible changes (removed/redefined principles)
- **MINOR**: New principles or sections added
- **PATCH**: Clarifications, wording fixes, non-semantic refinements

### Compliance Review

- **Weekly**: Automated checks in CI/CD for all technical principles
- **Monthly**: Manual review of documentation completeness
- **Quarterly**: Full constitution audit and update assessment
- **Per PR**: Code reviewers MUST verify constitutional compliance

### Enforcement

- Pull requests violating principles MUST be rejected
- Repeated violations MUST be addressed through additional tooling/automation
- Principles SUPERSEDE personal preferences or convenience
- Exceptions MUST be documented and justified explicitly

---

## Implementation Notes

### For AI Agents

- **Read Constitution First**: Before any code change, review this constitution
- **Check Principle Compliance**: Verify each applicable principle
- **Update Documentation**: Always update `.mdx` files, never create `.md` files
- **Maintain Coverage**: Ensure tests reach ≥90% coverage
- **Follow Conventions**: Use absolute imports, type hints, conventional commits
- **Validate Schemas**: Run validation checks on data files

### For Human Developers

- Familiarize yourself with this constitution before contributing
- When in doubt, refer to component-specific `AGENTS.md` files
- Use pre-commit hooks to catch violations early
- Ask questions when principles conflict or are unclear
- Propose amendments through proper governance process

### For Reviewers

- Verify all quality gates are satisfied
- Check documentation updates are present and accurate
- Ensure test coverage meets minimum threshold
- Validate schema compliance for data changes
- Confirm conventional commit format
- Reject PRs that violate any non-negotiable principle

---

**Version**: 1.0.0 | **Ratified**: 2025-10-22 | **Last Amended**: 2025-10-22

---

## Appendix: Principle Mapping

### To Plan Template

- **Constitution Check Section**: Validates against all principles
- **Technical Context**: Enforces Type Safety (III) and Modern Stack (VI)
- **Project Structure**: Implements Component Isolation (II)

### To Spec Template

- **User Scenarios**: Supports Test-First Development (IV)
- **Requirements**: Enforces Documentation-First (I) and Type Safety (III)
- **Key Entities**: Validates Data Schema Compliance (V)

### To Tasks Template

- **Phase Organization**: Reflects Component Isolation (II)
- **Test Tasks**: Implements Test-First Development (IV)
- **Documentation Tasks**: Enforces Documentation-First (I)

---

**Constitution Author**: AI Agent (default) in collaboration with project context  
**Last Review**: 2025-10-22  
**Next Scheduled Review**: 2026-01-22 (Quarterly)
