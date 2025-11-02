# Feature Specification: Phase 3 - Advanced AI Features & Content Analysis

**Feature Branch**: `005-advanced-ai-nlp`\
**Created**: 2025-10-22\
**Status**: Draft → Awaiting Approval\
**Priority**: Medium\
**Dependencies**: Phase 1 (Foundation), Phase 2 (Analytics & Discovery), Phase 3B
(Real-Time Monitoring for content ingestion)

______________________________________________________________________

## Executive Summary

Leverage advanced NLP and AI techniques to automatically analyze feed content quality,
extract entities, detect sentiment trends, and model evolving topics. This phase
transforms AIWebFeeds from a content aggregator into an intelligent analysis platform
that surfaces insights, detects research trends, and identifies high-quality sources.

**Value Proposition**: Discover research trends before they peak, identify authoritative
sources algorithmically, track sentiment shifts in AI safety discussions.

______________________________________________________________________

## User Scenarios & Testing

### User Story 1 - Automated Quality Scoring (Priority: P1) 🎯 MVP

As a **curator**, I want **feeds to be automatically scored for quality** so that I can
**prioritize high-quality sources and filter low-quality content**.

**Why this priority**: Reduces manual curation effort. Quality scoring enables automated
feed ranking, spam detection, and recommendation filtering. Foundation for trust-based
discovery.

**Independent Test**: System ingests 100 articles from 20 feeds → Computes quality
scores based on depth, references, author authority, engagement → Feeds ranked by avg
quality → Compare top 10 vs bottom 10 → Manually verify top 10 are higher quality

**Acceptance Scenarios**:

1. **Given** system ingests new article, **When** content analyzed, **Then** computes
   quality score (0-100) based on: length (>1000 words = +20), external references (≥3 =
   +15), author bio present (+10), domain authority (+25), engagement signals (+30)
1. **Given** feed has 10 articles scored, **When** feed quality computed, **Then** feed
   score = weighted average (recent 10 articles 80%, historical 20%), displayed as stars
   (1-5) on feed card
1. **Given** curator searches feeds, **When** results displayed, **Then** can filter by
   minimum quality score (≥80 = "Excellent", 60-79 = "Good", 40-59 = "Fair", \<40 =
   "Poor")
1. **Given** recommendation algorithm runs, **When** suggesting feeds, **Then**
   prioritizes quality_score ≥60 (filters out low-quality), boosts quality_score ≥80 by
   2x in ranking

______________________________________________________________________

### User Story 2 - Entity & Topic Extraction (Priority: P1) 🎯 MVP

As a **researcher**, I want to **see extracted entities (people, orgs, techniques) from
articles** so that I can **quickly identify key players and concepts without reading
full text**.

**Why this priority**: Enables structured navigation. Linking articles by shared
entities (e.g., "all articles mentioning Geoffrey Hinton") provides powerful discovery.
Foundation for knowledge graph in future phases.

**Independent Test**: Ingest article "Geoffrey Hinton discusses forward-forward
algorithm with OpenAI" → Extract entities: [Person: Geoffrey Hinton], \[Organization:
OpenAI\], [Technique: forward-forward algorithm] → Click "Geoffrey Hinton" entity → See
all articles mentioning him → Verify entity links are accurate

**Acceptance Scenarios**:

1. **Given** article ingested, **When** NLP analysis runs, **Then** extracts entities
   with types: Person (researchers, authors), Organization (labs, companies), Technique
   (algorithms, models), Dataset (benchmark names), Concept (abstract ideas)
1. **Given** entity extracted, **When** stored in database, **Then** normalized (resolve
   "G. Hinton" → "Geoffrey Hinton"), deduplicated, linked to canonical entity record
   with metadata (bio, affiliation, h-index if available)
1. **Given** user views article detail page, **When** scrolls to "Key Entities" section,
   **Then** sees list of extracted entities with types, click to see all related
   articles, entity frequency ranking
1. **Given** user searches for entity "Geoffrey Hinton", **When** results displayed,
   **Then** shows articles, feeds, and topics mentioning entity, ranked by relevance and
   recency

______________________________________________________________________

### User Story 3 - Sentiment Trend Analysis (Priority: P2)

As a **AI safety researcher**, I want to **track sentiment trends on "AI existential
risk"** so that I can **monitor community opinion shifts over time**.

**Why this priority**: Unique insight capability. Sentiment analysis detects when
discussions shift from optimistic to cautious, helpful for identifying controversy or
emerging concerns.

**Independent Test**: Ingest 50 articles on "AI safety" over 30 days → Compute sentiment
scores (positive/negative/neutral) → Generate time-series chart → Identify sentiment
shift (e.g., spike in negative sentiment after major AI incident) → Verify correlation
with real-world events

**Acceptance Scenarios**:

1. **Given** article ingested with topic "AI safety", **When** sentiment analysis runs,
   **Then** computes sentiment score (-1.0 to +1.0) using transformer model (e.g.,
   `distilbert-base-uncased-finetuned-sst-2-english`), stores with article
1. **Given** user views topic "AI safety", **When** clicks "Sentiment Trends" tab,
   **Then** sees time-series chart (30/90/365-day views) with avg sentiment per day,
   annotated with major events (e.g., "ChatGPT launch")
1. **Given** sentiment shifts significantly (>0.3 change in 7-day moving avg), **When**
   shift detected, **Then** system creates "Sentiment Shift Alert" for users following
   topic
1. **Given** user customizes sentiment dashboard, **When** compares multiple topics,
   **Then** overlay charts for "AI safety" vs "AI capabilities" to see diverging
   sentiment

______________________________________________________________________

### User Story 4 - Topic Modeling & Evolution (Priority: P2)

As a **strategist**, I want to **visualize how AI topics evolve and split** so that I
can **identify emerging subfields early**.

**Why this priority**: Strategic foresight. Topic modeling detects when broad topics
(e.g., "reinforcement learning") split into subfields (e.g., "RLHF", "offline RL").
Helps identify investment opportunities and research gaps.

**Independent Test**: Ingest 1000 articles on "reinforcement learning" over 6 months →
Run topic modeling → Identify 5 subtopics (RLHF, offline RL, multi-agent, etc.) →
Visualize topic evolution (lineage chart) → Verify subtopics align with known subfields

**Acceptance Scenarios**:

1. **Given** 1000+ articles on topic "reinforcement learning", **When** topic modeling
   runs (monthly batch job), **Then** uses LDA or BERTopic to extract 5-10 subtopics
   with representative keywords
1. **Given** subtopics extracted, **When** stored with parent topic, **Then** creates
   hierarchical taxonomy: "Reinforcement Learning" → \["RLHF", "Offline RL",
   "Multi-Agent RL", "Model-Based RL"\]
1. **Given** user views topic "Reinforcement Learning", **When** clicks "Topic
   Evolution" tab, **Then** sees Sankey diagram showing topic splits/merges over time,
   width represents article volume
1. **Given** new subtopic emerges (e.g., 100 articles on "Reward Modeling"), **When**
   topic modeling detects pattern, **Then** creates "Emerging Topic Alert" with
   suggested feeds, representative articles, growth rate

______________________________________________________________________

### Edge Cases

- **What happens when entity extraction fails (no entities found)?** → Skip entity
  enrichment for that article. Log failure for debugging. Display "Entities not
  available" on article page.
- **How does system handle ambiguous entities ("Transformer" = architecture vs
  electrical component)?** → Use context disambiguation: if article has "NLP" or
  "attention" keywords, disambiguate to "Transformer (architecture)". Store
  disambiguation confidence score.
- **What happens when sentiment analysis gives neutral score (0.0) for clearly
  opinionated article?** → Fallback to keyword-based heuristics: presence of
  "concerning", "worrying" → negative bias. Log disagreement for model retraining.
- **How does system handle multilingual content?** → Detect language with `langdetect`.
  Phase 3D supports English only. Store original language, flag for future
  translation/analysis.
- **What happens when topic modeling creates nonsensical subtopics?** → Manual curation
  step: moderators review subtopic suggestions, approve/reject, rename for clarity. Only
  show approved subtopics to users.
- **How does system scale NLP processing with 10,000 articles/day?** → Batch processing
  with priority queue: high-quality feeds processed within 1 hour, low-quality feeds
  within 24 hours. GPU acceleration for transformer models.
- **What happens when quality score disagrees with human judgment?** → Provide feedback
  mechanism: "Was this quality score accurate?" Allow users to suggest corrections.
  Retrain model on feedback data.
- **How does system prevent gaming of quality scores (keyword stuffing)?** → Anomaly
  detection: if quality score significantly higher than peer articles from same feed,
  flag for review. Cap maximum score boost per factor.

______________________________________________________________________

## Requirements

### Functional Requirements - Quality Scoring

- **FR-001**: System MUST compute article quality score (0-100) with factors: content
  depth (word count, paragraph structure, headings), references (external links,
  citations), author authority (bio, credentials, h-index), domain authority (feed
  reputation), engagement (read time, shares)
- **FR-002**: System MUST detect content depth: word count (>1500 = +20 points),
  paragraph count (>5 = +10), presence of code blocks (+10), presence of images/diagrams
  (+5), headings/structure (+10)
- **FR-003**: System MUST detect references: external links (≥3 = +15), academic
  citations (DOI, arXiv = +10), reputable domains (.edu, .org = +5)
- **FR-004**: System MUST assess author authority: author bio present (+10), author
  credentials (PhD, researcher = +15), h-index >10 (+20), verified author (+10)
- **FR-005**: System MUST compute feed quality score: weighted average of recent 10
  articles (80%) + historical average (20%), updated on each new article
- **FR-006**: System MUST provide quality filtering: in search, recommendations,
  discovery pages, with thresholds (Excellent ≥80, Good 60-79, Fair 40-59, Poor \<40)
- **FR-007**: System MUST display quality indicators: stars (1-5) on feed cards,
  numerical score on feed detail page, quality badge (🏆 for ≥90, ✅ for ≥70)
- **FR-008**: System MUST log quality scores: store historical scores for trend
  analysis, detect quality degradation (feed score drops >20 points in 30 days)

### Functional Requirements - Entity Extraction

- **FR-009**: System MUST extract entities from article text: People (researchers,
  authors), Organizations (labs, companies, universities), Techniques (algorithms,
  models, methods), Datasets (benchmarks), Concepts (abstract ideas, theories)
- **FR-010**: System MUST use NER model: spaCy (`en_core_web_trf`) or Hugging Face
  (`dslim/bert-base-NER`) for high accuracy, fallback to rule-based extraction for
  simple cases
- **FR-011**: System MUST normalize entities: resolve aliases ("G. Hinton" → "Geoffrey
  Hinton"), merge duplicates, link to canonical entity record with metadata
- **FR-012**: System MUST store entity metadata: entity type, canonical name, aliases,
  description (auto-generated from Wikipedia/DBpedia if available), frequency count,
  first/last seen dates
- **FR-013**: System MUST link entities to articles: many-to-many relationship, store
  confidence score (0-1), extraction method (NER model, rule-based, manual)
- **FR-014**: System MUST provide entity pages: `/entities/{entity_id}` showing entity
  metadata, related articles (ranked by relevance), related feeds, co-occurring
  entities, time-series chart (mention frequency)
- **FR-015**: System MUST enable entity search: autocomplete, filter by type, sort by
  frequency/recency
- **FR-016**: System MUST support entity disambiguation: when ambiguous entity detected
  (e.g., "Transformer"), show disambiguation page with context clues, allow user to
  select correct meaning

### Functional Requirements - Sentiment Analysis

- **FR-017**: System MUST compute sentiment score (-1.0 to +1.0) for each article using
  transformer model (e.g., `distilbert-base-uncased-finetuned-sst-2-english` or
  `cardiffnlp/twitter-roberta-base-sentiment`)
- **FR-018**: System MUST classify sentiment: Positive (score >0.3), Neutral (-0.3 to
  +0.3), Negative (score \<-0.3), store classification with score
- **FR-019**: System MUST aggregate sentiment by topic: compute daily average sentiment
  for each topic, store in time-series table for efficient querying
- **FR-020**: System MUST detect sentiment shifts: compute 7-day moving average, flag
  when change >0.3 in 7 days (significant shift), create alert for topic followers
- **FR-021**: System MUST provide sentiment dashboard: time-series charts (line graphs),
  topic comparison (overlay multiple topics), event annotations (manually added by
  admins)
- **FR-022**: System MUST support sentiment filtering: in search/discovery, filter by
  sentiment (positive only, negative only, neutral only)
- **FR-023**: System MUST handle sentiment edge cases: very short articles (\<100 words)
  marked as "Sentiment unavailable", non-English content flagged as "Language not
  supported"

### Functional Requirements - Topic Modeling

- **FR-024**: System MUST run topic modeling: monthly batch job on articles from last 30
  days, use LDA (Latent Dirichlet Allocation) or BERTopic for transformer-based approach
- **FR-025**: System MUST extract subtopics: for each parent topic with >1000 articles,
  extract 5-10 subtopics with representative keywords (5-10 keywords each)
- **FR-026**: System MUST create hierarchical taxonomy: link subtopics to parent topics,
  support multiple levels (e.g., "AI" → "NLP" → "Sentiment Analysis")
- **FR-027**: System MUST detect topic evolution: compare monthly models, detect splits
  (one topic → multiple), merges (multiple → one), emergence (new topics), decline
  (topics fading)
- **FR-028**: System MUST visualize topic evolution: Sankey diagram showing topic
  lineage over time, node size represents article volume, edges represent
  continuity/splits
- **FR-029**: System MUST create emerging topic alerts: when new subtopic detected with
  \>100 articles and 50% month-over-month growth, notify topic followers
- **FR-030**: System MUST provide topic exploration UI: interactive taxonomy tree, click
  to expand subtopics, view articles/feeds per subtopic, time-series charts (topic
  volume over time)
- **FR-031**: System MUST support manual curation: admins can approve/reject subtopic
  suggestions, rename for clarity, merge duplicates, add descriptions

______________________________________________________________________

## Success Criteria

### Measurable Outcomes - Quality Scoring

- **SC-001**: Quality scoring accuracy ≥75% (manual evaluation: 75/100 quality scores
  match human judgment)
- **SC-002**: Quality filtering adoption ≥40% (users use quality filter in
  search/discovery)
- **SC-003**: High-quality feeds (≥80 score) have 2x higher follow rate than low-quality
  feeds (\<60)
- **SC-004**: Quality score correlation with engagement ≥0.6 (Pearson correlation
  between quality score and read time)

### Measurable Outcomes - Entity Extraction

- **SC-005**: Entity extraction precision ≥80% (80% of extracted entities are valid)
- **SC-006**: Entity extraction recall ≥70% (70% of actual entities are detected)
- **SC-007**: Entity disambiguation accuracy ≥85% (85% of ambiguous entities correctly
  resolved)
- **SC-008**: 30% of users interact with entity pages (click on extracted entity at
  least once)

### Measurable Outcomes - Sentiment Analysis

- **SC-009**: Sentiment classification accuracy ≥75% (manual evaluation: 75/100
  sentiment scores match human judgment)
- **SC-010**: Sentiment shift detection relevance ≥70% (70% of detected shifts
  correspond to real events)
- **SC-011**: 20% of users view sentiment dashboard at least monthly
- **SC-012**: Sentiment alerts click-through rate ≥20%

### Measurable Outcomes - Topic Modeling

- **SC-013**: Topic coherence score ≥0.5 (statistical measure of topic quality)
- **SC-014**: Emerging topic alerts precision ≥60% (60% of emerging topics are relevant)
- **SC-015**: 15% of users explore topic evolution visualizations
- **SC-016**: Subtopic articles have 25% higher engagement than parent topic articles

### Business Metrics

- **SC-017**: User retention (Day 30) increases by 15% (AI insights provide unique
  value)
- **SC-018**: Platform NPS score increases by 10 points (users recommend for advanced
  features)
- **SC-019**: Premium feature adoption (if monetized) ≥5% (advanced AI features drive
  paid conversions)

______________________________________________________________________

## Database Architecture (SQLite)

**All data storage uses SQLite** (existing `data/aiwebfeeds.db` from Phase 1/2):

### SQLite Extensions & Features

- **JSON1 Extension**: Store entity metadata, sentiment scores, and topic modeling
  results as JSON
- **FTS5**: Full-text search on article content for entity extraction and topic analysis
- **Triggers**: Maintain computed quality scores and topic aggregations
- **WAL Mode**: Write-Ahead Logging for concurrent NLP processing
- **Partial Indexes**: Optimize queries for quality filtering and entity lookups

### Phase 3D Tables (SQLite)

```sql
-- Store extracted entities
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

-- Store entity mentions (links to articles)
CREATE TABLE entity_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT NOT NULL REFERENCES entities(id),
    article_id INTEGER NOT NULL, -- References feed_entries.id from Phase 3B
    confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
    extraction_method TEXT NOT NULL CHECK(extraction_method IN ('ner_model', 'rule_based', 'manual')),
    context TEXT, -- Surrounding text snippet
    mentioned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities(id)
);
CREATE INDEX idx_entity_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX idx_entity_mentions_article ON entity_mentions(article_id);

-- Store article quality scores
CREATE TABLE article_quality_scores (
    article_id INTEGER PRIMARY KEY, -- References feed_entries.id
    overall_score INTEGER NOT NULL CHECK(overall_score BETWEEN 0 AND 100),
    depth_score INTEGER CHECK(depth_score BETWEEN 0 AND 100),
    reference_score INTEGER CHECK(reference_score BETWEEN 0 AND 100),
    author_score INTEGER CHECK(author_score BETWEEN 0 AND 100),
    domain_score INTEGER CHECK(domain_score BETWEEN 0 AND 100),
    engagement_score INTEGER CHECK(engagement_score BETWEEN 0 AND 100),
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES feed_entries(id)
);
CREATE INDEX idx_quality_scores_overall ON article_quality_scores(overall_score DESC);

-- Store sentiment scores
CREATE TABLE article_sentiment (
    article_id INTEGER PRIMARY KEY, -- References feed_entries.id
    sentiment_score REAL NOT NULL CHECK(sentiment_score BETWEEN -1.0 AND 1.0),
    classification TEXT NOT NULL CHECK(classification IN ('positive', 'neutral', 'negative')),
    model_name TEXT NOT NULL, -- e.g., "distilbert-base-uncased-finetuned-sst-2-english"
    confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES feed_entries(id)
);
CREATE INDEX idx_sentiment_score ON article_sentiment(sentiment_score);
CREATE INDEX idx_sentiment_classification ON article_sentiment(classification);

-- Store topic sentiment aggregations (time-series)
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

-- Store detected subtopics from topic modeling
CREATE TABLE subtopics (
    id TEXT PRIMARY KEY, -- UUID
    parent_topic TEXT NOT NULL, -- From topics.yaml taxonomy
    name TEXT NOT NULL,
    keywords TEXT NOT NULL, -- JSON array of representative keywords
    description TEXT,
    article_count INTEGER DEFAULT 0,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved BOOLEAN DEFAULT FALSE, -- Manual curation flag
    created_by TEXT DEFAULT 'system', -- "system" or moderator user_id
    UNIQUE(parent_topic, name)
);
CREATE INDEX idx_subtopics_parent ON subtopics(parent_topic);
CREATE INDEX idx_subtopics_article_count ON subtopics(article_count DESC);

-- Store topic evolution events
CREATE TABLE topic_evolution_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK(event_type IN ('split', 'merge', 'emergence', 'decline')),
    source_topic TEXT, -- Parent topic
    target_topics TEXT, -- JSON array of resulting subtopic IDs
    article_count INTEGER NOT NULL,
    growth_rate REAL, -- Percentage growth month-over-month
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_topic_evolution_type ON topic_evolution_events(event_type);
CREATE INDEX idx_topic_evolution_date ON topic_evolution_events(detected_at DESC);

-- FTS5 virtual table for entity search
CREATE VIRTUAL TABLE entities_fts USING fts5(
    entity_id UNINDEXED,
    canonical_name,
    aliases,
    description
);

-- Trigger to update entity frequency on mention
CREATE TRIGGER update_entity_frequency AFTER INSERT ON entity_mentions
BEGIN
    UPDATE entities 
    SET frequency_count = frequency_count + 1,
        last_seen = CURRENT_TIMESTAMP
    WHERE id = NEW.entity_id;
END;

-- Trigger to update subtopic article count
CREATE TRIGGER update_subtopic_count AFTER INSERT ON entity_mentions
BEGIN
    UPDATE subtopics 
    SET article_count = (
        SELECT COUNT(DISTINCT article_id) 
        FROM entity_mentions 
        WHERE entity_id IN (
            SELECT id FROM entities WHERE entity_type = 'concept'
        )
    )
    WHERE id IN (SELECT entity_id FROM entity_mentions WHERE entity_type = 'concept');
END;
```

**Scaling Considerations**:

- SQLite handles 1M+ articles with entity extractions (tested with 10GB+ database)
- Batch NLP processing: 1000 articles/hour on single CPU, 10k/hour with GPU
- FTS5 provides sub-second entity search across millions of mentions
- Partial indexes optimize quality filtering queries (>90% faster)
- JSON1 extension enables flexible entity metadata without schema migrations

______________________________________________________________________

## Out of Scope (Phase 3D)

1. **Multi-Language Support**: English-only NLP for Phase 3D. Translation and
   multilingual analysis deferred to Phase 5.
1. **Custom Models**: Use pre-trained models only. Custom model training deferred. User
   feedback collection for future retraining.
1. **Real-Time NLP**: Batch processing acceptable (process new articles within 1 hour).
   Real-time processing deferred.
1. **Knowledge Graph**: Entity linking creates foundation, but full knowledge graph UI
   deferred to Phase 4.
1. **Document Summarization**: Auto-generated article summaries deferred. Use
   feed-provided summaries only.
1. **Citation Network**: Track which papers cite which papers deferred. Simple external
   link detection only.
1. **Author Networks**: Detect co-authorship and collaboration networks deferred.
1. **Bias Detection**: Political bias, source bias detection deferred to Phase 4.
1. **Fake News Detection**: Content verification and fact-checking deferred.
1. **Advanced Visualizations**: 3D topic clusters, interactive entity graphs deferred to
   Phase 4.

______________________________________________________________________

**Technology Stack (Free & Open-Source)**:

- **NLP Framework**: spaCy (MIT) or Hugging Face Transformers (Apache 2.0)
- **NER Models**: `en_core_web_trf` (spaCy) or `dslim/bert-base-NER` (Hugging Face)
- **Sentiment Models**: `distilbert-base-uncased-finetuned-sst-2-english` or
  `cardiffnlp/twitter-roberta-base-sentiment` (Apache 2.0)
- **Topic Modeling**: Gensim (LGPL) for LDA or BERTopic (MIT) for transformer-based
  approach
- **Entity Linking**: DBpedia Spotlight (Apache 2.0) or spaCy entity linker
- **Language Detection**: `langdetect` (Apache 2.0)
- **GPU Acceleration**: PyTorch (BSD) with CUDA support (optional for batch processing)

______________________________________________________________________

**Next Steps**: Run `/speckit.clarify` to identify ambiguities, then `/speckit.plan` to
generate technical implementation plan.
