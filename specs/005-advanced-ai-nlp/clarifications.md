# Phase 5: Advanced AI/NLP - Clarifications

**Created**: 2025-10-27\
**Status**: Approved\
**Batch Processing Focus**: All NLP runs as scheduled jobs, results stored in SQLite

______________________________________________________________________

## Architecture Decision: Batch Processing Pipeline

### Core Principle

**ALL NLP operations run as batch jobs** → Process articles from `feed_entries` table →
Write results to SQLite tables → No real-time API dependencies.

```
┌─────────────────────┐
│  feed_entries table │  ← Articles from Phase 3B polling
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │ Batch Jobs   │  ← APScheduler (reuse from Phase 3B)
    │  - Quality   │
    │  - Entities  │
    │  - Sentiment │
    │  - Topics    │
    └──────┬───────┘
           │
           ▼
┌──────────────────────┐
│  SQLite Results      │
│  - article_quality_  │
│    scores            │
│  - entities          │
│  - entity_mentions   │
│  - article_sentiment │
│  - subtopics         │
└──────────────────────┘
```

______________________________________________________________________

## Clarification 1: Processing Schedule

**Q**: When do NLP jobs run?

**A**: Hierarchical schedule based on priority:

| Job Type               | Frequency        | Batch Size      | SLA                             |
| ---------------------- | ---------------- | --------------- | ------------------------------- |
| **Quality Scoring**    | Every 30 minutes | 100 articles    | \<1 hour from article ingestion |
| **Entity Extraction**  | Every 1 hour     | 50 articles     | \<2 hours from ingestion        |
| **Sentiment Analysis** | Every 1 hour     | 100 articles    | \<2 hours from ingestion        |
| **Topic Modeling**     | Daily (3 AM)     | All unprocessed | \<24 hours from ingestion       |

**Implementation**: APScheduler cron jobs in
`packages/ai_web_feeds/src/ai_web_feeds/nlp_scheduler.py`

**Priority Queue**: High-quality feeds (score ≥80) processed first.

______________________________________________________________________

## Clarification 2: NLP Model Selection

**Q**: Which models do we use for each task?

**A**: Lightweight, pre-trained models (CPU-friendly, no GPU required):

### Quality Scoring (No ML Model)

- **Heuristic-based** scoring using article metadata:
  - Word count, paragraph count, external links
  - Domain reputation (from `feeds` table)
  - No ML model required

### Entity Extraction

- **Primary**: spaCy `en_core_web_sm` (small model, 13MB, CPU-optimized)
- **Fallback**: Rule-based patterns for common entities (OpenAI, Geoffrey Hinton, etc.)
- **Why small model**: Process 100 articles/minute on CPU vs 10/minute with large model

### Sentiment Analysis

- **Model**: `distilbert-base-uncased-finetuned-sst-2-english` (67MB, Hugging Face)
- **Alternative**: `cardiffnlp/twitter-roberta-base-sentiment` (125MB, better for short
  text)
- **Why DistilBERT**: Fast inference (20ms/article on CPU), 97% accuracy of full BERT

### Topic Modeling

- **Model**: Gensim LDA (no neural network, pure statistical)
- **Why LDA over BERTopic**: BERTopic requires sentence-transformers (500MB+), LDA is
  lightweight
- **Fallback**: Simple TF-IDF + K-Means clustering

**Model Caching**: Download models to `~/.cache/ai_web_feeds/models/` on first run,
reuse indefinitely.

______________________________________________________________________

## Clarification 3: Batch Processing Logic

**Q**: How do we track which articles have been processed?

**A**: Use status flags in `feed_entries` table (extend Phase 3B schema):

```sql
-- Add to existing feed_entries table from Phase 3B
ALTER TABLE feed_entries ADD COLUMN quality_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE feed_entries ADD COLUMN entities_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE feed_entries ADD COLUMN sentiment_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE feed_entries ADD COLUMN topics_processed BOOLEAN DEFAULT FALSE;

-- Add processing timestamps for debugging
ALTER TABLE feed_entries ADD COLUMN quality_processed_at DATETIME;
ALTER TABLE feed_entries ADD COLUMN entities_processed_at DATETIME;
ALTER TABLE feed_entries ADD COLUMN sentiment_processed_at DATETIME;
```

**Batch Query Example** (Quality Scoring):

```sql
SELECT id, title, content, feed_id 
FROM feed_entries 
WHERE quality_processed = FALSE 
  AND LENGTH(content) > 100  -- Skip very short articles
ORDER BY published_at DESC  -- Process recent articles first
LIMIT 100;  -- Batch size
```

**Processing Flow**:

1. Query unprocessed articles
1. Run NLP model (quality/entities/sentiment)
1. Write results to corresponding table (`article_quality_scores`, `entities`, etc.)
1. Set `*_processed = TRUE` + timestamp
1. Commit transaction

______________________________________________________________________

## Clarification 4: Entity Normalization & Deduplication

**Q**: How do we handle entity aliases and duplicates?

**A**: Two-stage normalization:

### Stage 1: Extraction (Per Article)

- spaCy extracts raw entities: `["G. Hinton", "Geoffrey Hinton", "Hinton"]`
- Store all variants in `entity_mentions.context` for debugging

### Stage 2: Normalization (Batch)

- **Canonical Name Resolution**:
  - Use Levenshtein distance (edit distance) to find similar names
  - If distance ≤2 and same entity type → merge
  - Example: "G. Hinton" + "Geoffrey Hinton" → merge to "Geoffrey Hinton"
- **Manual Aliases**:
  - Store common aliases in `entities.aliases` JSON field:
    `["G. Hinton", "Prof. Hinton"]`
  - CLI command: `aiwebfeeds nlp add-alias "Geoffrey Hinton" "G. Hinton"`

**Deduplication Strategy**:

```python
# Simplified algorithm
canonical_entities = {}
for entity in raw_entities:
    # Check if similar entity exists
    similar = find_similar(entity.name, canonical_entities.keys(), threshold=2)
    if similar:
        # Merge: increment frequency, add to aliases
        canonical_entities[similar].frequency += 1
        canonical_entities[similar].aliases.append(entity.name)
    else:
        # New canonical entity
        canonical_entities[entity.name] = entity
```

**Edge Case**: Ambiguous entities (e.g., "Transformer" = architecture vs electrical)

- Store `entities.metadata` JSON: `{"context_keywords": ["attention", "NLP"]}`
- Disambiguation logic: if article contains "attention" → likely architecture

______________________________________________________________________

## Clarification 5: Sentiment Aggregation

**Q**: How do we compute topic sentiment time-series?

**A**: Daily aggregation job:

**Trigger**: Run after sentiment batch job completes (once per hour)

**Logic**:

1. Query articles with sentiment processed in last 1 hour
1. For each article's topics (from `topics.yaml` matching):
   - Aggregate sentiment by (topic, date)
   - Compute: avg, positive/neutral/negative counts
1. Upsert into `topic_sentiment_daily` table

**Example SQL**:

```sql
-- Compute daily topic sentiment
INSERT OR REPLACE INTO topic_sentiment_daily (
    topic, date, avg_sentiment, article_count, 
    positive_count, neutral_count, negative_count
)
SELECT 
    fe.topics AS topic,  -- Assuming topics stored as JSON in feed_entries
    DATE(fe.published_at) AS date,
    AVG(asent.sentiment_score) AS avg_sentiment,
    COUNT(*) AS article_count,
    SUM(CASE WHEN asent.classification = 'positive' THEN 1 ELSE 0 END) AS positive_count,
    SUM(CASE WHEN asent.classification = 'neutral' THEN 1 ELSE 0 END) AS neutral_count,
    SUM(CASE WHEN asent.classification = 'negative' THEN 1 ELSE 0 END) AS negative_count
FROM feed_entries fe
JOIN article_sentiment asent ON fe.id = asent.article_id
WHERE asent.computed_at >= datetime('now', '-1 hour')  -- Only new sentiment scores
GROUP BY topic, DATE(fe.published_at);
```

**Sentiment Shift Detection**:

- Compute 7-day moving average in query:
  ```sql
  SELECT topic, date, avg_sentiment,
         AVG(avg_sentiment) OVER (
             PARTITION BY topic 
             ORDER BY date 
             ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
         ) AS moving_avg_7d
  FROM topic_sentiment_daily;
  ```
- If `ABS(current_day - moving_avg_7d) > 0.3` → Create alert

______________________________________________________________________

## Clarification 6: Topic Modeling Batch Job

**Q**: How does monthly topic modeling work?

**A**: Separate batch job (most computationally expensive):

**Schedule**: Run on 1st day of each month at 3 AM

**Input**: All articles from previous month with `topics_processed = FALSE`

**Algorithm** (Gensim LDA):

1. **Preprocessing**:
   - Tokenize article content
   - Remove stopwords (standard English + domain-specific: "the", "a", "is", "ai", "ml")
   - Stem/lemmatize tokens
1. **LDA Training**:
   - Fit LDA model with `num_topics = 10` (configurable)
   - Extract top 10 keywords per topic
1. **Subtopic Creation**:
   - For each detected topic:
     - Generate name from top keywords (e.g., "rlhf reward modeling alignment")
     - Count articles matching topic (cosine similarity >0.3)
     - Store in `subtopics` table with `approved = FALSE`
1. **Evolution Detection**:
   - Compare with previous month's topics
   - Detect splits/merges/emergence/decline
   - Store events in `topic_evolution_events`

**Performance**: Process 10k articles in ~10 minutes on CPU (Gensim is fast)

**Manual Curation**: Admins review via CLI:

```bash
aiwebfeeds nlp review-subtopics --month 2025-10
# Shows: Detected subtopics, article counts, sample articles
# Prompt: Approve/Reject/Rename each subtopic
```

______________________________________________________________________

## Clarification 7: Error Handling & Retries

**Q**: What happens when NLP processing fails?

**A**: Graceful degradation + retry logic:

### Retry Strategy (per article)

- **Max Retries**: 3 attempts
- **Backoff**: Exponential (1 min, 5 min, 15 min)
- **Failure Modes**:
  - Model loading failure → Log error, skip batch, retry on next job run
  - OOM (Out of Memory) → Process smaller batch size (50 → 25 → 10)
  - Network timeout (for model download) → Retry with exponential backoff

### Failure Tracking

```sql
-- Add to feed_entries
ALTER TABLE feed_entries ADD COLUMN nlp_failures TEXT; -- JSON: {"quality": 2, "entities": 0}
ALTER TABLE feed_entries ADD COLUMN last_failure_reason TEXT;
```

### Fallback Behavior

- **Quality Scoring**: If heuristic computation fails → Default score = 50 (neutral)
- **Entity Extraction**: If spaCy fails → Use rule-based fallback → If that fails, skip
  entity processing
- **Sentiment Analysis**: If model fails → Mark as "unavailable", don't create
  `article_sentiment` record
- **Topic Modeling**: If LDA fails → Log error, skip subtopic generation for that month

### Monitoring

- Log all failures to `packages/ai_web_feeds/src/ai_web_feeds/logger.py` (Loguru)
- CLI command: `aiwebfeeds nlp failures --last-24h` to review recent failures

______________________________________________________________________

## Clarification 8: Configuration Management

**Q**: How are NLP settings configured?

**A**: Extend `config.py` with `Phase5Settings`:

```python
# packages/ai_web_feeds/src/ai_web_feeds/config.py

from pydantic_settings import BaseSettings


class Phase5Settings(BaseSettings):
    """Phase 5: Advanced AI/NLP Configuration"""

    # Batch Processing
    quality_batch_size: int = 100
    entity_batch_size: int = 50
    sentiment_batch_size: int = 100

    # Schedule (cron expressions)
    quality_cron: str = "*/30 * * * *"  # Every 30 minutes
    entity_cron: str = "0 * * * *"  # Every hour
    sentiment_cron: str = "0 * * * *"  # Every hour
    topic_modeling_cron: str = "0 3 1 * *"  # 3 AM on 1st of month

    # Models
    spacy_model: str = "en_core_web_sm"
    sentiment_model: str = "distilbert-base-uncased-finetuned-sst-2-english"
    topic_model: str = "lda"  # "lda" or "bertopic"

    # Thresholds
    quality_min_words: int = 100  # Skip articles shorter than 100 words
    entity_confidence_threshold: float = 0.7  # Discard entities with confidence <0.7
    sentiment_shift_threshold: float = 0.3  # Alert when 7-day MA changes >0.3
    topic_coherence_min: float = 0.5  # Discard topics with coherence <0.5

    # Resources
    nlp_workers: int = 4  # Parallel processing workers (CPU cores)
    model_cache_dir: str = "~/.cache/ai_web_feeds/models"

    class Config:
        env_prefix = "PHASE5_"  # Environment variables: PHASE5_QUALITY_BATCH_SIZE=200
```

**Environment Variables** (in `.env` or `env.example`):

```bash
# Phase 5: NLP Configuration
PHASE5_QUALITY_BATCH_SIZE=100
PHASE5_ENTITY_BATCH_SIZE=50
PHASE5_SPACY_MODEL=en_core_web_sm
PHASE5_NLP_WORKERS=4
```

______________________________________________________________________

## Clarification 9: CLI Commands

**Q**: What CLI commands do we add for Phase 5?

**A**: New `nlp` command group:

```bash
# Run NLP processing manually (useful for testing)
aiwebfeeds nlp process quality --batch-size 100
aiwebfeeds nlp process entities --batch-size 50
aiwebfeeds nlp process sentiment --batch-size 100
aiwebfeeds nlp process topics --force  # Force topic modeling even if not scheduled

# Review results
aiwebfeeds nlp stats  # Show processing stats (articles processed, pending, failed)
aiwebfeeds nlp failures --last-24h  # Show recent processing failures

# Entity management
aiwebfeeds nlp list-entities --limit 20 --sort frequency
aiwebfeeds nlp show-entity "Geoffrey Hinton"  # Show entity details, articles
aiwebfeeds nlp add-alias "Geoffrey Hinton" "G. Hinton"
aiwebfeeds nlp merge-entities "G. Hinton" "Geoffrey Hinton"  # Merge duplicates

# Topic management
aiwebfeeds nlp review-subtopics --month 2025-10  # Review detected subtopics
aiwebfeeds nlp approve-subtopic <subtopic_id>
aiwebfeeds nlp rename-subtopic <subtopic_id> "New Name"

# Sentiment trends
aiwebfeeds nlp sentiment "AI Safety" --days 30  # Show 30-day sentiment trend

# Configuration
aiwebfeeds nlp config show  # Show current NLP configuration
aiwebfeeds nlp models download  # Pre-download all NLP models
```

**Implementation**: `apps/cli/ai_web_feeds/cli/commands/nlp.py`

______________________________________________________________________

## Clarification 10: Testing Strategy

**Q**: How do we test NLP pipelines?

**A**: Multi-layer testing:

### Unit Tests (Mock Models)

- Test `quality_scorer.py` with mock articles (known word counts, link counts)
- Test `entity_extractor.py` with mock spaCy output
- Test `sentiment_analyzer.py` with mock model predictions
- **Goal**: Fast tests (\<1s), no model downloads

### Integration Tests (Real Models, Small Samples)

- Download small models (`en_core_web_sm`)
- Process 10 sample articles
- Verify results written to SQLite
- **Goal**: Validate end-to-end pipeline

### Batch Processing Tests

- Simulate 100 articles in `feed_entries`
- Run batch job
- Verify all articles processed, flags updated
- Verify results in output tables
- **Goal**: Validate batch logic, error handling

### Performance Tests (Optional)

- Process 1000 articles
- Measure time per article
- Verify memory usage \<2GB
- **Goal**: Ensure scalability

**Test Fixtures**:

- `tests/fixtures/sample_articles.json` (10 articles with known properties)
- `tests/fixtures/mock_entities.json` (expected entity extraction output)

______________________________________________________________________

## Clarification 11: Success Metrics (Revised)

**Q**: How do we measure Phase 5 success?

**A**: Technical + usage metrics:

### Technical Metrics (Measurable Immediately)

- ✅ **Processing Throughput**: ≥100 articles/hour for quality scoring
- ✅ **Model Accuracy**: Sentiment classification accuracy ≥75% (manual spot-check of 100
  articles)
- ✅ **Entity Precision**: ≥80% of extracted entities are valid (manual spot-check)
- ✅ **Batch Job Reliability**: \<5% failure rate (track via `nlp_failures` column)
- ✅ **Database Performance**: Quality filtering query \<100ms (test with 10k articles)

### Usage Metrics (Require User Adoption)

- 📊 **Quality Filter Adoption**: 40% of search queries use quality filter (defer until
  search UI updated)
- 📊 **Entity Page Views**: 30% of users click on entity at least once (defer until
  entity pages built)
- 📊 **Sentiment Dashboard**: 20% of users view sentiment trends monthly (defer until
  dashboard built)

**Acceptance Criteria for Phase 5**:

1. ✅ All 4 batch jobs (quality, entities, sentiment, topics) running on schedule
1. ✅ Process 1000 articles → 95% success rate, \<5% failures
1. ✅ SQLite tables populated with results (quality scores, entities, sentiment)
1. ✅ CLI commands work (`aiwebfeeds nlp stats`, `list-entities`, etc.)
1. ✅ Unit + integration tests pass with ≥90% coverage

**Phase 6 (Future)**: Build UI to surface NLP results (quality filtering, entity pages,
sentiment dashboard)

______________________________________________________________________

## Clarification 12: Dependencies & Prerequisites

**Q**: What existing infrastructure do we leverage?

**A**: Heavy reuse from Phase 3B:

### From Phase 3B (Real-Time Monitoring)

- ✅ **`feed_entries` table**: Articles to process (already populated by polling jobs)
- ✅ **APScheduler**: Reuse for NLP batch jobs (already configured in `scheduler.py`)
- ✅ **SQLite database**: `data/aiwebfeeds.db` (already configured, WAL mode enabled)
- ✅ **Logger**: `logger.py` (Loguru) for NLP processing logs

### New Dependencies (Python)

```toml
# Add to packages/ai_web_feeds/pyproject.toml
dependencies = [
    # ... existing deps from Phase 3B ...
    
    # Phase 5: NLP
    "spacy>=3.7.0",  # NER + entity linking
    "transformers>=4.40.0",  # Hugging Face sentiment models
    "torch>=2.0.0",  # PyTorch for transformer models
    "gensim>=4.3.0",  # LDA topic modeling
    "langdetect>=1.0.9",  # Language detection
    "scikit-learn>=1.4.0",  # Clustering, TF-IDF
]
```

### Model Downloads (First Run)

```bash
# Download spaCy model (13MB)
uv run python -m spacy download en_core_web_sm

# Download Hugging Face models (auto-downloaded on first use, ~67MB)
# No manual download needed, handled by transformers library
```

______________________________________________________________________

## Clarification 13: Rollout Plan

**Q**: How do we roll out Phase 5?

**A**: Incremental rollout (one job at a time):

### Phase 5A: Quality Scoring (Week 1)

- ✅ Implement `quality_scorer.py` module
- ✅ Create `article_quality_scores` table
- ✅ Add quality batch job to scheduler
- ✅ Add CLI: `aiwebfeeds nlp process quality`
- ✅ Test with 1000 articles
- ✅ Document in `apps/web/content/docs/features/quality-scoring.mdx`

### Phase 5B: Entity Extraction (Week 2)

- ✅ Implement `entity_extractor.py` module
- ✅ Create `entities` + `entity_mentions` tables
- ✅ Add entity batch job to scheduler
- ✅ Add CLI: `aiwebfeeds nlp list-entities`, `show-entity`
- ✅ Test entity normalization with 500 articles
- ✅ Document in `apps/web/content/docs/features/entity-extraction.mdx`

### Phase 5C: Sentiment Analysis (Week 3)

- ✅ Implement `sentiment_analyzer.py` module
- ✅ Create `article_sentiment` + `topic_sentiment_daily` tables
- ✅ Add sentiment batch job + aggregation job
- ✅ Add CLI: `aiwebfeeds nlp sentiment <topic>`
- ✅ Test sentiment trends with 1000 articles over 30 days
- ✅ Document in `apps/web/content/docs/features/sentiment-analysis.mdx`

### Phase 5D: Topic Modeling (Week 4)

- ✅ Implement `topic_modeler.py` module
- ✅ Create `subtopics` + `topic_evolution_events` tables
- ✅ Add monthly topic modeling job
- ✅ Add CLI: `aiwebfeeds nlp review-subtopics`
- ✅ Test with 10k articles (1 month backlog)
- ✅ Document in `apps/web/content/docs/features/topic-modeling.mdx`

### Phase 5E: Testing & Documentation (Week 5)

- ✅ Write comprehensive unit tests (≥90% coverage)
- ✅ Write integration tests (end-to-end batch processing)
- ✅ Performance testing (1000 articles benchmark)
- ✅ Update main documentation (`CHANGELOG.md`, `README.md`)
- ✅ CLI validation (`aiwebfeeds nlp --help`)

**Total Estimated Time**: 5 weeks for full implementation

______________________________________________________________________

## Summary: Key Design Decisions

| Decision                | Rationale                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Batch Processing**    | Acceptable latency (\<2 hours), simpler architecture, no real-time API complexity  |
| **Lightweight Models**  | CPU-friendly (no GPU needed), fast inference, smaller downloads                    |
| **SQLite Storage**      | Reuse existing infrastructure, sufficient scale (1M+ articles), simpler deployment |
| **APScheduler**         | Reuse from Phase 3B, reliable, well-tested                                         |
| **Incremental Rollout** | Lower risk, easier testing, faster initial value delivery                          |
| **CLI-First**           | Build CLI before UI (test backend logic independently)                             |
| **Manual Curation**     | Topic modeling requires human review (not fully automated)                         |

______________________________________________________________________

**Next Step**: Generate implementation plan with `/speckit.plan`
