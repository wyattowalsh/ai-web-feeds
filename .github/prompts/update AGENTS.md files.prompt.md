______________________________________________________________________

## mode: agent description: Comprehensive prompt for systematically updating all AGENTS.md files across the AIWebFeeds monorepo to create a unified, navigable, LLM-optimized documentation system

# Task: Comprehensive AGENTS.md Documentation System Update

**Estimated Time**: 85 minutes\
**Complexity**: Medium\
**Impact**: High (affects all AI agent interactions with codebase)\
**Prerequisites**: Understanding of project structure, markdown, and documentation best
practices

______________________________________________________________________

## Objective

Systematically audit, refactor, and enhance all `AGENTS.md` files across the AIWebFeeds
monorepo to establish a cohesive, navigable, and LLM-optimized documentation system that
serves as the primary reference for AI coding agents.

**Goal**: Transform disparate AGENTS.md files into an interconnected knowledge graph
that enables efficient agent navigation, clear component understanding, and actionable
development guidance.

## Context

**Project**: AIWebFeeds - Hybrid monorepo combining Python (uv) and TypeScript (pnpm)
for RSS/Atom feed management

**Architecture**: Documentation-first, component-isolated design with LLM-optimized
formats

**Components & Documentation Hierarchy**:

```
/ (Root)
├── AGENTS.md ..................... Hub & navigation (PRIMARY ENTRY)
│
├── packages/ai_web_feeds/
│   └── AGENTS.md ................. Core Python library patterns
│
├── apps/cli/
│   └── AGENTS.md ................. Typer CLI command patterns
│
├── apps/web/
│   └── AGENTS.md ................. Next.js/FumaDocs web patterns
│
├── tests/
│   └── AGENTS.md ................. pytest testing strategies
│
└── .github/
    └── AGENTS.md ................. GitHub workflows & templates
```

**Current State**: Files exist but lack consistency, navigation structure, and proper
cross-referencing

**Desired State**: Unified documentation system with clear hierarchy, bidirectional
links, and DRY principle adherence

## Requirements

### 1. Structure & Format

Each `AGENTS.md` file MUST include these sections in order:

```markdown
# [Component Name] - Agent Instructions

> **Component**: [Brief description]
> **Location**: [Relative path]
> **Parent**: [Link to parent AGENTS.md]

## 📍 Essential Links

- **Full Documentation**: [Link to llms-full.txt section]
- **[Relevant Doc 1]**: [Link]
- **[Relevant Doc 2]**: [Link]
- **Root Instructions**: [Link to root AGENTS.md]

---

## 🎯 Purpose

[2-3 sentence description of component's role]
[Bullet list of 3-6 key responsibilities]

**Stack**: [Key technologies, versions]

---

## 🏗️ Architecture

```

[Minimal ASCII tree of directory structure]

````

**See**: [Link to llms-full.txt] for detailed module documentation

---

## 📐 Development Rules

### 1. [Pattern Name]
```[language]
# ✅ Correct pattern
[code example]

# ❌ Incorrect pattern
[code example]
````

[Repeat for 3-5 key patterns]

______________________________________________________________________

## 🧪 Testing

**Location**: [Test directory]

```bash
# Run tests command
```

**Patterns**:

- [Key testing pattern 1]
- [Key testing pattern 2]

**See**: [Link to tests/AGENTS.md or testing docs]

______________________________________________________________________

## 🔄 Common Tasks

### [Task Name]

[Numbered step-by-step checklist]

[Repeat for 3-5 common tasks]

______________________________________________________________________

## 🚨 Critical Patterns

### DO

✅ [Pattern 1] ✅ [Pattern 2] [5-7 DO items]

### DON'T

❌ [Anti-pattern 1] ❌ [Anti-pattern 2] [5-7 DON'T items]

______________________________________________________________________

## 📚 Reference

**[Resource name]**: [Link] [3-5 key reference links]

______________________________________________________________________

*Updated: October 2025 · Version: 0.1.0*

````

### 2. Content Guidelines

**Abstract & Distilled**:
- ❌ Remove: Verbose explanations, tutorials, implementation details
- ✅ Include: Patterns, rules, checklists, decision trees
- ✅ Format: Bullets > paragraphs, tables > prose, examples > descriptions
- 📏 Length: 150-200 lines per component file, ≤250 for root
- 🎯 Focus: "What patterns to follow" not "how things work internally"

**Referential (DRY Principle)**:
- Link to `llms-full.txt` for comprehensive details (avoid duplication)
- Cross-reference related `AGENTS.md` files for component interactions
- Use `file:///absolute/path` syntax for IDE-clickable web component references
- Include parent → child hierarchy links in header
- Reference external docs (FumaDocs, pytest, Typer) instead of re-explaining

**Clear & Scannable (LLM-Optimized)**:
- Emoji section headers for visual anchoring: 📍 🎯 🏗️ 📐 🧪 🔄 🚨 📚
- Code examples always show ✅ correct THEN ❌ incorrect patterns
- Use tables for comparisons, navigation, and multi-dimensional data
- Front-load critical information (inverted pyramid style)
- Progressive disclosure: summary → details → references

**Consistency Standards**:
- Identical section order across all component files
- Matching emoji headers (📍 Essential Links, 🎯 Purpose, etc.)
- Uniform code block formatting with language specification
- Consistent terminology (e.g., "Core Package" not "core lib" or "main package")
- Standard footer: `*Updated: October 2025 · Version: 0.1.0*`

### 3. Linking Standards

**Root AGENTS.md** must include:
```markdown
## 📍 Quick Navigation

| Component | Path | Reference Docs |
|-----------|------|----------------|
| **Core Package** | [`packages/ai_web_feeds/`](packages/ai_web_feeds/) | [`AGENTS.md`](packages/ai_web_feeds/AGENTS.md) · [Full Docs](https://aiwebfeeds.com/llms-full.txt#core-package) |
| **CLI** | [`apps/cli/`](apps/cli/) | [`AGENTS.md`](apps/cli/AGENTS.md) · [CLI Docs](https://aiwebfeeds.com/docs/cli) |
| **Web** | [`apps/web/`](apps/web/) | [`AGENTS.md`](apps/web/AGENTS.md) · [#file:web](file:///Users/ww/dev/projects/ai-web-feeds/apps/web) |
| **Tests** | [`tests/`](tests/) | [`AGENTS.md`](tests/AGENTS.md) · [Testing Guide](https://aiwebfeeds.com/docs/contributing/testing) |
````

**Component AGENTS.md** must include:

```markdown
## 📍 Essential Links

- **Full Documentation**: [llms-full.txt#[section]](https://aiwebfeeds.com/llms-full.txt#[section])
- **Root Instructions**: [../../AGENTS.md](../../AGENTS.md)
- **[Related Component]**: [../../[path]/AGENTS.md](../../[path]/AGENTS.md)
```

### 4. Component-Specific Requirements

**Core Package (`packages/ai_web_feeds/AGENTS.md`)**:

- **Focus**: Python module patterns, ORM models, type safety
- **Key Sections**:
  - Module architecture (fetcher.py, storage.py, models.py, analytics.py)
  - Pydantic/SQLModel validation patterns
  - Database migration workflow (Alembic)
  - Async patterns with httpx
- **Critical Patterns**: Type hints, context managers, error handling
- **References**: Link to testing patterns, root workflow, llms-full.txt#core-package

**CLI (`apps/cli/AGENTS.md`)**:

- **Focus**: Typer command structure, Rich UI components
- **Key Sections**:
  - Command registration and organization
  - Rich table/panel/progress patterns
  - Error handling with exit codes
  - Option/argument validation
- **Critical Patterns**: Don't re-implement core logic, use Rich for all output
- **References**: Core package for business logic, testing for CLI testing patterns

**Web (`apps/web/AGENTS.md`)**:

- **Focus**: FumaDocs content structure, Next.js patterns
- **Key Sections**:
  - MDX content organization in `content/docs/`
  - Navigation via `meta.json` configuration
  - Custom MDX component usage
  - LLM docs generation (`/llms-full.txt`, `/llms.txt`)
  - Feed generation (RSS/Atom/JSON)
- **Critical Patterns**: Never create standalone `.md` files, always use FumaDocs
  structure
- **References**: Use `file:///absolute/path` for web-specific references
- **Special Note**: Emphasize documentation-first development

**Tests (`tests/AGENTS.md`)**:

- **Focus**: pytest patterns, coverage requirements, test organization
- **Key Sections**:
  - Test markers (`@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.e2e`)
  - Fixture patterns in `conftest.py`
  - Mocking strategies (pytest-mock, httpx mocking)
  - Property-based testing with Hypothesis
  - Coverage requirements (≥90%)
- **Critical Patterns**: Write tests first (TDD), mock external dependencies
- **Test Types Table**:
  | Type        | Speed   | Dependencies | Use Case           |
  | ----------- | ------- | ------------ | ------------------ |
  | Unit        | \<100ms | Mocked       | Isolated functions |
  | Integration | \<1s    | Test DB      | Multi-component    |
  | E2E         | \<10s   | Real infra   | Full workflows     |

**Root (`/AGENTS.md`)**:

- **Focus**: Navigation hub, high-level architecture, unified workflow
- **Key Sections**:
  - Component navigation table (PRIMARY)
  - Technology stack overview
  - Core principles (documentation-first, component isolation, quality standards)
  - Standard workflow (read → create → implement → test → document)
  - AI agent critical rules checklist
- **Critical Patterns**: First file agents should read, links to all other AGENTS.md
  files
- **Length**: Can exceed 200 lines (max 250) due to navigation responsibilities

**GitHub (`/.github/AGENTS.md`)**:

- **Focus**: Minimal - GitHub-specific configuration only
- **Key Sections**:
  - Issue/PR template guidelines
  - Workflow patterns (when CI/CD added)
  - Brief community file references
- **Critical Patterns**: Keep brief, link to root for main workflow
- **Length**: 50-75 lines maximum

## Constraints

1. **No Breaking Changes**: Maintain existing file paths, structure, and public APIs
1. **Consistency First**: All files MUST follow identical template structure
1. **Brevity Over Completeness**: Prefer bullet points and checklists over paragraphs
1. **DRY Principle**: Reference `llms-full.txt` instead of duplicating detailed content
1. **Zero Markdown Lint Errors**: Follow markdown best practices strictly
1. **Line Length**: Maximum 100 characters per line for readability and git diff clarity
1. **Code Block Fencing**: Always specify language (python, typescript, bash, json,
   yaml, etc.)
1. **No Orphaned Content**: Every assertion must cite a source (code example, reference
   link, or pattern)
1. **Version Consistency**: All files must show same version in footer
1. **Accessibility**: Use semantic markdown (proper heading hierarchy, alt text for
   conceptual diagrams)

## Success Criteria

✅ **Navigation Efficiency**: Can navigate from root to any component AGENTS.md in
exactly 1 click ✅ **Three-Question Test**: Each file clearly answers:

- "What is this component?"
- "How do I work with it correctly?"
- "Where do I learn more details?" ✅ **Structural Consistency**: All files use identical
  section structure and emoji headers ✅ **Reference Integrity**: All `llms-full.txt`
  links functional with proper section anchors ✅ **Length Compliance**: Component files
  ≤200 lines, root ≤250 lines ✅ **Actionability**: Every section provides concrete
  patterns, checklists, or decision trees ✅ **Bidirectional Links**: Parent ↔ child and
  component ↔ component links work both ways ✅ **Zero Duplication**: Detailed docs live
  exclusively in `llms-full.txt` or `apps/web/content/docs/` ✅ **Code Quality**: All
  code examples show both ✅ correct AND ❌ incorrect patterns ✅ **Searchability**: Key
  terms and patterns are easy to grep/search across all files

## Deliverables

1. Updated `/AGENTS.md` (root navigation hub)
1. Updated `/packages/ai_web_feeds/AGENTS.md`
1. Updated `/apps/cli/AGENTS.md`
1. Updated `/apps/web/AGENTS.md`
1. Updated `/tests/AGENTS.md`
1. Updated `/.github/AGENTS.md`

## Validation Steps

After completion, verify each deliverable against this checklist:

### Structural Validation

1. [ ] All AGENTS.md files follow the standard template exactly
1. [ ] Navigation table in root links to all 5 component AGENTS.md files
1. [ ] Each component file links back to root in "Essential Links" section
1. [ ] All `llms-full.txt` links include proper section anchors
1. [ ] Emoji section headers are consistent across all files (📍 🎯 🏗️ 📐 🧪 🔄 🚨 📚)

### Content Validation

6. [ ] Code examples demonstrate both ✅ correct AND ❌ incorrect patterns
1. [ ] DO/DON'T lists contain 5-7 actionable items each
1. [ ] No markdown lint errors in any file
1. [ ] File lengths comply: component ≤200 lines, root ≤250 lines
1. [ ] Version footer matches exactly: `*Updated: October 2025 · Version: 0.1.0*`

### Link Validation

11. [ ] All relative paths (../../) resolve correctly
01. [ ] All absolute URLs (https://) are reachable
01. [ ] Web component uses `file:///absolute/path` references
01. [ ] Cross-references between components work bidirectionally

### Quality Validation

15. [ ] Each file passes the "Three-Question Test" (What/How/Where)
01. [ ] No duplicated content between AGENTS.md and llms-full.txt
01. [ ] Architecture diagrams use ASCII trees for simplicity
01. [ ] Testing sections link to appropriate test files/docs
01. [ ] Common tasks use numbered checklists, not paragraphs
01. [ ] Reference sections include 3-5 curated external links

## Notes

### Best Practices for Execution

1. **Read First, Write Second**: Before editing any file, read the existing content to
   understand project-specific conventions
1. **AI Agent Usability > Human Aesthetics**: Optimize for parsing, not presentation
1. **Assumed Reading Order**: Agents will read `root AGENTS.md` → `component AGENTS.md`
   → `llms-full.txt` in sequence
1. **Path Resolution**: Use relative paths for internal links (`../../`), absolute URLs
   for external (`https://`)
1. **When in Doubt**: Favor brevity and referencing over attempting completeness

### Decision Framework

**Include in AGENTS.md IF**:

- ✅ Pattern/rule that agents need immediately
- ✅ Decision tree for choosing between options
- ✅ Critical do/don't for avoiding common mistakes
- ✅ Quick reference checklist

**Delegate to llms-full.txt IF**:

- ➡️ Implementation details or "how it works" explanations
- ➡️ Comprehensive API documentation
- ➡️ Historical context or design rationale
- ➡️ Extended examples or tutorials

### Quality Indicators

**Good AGENTS.md File**:

- Can be scanned in \<60 seconds
- Answers "what patterns to follow" not "how internals work"
- Links work and point to correct sections
- Code examples are minimal but illustrative
- No repetition of content available elsewhere

**Poor AGENTS.md File**:

- Requires >5 minutes to read
- Duplicates content from other docs
- Links broken or pointing to wrong sections
- Code examples are full implementations
- Explains concepts instead of prescribing patterns

### Component Interaction Patterns

```
Root AGENTS.md (Hub)
    ↓
    ├─→ Core Package ──→ (provides logic to) ──→ CLI
    ├─→ CLI ──→ (imports from) ──→ Core Package
    ├─→ Web ──→ (documents) ──→ All Components
    ├─→ Tests ──→ (validates) ──→ All Components
    └─→ GitHub ──→ (orchestrates) ──→ All Components
```

Each component's AGENTS.md should acknowledge these relationships in the "Essential
Links" section.

______________________________________________________________________

## Execution Strategy

### Phase 1: Audit & Plan (10 minutes)

1. Read all existing AGENTS.md files (6 total)
1. Identify inconsistencies in structure, terminology, and linking
1. Note any project-specific conventions to preserve
1. Create mental map of component relationships

### Phase 2: Root First (15 minutes)

1. Update `/AGENTS.md` as the primary navigation hub
1. Establish canonical terminology and section structure
1. Create complete component navigation table
1. Define standard workflow and critical rules
1. **Validation**: Can you navigate to any component in 1 click?

### Phase 3: Components (40 minutes, ~8 min each)

Update in this order (dependencies first):

1. **Core Package** (`packages/ai_web_feeds/AGENTS.md`) - Foundation
1. **Tests** (`tests/AGENTS.md`) - Validates core
1. **CLI** (`apps/cli/AGENTS.md`) - Uses core
1. **Web** (`apps/web/AGENTS.md`) - Documents all
1. **GitHub** (`.github/AGENTS.md`) - Minimal updates

For each:

- Apply standard template
- Add bidirectional links
- Include component-specific patterns
- Verify length limits
- Test all links

### Phase 4: Cross-Reference Validation (10 minutes)

1. Verify all links resolve correctly
1. Check for circular references or orphaned content
1. Ensure consistent terminology across all files
1. Confirm no content duplication
1. Test navigation flow: root → component → back to root

### Phase 5: Final Quality Check (10 minutes)

1. Run through all 20 validation checklist items
1. Fix any markdown lint errors
1. Verify code examples show ✅ and ❌ patterns
1. Confirm version footers match
1. Test "Three-Question Test" on each file

**Total Estimated Time**: 85 minutes

______________________________________________________________________

## Example: Good vs. Bad Patterns

### ❌ BAD: Verbose, Implementation-Focused

```markdown
## Fetcher Module

The fetcher module is responsible for downloading RSS and Atom feeds from the internet.
It uses the httpx library because it supports both synchronous and asynchronous requests,
which is important for performance when fetching multiple feeds. The module includes
retry logic using the tenacity library, which will automatically retry failed requests
up to 3 times with exponential backoff. Here's how it works:

First, the `fetch_feed()` function takes a URL parameter...
[continues for 50 more lines]
```

### ✅ GOOD: Pattern-Focused, Concise

````markdown
## 📐 Development Rules

### 1. Fetcher Patterns
```python
# ✅ Correct: Use async with retry
@retry(stop=stop_after_attempt(3))
async def fetch_feed(url: str) -> bytes:
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=30)
        return response.content

# ❌ Incorrect: Synchronous without retry
def fetch_feed(url):
    return requests.get(url).content
````

**See**: [llms-full.txt#fetcher](https://aiwebfeeds.com/llms-full.txt#fetcher) for
implementation details

````

### ❌ BAD: Missing Links, No Context
```markdown
## Testing

Run tests with pytest. Make sure you have coverage enabled.
````

### ✅ GOOD: Linked, Contextual

````markdown
## 🧪 Testing

**Location**: `tests/packages/ai_web_feeds/`

```bash
# Run with coverage
cd ../../tests && uv run pytest --cov
````

**Patterns**:

- Use `@pytest.mark.unit` for isolated tests
- Mock HTTP calls with `pytest-mock`
- Maintain ≥90% coverage

**See**: [../../tests/AGENTS.md](../../tests/AGENTS.md) for comprehensive testing guide

```

---

## Troubleshooting Common Issues

| Issue | Solution |
|-------|----------|
| Links broken after editing | Use relative paths (`../../`) not absolute |
| Markdown lint errors | Run linter, check code fence language tags |
| File too long (>200 lines) | Move details to llms-full.txt, keep only patterns |
| Inconsistent emoji | Copy exact emoji from template (📍 🎯 🏗️ 📐 🧪 🔄 🚨 📚) |
| Circular references | Root → Component only, not Component → Component |
| Missing context | Add "See: [link]" to relevant detailed docs |

---

## Post-Completion Checklist

After all files are updated:

- [ ] Commit with message: `docs: standardize all AGENTS.md files with unified template`
- [ ] Verify all links in a fresh checkout
- [ ] Test navigation flow: root → each component → back
- [ ] Run markdown linter on all 6 AGENTS.md files
- [ ] Update llms-full.txt if any new sections needed
- [ ] Create PR with "documentation" label
- [ ] Request review from maintainer

**Success Metric**: Can a new AI agent navigate the entire codebase using only AGENTS.md files in <5 minutes?
```
