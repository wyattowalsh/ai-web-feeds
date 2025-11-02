# AI Web Feeds CLI

Command-line interface for managing AI/ML feed sources.

## Installation

```bash
# From project root
uv sync

# Or install directly
uv pip install -e apps/cli
```

## Quick Start

```bash
# 1. Enrich feeds from feeds.yaml
aiwebfeeds enrich all

# 2. Generate OPML files
aiwebfeeds opml all
aiwebfeeds opml categorized

# 3. View statistics
aiwebfeeds stats show

# 4. Generate filtered OPML
aiwebfeeds opml filtered data/nlp-feeds.opml --topic nlp --verified
```

## Commands

### `enrich` - Enrich Feed Data

Enrich feeds with metadata, discover feed URLs, validate formats, and save to database.

```bash
# Enrich all feeds
aiwebfeeds enrich all

# Custom paths
aiwebfeeds enrich all \
  --input data/feeds.yaml \
  --output data/feeds.enriched.yaml \
  --schema data/feeds.enriched.schema.json \
  --database sqlite:///data/aiwebfeeds.db

# Preview enrichment for one feed
aiwebfeeds enrich one <feed-id>
```

**What it does:**
- Discovers feed URLs from site URLs (if `discover: true`)
- Detects feed format (RSS, Atom, JSONFeed)
- Validates feed accessibility
- Saves to:
  - `feeds.enriched.yaml` - Enriched YAML with all metadata
  - `feeds.enriched.schema.json` - JSON schema for validation
  - `aiwebfeeds.db` - SQLite database

### `opml` - Generate OPML Files

Generate OPML files for feed readers.

```bash
# All feeds (flat list)
aiwebfeeds opml all --output data/all.opml

# Categorized by source type
aiwebfeeds opml categorized --output data/categorized.opml

# Filtered OPML
aiwebfeeds opml filtered <output-file> [OPTIONS]

Options:
  --topic, -t      Filter by topic (e.g., nlp, mlops)
  --type, -T       Filter by source type (e.g., blog, podcast)
  --tag, -g        Filter by tag (e.g., official, community)
  --verified, -v   Only include verified feeds
```

**Examples:**

```bash
# NLP-related feeds only
aiwebfeeds opml filtered data/nlp.opml --topic nlp

# Official blogs
aiwebfeeds opml filtered data/official-blogs.opml \
  --type blog \
  --tag official

# Verified ML podcasts
aiwebfeeds opml filtered data/ml-podcasts.opml \
  --topic ml \
  --type podcast \
  --verified
```

### `stats` - View Statistics

Display feed statistics and summaries.

```bash
aiwebfeeds stats show
```

Example output:
```
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

Export feed data in various formats (coming soon).

```bash
aiwebfeeds export json    # Export as JSON
aiwebfeeds export csv     # Export as CSV
```

### `validate` - Validate Data

Validate feed data against schemas (coming soon).

```bash
aiwebfeeds validate       # Validate feeds.yaml
```

## Workflow

### Initial Setup

```bash
# 1. Create or edit data/feeds.yaml with your feed sources
# 2. Enrich the feeds
aiwebfeeds enrich all

# 3. Generate OPML files for your feed reader
aiwebfeeds opml all
aiwebfeeds opml categorized

# 4. Check the results
aiwebfeeds stats show
```

### Adding New Feeds

```bash
# 1. Add feed entries to data/feeds.yaml
# 2. Re-enrich
aiwebfeeds enrich all

# 3. Regenerate OPML files
aiwebfeeds opml all
aiwebfeeds opml categorized
```

### Creating Custom Feed Collections

```bash
# Create topic-specific OPML files
aiwebfeeds opml filtered data/nlp.opml --topic nlp
aiwebfeeds opml filtered data/mlops.opml --topic mlops
aiwebfeeds opml filtered data/research.opml --topic research

# Create type-specific collections
aiwebfeeds opml filtered data/podcasts.opml --type podcast
aiwebfeeds opml filtered data/blogs.opml --type blog

# Verified feeds only
aiwebfeeds opml filtered data/verified.opml --verified

# Combine filters for precise collections
aiwebfeeds opml filtered data/verified-nlp-blogs.opml \
  --topic nlp \
  --type blog \
  --verified
```

## Configuration

### `test` - Run Test Suite

Run tests using `uv` and `pytest`. **New in this version!**

```bash
# Run all tests
aiwebfeeds test all

# Run unit tests only
aiwebfeeds test unit

# Run integration tests
aiwebfeeds test integration

# Run E2E tests
aiwebfeeds test e2e

# Quick test (fast unit tests)
aiwebfeeds test quick

# With coverage report
aiwebfeeds test coverage

# Coverage with browser
aiwebfeeds test coverage --open

# Run specific file
aiwebfeeds test file packages/ai_web_feeds/unit/test_models.py

# Debug mode
aiwebfeeds test debug

# Watch mode (re-run on changes)
aiwebfeeds test watch

# List test markers
aiwebfeeds test markers
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
aiwebfeeds test quick                    # Quick check
aiwebfeeds test all -v                   # Full run
aiwebfeeds test coverage --open          # Coverage report

# CI/CD
aiwebfeeds test all --coverage --parallel

# Debugging
aiwebfeeds test debug packages/ai_web_feeds/unit/test_models.py
aiwebfeeds test file test_storage.py -k "test_add_feed"
```

See [TEST_COMMAND.md](./TEST_COMMAND.md) for detailed documentation.

### Environment Variables

```bash
# Database location
export AIWF_DATABASE_URL=sqlite:///data/aiwebfeeds.db

# Logging
export AIWF_LOGGING__LEVEL=INFO
export AIWF_LOGGING__FILE=True
export AIWF_LOGGING__FILE_PATH=logs/aiwebfeeds.log
```

### File Locations

By default, the CLI expects:
- Input: `data/feeds.yaml`
- Output: `data/feeds.enriched.yaml`
- Schema: `data/feeds.enriched.schema.json`
- Database: `data/aiwebfeeds.db`
- OPML: `data/*.opml`

Override with command options (`--input`, `--output`, `--database`, etc.)

## Help

Get help for any command:

```bash
# General help
aiwebfeeds --help

# Command-specific help
aiwebfeeds enrich --help
aiwebfeeds opml --help
aiwebfeeds opml filtered --help
```

## See Also

- [Core Package README](../../packages/ai_web_feeds/README.md) - Python API documentation
- [Feeds Schema](../../data/feeds.schema.json) - Input feed schema
- [Enriched Schema](../../data/feeds.enriched.schema.json) - Output feed schema
