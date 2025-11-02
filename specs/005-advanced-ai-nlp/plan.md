# Implementation Plan: Phase 5 - Advanced AI/NLP Features

**Feature Branch**: `005-advanced-ai-nlp`  
**Created**: 2025-10-27  
**Status**: Ready for Implementation  
**Estimated Effort**: 5 weeks (5 sub-phases)

---

## Technical Context

### What We're Building

**Batch NLP Pipeline**: Scheduled jobs that process articles from `feed_entries` (Phase 3B) → Extract quality scores, entities, sentiment, topics → Store results in SQLite → Expose via CLI.

**Core Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                      Phase 5: NLP Pipeline                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ APScheduler  │───▶│  NLP Jobs    │───▶│   SQLite     │  │
│  │  (Phase 3B)  │    │              │    │  Results     │  │
│  │              │    │ - Quality    │    │              │  │
│  │ Cron Jobs:   │    │ - Entities   │    │ - quality_   │  │
│  │ */30 * * * * │    │ - Sentiment  │    │   scores     │  │
│  │ 0 * * * *    │    │ - Topics     │    │ - entities   │  │
│  │ 0 3 1 * *    │    │              │    │ - sentiment  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                               │
│  Input: feed_entries table (from Phase 3B polling)          │
│  Output: 8 new SQLite tables + processed flags              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Dependencies from Phase 3B

✅ **Already Available**:
- `feed_entries` table (articles from feed polling)
- `APScheduler` infrastructure (`scheduler.py`)
- `Storage` class (`storage.py`) with SQLAlchemy models
- `logger.py` (Loguru) for structured logging
- SQLite database with WAL mode enabled

✅ **No Changes Needed** to Phase 3B code.

---

## Constitution Check ✅

### Alignment with Root AGENTS.md

| Rule | Compliance |
|------|------------|
| **Documentation-First** | ✅ All docs in `apps/web/content/docs/features/*.mdx` (no standalone `.md` files) |
| **Type Safety** | ✅ Python type hints, Pydantic models for config |
| **Testing** | ✅ ≥90% coverage target, unit + integration tests |
| **Code Quality** | ✅ Ruff formatting, conventional commits |
| **SQLite-First** | ✅ All data in SQLite (no PostgreSQL, no external services) |

### Alignment with Component-Specific AGENTS.md

| Component | Location | Rules |
|-----------|----------|-------|
| **Core Package** | `packages/ai_web_feeds/` | ✅ Modular design, absolute imports, Pydantic validation |
| **CLI** | `apps/cli/` | ✅ Typer commands, `uv run aiwebfeeds nlp ...` |
| **Web Docs** | `apps/web/content/docs/` | ✅ `.mdx` files with frontmatter, update `meta.json` |
| **Tests** | `tests/` | ✅ Mirror source tree, mock external boundaries, property-based tests |

---

## Project Structure

### New Files to Create

```
packages/ai_web_feeds/src/ai_web_feeds/
├── nlp/
│   ├── __init__.py           # Package exports
│   ├── quality_scorer.py     # Quality scoring logic
│   ├── entity_extractor.py   # NER + entity normalization
│   ├── sentiment_analyzer.py # Sentiment classification
│   ├── topic_modeler.py      # LDA topic modeling
│   └── utils.py              # Shared utilities (text preprocessing, etc.)
├── nlp_scheduler.py          # APScheduler jobs for NLP
└── models.py                 # EXTEND: Add new SQLModel classes

apps/cli/ai_web_feeds/cli/commands/
└── nlp.py                    # CLI: `aiwebfeeds nlp ...`

apps/web/content/docs/features/
├── quality-scoring.mdx       # Phase 5A docs
├── entity-extraction.mdx     # Phase 5B docs
├── sentiment-analysis.mdx    # Phase 5C docs
└── topic-modeling.mdx        # Phase 5D docs

tests/tests/packages/ai_web_feeds/nlp/
├── test_quality_scorer.py
├── test_entity_extractor.py
├── test_sentiment_analyzer.py
├── test_topic_modeler.py
└── test_nlp_scheduler.py

tests/fixtures/
├── sample_articles.json      # Test data (10 articles)
└── mock_entities.json        # Expected entity extraction output
```

### Files to Modify

```
packages/ai_web_feeds/
├── pyproject.toml            # ADD: spacy, transformers, gensim deps
├── src/ai_web_feeds/
│   ├── config.py             # ADD: Phase5Settings class
│   ├── models.py             # ADD: 8 new SQLModel classes (entities, quality, sentiment, etc.)
│   ├── storage.py            # ADD: CRUD methods for new tables
│   └── scheduler.py          # EXTEND: Register NLP jobs

apps/cli/ai_web_feeds/cli/
└── __init__.py               # REGISTER: nlp command module

apps/web/content/docs/
└── meta.json                 # ADD: quality-scoring, entity-extraction, etc. to nav

env.example                   # ADD: Phase 5 environment variables

data/
└── aiwebfeeds.db             # MIGRATE: Add 8 new tables (via Alembic or raw SQL)
```

---

## Complexity Analysis

### High Complexity (Weeks 2-4)

| Task | Complexity | Reason |
|------|------------|--------|
| **Entity Extraction** | 🔴 High | spaCy integration, entity normalization, disambiguation logic |
| **Topic Modeling** | 🔴 High | Gensim LDA, topic evolution detection, manual curation workflow |
| **Sentiment Aggregation** | 🟡 Medium | Time-series aggregation, moving averages, shift detection |

### Medium Complexity (Week 1, 5)

| Task | Complexity | Reason |
|------|------------|--------|
| **Quality Scoring** | 🟡 Medium | Heuristic-based, no ML model, but multiple factors to combine |
| **Sentiment Analysis** | 🟡 Medium | Pre-trained model (DistilBERT), but requires PyTorch integration |
| **Database Migration** | 🟡 Medium | 8 new tables, triggers, indexes, FTS5 virtual table |

### Low Complexity

| Task | Complexity | Reason |
|------|------------|--------|
| **Config Extension** | 🟢 Low | Add Phase5Settings to config.py (straightforward Pydantic) |
| **CLI Commands** | 🟢 Low | Typer command structure already established in Phase 3B |
| **Documentation** | 🟢 Low | `.mdx` files with examples (time-consuming but straightforward) |

---

## Implementation Phases

### Phase 5A: Quality Scoring (Week 1) 🎯 Start Here

**Goal**: Implement quality scoring for articles, store in SQLite, schedule batch job.

**Deliverables**:
1. ✅ `quality_scorer.py` module with heuristic scoring
2. ✅ `article_quality_scores` table in SQLite
3. ✅ Batch job: process 100 articles every 30 minutes
4. ✅ CLI: `aiwebfeeds nlp process quality`
5. ✅ Unit tests (≥90% coverage)
6. ✅ Documentation: `quality-scoring.mdx`

**Acceptance Criteria**:
- Process 1000 articles → All have quality scores (0-100)
- Feed quality scores updated (weighted average of recent articles)
- CLI shows processing stats: `aiwebfeeds nlp stats`

---

### Phase 5B: Entity Extraction (Week 2)

**Goal**: Extract entities (people, orgs, techniques) using spaCy, normalize, store.

**Deliverables**:
1. ✅ `entity_extractor.py` module with spaCy integration
2. ✅ `entities` + `entity_mentions` tables in SQLite
3. ✅ Entity normalization logic (Levenshtein distance, alias resolution)
4. ✅ Batch job: process 50 articles every hour
5. ✅ CLI: `aiwebfeeds nlp list-entities`, `show-entity`, `add-alias`, `merge-entities`
6. ✅ Unit tests + integration tests
7. ✅ Documentation: `entity-extraction.mdx`

**Acceptance Criteria**:
- Extract entities from 500 articles → ≥80% precision (manual spot-check)
- Normalize aliases: "G. Hinton" → "Geoffrey Hinton"
- FTS5 entity search: sub-second response for millions of mentions

---

### Phase 5C: Sentiment Analysis (Week 3)

**Goal**: Classify article sentiment, aggregate by topic, detect shifts.

**Deliverables**:
1. ✅ `sentiment_analyzer.py` module with DistilBERT
2. ✅ `article_sentiment` + `topic_sentiment_daily` tables
3. ✅ Batch job: process 100 articles every hour
4. ✅ Aggregation job: compute daily topic sentiment (runs after sentiment job)
5. ✅ Shift detection: alert when 7-day moving average changes >0.3
6. ✅ CLI: `aiwebfeeds nlp sentiment <topic> --days 30`
7. ✅ Unit tests + integration tests
8. ✅ Documentation: `sentiment-analysis.mdx`

**Acceptance Criteria**:
- Sentiment classification accuracy ≥75% (manual spot-check of 100 articles)
- Time-series chart: 30-day sentiment trend for "AI Safety"
- Detect sentiment shift: when GPT-4 launches, negative sentiment spike

---

### Phase 5D: Topic Modeling (Week 4)

**Goal**: Detect subtopics using LDA, track evolution, enable manual curation.

**Deliverables**:
1. ✅ `topic_modeler.py` module with Gensim LDA
2. ✅ `subtopics` + `topic_evolution_events` tables
3. ✅ Batch job: monthly topic modeling (1st of month, 3 AM)
4. ✅ Evolution detection: compare with previous month, detect splits/merges
5. ✅ CLI: `aiwebfeeds nlp review-subtopics`, `approve-subtopic`, `rename-subtopic`
6. ✅ Unit tests + integration tests
7. ✅ Documentation: `topic-modeling.mdx`

**Acceptance Criteria**:
- Process 10k articles → Extract 5-10 subtopics per parent topic
- Topic coherence score ≥0.5 (statistical measure)
- Manual curation workflow: approve/reject/rename subtopics

---

### Phase 5E: Testing & Documentation (Week 5)

**Goal**: Comprehensive testing, polish documentation, validate deployment.

**Deliverables**:
1. ✅ Unit tests for all 4 NLP modules (≥90% coverage)
2. ✅ Integration tests: end-to-end batch processing (1000 articles)
3. ✅ Performance benchmarks: 100 articles/hour minimum
4. ✅ CLI validation: all `aiwebfeeds nlp` commands work
5. ✅ Documentation review: all `.mdx` files complete, examples tested
6. ✅ Update `CHANGELOG.md`, `README.md`, `RELEASE_NOTES.md`

**Acceptance Criteria**:
- All tests pass: `uv run pytest --cov=ai_web_feeds`
- Coverage ≥90%: `uv run pytest --cov-report=html`
- CLI help works: `aiwebfeeds nlp --help`
- Documentation site builds: `cd apps/web && pnpm build`

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **spaCy Model Download Fails** | Medium | High | Fallback to rule-based extraction, retry with exponential backoff |
| **OOM (Out of Memory) on Large Articles** | Medium | Medium | Process in smaller batches (50 → 25 → 10), truncate articles >10k words |
| **Topic Modeling Low Coherence** | High | Medium | Manual curation required, adjust num_topics parameter, use BERTopic fallback |
| **Sentiment Model Disagrees with Humans** | High | Low | Collect feedback, retrain on feedback data (deferred to Phase 6) |
| **Batch Processing Falls Behind** | Medium | Medium | Increase workers (4 → 8), prioritize high-quality feeds, process in parallel |

### Project Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Model Download Size Too Large** | Low | Medium | Use small models (en_core_web_sm = 13MB), document requirements |
| **Testing Takes Longer Than Planned** | High | Medium | Start testing early (write tests alongside implementation) |
| **Documentation Incomplete** | Medium | High | Allocate full week for docs (Phase 5E), use examples from tests |

---

## Dependencies

### Python Packages (Add to `pyproject.toml`)

```toml
[project]
dependencies = [
    # ... existing deps from Phase 3B ...
    
    # Phase 5: NLP
    "spacy>=3.7.0",         # NER, entity linking
    "transformers>=4.40.0", # Hugging Face sentiment models
    "torch>=2.0.0",         # PyTorch for transformers (CPU-only)
    "gensim>=4.3.0",        # LDA topic modeling
    "langdetect>=1.0.9",    # Language detection
    "scikit-learn>=1.4.0",  # Clustering, TF-IDF for topic modeling
]

[project.optional-dependencies]
dev = [
    # ... existing dev deps ...
    
    # Phase 5 testing
    "pytest-benchmark>=4.0.0",  # Performance benchmarks
]
```

### System Dependencies

- **Python**: 3.13+ (already required by Phase 1)
- **SQLite**: 3.35+ with JSON1 + FTS5 (already required by Phase 1)
- **uv**: Latest version for package management

### Model Downloads (First Run)

```bash
# Download spaCy model (13MB, one-time)
uv run python -m spacy download en_core_web_sm

# Hugging Face models auto-download on first use (~67MB total):
# - distilbert-base-uncased-finetuned-sst-2-english (67MB)
# Cache location: ~/.cache/huggingface/hub
```

---

## Database Migrations

### Migration Strategy

**Approach**: Extend `feed_entries` table + create 8 new tables.

**Tools**: Raw SQL (no Alembic for Phase 5, keep it simple).

**Migration File**: `packages/ai_web_feeds/migrations/005_add_nlp_tables.sql`

### Migration SQL

```sql
-- =====================================================================
-- Phase 5: Advanced AI/NLP - Database Migration
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extend feed_entries table (from Phase 3B)
-- ---------------------------------------------------------------------
ALTER TABLE feed_entries ADD COLUMN quality_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE feed_entries ADD COLUMN entities_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE feed_entries ADD COLUMN sentiment_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE feed_entries ADD COLUMN topics_processed BOOLEAN DEFAULT FALSE;

ALTER TABLE feed_entries ADD COLUMN quality_processed_at DATETIME;
ALTER TABLE feed_entries ADD COLUMN entities_processed_at DATETIME;
ALTER TABLE feed_entries ADD COLUMN sentiment_processed_at DATETIME;

ALTER TABLE feed_entries ADD COLUMN nlp_failures TEXT; -- JSON: {"quality": 2, "entities": 0}
ALTER TABLE feed_entries ADD COLUMN last_failure_reason TEXT;

-- ---------------------------------------------------------------------
-- 2. Quality Scoring Tables
-- ---------------------------------------------------------------------
CREATE TABLE article_quality_scores (
    article_id INTEGER PRIMARY KEY,
    overall_score INTEGER NOT NULL CHECK(overall_score BETWEEN 0 AND 100),
    depth_score INTEGER CHECK(depth_score BETWEEN 0 AND 100),
    reference_score INTEGER CHECK(reference_score BETWEEN 0 AND 100),
    author_score INTEGER CHECK(author_score BETWEEN 0 AND 100),
    domain_score INTEGER CHECK(domain_score BETWEEN 0 AND 100),
    engagement_score INTEGER CHECK(engagement_score BETWEEN 0 AND 100),
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES feed_entries(id) ON DELETE CASCADE
);
CREATE INDEX idx_quality_scores_overall ON article_quality_scores(overall_score DESC);
CREATE INDEX idx_quality_scores_computed ON article_quality_scores(computed_at DESC);

-- ---------------------------------------------------------------------
-- 3. Entity Extraction Tables
-- ---------------------------------------------------------------------
CREATE TABLE entities (
    id TEXT PRIMARY KEY, -- UUID
    canonical_name TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('person', 'organization', 'technique', 'dataset', 'concept')),
    aliases TEXT, -- JSON array: ["G. Hinton", "Geoffrey Hinton"]
    description TEXT,
    metadata TEXT, -- JSON: {bio, affiliation, h_index, wikipedia_url}
    frequency_count INTEGER DEFAULT 0,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_frequency ON entities(frequency_count DESC);
CREATE INDEX idx_entities_name ON entities(canonical_name);

CREATE TABLE entity_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    article_id INTEGER NOT NULL,
    confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
    extraction_method TEXT NOT NULL CHECK(extraction_method IN ('ner_model', 'rule_based', 'manual')),
    context TEXT, -- Surrounding text snippet
    mentioned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities(id),
    FOREIGN KEY (article_id) REFERENCES feed_entries(id) ON DELETE CASCADE
);
CREATE INDEX idx_entity_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX idx_entity_mentions_article ON entity_mentions(article_id);
CREATE INDEX idx_entity_mentions_confidence ON entity_mentions(confidence DESC);

-- FTS5 virtual table for entity search
CREATE VIRTUAL TABLE entities_fts USING fts5(
    entity_id UNINDEXED,
    canonical_name,
    aliases,
    description,
    content=entities,
    content_rowid=rowid
);

-- Trigger to keep FTS5 in sync
CREATE TRIGGER entities_fts_insert AFTER INSERT ON entities BEGIN
    INSERT INTO entities_fts(rowid, entity_id, canonical_name, aliases, description)
    VALUES (NEW.rowid, NEW.id, NEW.canonical_name, NEW.aliases, NEW.description);
END;

CREATE TRIGGER entities_fts_update AFTER UPDATE ON entities BEGIN
    UPDATE entities_fts SET 
        canonical_name = NEW.canonical_name,
        aliases = NEW.aliases,
        description = NEW.description
    WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER entities_fts_delete AFTER DELETE ON entities BEGIN
    DELETE FROM entities_fts WHERE rowid = OLD.rowid;
END;

-- Trigger to update entity frequency on mention
CREATE TRIGGER update_entity_frequency AFTER INSERT ON entity_mentions
BEGIN
    UPDATE entities 
    SET frequency_count = frequency_count + 1,
        last_seen = CURRENT_TIMESTAMP
    WHERE id = NEW.entity_id;
END;

-- ---------------------------------------------------------------------
-- 4. Sentiment Analysis Tables
-- ---------------------------------------------------------------------
CREATE TABLE article_sentiment (
    article_id INTEGER PRIMARY KEY,
    sentiment_score REAL NOT NULL CHECK(sentiment_score BETWEEN -1.0 AND 1.0),
    classification TEXT NOT NULL CHECK(classification IN ('positive', 'neutral', 'negative')),
    model_name TEXT NOT NULL,
    confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES feed_entries(id) ON DELETE CASCADE
);
CREATE INDEX idx_sentiment_score ON article_sentiment(sentiment_score);
CREATE INDEX idx_sentiment_classification ON article_sentiment(classification);
CREATE INDEX idx_sentiment_computed ON article_sentiment(computed_at DESC);

CREATE TABLE topic_sentiment_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    date DATE NOT NULL,
    avg_sentiment REAL NOT NULL,
    article_count INTEGER NOT NULL,
    positive_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,
    UNIQUE(topic, date)
);
CREATE INDEX idx_topic_sentiment_topic ON topic_sentiment_daily(topic);
CREATE INDEX idx_topic_sentiment_date ON topic_sentiment_daily(date DESC);
CREATE INDEX idx_topic_sentiment_topic_date ON topic_sentiment_daily(topic, date DESC);

-- ---------------------------------------------------------------------
-- 5. Topic Modeling Tables
-- ---------------------------------------------------------------------
CREATE TABLE subtopics (
    id TEXT PRIMARY KEY, -- UUID
    parent_topic TEXT NOT NULL,
    name TEXT NOT NULL,
    keywords TEXT NOT NULL, -- JSON array of representative keywords
    description TEXT,
    article_count INTEGER DEFAULT 0,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved BOOLEAN DEFAULT FALSE,
    created_by TEXT DEFAULT 'system',
    UNIQUE(parent_topic, name)
);
CREATE INDEX idx_subtopics_parent ON subtopics(parent_topic);
CREATE INDEX idx_subtopics_article_count ON subtopics(article_count DESC);
CREATE INDEX idx_subtopics_approved ON subtopics(approved);

CREATE TABLE topic_evolution_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK(event_type IN ('split', 'merge', 'emergence', 'decline')),
    source_topic TEXT,
    target_topics TEXT, -- JSON array of resulting subtopic IDs
    article_count INTEGER NOT NULL,
    growth_rate REAL,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_topic_evolution_type ON topic_evolution_events(event_type);
CREATE INDEX idx_topic_evolution_date ON topic_evolution_events(detected_at DESC);

-- ---------------------------------------------------------------------
-- 6. Partial Indexes for Performance
-- ---------------------------------------------------------------------
-- Index for finding unprocessed articles (quality)
CREATE INDEX idx_feed_entries_quality_unprocessed 
ON feed_entries(quality_processed, published_at DESC) 
WHERE quality_processed = FALSE;

-- Index for finding unprocessed articles (entities)
CREATE INDEX idx_feed_entries_entities_unprocessed 
ON feed_entries(entities_processed, published_at DESC) 
WHERE entities_processed = FALSE;

-- Index for finding unprocessed articles (sentiment)
CREATE INDEX idx_feed_entries_sentiment_unprocessed 
ON feed_entries(sentiment_processed, published_at DESC) 
WHERE sentiment_processed = FALSE;

-- Index for high-quality articles
CREATE INDEX idx_quality_scores_high 
ON article_quality_scores(overall_score DESC, computed_at DESC) 
WHERE overall_score >= 80;
```

### Migration Execution

```python
# packages/ai_web_feeds/src/ai_web_feeds/migrations/run_migration.py

from pathlib import Path
import sqlite3
from ai_web_feeds.config import Settings

def run_migration_005():
    """Run Phase 5 migration: Add NLP tables"""
    settings = Settings()
    migration_sql = Path(__file__).parent / "005_add_nlp_tables.sql"
    
    with sqlite3.connect(settings.database_url.replace("sqlite:///", "")) as conn:
        conn.executescript(migration_sql.read_text())
        print("✅ Migration 005 completed: NLP tables added")

if __name__ == "__main__":
    run_migration_005()
```

**Run Migration**:
```bash
uv run python packages/ai_web_feeds/src/ai_web_feeds/migrations/run_migration.py
```

---

## Next Steps

1. ✅ **Review this plan**: User approves phased approach
2. ✅ **Run `/speckit.tasks`**: Generate detailed task list (89+ tasks)
3. ✅ **Start Phase 5A**: Implement quality scoring (Week 1)
4. ✅ **Iterate**: Phase 5B → 5C → 5D → 5E (Weeks 2-5)
5. ✅ **Merge to main**: After Phase 5E completion, tag as `v0.4.0-beta`

---

**Status**: ✅ Ready for Implementation  
**Estimated Timeline**: 5 weeks  
**Risk Level**: Medium (entity extraction + topic modeling complexity)

