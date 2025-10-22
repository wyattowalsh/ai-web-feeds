# Feature Specification: Phase 1 - Data Discovery & Analytics

**Feature Branch**: `002-data-discovery-analytics`  
**Created**: 2025-10-22  
**Status**: Draft  
**Input**: User description: "Phase 1: Data & Discovery - Analytics Dashboard, Intelligent Search & Discovery, and AI-Powered Feed Recommendations"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Analytics Dashboard (Priority: P1) 🎯 MVP

As a **Feed Curator/Researcher**, I want to **visualize feed collection metrics and trends** so that I can **identify high-value feeds, spot inactive sources, and understand content patterns** in the AI/ML ecosystem.

**Why this priority**: Actionable insights from existing data with immediate value. Builds directly on completed MVP (validation data, feed metadata). No external dependencies. Quick wins for data-driven decisions.

**Independent Test**: Visit `/analytics` page → View real-time charts (trending topics, publication velocity, feed health distribution) → Filter by date range/topic → Export insights as PDF/CSV → Verify metrics match database queries

**Acceptance Scenarios**:

1. **Given** 1000+ feeds with validation history, **When** curator visits analytics dashboard, **Then** system displays: total feeds, success rate, avg response time, health score distribution, trending topics (last 30 days)
2. **Given** analytics dashboard loaded, **When** curator selects "Last 7 days" time filter, **Then** all charts update to show only data from past week with smooth transitions
3. **Given** topic filter applied (e.g., "LLM"), **When** curator views publication velocity chart, **Then** system shows daily/weekly/monthly posting frequency for feeds tagged with "LLM"
4. **Given** analytics data displayed, **When** curator clicks "Export Report", **Then** system generates PDF with all visible charts, summary stats, and timestamp

---

### User Story 2 - Intelligent Search & Discovery (Priority: P1) 🎯 MVP

As a **Feed Consumer/Researcher**, I want to **search feeds by keywords, topics, and semantic similarity** so that I can **quickly find relevant content sources without manually browsing the entire catalog**.

**Why this priority**: Core discovery functionality. Dramatically improves UX for large catalogs (1000+ feeds). Enables power users to find niche feeds. Foundation for recommendation system.

**Independent Test**: Visit `/search` page → Type "transformer models" in search bar → See autocomplete suggestions → Select "Full-text search" → View results with highlighted matches → Apply faceted filters (type=blog, verified=true) → Save search query → Verify results match expectations

**Acceptance Scenarios**:

1. **Given** user on search page, **When** user types "transformers" in search box, **Then** system shows autocomplete suggestions (feeds, topics, recent searches) within 200ms
2. **Given** search query "BERT optimization", **When** user presses Enter, **Then** system returns feeds with matching titles/descriptions, ranked by relevance, with highlighted keywords
3. **Given** search results displayed, **When** user applies faceted filters (source_type=blog, topic=nlp, verified=true), **Then** results update to show only verified NLP blogs, with count badges per filter
4. **Given** user found valuable search, **When** user clicks "Save Search", **Then** system stores query+filters and shows in "Saved Searches" sidebar for one-click replay
5. **Given** user has semantic search enabled, **When** user searches "attention mechanisms", **Then** system also returns feeds about "self-attention", "transformers", "BERT" via embedding similarity (cosine similarity ≥0.7)

---

### User Story 3 - AI-Powered Feed Recommendations (Priority: P2)

As a **Feed Consumer**, I want to **receive personalized feed suggestions based on my interests and browsing behavior** so that I can **discover high-quality content sources I wouldn't have found manually**.

**Why this priority**: Differentiation from competitors. Leverages AI/ML strengths. Increases engagement and discovery. Requires user interaction data (deferred to P2 until user accounts exist).

**Independent Test**: Visit `/recommendations` page → View "Recommended for You" section with 10 feed cards → Click "Why this recommendation?" to see explanation → Dismiss irrelevant feed → Like valuable feed → Reload page to see updated recommendations → Verify suggestions improve over time

**Acceptance Scenarios**:

1. **Given** new user visits recommendations page (cold start), **When** user completes onboarding quiz (select 3-5 topics of interest), **Then** system shows 10-20 recommended feeds from selected topics, ranked by popularity+quality
2. **Given** user with browsing history, **When** system generates recommendations, **Then** recommendations include: collaborative filtering ("users like you follow..."), content-based similarity ("similar to feeds you follow"), and trending feeds in user's topics
3. **Given** recommendation displayed, **When** user clicks "Why?" icon, **Then** system shows explanation ("Because you follow X", "Popular in Y topic", "Similar to Z")
4. **Given** user interacts with recommendations (like/dismiss), **When** page reloads, **Then** future recommendations incorporate feedback (boost liked topics, reduce dismissed categories)
5. **Given** user follows 20+ feeds across 5 topics, **When** system calculates recommendations, **Then** system uses hybrid approach (60% collaborative, 30% content-based, 10% serendipity) with diversity constraints (max 3 feeds per topic)

---

### Edge Cases

- **What happens when no search results found?** → Show "0 results" message with suggestions: check spelling, broaden search, browse by topic, contact us to add feed
- **How does system handle slow semantic search (>5s)?** → Show spinner, fall back to full-text search after 5s timeout, log performance issue
- **What happens when analytics data is stale (>24h)?** → Display banner "Data last updated: [timestamp]", provide "Refresh Now" button to trigger background job
- **How does system handle recommendations for users with no interaction data?** → Cold start: use popular feeds + onboarding quiz + random exploration (10% serendipity)
- **What happens when user searches for inappropriate/spam content?** → Filter out NSFW/spam feeds (verified flag), log suspicious queries, show "No results" without revealing filtering
- **How does system handle concurrent analytics queries?** → Use Redis cache (5min TTL) for expensive aggregations, implement query result pagination (1000 records max), rate limit API (10 req/min per IP)
- **What happens when trending topics have no feeds?** → Hide empty topics, suggest "Add a feed" action, show related topics with content
- **How does system handle user with extremely niche interests (1-2 matching feeds)?** → Expand recommendation scope to parent topics, show "Explore related topics" suggestions, explain scarcity transparently

---

## Requirements *(mandatory)*

### Functional Requirements - Analytics Dashboard

- **FR-001**: System MUST display real-time analytics dashboard at `/analytics` with key metrics: total feeds, validation success rate, average response time, health score distribution
- **FR-002**: System MUST provide time range filters: Last 7 days, Last 30 days, Last 90 days, Custom date range (date picker)
- **FR-003**: System MUST render interactive charts: trending topics (bar chart), publication velocity (line chart), feed health distribution (pie chart), validation success over time (area chart)
- **FR-004**: System MUST allow topic filtering: dropdown to filter all analytics by single topic (e.g., "Show only LLM feeds")
- **FR-005**: System MUST calculate trending topics by: article publication frequency (last 30 days), weighted by feed quality scores
- **FR-006**: System MUST display publication velocity metrics: daily/weekly/monthly post counts, average posts per feed, most/least active feeds
- **FR-007**: System MUST show feed health insights: healthy (≥0.8), moderate (0.5-0.8), unhealthy (<0.5) with counts and percentages
- **FR-008**: System MUST provide data export: PDF report (charts + summary), CSV export (raw metrics), API endpoint for programmatic access
- **FR-009**: System MUST cache analytics queries for 5 minutes to reduce database load
- **FR-010**: System MUST show data freshness indicator: "Last updated: [timestamp]" with auto-refresh option

### Functional Requirements - Search & Discovery

- **FR-011**: System MUST provide unified search interface at `/search` with single search bar
- **FR-012**: System MUST implement full-text search across: feed titles, descriptions, recent article titles (if cached)
- **FR-013**: System MUST provide autocomplete suggestions within 200ms: matching feeds (top 5), matching topics (top 3), recent searches (user-specific, top 3)
- **FR-014**: System MUST rank search results by relevance: TF-IDF scoring with boost factors (verified +20%, active +10%, popular +5%)
- **FR-015**: System MUST highlight search terms in results: bolded keywords in title/description snippets
- **FR-016**: System MUST implement faceted filtering: source type (blog, podcast, newsletter, etc.), topics (multi-select), verified status (toggle), activity status (active/inactive)
- **FR-017**: System MUST display result count badges: "Blogs (45)", "Verified (23)" next to each filter option
- **FR-018**: System MUST support filter combinations: multiple filters applied with AND logic (e.g., "blog AND nlp AND verified")
- **FR-019**: System MUST provide semantic search toggle: "Include similar results" checkbox that enables vector similarity search
- **FR-020**: System MUST implement semantic search using embeddings: Sentence-BERT embeddings for feed titles+descriptions, cosine similarity ≥0.7 threshold
- **FR-021**: System MUST allow saving searches: "Save Search" button stores query+filters, shown in sidebar for one-click replay
- **FR-022**: System MUST support search history: last 10 searches stored per user (localStorage or database if logged in)
- **FR-023**: System MUST handle zero results gracefully: suggestions (check spelling, broaden search), browse by topic link, contact form
- **FR-024**: System MUST paginate search results: 20 results per page with infinite scroll or numbered pagination
- **FR-025**: System MUST log search queries: anonymized search analytics (popular queries, zero-result queries) for improvement

### Functional Requirements - AI Recommendations

- **FR-026**: System MUST provide recommendations page at `/recommendations` with personalized feed suggestions
- **FR-027**: System MUST implement cold start onboarding: quiz with 3-5 topic selection (e.g., "What AI/ML areas interest you?")
- **FR-028**: System MUST generate 10-20 recommendations per page with infinite scroll
- **FR-029**: System MUST use collaborative filtering: "Users who follow X also follow Y" based on feed co-occurrence in user collections
- **FR-030**: System MUST use content-based filtering: recommend feeds similar to user's followed feeds (topic overlap, embedding similarity)
- **FR-031**: System MUST implement hybrid recommendation algorithm: 60% collaborative, 30% content-based, 10% serendipity (random popular feeds)
- **FR-032**: System MUST enforce diversity constraints: max 3 feeds per topic in recommendations, minimum 2 topics represented
- **FR-033**: System MUST provide recommendation explanations: "Because you follow X", "Popular in Y", "Similar to Z" with clickable links
- **FR-034**: System MUST support user feedback: "Like" (thumbs up), "Dismiss" (X icon), "Not interested in topic" (block topic)
- **FR-035**: System MUST update recommendations based on feedback: boost liked topics (weight +0.2), reduce dismissed feeds (weight -0.5), block unwanted topics
- **FR-036**: System MUST periodically retrain recommendation models: nightly batch job to recalculate collaborative matrix, weekly embedding refresh
- **FR-037**: System MUST implement trending feeds boost: feeds with sudden activity spike (3x avg posts in 7 days) get +0.1 relevance boost
- **FR-038**: System MUST provide recommendation API: `/api/recommendations?user_id=X&count=10` for programmatic access
- **FR-039**: System MUST log recommendation interactions: impressions, clicks, likes, dismisses for model evaluation and A/B testing
- **FR-040**: System MUST handle privacy: user can opt-out of personalization, recommendations fall back to popular feeds only

### Non-Functional Requirements

#### Performance

- **NFR-001**: Analytics dashboard MUST load within 2 seconds on 4G connection
- **NFR-002**: Search autocomplete MUST respond within 200ms for 95% of queries
- **NFR-003**: Full-text search MUST return results within 500ms for 10,000+ feed catalog
- **NFR-004**: Semantic search MUST return results within 3 seconds (acceptable for advanced feature)
- **NFR-005**: Recommendation generation MUST complete within 1 second (use precomputed matrices)
- **NFR-006**: System MUST handle 1000 concurrent users without performance degradation
- **NFR-007**: Analytics queries MUST be cached for 5 minutes to reduce database load by 80%

#### Scalability

- **NFR-008**: SQLite FTS5 MUST support 50,000+ feeds with sub-second search (tested: SQLite handles 100K+ FTS rows efficiently)
- **NFR-009**: Recommendation system MUST scale to 10,000+ users with O(log n) lookup time (SQLite B-tree indexes, precomputed collaborative matrices)
- **NFR-010**: Analytics aggregations MUST use SQLite triggers for incremental updates (10x faster than full re-computation)
- **NFR-011a**: SQLite database MUST use WAL mode for 1000+ concurrent readers without blocking writes
- **NFR-011b**: Vector similarity search MUST complete in <2s for 10,000 embeddings (brute-force NumPy or sqlite-vec extension)

#### Usability

- **NFR-011**: All charts MUST be interactive: hover tooltips, click to drill down, zoom/pan support
- **NFR-012**: Search interface MUST provide keyboard shortcuts: Cmd/Ctrl+K to focus, Arrow keys for autocomplete, Enter to search
- **NFR-013**: Recommendations MUST show progress indicator during generation (spinner, skeleton UI)
- **NFR-014**: All analytics/search/recommendations pages MUST be mobile-responsive (TailwindCSS breakpoints)

#### Data Quality

- **NFR-015**: Trending topics MUST exclude spam/low-quality feeds (verified flag filter)
- **NFR-016**: Recommendation models MUST be evaluated weekly: precision@10, recall@10, click-through rate metrics
- **NFR-017**: Search relevance MUST be manually audited monthly: test queries, A/B test ranking algorithms

### Key Entities

- **AnalyticsSnapshot**: Represents aggregated metrics at a point in time. Attributes: snapshot_date, total_feeds, active_feeds, validation_success_rate, avg_response_time, trending_topics (JSON array), health_distribution (JSON object). Stored daily for historical trending.

- **SearchQuery**: Represents user search interactions. Attributes: query_text, user_id (optional), timestamp, result_count, filters_applied (JSON), clicked_results (array of feed_ids). Used for search analytics and personalization.

- **SavedSearch**: User-saved search queries. Attributes: user_id, search_name, query_text, filters (JSON), created_at, last_used_at. Enables one-click replay of complex searches.

- **FeedEmbedding**: Vector representation of feed content. Attributes: feed_id, embedding_vector (768-dim float array), embedding_model_version, last_updated. Used for semantic search and content-based recommendations.

- **RecommendationInteraction**: User feedback on recommendations. Attributes: user_id, feed_id, interaction_type (impression/click/like/dismiss), timestamp. Used for model training and evaluation.

- **CollaborativeMatrix**: Precomputed feed co-occurrence matrix. Attributes: feed_id_1, feed_id_2, co_occurrence_score, last_updated. Used for fast collaborative filtering (avoids real-time computation).

- **UserProfile**: Representation of user interests (future, for P2). Attributes: user_id, followed_feeds (array), preferred_topics (array), interaction_history (JSON), created_at, updated_at. Foundation for personalization.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes - Analytics Dashboard

- **SC-001**: Dashboard page load time ≤2 seconds for 95% of requests
- **SC-002**: Curators can identify top 10 trending topics in ≤30 seconds
- **SC-003**: 80% of curators use analytics dashboard at least weekly (measured via page views)
- **SC-004**: Curators identify and disable 20+ inactive feeds within first month using health distribution chart
- **SC-005**: Export feature used by 30% of curators within first quarter

### Measurable Outcomes - Search & Discovery

- **SC-006**: Search results appear within 500ms for 95% of queries
- **SC-007**: 70% of searches yield >0 results (zero-result rate <30%)
- **SC-008**: Average click-through rate on search results ≥40% (users find relevant feeds)
- **SC-009**: 50% of users who search use faceted filters
- **SC-010**: Saved searches used by 20% of active users within first month
- **SC-011**: Semantic search (when enabled) increases result relevance by 25% (measured via A/B test click-through rate)

### Measurable Outcomes - AI Recommendations

- **SC-012**: Recommendation generation completes within 1 second for 95% of requests
- **SC-013**: Cold start users (onboarding quiz) receive recommendations with ≥50% topic match rate
- **SC-014**: Recommendation click-through rate ≥15% (users explore suggested feeds)
- **SC-015**: Users who interact with recommendations (like/dismiss) follow 2x more feeds than non-users
- **SC-016**: Recommendation precision@10 ≥60% (manual evaluation: 6+ relevant feeds in top 10)
- **SC-017**: 40% of new feed follows come from recommendations within 3 months

### Business Metrics

- **SC-018**: Monthly active users increase by 30% after Phase 1 launch (improved discovery)
- **SC-019**: Average session duration increases by 50% (users spend more time exploring)
- **SC-020**: Support tickets for "can't find X feed" decrease by 60% (better search)
- **SC-021**: 500+ saved searches created within first quarter (user engagement signal)
- **SC-022**: 80% user satisfaction score on post-launch survey (Phase 1 features)

---

## Assumptions

1. **MVP Completion**: Assumes US1 (Feed Discovery) and US2 (Quality Assurance) are fully implemented with validation data available
2. **Feed Metadata Quality**: Assumes feed titles/descriptions are accurate and informative for search relevance
3. **Data Volume**: Spec designed for 1,000-50,000 feeds; SQLite FTS5 handles this range efficiently without external search engines
4. **User Base**: Initial launch targets 100-1,000 users; recommendations use collaborative filtering when sufficient interaction data exists
5. **Computing Resources**: Semantic search requires CPU for embedding generation (one-time, ~100ms per feed); no GPU needed with quantized models
6. **Privacy**: Analytics and search logs are anonymized; personalized recommendations stored in browser localStorage (no user accounts in P1)
7. **SQLite Performance**: Assumes proper indexing, query optimization, and WAL mode for concurrent reads (sufficient for 1000 concurrent users)

---

## Dependencies

### Technical Dependencies

- **Database**: SQLite with FTS5 (full-text search), JSON1 extension (JSON support), triggers for materialized views
- **Search**: SQLite FTS5 with rank scoring, in-memory LRU cache (Python functools) for autocomplete
- **ML/AI**: Sentence-Transformers (open-source, Apache 2.0), scikit-learn (BSD), all-MiniLM-L6-v2 model (free)
- **Visualization**: Chart.js (MIT license, free), Apache ECharts (Apache 2.0), TailwindCSS (MIT)
- **Caching**: Python functools.lru_cache, SQLite temporary tables for precomputed analytics
- **Vector Storage**: SQLite with BLOB columns + NumPy for embeddings, or sqlite-vec extension (MIT, optional)

### Data Dependencies

- **Validation Data**: Relies on US2 validation history for health metrics and trends
- **Feed Metadata**: Relies on US1 feed catalog (titles, descriptions, topics) for search and recommendations
- **User Interaction Data**: Recommendations improve with user follows, likes, dismisses (collect over time)

### External Dependencies (All Free & Open-Source)

- **Embedding Model**: Pre-trained `all-MiniLM-L6-v2` from Sentence-Transformers (80MB, Apache 2.0 license, downloaded once)
- **Visualization**: Chart.js v4 (MIT) or Apache ECharts (Apache 2.0) via CDN or npm
- **PDF Export**: Playwright (Apache 2.0) or WeasyPrint (BSD) for server-side PDF generation
- **Vector Search**: sqlite-vec extension (MIT, optional) or native NumPy + SQLite BLOB for embeddings
- **Caching**: No Redis required - uses Python functools.lru_cache and SQLite TEMP tables

---

## Technical Architecture (Free & Open-Source Stack)

### SQLite Advanced Features

**Why SQLite?** Single-file, zero-config, serverless, 100% open-source (public domain), handles 1000+ concurrent reads with WAL mode.

#### Full-Text Search (FTS5)
```sql
-- Create FTS5 virtual table for feed search
CREATE VIRTUAL TABLE feeds_fts USING fts5(
  title, description, content,
  tokenize='porter unicode61'
);

-- Search with ranking
SELECT feed_id, rank 
FROM feeds_fts 
WHERE feeds_fts MATCH 'transformer attention'
ORDER BY rank 
LIMIT 20;
```

#### JSON Support (JSON1)
```sql
-- Store flexible analytics snapshots
CREATE TABLE analytics_snapshots (
  snapshot_date TEXT PRIMARY KEY,
  metrics JSON NOT NULL,
  trending_topics JSON
);

-- Query JSON data
SELECT json_extract(metrics, '$.success_rate') 
FROM analytics_snapshots 
WHERE snapshot_date = '2025-10-22';
```

#### Materialized Views (Triggers)
```sql
-- Precompute expensive aggregations
CREATE TABLE analytics_cache (
  metric_name TEXT PRIMARY KEY,
  metric_value REAL,
  last_updated TEXT
);

-- Auto-refresh with triggers
CREATE TRIGGER refresh_analytics 
AFTER INSERT ON validation_results
BEGIN
  UPDATE analytics_cache 
  SET metric_value = (SELECT AVG(response_time) FROM validation_results),
      last_updated = datetime('now')
  WHERE metric_name = 'avg_response_time';
END;
```

#### Vector Storage Options

**Option 1: Native SQLite + NumPy** (Zero dependencies)
```python
# Store embeddings as BLOB
CREATE TABLE feed_embeddings (
  feed_id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL  -- 768-dim float32 array
);

# Python cosine similarity
import numpy as np
query_vec = model.encode("transformer models")
results = []
for feed_id, embedding_blob in db.execute("SELECT feed_id, embedding FROM feed_embeddings"):
    feed_vec = np.frombuffer(embedding_blob, dtype=np.float32)
    similarity = np.dot(query_vec, feed_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(feed_vec))
    if similarity >= 0.7:
        results.append((feed_id, similarity))
```

**Option 2: sqlite-vec Extension** (MIT, optional)
```sql
-- Install: pip install sqlite-vec
-- Faster vector search with native SQL
SELECT feed_id, vec_distance_cosine(embedding, ?) as similarity
FROM feed_embeddings
WHERE similarity >= 0.7
ORDER BY similarity DESC
LIMIT 10;
```

### Free & Open-Source Library Stack

| Component | Library | License | Purpose |
|-----------|---------|---------|---------|
| **Database** | SQLite 3.40+ | Public Domain | Core storage, FTS5, JSON1 |
| **ORM** | SQLModel | MIT | Type-safe database models |
| **Search** | SQLite FTS5 | Built-in | Full-text search |
| **ML Framework** | scikit-learn | BSD | Collaborative filtering |
| **Embeddings** | sentence-transformers | Apache 2.0 | Semantic search |
| **Pretrained Model** | all-MiniLM-L6-v2 | Apache 2.0 | 384-dim embeddings |
| **Visualization** | Chart.js | MIT | Interactive charts |
| **Alt Visualization** | Apache ECharts | Apache 2.0 | Advanced charting |
| **PDF Export** | Playwright | Apache 2.0 | Headless browser |
| **Alt PDF** | WeasyPrint | BSD | HTML to PDF |
| **Caching** | functools.lru_cache | Python stdlib | In-memory cache |
| **Vector Math** | NumPy | BSD | Embedding operations |
| **Web Framework** | FastAPI | MIT | REST API (existing) |
| **Frontend** | Next.js 15 | MIT | Web UI (existing) |
| **Styling** | TailwindCSS | MIT | CSS framework (existing) |

**Total Cost**: $0 (100% free, open-source, permissive licenses)

### Performance Optimizations

#### SQLite Configuration
```python
# Enable WAL mode for concurrent reads
PRAGMA journal_mode = WAL;

# Increase cache size (200MB)
PRAGMA cache_size = -200000;

# Use memory for temp tables
PRAGMA temp_store = MEMORY;

# Optimize for read-heavy workloads
PRAGMA synchronous = NORMAL;
PRAGMA mmap_size = 268435456;  # 256MB memory-mapped I/O
```

#### Indexing Strategy
```sql
-- Search performance
CREATE INDEX idx_feeds_fts_search ON feeds_fts(title, description);

-- Analytics queries
CREATE INDEX idx_validation_timestamp ON validation_results(validated_at);
CREATE INDEX idx_validation_feed ON validation_results(feed_source_id, validated_at);

-- Recommendation queries
CREATE INDEX idx_feed_topics ON feed_sources(topics);
CREATE INDEX idx_collaborative_matrix ON collaborative_matrix(feed_id_1, feed_id_2);
```

#### Caching Layers

1. **Application Cache** (Python functools)
   - Autocomplete suggestions: 5-minute TTL
   - Trending topics: 30-minute TTL
   - Popular searches: 1-hour TTL

2. **Database Cache** (SQLite TEMP tables)
   - Precomputed analytics: Refresh daily
   - Collaborative matrix: Refresh nightly
   - Embedding index: Refresh on feed additions

3. **Browser Cache** (localStorage)
   - Search history: Per-user, 10 recent queries
   - Saved searches: Per-user, unlimited
   - Recommendation feedback: Per-user, 100 interactions

---

## Out of Scope (Phase 1)

The following features are explicitly **NOT included** in Phase 1 and may be considered for future phases:

1. **User Accounts**: No authentication, login, or personalized profiles (deferred to Phase 2). Recommendations use browser localStorage for MVP.
2. **Real-Time Analytics**: Dashboard updates every 5 minutes (cached), not live streaming. Real-time requires WebSocket infrastructure.
3. **Advanced NLP**: No sentiment analysis, entity extraction, or topic modeling beyond keyword trending. Deferred to Phase 3.
4. **Collaborative Feeds**: No user-generated collections or public sharing. Deferred to Phase 2 (Community Curation).
5. **Notification System**: No email/push notifications for trending topics or new recommendations. Deferred to Phase 2.
6. **A/B Testing Framework**: Manual ranking/algorithm adjustments. Automated experimentation framework deferred to Phase 3.
7. **Multi-Language Support**: Search and recommendations are English-only initially. I18n deferred to Phase 4.
8. **Mobile Apps**: Web-only (responsive design). Native iOS/Android apps deferred to Phase 5.
9. **Video/Podcast Content**: Text-based feeds only. Multimedia content search deferred to future.
10. **Advanced Filtering**: Simple facets only (type, topic, verified). Complex boolean queries, date ranges, custom fields deferred.

---

**Next Steps**: Run `/speckit.clarify` to identify ambiguities, then `/speckit.plan` to generate technical implementation plan.
