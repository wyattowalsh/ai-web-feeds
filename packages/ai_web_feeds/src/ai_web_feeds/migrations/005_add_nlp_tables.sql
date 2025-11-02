-- =====================================================================
-- Phase 5: Advanced AI/NLP - Database Migration
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extend feed_entries table (from Phase 3B)
-- ---------------------------------------------------------------------
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We'll handle this in the Python script by checking column existence first

-- These will be added via Python script:
-- ALTER TABLE feed_entries ADD COLUMN quality_processed BOOLEAN DEFAULT FALSE;
-- ALTER TABLE feed_entries ADD COLUMN entities_processed BOOLEAN DEFAULT FALSE;
-- ALTER TABLE feed_entries ADD COLUMN sentiment_processed BOOLEAN DEFAULT FALSE;
-- ALTER TABLE feed_entries ADD COLUMN topics_processed BOOLEAN DEFAULT FALSE;
-- ALTER TABLE feed_entries ADD COLUMN quality_processed_at DATETIME;
-- ALTER TABLE feed_entries ADD COLUMN entities_processed_at DATETIME;
-- ALTER TABLE feed_entries ADD COLUMN sentiment_processed_at DATETIME;
-- ALTER TABLE feed_entries ADD COLUMN nlp_failures TEXT;
-- ALTER TABLE feed_entries ADD COLUMN last_failure_reason TEXT;

-- ---------------------------------------------------------------------
-- 2. Quality Scoring Tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS article_quality_scores (
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
CREATE TABLE IF NOT EXISTS entities (
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

CREATE TABLE IF NOT EXISTS entity_mentions (
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
CREATE TABLE IF NOT EXISTS article_sentiment (
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

CREATE TABLE IF NOT EXISTS topic_sentiment_daily (
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
CREATE TABLE IF NOT EXISTS subtopics (
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

CREATE TABLE IF NOT EXISTS topic_evolution_events (
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
