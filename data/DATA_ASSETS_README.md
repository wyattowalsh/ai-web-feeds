# AI Web Feeds - Data Assets

This directory contains all data assets for the AI Web Feeds project, including schemas,
sample data, and the SQLite database.

## 📁 Directory Structure

```
data/
├── *.schema.json          # JSON Schema validation files
├── *.yaml                 # YAML data files (feeds, topics)
├── *.json                 # JSON data files (sample analytics)
├── *.opml                 # OPML export files
├── *.sql                  # SQL initialization scripts
├── aiwebfeeds.db          # SQLite database (generated)
└── validate_data_assets.py # Validation script
```

## 🗂️ File Inventory

### JSON Schemas (Validation)

| File                         | Purpose                         | Spec |
| ---------------------------- | ------------------------------- | ---- |
| `feeds.schema.json`          | Minimal contributor feed schema | 001  |
| `feeds.enriched.schema.json` | Enriched feed metadata schema   | 001  |
| `topics.schema.json`         | Topic taxonomy schema           | 001  |

### YAML Data Files

| File                          | Purpose                                 | Records | Spec |
| ----------------------------- | --------------------------------------- | ------- | ---- |
| `feeds.yaml`                  | Minimal contributor feeds (487 sources) | ~500    | 001  |
| `feeds.enriched.yaml`         | Auto-enriched feed metadata             | ~500    | 001  |
| `feeds.enriched.example.yaml` | Example enriched entries (4 sources)    | 4       | 001  |
| `topics.yaml`                 | Topic taxonomy with hierarchy           | ~150    | 001  |

### JSON Data Files

| File                         | Purpose                           | Spec |
| ---------------------------- | --------------------------------- | ---- |
| `sample_analytics_data.json` | Test data for analytics dashboard | 002  |

### OPML Files (Feed Reader Import)

| File                     | Purpose                    |
| ------------------------ | -------------------------- |
| `feeds.opml`             | Flat feed list export      |
| `feeds.categorized.opml` | Categorized by source type |
| `categorized.opml`       | Categorized by topic       |
| `all.opml`               | All feeds (legacy)         |

### SQL Scripts

| File                     | Purpose                     |
| ------------------------ | --------------------------- |
| `init_aiwebfeeds_db.sql` | Database initialization DDL |

### SQLite Database

| File            | Tables | Purpose                              |
| --------------- | ------ | ------------------------------------ |
| `aiwebfeeds.db` | 40+    | Production database with all schemas |

## 📐 Schema Specifications

### feeds.schema.json (Minimal Contributor Schema)

**Purpose**: Ultra-simplified schema for contributors - only URL and topics required.

**Required Fields**:

- `url`: Any HTTP(S) URL (direct feed, website, or platform URL)
- `topics`: 1-6 topic IDs from topics.yaml

**Optional Fields**:

- `title`: Custom title (otherwise auto-extracted)
- `notes`: Contributor notes

**Platform Detection**: Automatically detects and enriches:

- Substack, Medium, WordPress blogs
- GitHub releases, YouTube channels
- Reddit subreddits, Twitter/X profiles
- arXiv categories, academic journals

### feeds.enriched.schema.json (Enriched Feed Schema)

**Purpose**: Comprehensive schema with auto-discovered and AI-generated metadata.

**Enrichment Blocks**:

1. **Core Metadata** (`id`, `feed`, `site`, `title`, `source_type`, `mediums`, `tags`,
   `topics`)
1. **Meta Block**: Auto-discovered metadata
   - Platform detection, format, language
   - Health/quality scores, content metrics
   - Visual assets (icons, logos, images)
   - Update patterns, performance metrics
   - SEO and social metadata
   - Security assessment
1. **Curation Block**: Quality assessment
   - Status (verified, unverified, archived, etc.)
   - Quality score, curator notes
1. **Provenance Block**: Attribution
   - Original source, license
1. **Discovery Config**: Feed detection strategy
1. **Relations**: Inter-feed relationships
1. **Mappings**: External identifier mappings

### topics.schema.json (Topic Taxonomy Schema)

**Purpose**: Hierarchical + ontological topic graph with typed relationships.

**Key Features**:

- **Facets**: domain, subfield, task, methodology, modality, data, ops, etc.
- **Facet Groups**: conceptual, operational, governance, contextual, communicative
- **Relations**: depends_on, implements, influences, contrasts_with, same_as, related_to
- **Mappings**: Wikidata, Schema.org, Hugging Face, arXiv categories
- **i18n**: Multi-language support
- **Rank Hints**: Priority weights for surfacing (0.0-1.0)

## 🗄️ Database Schema (aiwebfeeds.db)

### Phase 001: Core Tables (MVP)

| Table         | Purpose             | Foreign Keys                  |
| ------------- | ------------------- | ----------------------------- |
| `sources`     | Feed sources        | -                             |
| `items`       | Feed items/articles | `feed_source_id → sources.id` |
| `fetch_logs`  | Fetch attempt logs  | `feed_source_id → sources.id` |
| `topics`      | Topic definitions   | `parent_id → topics.id`       |
| `enrichment`  | Enrichment metadata | `feed_source_id → sources.id` |
| `validations` | Validation results  | `feed_source_id → sources.id` |
| `analytics`   | Feed analytics      | `feed_source_id → sources.id` |

### Phase 002: Data Discovery & Analytics

| Table                         | Purpose                     | Foreign Keys               |
| ----------------------------- | --------------------------- | -------------------------- |
| `feed_embeddings`             | Vector embeddings (384-dim) | `feed_id → sources.id`     |
| `analytics_snapshots`         | Daily aggregated metrics    | -                          |
| `topic_stats`                 | Per-topic statistics        | -                          |
| `search_queries`              | User search interactions    | -                          |
| `saved_searches`              | User-saved searches         | -                          |
| `recommendation_interactions` | User feedback               | `feed_id → sources.id`     |
| `user_profiles`               | User preferences            | -                          |
| `collaborative_matrix`        | Co-occurrence scores        | `feed_id_1/2 → sources.id` |

### Phase 003: Real-Time Monitoring

| Table                      | Purpose              | Foreign Keys           |
| -------------------------- | -------------------- | ---------------------- |
| `feed_entries`             | Discovered articles  | `feed_id → sources.id` |
| `feed_poll_jobs`           | Polling job tracking | `feed_id → sources.id` |
| `notifications`            | User notifications   | -                      |
| `user_feed_follows`        | User subscriptions   | `feed_id → sources.id` |
| `trending_topics`          | Detected trends      | -                      |
| `notification_preferences` | User settings        | `feed_id → sources.id` |
| `email_digests`            | Digest subscriptions | -                      |

### Phase 005: Advanced AI/NLP

| Table                    | Purpose                  | Foreign Keys                                              |
| ------------------------ | ------------------------ | --------------------------------------------------------- |
| `article_quality_scores` | Quality metrics          | `article_id → feed_entries.id`                            |
| `entities`               | Extracted named entities | -                                                         |
| `entity_mentions`        | Entity occurrences       | `entity_id → entities.id`, `article_id → feed_entries.id` |
| `article_sentiment`      | Sentiment classification | `article_id → feed_entries.id`                            |
| `topic_sentiment_daily`  | Aggregated sentiment     | -                                                         |
| `subtopics`              | Discovered subtopics     | -                                                         |
| `topic_evolution_events` | Topic lifecycle          | -                                                         |

## 🔧 Usage Examples

### Initialize Database

```bash
cd data
sqlite3 aiwebfeeds.db < init_aiwebfeeds_db.sql
```

### Validate Data Assets

```bash
cd data
python validate_data_assets.py
# or
uv run python validate_data_assets.py
```

### Load Feeds into Database

```bash
cd /Users/ww/dev/projects/ai-web-feeds
uv run aiwebfeeds load data/feeds.yaml
```

### Validate All Feeds

```bash
uv run aiwebfeeds validate --all
```

### Export to OPML

```bash
uv run aiwebfeeds export --format opml --output data/feeds.opml
```

### Query Database

```bash
sqlite3 data/aiwebfeeds.db "SELECT id, title, source_type FROM sources LIMIT 10;"
```

## 📊 Sample Analytics Data

`sample_analytics_data.json` contains:

- **Analytics Snapshots** (3 days): Daily metrics for testing dashboard

  - Total/active feeds
  - Validation success rate
  - Avg response time
  - Trending topics with Z-scores
  - Health distribution

- **Topic Stats** (15 topics): Per-topic metrics

  - Feed count
  - Validation frequency
  - Avg health score
  - Snapshot date

## 🎯 Data Quality Standards

### Feed Sources

- **URL Validation**: All URLs must be valid HTTP(S)
- **Topic Validation**: Topics must exist in topics.yaml
- **Uniqueness**: Feed URLs must be unique
- **Completeness**: Minimum required fields validated

### Topics

- **DAG Structure**: No circular parent relationships
- **Relation Types**: Must use defined relation types
- **Facet Values**: Must use predefined facet values
- **Rank Hints**: Must be 0.0-1.0

### Enrichment Data

- **Score Ranges**: All scores 0.0-1.0
- **Timestamp Format**: ISO 8601
- **JSON Fields**: Valid JSON in TEXT columns
- **Platform Detection**: Consistent platform names

## 🔄 Update Workflow

1. **Contributors add feeds**: Edit `feeds.yaml` (minimal schema)
1. **CLI enriches**: `uv run aiwebfeeds enrich` auto-discovers metadata
1. **Validation**: `uv run aiwebfeeds validate` checks quality
1. **Database sync**: `uv run aiwebfeeds load` imports to DB
1. **Export**: `uv run aiwebfeeds export` generates OPML

## 📝 Notes

- **Database Creation**: Database initialized with 40+ tables from all phases
- **Backward Compatibility**: New phases add tables, don't modify existing schemas
- **Foreign Key Constraints**: Enabled (PRAGMA foreign_keys = ON)
- **Indexing Strategy**: B-tree indexes on frequently queried columns
- **JSON Storage**: Complex types stored as JSON TEXT for flexibility
- **Embeddings**: 384-dim float32 arrays serialized as BLOB (1536 bytes)

## 🔗 References

- [Feeds Schema Spec](../specs/001-core-project-spec/data-model.md)
- [Analytics Spec](../specs/002-data-discovery-analytics/data-model.md)
- [Monitoring Spec](../specs/003-real-time-monitoring/data-model.md)
- [NLP Spec](../specs/005-advanced-ai-nlp/data-model.md)
- [Topics Taxonomy](topics.yaml)

______________________________________________________________________

**Last Updated**: 2025-11-02\
**Generated By**: AIWebFeeds Core Team
