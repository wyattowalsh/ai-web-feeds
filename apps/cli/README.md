# ai-web-feeds CLI

Command-line interface for managing AI/ML feed sources.

Preferred command: `ai-web-feeds`.

## Installation

```bash
# From project root
uv sync

# Or sync the CLI workspace directly
cd apps/cli
uv sync
```

## Quick Start

```bash
# 1. Enrich feeds from feeds.yaml
ai-web-feeds enrich all

# 2. Generate OPML files
ai-web-feeds opml all
ai-web-feeds opml categorized

# 3. View statistics
ai-web-feeds stats show

# 4. Generate filtered OPML
ai-web-feeds opml filtered data/nlp-feeds.opml --topic nlp --verified
```

## Commands

### `enrich` - Enrich Feed Data

Enrich feeds with metadata, discover feed URLs, validate formats, and save to database.

```bash
# Enrich all feeds
ai-web-feeds enrich all

# Custom paths
ai-web-feeds enrich all \
  --input data/feeds.yaml \
  --output data/feeds.enriched.yaml \
  --schema data/feeds.enriched.schema.json \
  --database sqlite:///data/ai-web-feeds.db

# Preview enrichment for one feed
ai-web-feeds enrich one <feed-id>
```

**What it does:**

- Discovers feed URLs from site URLs (if `discover: true`)
- Detects feed format (RSS, Atom, JSONFeed)
- Validates feed accessibility
- Saves to:
  - `feeds.enriched.yaml` - Enriched YAML with all metadata
  - `feeds.enriched.schema.json` - JSON schema for validation
  - `ai-web-feeds.db` - canonical SQLite database

### `opml` - Generate OPML Files

Generate OPML files for feed readers.

```bash
# All feeds (flat list)
ai-web-feeds opml all --output data/feeds.opml

# Categorized by source type
ai-web-feeds opml categorized --output data/feeds.categorized.opml

# Filtered OPML
ai-web-feeds opml filtered <output-file> [OPTIONS]

Options:
  --topic, -t      Filter by topic (e.g., nlp, mlops)
  --type, -T       Filter by source type (e.g., blog, podcast)
  --tag, -g        Filter by tag (e.g., official, community)
  --verified, -v   Only include verified feeds
```

**Examples:**

```bash
# NLP-related feeds only
ai-web-feeds opml filtered data/nlp.opml --topic nlp

# Official blogs
ai-web-feeds opml filtered data/official-blogs.opml \
  --type blog \
  --tag official

# Verified ML podcasts
ai-web-feeds opml filtered data/ml-podcasts.opml \
  --topic ml \
  --type podcast \
  --verified
```

### `stats` - View Statistics

Display feed statistics and summaries.

```bash
ai-web-feeds stats show
```

Example output:

```text
📊 Feed Statistics
══════════════════════════════════════════════════
Total Feeds: 150
Verified: 120 (80.0%)

 By Source Type:
  blog            :  45
  preprint        :  30
  podcast         :  20
  organization    :  15
  newsletter      :  12
  video           :  10
  aggregator      :   8
  journal         :   5
  docs            :   3
  forum           :   2
══════════════════════════════════════════════════
```

### `export` - Export Data

Export feed data in current generated formats.

```bash
uv run ai-web-feeds export json    # Export as JSON
uv run ai-web-feeds export csv     # Export as CSV
```

### `validate` - Validate Data

Validate feed data against schemas.

```bash
uv run ai-web-feeds validate feeds # Validate feeds.yaml
```

## Workflow

### Initial Setup

```bash
# 1. Create or edit data/feeds.yaml with your feed sources
# 2. Enrich the feeds
ai-web-feeds enrich all

# 3. Generate OPML files for your feed reader
ai-web-feeds opml all
ai-web-feeds opml categorized

# 4. Check the results
ai-web-feeds stats show
```

### Adding New Feeds

```bash
# 1. Add articles to data/feeds.yaml
# 2. Re-enrich
ai-web-feeds enrich all

# 3. Regenerate OPML files
ai-web-feeds opml all
ai-web-feeds opml categorized
```

### Creating Custom Feed Collections

```bash
# Create topic-specific OPML files
ai-web-feeds opml filtered data/nlp.opml --topic nlp
ai-web-feeds opml filtered data/mlops.opml --topic mlops
ai-web-feeds opml filtered data/research.opml --topic research

# Create type-specific collections
ai-web-feeds opml filtered data/podcasts.opml --type podcast
ai-web-feeds opml filtered data/blogs.opml --type blog

# Verified feeds only
ai-web-feeds opml filtered data/verified.opml --verified

# Combine filters for precise collections
ai-web-feeds opml filtered data/verified-nlp-blogs.opml \
  --topic nlp \
  --type blog \
  --verified
```

## Configuration

### `test` - Run Test Suite

Run tests using `uv` and `pytest`. **New in this version!**

```bash
# Run all tests
ai-web-feeds test all

# Run unit tests only
ai-web-feeds test unit

# Run integration tests
ai-web-feeds test integration

# Run E2E tests
ai-web-feeds test e2e

# Quick test (fast unit tests)
ai-web-feeds test quick

# With coverage report
ai-web-feeds test coverage

# Coverage with browser
ai-web-feeds test coverage --open

# Run specific file
ai-web-feeds test file packages/ai_web_feeds/unit/test_models.py

# Debug mode
ai-web-feeds test debug

# Watch mode (re-run on changes)
ai-web-feeds test watch

# List test markers
ai-web-feeds test markers
```

**Common Options:**

- `--verbose, -v` - Verbose output
- `--coverage, -c` - Generate coverage report
- `--parallel, -p` - Run tests in parallel
- `--fast, -f` - Skip slow tests (unit tests only)
- `--open, -o` - Open coverage report in browser

**Test Categories:**

- `unit` - Fast, isolated component tests
- `integration` - Multi-component tests
- `e2e` - Full workflow tests
- `slow` - Tests that take longer to run
- `network` - Tests requiring network access

**Examples:**

```bash
# Development workflow
ai-web-feeds test quick                  # Quick check
ai-web-feeds test all -v                 # Full run
ai-web-feeds test coverage --open        # Coverage report

# CI/CD
ai-web-feeds test all --coverage --parallel

# Debugging
ai-web-feeds test debug packages/ai_web_feeds/unit/test_models.py
ai-web-feeds test file test_storage.py -k "test_add_feed"
```

See [TEST_COMMAND.md](./TEST_COMMAND.md) for detailed documentation.

### Environment Variables

```bash
# Database location
export AIWF_DATABASE_URL=sqlite:///data/ai-web-feeds.db

# Logging
export AIWF_LOGGING__LEVEL=INFO
export AIWF_LOGGING__FILE=True
export AIWF_LOGGING__FILE_PATH=logs/ai-web-feeds.log
```

### File Locations

By default, the CLI expects:

- Input: `data/feeds.yaml`
- Output: `data/feeds.enriched.yaml`
- Schema: `data/feeds.enriched.schema.json`
- Database: `data/ai-web-feeds.db`
- OPML: `data/*.opml`

Override with command options (`--input`, `--output`, `--database`, etc.)

## Help

Get help for any command:

```bash
# General help
ai-web-feeds --help

# Command-specific help
ai-web-feeds enrich --help
ai-web-feeds opml --help
ai-web-feeds opml filtered --help
```

## See Also

- [Core Package README](../../packages/ai_web_feeds/README.md) - Python API
  documentation
- [Feeds Schema](../../data/feeds.schema.json) - Input feed schema
- [Enriched Schema](../../data/feeds.enriched.schema.json) - Output feed schema
