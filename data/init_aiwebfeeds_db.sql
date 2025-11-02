-- AIWebFeeds Database Initialization Script
-- SQLite Database Schema for aiwebfeeds.db
-- Generated: 2025-11-02
-- Compatible with: SQLModel, SQLAlchemy 2.0+
--
-- This script creates all tables for:
-- - Phase 001: Core project (sources, items, fetch logs, topics)
-- - Phase 002: Analytics & Discovery (embeddings, snapshots, search, recommendations)
-- - Phase 003: Real-time Monitoring (polling, notifications, trending)
-- - Phase 005: Advanced AI/NLP (quality scoring, entities, sentiment, topic modeling)

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ============================================================================
-- Phase 001: Core Tables
-- ============================================================================

-- Feed Sources (main table)
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY NOT NULL,
    feed TEXT,
    site TEXT,
    title TEXT NOT NULL,
    source_type TEXT,
    mediums TEXT, -- JSON array
    tags TEXT, -- JSON array
    topics TEXT NOT NULL, -- JSON array
    topic_weights TEXT, -- JSON object
    language TEXT DEFAULT 'en',
    format TEXT DEFAULT 'unknown',
    updated TIMESTAMP,
    last_validated TIMESTAMP,
    verified BOOLEAN DEFAULT 0,
    contributor TEXT,
    popularity_score REAL DEFAULT 0.0 CHECK(popularity_score >= 0.0 AND popularity_score <= 1.0),
    validation_count INTEGER DEFAULT 0,
    curation_status TEXT DEFAULT 'unverified',
    curation_since TIMESTAMP,
    curation_by TEXT,
    quality_score REAL CHECK(quality_score IS NULL OR (quality_score >= 0.0 AND quality_score <= 1.0)),
    curation_notes TEXT,
    provenance_source TEXT,
    provenance_from TEXT,
    provenance_license TEXT,
    discover_enabled BOOLEAN DEFAULT 0,
    discover_config TEXT, -- JSON object
    relations TEXT, -- JSON object
    mappings TEXT, -- JSON object
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sources_source_type ON sources(source_type);
CREATE INDEX IF NOT EXISTS idx_sources_verified ON sources(verified);
CREATE INDEX IF NOT EXISTS idx_sources_popularity_score ON sources(popularity_score);
CREATE INDEX IF NOT EXISTS idx_sources_curation_status ON sources(curation_status);
CREATE INDEX IF NOT EXISTS idx_sources_active_verified_popularity ON sources(curation_status, verified, popularity_score);

-- Feed Items (articles/entries)
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY NOT NULL,
    feed_source_id TEXT NOT NULL,
    title TEXT,
    link TEXT,
    description TEXT,
    content TEXT,
    author TEXT,
    published TIMESTAMP,
    updated TIMESTAMP,
    guid TEXT UNIQUE,
    categories TEXT, -- JSON array
    tags TEXT, -- JSON array
    enclosures TEXT, -- JSON array
    extra_data TEXT, -- JSON object
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_feed_source_id ON items(feed_source_id);
CREATE INDEX IF NOT EXISTS idx_items_published ON items(published);
CREATE INDEX IF NOT EXISTS idx_items_guid ON items(guid);

-- Feed Fetch Logs
CREATE TABLE IF NOT EXISTS fetch_logs (
    id TEXT PRIMARY KEY NOT NULL,
    feed_source_id TEXT NOT NULL,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fetch_url TEXT NOT NULL,
    success BOOLEAN DEFAULT 0,
    status_code INTEGER,
    content_type TEXT,
    content_length INTEGER,
    etag TEXT,
    last_modified TEXT,
    error_message TEXT,
    error_type TEXT,
    items_found INTEGER,
    items_new INTEGER,
    items_updated INTEGER,
    fetch_duration_ms INTEGER,
    response_headers TEXT, -- JSON object
    extra_data TEXT, -- JSON object
    FOREIGN KEY (feed_source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fetch_logs_feed_source_id ON fetch_logs(feed_source_id);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_fetched_at ON fetch_logs(fetched_at);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_success ON fetch_logs(success);

-- Topics
CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    parent_id TEXT,
    aliases TEXT, -- JSON array
    related_topics TEXT, -- JSON array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topics_parent_id ON topics(parent_id);

-- ============================================================================
-- Phase 001: Enrichment & Validation Tables
-- ============================================================================

-- Feed Enrichment Data
CREATE TABLE IF NOT EXISTS enrichment (
    id TEXT PRIMARY KEY NOT NULL,
    feed_source_id TEXT NOT NULL UNIQUE,
    enriched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enrichment_version TEXT DEFAULT '1.0.0',
    enricher TEXT,
    discovered_title TEXT,
    discovered_description TEXT,
    discovered_language TEXT,
    discovered_author TEXT,
    detected_format TEXT,
    detected_platform TEXT,
    platform_metadata TEXT, -- JSON object
    icon_url TEXT,
    logo_url TEXT,
    image_url TEXT,
    favicon_url TEXT,
    banner_url TEXT,
    health_score REAL CHECK(health_score IS NULL OR (health_score >= 0.0 AND health_score <= 1.0)),
    quality_score REAL CHECK(quality_score IS NULL OR (quality_score >= 0.0 AND quality_score <= 1.0)),
    completeness_score REAL CHECK(completeness_score IS NULL OR (completeness_score >= 0.0 AND completeness_score <= 1.0)),
    reliability_score REAL CHECK(reliability_score IS NULL OR (reliability_score >= 0.0 AND reliability_score <= 1.0)),
    freshness_score REAL CHECK(freshness_score IS NULL OR (freshness_score >= 0.0 AND freshness_score <= 1.0)),
    entry_count INTEGER,
    has_full_content BOOLEAN DEFAULT 0,
    avg_content_length REAL,
    content_types TEXT, -- JSON array
    content_samples TEXT, -- JSON array
    estimated_frequency TEXT,
    last_updated TIMESTAMP,
    update_regularity REAL CHECK(update_regularity IS NULL OR (update_regularity >= 0.0 AND update_regularity <= 1.0)),
    update_intervals TEXT, -- JSON array
    response_time_ms REAL,
    availability_score REAL CHECK(availability_score IS NULL OR (availability_score >= 0.0 AND availability_score <= 1.0)),
    uptime_percentage REAL CHECK(uptime_percentage IS NULL OR (uptime_percentage >= 0.0 AND uptime_percentage <= 100.0)),
    suggested_topics TEXT, -- JSON array
    topic_confidence TEXT, -- JSON object
    auto_keywords TEXT, -- JSON array
    has_itunes BOOLEAN DEFAULT 0,
    has_media_rss BOOLEAN DEFAULT 0,
    has_dublin_core BOOLEAN DEFAULT 0,
    has_geo BOOLEAN DEFAULT 0,
    extension_data TEXT, -- JSON object
    seo_title TEXT,
    seo_description TEXT,
    og_image TEXT,
    twitter_card TEXT,
    social_metadata TEXT, -- JSON object
    encoding TEXT,
    generator TEXT,
    ttl INTEGER,
    cloud TEXT, -- JSON object
    internal_links INTEGER,
    external_links INTEGER,
    broken_links INTEGER,
    redirect_chains TEXT, -- JSON array
    uses_https BOOLEAN DEFAULT 0,
    has_valid_ssl BOOLEAN DEFAULT 0,
    security_headers TEXT, -- JSON object
    structured_data TEXT, -- JSON object
    raw_metadata TEXT, -- JSON object
    extra_data TEXT, -- JSON object
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrichment_feed_source_id ON enrichment(feed_source_id);

-- Feed Validation Results
CREATE TABLE IF NOT EXISTS validations (
    id TEXT PRIMARY KEY NOT NULL,
    feed_source_id TEXT NOT NULL,
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validator_version TEXT DEFAULT '1.0.0',
    is_valid BOOLEAN DEFAULT 0,
    validation_level TEXT,
    schema_valid BOOLEAN DEFAULT 0,
    schema_version TEXT,
    schema_errors TEXT, -- JSON array
    is_accessible BOOLEAN DEFAULT 0,
    http_status INTEGER,
    redirect_count INTEGER,
    final_url TEXT,
    has_items BOOLEAN DEFAULT 0,
    item_count INTEGER,
    has_required_fields BOOLEAN DEFAULT 0,
    missing_fields TEXT, -- JSON array
    format_valid BOOLEAN DEFAULT 0,
    format_errors TEXT, -- JSON array
    xml_well_formed BOOLEAN DEFAULT 0,
    links_checked INTEGER,
    links_valid INTEGER,
    links_broken INTEGER,
    broken_link_urls TEXT, -- JSON array
    images_checked INTEGER,
    images_accessible INTEGER,
    image_errors TEXT, -- JSON array
    response_time_ms REAL,
    size_bytes INTEGER,
    compression_ratio REAL,
    https_enabled BOOLEAN DEFAULT 0,
    ssl_valid BOOLEAN DEFAULT 0,
    security_issues TEXT, -- JSON array
    warnings TEXT, -- JSON array
    recommendations TEXT, -- JSON array
    validation_report TEXT, -- JSON object
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_validations_feed_source_id ON validations(feed_source_id);
CREATE INDEX IF NOT EXISTS idx_validations_validated_at ON validations(validated_at);
CREATE INDEX IF NOT EXISTS idx_validations_is_valid ON validations(is_valid);

-- Feed Analytics
CREATE TABLE IF NOT EXISTS analytics (
    id TEXT PRIMARY KEY NOT NULL,
    feed_source_id TEXT NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    period_type TEXT DEFAULT 'daily',
    total_items INTEGER DEFAULT 0,
    new_items INTEGER DEFAULT 0,
    updated_items INTEGER DEFAULT 0,
    deleted_items INTEGER DEFAULT 0,
    update_count INTEGER DEFAULT 0,
    avg_update_interval_hours REAL,
    min_update_interval_hours REAL,
    max_update_interval_hours REAL,
    avg_content_length REAL,
    avg_title_length REAL,
    has_images_count INTEGER DEFAULT 0,
    has_video_count INTEGER DEFAULT 0,
    has_audio_count INTEGER DEFAULT 0,
    avg_links_per_item REAL,
    avg_categories_per_item REAL,
    unique_authors INTEGER DEFAULT 0,
    items_with_full_content INTEGER DEFAULT 0,
    items_with_summary_only INTEGER DEFAULT 0,
    items_with_media INTEGER DEFAULT 0,
    fetch_attempts INTEGER DEFAULT 0,
    fetch_successes INTEGER DEFAULT 0,
    fetch_failures INTEGER DEFAULT 0,
    uptime_percentage REAL CHECK(uptime_percentage IS NULL OR (uptime_percentage >= 0.0 AND uptime_percentage <= 100.0)),
    avg_response_time_ms REAL,
    min_response_time_ms REAL,
    max_response_time_ms REAL,
    topic_distribution TEXT, -- JSON object
    keyword_frequency TEXT, -- JSON object
    extra_metrics TEXT, -- JSON object
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analytics_feed_source_id ON analytics(feed_source_id);
CREATE INDEX IF NOT EXISTS idx_analytics_period_start ON analytics(period_start);
CREATE INDEX IF NOT EXISTS idx_analytics_period_type ON analytics(period_type);

-- ============================================================================
-- Phase 002: Data Discovery & Analytics Tables
-- ============================================================================

-- Feed Embeddings (for semantic search)
CREATE TABLE IF NOT EXISTS feed_embeddings (
    feed_id TEXT PRIMARY KEY NOT NULL,
    embedding BLOB NOT NULL, -- 384-dim float32 array (1536 bytes)
    embedding_model TEXT DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
    embedding_provider TEXT DEFAULT 'local',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Analytics Snapshots (daily aggregated metrics for dashboards)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    snapshot_date TEXT PRIMARY KEY NOT NULL, -- ISO date YYYY-MM-DD
    total_feeds INTEGER NOT NULL,
    active_feeds INTEGER NOT NULL,
    validation_success_rate REAL NOT NULL CHECK(validation_success_rate >= 0.0 AND validation_success_rate <= 1.0),
    avg_response_time REAL NOT NULL,
    trending_topics TEXT NOT NULL, -- JSON array
    health_distribution TEXT NOT NULL, -- JSON object
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Topic Statistics (for trending and Most Active Topics)
CREATE TABLE IF NOT EXISTS topic_stats (
    id TEXT PRIMARY KEY NOT NULL,
    topic TEXT NOT NULL,
    feed_count INTEGER NOT NULL,
    validation_frequency REAL NOT NULL,
    avg_health_score REAL NOT NULL CHECK(avg_health_score >= 0.0 AND avg_health_score <= 1.0),
    snapshot_date TEXT NOT NULL, -- ISO date YYYY-MM-DD
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topic_stats_topic ON topic_stats(topic);
CREATE INDEX IF NOT EXISTS idx_topic_stats_snapshot_date ON topic_stats(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_topic_stats_validation_frequency ON topic_stats(validation_frequency DESC);

-- Search Queries (user search interactions)
CREATE TABLE IF NOT EXISTS search_queries (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    query_text TEXT NOT NULL,
    search_type TEXT NOT NULL,
    filters_applied TEXT, -- JSON object
    result_count INTEGER NOT NULL,
    clicked_results TEXT, -- JSON array
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_queries_user_id ON search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_timestamp ON search_queries(timestamp);

-- Saved Searches (user-saved search queries)
CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    search_name TEXT NOT NULL,
    query_text TEXT NOT NULL,
    filters TEXT, -- JSON object
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);

-- Recommendation Interactions (user feedback on recommendations)
CREATE TABLE IF NOT EXISTS recommendation_interactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    interaction_type TEXT NOT NULL,
    context TEXT, -- JSON object
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recommendation_interactions_user_id ON recommendation_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_interactions_feed_id ON recommendation_interactions(feed_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_interactions_timestamp ON recommendation_interactions(timestamp);

-- User Profiles (user interests and preferences)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY NOT NULL,
    followed_feeds TEXT, -- JSON array
    preferred_topics TEXT, -- JSON array
    blocked_topics TEXT, -- JSON array
    interaction_history TEXT, -- JSON object
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collaborative Matrix (precomputed feed co-occurrence)
CREATE TABLE IF NOT EXISTS collaborative_matrix (
    id TEXT PRIMARY KEY NOT NULL,
    feed_id_1 TEXT NOT NULL,
    feed_id_2 TEXT NOT NULL,
    co_occurrence_score REAL NOT NULL CHECK(co_occurrence_score >= 0.0 AND co_occurrence_score <= 1.0),
    support INTEGER NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_id_1) REFERENCES sources(id) ON DELETE CASCADE,
    FOREIGN KEY (feed_id_2) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collaborative_matrix_feed_id_1 ON collaborative_matrix(feed_id_1);
CREATE INDEX IF NOT EXISTS idx_collaborative_matrix_feed_id_2 ON collaborative_matrix(feed_id_2);

-- ============================================================================
-- Phase 003: Real-Time Monitoring Tables
-- ============================================================================

-- Feed Entries (discovered articles from polling)
CREATE TABLE IF NOT EXISTS feed_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id TEXT NOT NULL,
    guid TEXT NOT NULL UNIQUE,
    link TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content_html TEXT,
    pub_date TIMESTAMP NOT NULL,
    author TEXT,
    categories TEXT, -- JSON array
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    quality_processed BOOLEAN DEFAULT 0,
    entities_processed BOOLEAN DEFAULT 0,
    sentiment_processed BOOLEAN DEFAULT 0,
    topics_processed BOOLEAN DEFAULT 0,
    quality_processed_at TIMESTAMP,
    entities_processed_at TIMESTAMP,
    sentiment_processed_at TIMESTAMP,
    nlp_failures TEXT, -- JSON object
    last_failure_reason TEXT,
    FOREIGN KEY (feed_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feed_entries_feed_id ON feed_entries(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_entries_guid ON feed_entries(guid);
CREATE INDEX IF NOT EXISTS idx_feed_entries_pub_date ON feed_entries(pub_date);
CREATE INDEX IF NOT EXISTS idx_feed_entries_quality_processed ON feed_entries(quality_processed);
CREATE INDEX IF NOT EXISTS idx_feed_entries_entities_processed ON feed_entries(entities_processed);
CREATE INDEX IF NOT EXISTS idx_feed_entries_sentiment_processed ON feed_entries(sentiment_processed);

-- Feed Poll Jobs (polling job tracking)
CREATE TABLE IF NOT EXISTS feed_poll_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id TEXT NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status TEXT NOT NULL,
    error_message TEXT,
    articles_discovered INTEGER DEFAULT 0 CHECK(articles_discovered >= 0),
    response_time_ms INTEGER CHECK(response_time_ms IS NULL OR response_time_ms >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feed_poll_jobs_feed_id ON feed_poll_jobs(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_poll_jobs_status ON feed_poll_jobs(status);
CREATE INDEX IF NOT EXISTS idx_feed_poll_jobs_scheduled_at ON feed_poll_jobs(scheduled_at);

-- Notifications (user notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    context_data TEXT, -- JSON object
    read_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- User Feed Follows (user subscriptions)
CREATE TABLE IF NOT EXISTS user_feed_follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_feed_follows_user_id ON user_feed_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feed_follows_feed_id ON user_feed_follows(feed_id);

-- Trending Topics (detected trends)
CREATE TABLE IF NOT EXISTS trending_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id TEXT NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    article_count INTEGER NOT NULL CHECK(article_count >= 0),
    baseline_mean REAL NOT NULL CHECK(baseline_mean >= 0.0),
    baseline_std REAL NOT NULL CHECK(baseline_std >= 0.0),
    z_score REAL NOT NULL,
    rank INTEGER NOT NULL CHECK(rank >= 1),
    representative_articles TEXT, -- JSON array of article IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trending_topics_topic_id ON trending_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_trending_topics_period_start ON trending_topics(period_start);
CREATE INDEX IF NOT EXISTS idx_trending_topics_z_score ON trending_topics(z_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_rank ON trending_topics(rank);

-- Notification Preferences (user notification settings)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    feed_id TEXT,
    delivery_method TEXT NOT NULL,
    frequency TEXT NOT NULL,
    quiet_hours_start TEXT,
    quiet_hours_end TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_feed_id ON notification_preferences(feed_id);

-- Email Digests (email digest subscriptions)
CREATE TABLE IF NOT EXISTS email_digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    schedule_type TEXT NOT NULL,
    schedule_cron TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    last_sent_at TIMESTAMP,
    next_send_at TIMESTAMP NOT NULL,
    article_count INTEGER DEFAULT 0 CHECK(article_count >= 0),
    open_count INTEGER DEFAULT 0 CHECK(open_count >= 0),
    click_count INTEGER DEFAULT 0 CHECK(click_count >= 0),
    unsubscribed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_digests_user_id ON email_digests(user_id);
CREATE INDEX IF NOT EXISTS idx_email_digests_next_send_at ON email_digests(next_send_at);

-- ============================================================================
-- Phase 005: Advanced AI/NLP Tables
-- ============================================================================

-- Article Quality Scores (quality metrics)
CREATE TABLE IF NOT EXISTS article_quality_scores (
    article_id INTEGER PRIMARY KEY NOT NULL,
    overall_score INTEGER NOT NULL CHECK(overall_score >= 0 AND overall_score <= 100),
    depth_score INTEGER CHECK(depth_score IS NULL OR (depth_score >= 0 AND depth_score <= 100)),
    reference_score INTEGER CHECK(reference_score IS NULL OR (reference_score >= 0 AND reference_score <= 100)),
    author_score INTEGER CHECK(author_score IS NULL OR (author_score >= 0 AND author_score <= 100)),
    domain_score INTEGER CHECK(domain_score IS NULL OR (domain_score >= 0 AND domain_score <= 100)),
    engagement_score INTEGER CHECK(engagement_score IS NULL OR (engagement_score >= 0 AND engagement_score <= 100)),
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES feed_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_article_quality_scores_computed_at ON article_quality_scores(computed_at);
CREATE INDEX IF NOT EXISTS idx_article_quality_scores_overall_score ON article_quality_scores(overall_score DESC);

-- Entities (extracted named entities)
CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY NOT NULL,
    canonical_name TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL,
    aliases TEXT, -- JSON array
    description TEXT,
    entity_metadata TEXT, -- JSON object
    frequency_count INTEGER DEFAULT 0 CHECK(frequency_count >= 0),
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entities_canonical_name ON entities(canonical_name);
CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_frequency_count ON entities(frequency_count DESC);

-- Entity Mentions (entity occurrences in articles)
CREATE TABLE IF NOT EXISTS entity_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT NOT NULL,
    article_id INTEGER NOT NULL,
    confidence REAL NOT NULL CHECK(confidence >= 0.0 AND confidence <= 1.0),
    extraction_method TEXT NOT NULL,
    context TEXT,
    mentioned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES feed_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_id ON entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_article_id ON entity_mentions(article_id);

-- Article Sentiment (sentiment classification)
CREATE TABLE IF NOT EXISTS article_sentiment (
    article_id INTEGER PRIMARY KEY NOT NULL,
    sentiment_score REAL NOT NULL CHECK(sentiment_score >= -1.0 AND sentiment_score <= 1.0),
    classification TEXT NOT NULL,
    model_name TEXT NOT NULL,
    confidence REAL NOT NULL CHECK(confidence >= 0.0 AND confidence <= 1.0),
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES feed_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_article_sentiment_computed_at ON article_sentiment(computed_at);
CREATE INDEX IF NOT EXISTS idx_article_sentiment_classification ON article_sentiment(classification);

-- Topic Sentiment Daily (aggregated sentiment by topic)
CREATE TABLE IF NOT EXISTS topic_sentiment_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    avg_sentiment REAL NOT NULL,
    article_count INTEGER NOT NULL CHECK(article_count >= 0),
    positive_count INTEGER DEFAULT 0 CHECK(positive_count >= 0),
    neutral_count INTEGER DEFAULT 0 CHECK(neutral_count >= 0),
    negative_count INTEGER DEFAULT 0 CHECK(negative_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_topic_sentiment_daily_topic ON topic_sentiment_daily(topic);
CREATE INDEX IF NOT EXISTS idx_topic_sentiment_daily_date ON topic_sentiment_daily(date);

-- Subtopics (discovered subtopics from topic modeling)
CREATE TABLE IF NOT EXISTS subtopics (
    id TEXT PRIMARY KEY NOT NULL,
    parent_topic TEXT NOT NULL,
    name TEXT NOT NULL,
    keywords TEXT NOT NULL, -- JSON array
    description TEXT,
    article_count INTEGER DEFAULT 0 CHECK(article_count >= 0),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved BOOLEAN DEFAULT 0,
    created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_subtopics_parent_topic ON subtopics(parent_topic);
CREATE INDEX IF NOT EXISTS idx_subtopics_article_count ON subtopics(article_count DESC);
CREATE INDEX IF NOT EXISTS idx_subtopics_approved ON subtopics(approved);

-- Topic Evolution Events (topic lifecycle tracking)
CREATE TABLE IF NOT EXISTS topic_evolution_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    source_topic TEXT,
    target_topics TEXT, -- JSON array
    article_count INTEGER NOT NULL CHECK(article_count >= 0),
    growth_rate REAL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topic_evolution_events_event_type ON topic_evolution_events(event_type);
CREATE INDEX IF NOT EXISTS idx_topic_evolution_events_detected_at ON topic_evolution_events(detected_at);

-- ============================================================================
-- Completion
-- ============================================================================

-- Verify schema
PRAGMA integrity_check;

-- Show table list
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
