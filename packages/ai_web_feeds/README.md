# AI Web Feeds - Core Package

Core library for managing AI/ML feed sources with SQLModel database, enrichment, and
OPML generation.

## Features

### 1. **Database Management** (`aiwebfeeds.db`)

- SQLModel-based database with Alembic migrations
- Tables for:
  - `feed_sources` - Feed metadata and configuration
  - `feed_items` - Individual feed entries
  - `feed_fetch_logs` - Fetch attempt tracking
  - `topics` - Topic taxonomy

### 2. **Feed Enrichment** (`feeds.enriched.yaml`)

- Automatic feed discovery from site URLs
- Feed format detection (RSS, Atom, JSONFeed)
- Metadata validation and enrichment
- Quality scoring and curation tracking

### 3. **JSON Schema Generation** (`feeds.enriched.schema.json`)

- Fully-specified schema for enriched data
- Validation support for all feed properties
- Backward-compatible with base schema

### 4. **OPML Generation**

- **All feeds** (`all.opml`) - Flat list of all feeds
- **Categorized** (`categorized.opml`) - Organized by source type
- **Filtered** - Custom filters by topic, type, tag, verification status

## Installation

```bash
# From project root
uv sync

# Install packages
cd packages/ai_web_feeds
uv pip install -e .

cd ../../apps/cli
uv pip install -e .
```

## CLI Usage

The CLI provides commands for enrichment, OPML generation, and statistics.

### Enrich Feeds

```bash
# Enrich all feeds
aiwebfeeds enrich all

# With custom paths
aiwebfeeds enrich all \
  --input data/feeds.yaml \
  --output data/feeds.enriched.yaml \
  --schema data/feeds.enriched.schema.json \
  --database sqlite:///data/aiwebfeeds.db

# Enrich a single feed (preview)
aiwebfeeds enrich one huggingface-blog
```

### Generate OPML Files

```bash
# Generate all.opml
aiwebfeeds opml all --output data/all.opml

# Generate categorized.opml
aiwebfeeds opml categorized --output data/categorized.opml

# Generate filtered OPML by topic
aiwebfeeds opml filtered data/topic-nlp.opml --topic nlp

# Filter by source type
aiwebfeeds opml filtered data/type-blog.opml --type blog

# Filter by tag
aiwebfeeds opml filtered data/tag-official.opml --tag official

# Verified feeds only
aiwebfeeds opml filtered data/verified.opml --verified

# Combine filters
aiwebfeeds opml filtered data/verified-nlp-blogs.opml \
  --topic nlp \
  --type blog \
  --verified
```

### View Statistics

```bash
# Show feed statistics
aiwebfeeds stats show
```

Output:

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
  ...
══════════════════════════════════════════════════
```

## Python API Usage

### Database Operations

```python
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.models import FeedSource, SourceType

# Initialize database
db = DatabaseManager("sqlite:///data/aiwebfeeds.db")
db.create_db_and_tables()

# Add a feed source
feed = FeedSource(
    id="example-blog",
    feed="https://example.com/feed.xml",
    site="https://example.com",
    title="Example Blog",
    source_type=SourceType.BLOG,
    topics=["ml", "nlp"],
    verified=True,
)
db.add_feed_source(feed)

# Query feeds
all_feeds = db.get_all_feed_sources()
specific_feed = db.get_feed_source("example-blog")
```

### Feed Enrichment

```python
import asyncio
from ai_web_feeds.utils import enrich_feed_source

feed_data = {
    "id": "example-blog",
    "site": "https://example.com",
    "title": "Example Blog",
    "discover": True,  # Enable feed discovery
    "topics": ["ml", "nlp"],
}

# Enrich the feed
enriched = asyncio.run(enrich_feed_source(feed_data))

# enriched now contains:
# - Discovered feed URL (if found)
# - Detected feed format
# - Validation timestamp
# - etc.
```

### OPML Generation

```python
from ai_web_feeds.storage import DatabaseManager
from ai_web_feeds.utils import (
    generate_opml,
    generate_categorized_opml,
    generate_filtered_opml,
    save_opml,
)

# Get feeds from database
db = DatabaseManager("sqlite:///data/aiwebfeeds.db")
feeds = db.get_all_feed_sources()

# Generate all.opml
opml_xml = generate_opml(feeds, title="AI Web Feeds - All")
save_opml(opml_xml, "data/all.opml")

# Generate categorized.opml
opml_xml = generate_categorized_opml(feeds, title="AI Web Feeds - By Type")
save_opml(opml_xml, "data/categorized.opml")


# Generate filtered OPML
def nlp_filter(feed):
    return "nlp" in feed.topics and feed.verified


opml_xml = generate_filtered_opml(
    feeds,
    title="AI Web Feeds - NLP (Verified)",
    filter_fn=nlp_filter,
)
save_opml(opml_xml, "data/nlp-verified.opml")
```

### Schema Generation

```python
from ai_web_feeds.utils import generate_enriched_schema, save_json_schema

# Generate the enriched schema
schema = generate_enriched_schema()

# Save to file
save_json_schema(schema, "data/feeds.enriched.schema.json")
```

## Data Flow

```
feeds.yaml (source)
    ↓
    ↓ [enrich command]
    ↓
    ├→ feeds.enriched.yaml (enriched YAML)
    ├→ feeds.enriched.schema.json (JSON schema)
    └→ aiwebfeeds.db (SQLModel database)
            ↓
            ↓ [opml commands]
            ↓
            ├→ all.opml (all feeds)
            ├→ categorized.opml (by source type)
            └→ custom-filter.opml (filtered)
```

## Database Schema

### `feed_sources` Table

- Core feed metadata (id, feed, site, title)
- Classification (source_type, mediums, tags)
- Topics and weights
- Metadata (language, format, timestamps)
- Curation (status, quality_score, notes)
- Provenance (source, from, license)
- Relations and mappings (JSON)

### `feed_items` Table

- Individual feed entries
- Content (title, link, description, content)
- Metadata (author, published, updated)
- Categories, tags, enclosures

### `feed_fetch_logs` Table

- Fetch attempt tracking
- Response metadata (status, headers)
- Error logging
- Statistics (items found/new/updated)

### `topics` Table

- Topic definitions
- Hierarchical structure (parent_id)
- Aliases and relations

## Development

### Running Tests

```bash
# Run all tests
uv run pytest

# Run specific test file
uv run pytest tests/packages/ai_web_feeds/test_models.py

# With coverage
uv run pytest --cov=ai_web_feeds
```

### Database Migrations

```bash
# Initialize Alembic (first time only)
uv run python packages/ai_web_feeds/scripts/init_alembic.py

# Create a migration
cd packages/ai_web_feeds
alembic revision --autogenerate -m "Add new field"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Configuration

Set environment variables to configure:

```bash
# Logging
export AIWF_LOGGING__LEVEL=DEBUG
export AIWF_LOGGING__FILE=True
export AIWF_LOGGING__FILE_PATH=logs/aiwebfeeds.log

# Database
export AIWF_DATABASE_URL=sqlite:///data/aiwebfeeds.db
```

## File Structure

```
packages/ai_web_feeds/
├── src/ai_web_feeds/
│   ├── __init__.py          # Package initialization
│   ├── config.py            # Settings and configuration
│   ├── logger.py            # Logging setup
│   ├── models.py            # SQLModel models
│   ├── storage.py           # Database manager
│   └── utils.py             # Enrichment, OPML, schema utils
├── scripts/
│   └── init_alembic.py      # Alembic initialization
└── pyproject.toml           # Package dependencies

apps/cli/
├── ai_web_feeds/cli/
│   ├── __init__.py          # CLI app entry point
│   └── commands/
│       ├── __init__.py
│       ├── enrich.py        # Enrichment commands
│       ├── opml.py          # OPML generation commands
│       ├── stats.py         # Statistics commands
│       ├── export.py        # Export commands (stub)
│       └── validate.py      # Validation commands (stub)
└── pyproject.toml           # CLI dependencies
```

## License

See LICENSE file in repository root.
