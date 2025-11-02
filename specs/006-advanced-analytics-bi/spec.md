# Feature Specification: Phase 3 - Advanced Analytics & Business Intelligence

**Feature Branch**: `006-advanced-analytics-bi`  
**Created**: 2025-10-22  
**Status**: Draft → Awaiting Approval  
**Priority**: Medium  
**Dependencies**: Phase 1 (Foundation), Phase 2 (Analytics & Discovery), Phase 3D (Advanced AI/NLP for enriched data)

---

## Executive Summary

Transform AIWebFeeds into an enterprise-grade business intelligence platform with custom dashboards, advanced metrics, cohort analysis, and programmatic API access. This phase enables power users, researchers, and organizations to derive strategic insights from AI/ML feed data, supporting data-driven decision-making and competitive intelligence.

**Value Proposition**: Replace spreadsheet analysis with interactive dashboards, export data for research papers, integrate with BI tools (Tableau, PowerBI), build custom applications on AIWebFeeds data.

---

## User Scenarios & Testing

### User Story 1 - Custom Dashboards (Priority: P1) 🎯 MVP

As a **research manager**, I want to **create custom dashboards with drag-and-drop widgets** so that I can **track KPIs relevant to my team's focus areas**.

**Why this priority**: One-size-fits-all analytics insufficient for diverse user needs. Custom dashboards enable each user to surface insights relevant to their work. Foundation for enterprise adoption.

**Independent Test**: Click "Create Dashboard" → Drag "Topic Trends" widget → Configure topics ["LLM", "Computer Vision"] → Drag "Feed Health" widget → Configure feeds [top 10 feeds] → Save dashboard → Set as default → Refresh page → Verify dashboard loads with real-time data

**Acceptance Scenarios**:

1. **Given** user creates new dashboard, **When** opens widget library, **Then** sees 20+ widget types: Topic Trends (line chart), Feed Health (gauge), Entity Frequency (bar chart), Sentiment Timeline (area chart), Custom Metrics (KPI cards)
2. **Given** user drags widget to canvas, **When** configures widget, **Then** can customize: data sources (topics/feeds/entities), time range (7/30/90/365 days), visualization type (chart/table/heatmap), refresh interval (real-time/hourly/daily)
3. **Given** dashboard configured, **When** saves with name "Team AI Safety Dashboard", **Then** appears in user's dashboard list, can set as default (loads on `/analytics`), can share with collaborators (read-only URL)
4. **Given** dashboard shared, **When** collaborator views, **Then** sees real-time data (not snapshot), can export individual widgets (PNG/CSV), cannot edit unless granted edit permissions

---

### User Story 2 - Advanced Data Export (Priority: P1) 🎯 MVP

As a **academic researcher**, I want to **export feed metadata and article data in multiple formats** so that I can **analyze data in Jupyter notebooks and publish findings**.

**Why this priority**: Data portability critical for research use cases. Academic users need CSV/JSON for statistical analysis, citation network studies, meta-research. Differentiation from commercial feed readers.

**Independent Test**: Configure export: topics ["Reinforcement Learning"], date range [Jan 1 - Dec 31, 2024], include fields [title, author, pubDate, entities, sentiment] → Export as CSV → Load in pandas → Verify 5000+ rows → Check schema matches spec → Compute statistics

**Acceptance Scenarios**:

1. **Given** user configures export, **When** selects data scope (topics, feeds, date range, quality filter), **Then** can choose fields: metadata (title, link, pubDate), enriched (entities, sentiment, quality score), engagement (read time, shares), feed info (source, topics)
2. **Given** export configured, **When** selects format, **Then** supports: CSV (tabular), JSON (nested), JSONL (streaming), Parquet (compressed), Excel (with multiple sheets)
3. **Given** large export (>100k rows), **When** initiates export, **Then** system creates async job, sends email when ready, provides paginated download links (50MB chunks), expires after 7 days
4. **Given** export requires preprocessing (entity normalization, sentiment aggregation), **When** job runs, **Then** shows progress indicator, estimates completion time, allows cancellation, retries on failure

---

### User Story 3 - Cohort Analysis (Priority: P2)

As a **product manager**, I want to **analyze user behavior cohorts** so that I can **understand which features drive retention**.

**Why this priority**: User analytics enable product improvements. Cohort analysis reveals which user segments are most engaged, which features correlate with retention, where onboarding friction exists.

**Independent Test**: Define cohort "Users who followed ≥5 feeds in first week" → Track retention (Day 7, 14, 30) → Compare to baseline cohort → Visualize retention curves → Identify retention cliff (Day 14) → Analyze feature usage differences

**Acceptance Scenarios**:

1. **Given** user defines cohort, **When** selects criteria (signup date, first action, feature usage), **Then** can combine conditions: "Signed up in Jan 2024 AND followed ≥5 feeds in first week AND used search at least once"
2. **Given** cohort defined, **When** analyzes retention, **Then** sees retention curves (Day 1, 7, 14, 30, 60, 90), comparison to baseline, statistical significance (p-value), sample size
3. **Given** retention data displayed, **When** drills down, **Then** can segment by user attributes (source, topic interests, notification preferences), see feature usage heatmap (which features correlated with retention)
4. **Given** cohort insights discovered, **When** exports report, **Then** generates PDF with executive summary, retention charts, statistical tests, recommended actions

---

### User Story 4 - API Access & Rate Limiting (Priority: P2)

As a **developer**, I want **programmatic API access with authentication** so that I can **build custom tools and integrations**.

**Why this priority**: API access enables ecosystem growth. Third-party tools, browser extensions, mobile apps, Slack bots, etc. Programmatic access required for enterprise integrations (CRM, BI tools).

**Independent Test**: Generate API key → Make authenticated request `GET /api/v1/feeds?topics=LLM&quality_min=80` → Verify JSON response with 20 feeds → Hit rate limit (100 req/hour) → Receive 429 error → Wait 1 minute → Retry succeeds

**Acceptance Scenarios**:

1. **Given** user generates API key, **When** navigates to API settings, **Then** can create multiple keys (name, expiration date, scopes), revoke keys, view usage stats (requests/hour, total requests)
2. **Given** API key created, **When** makes authenticated request, **Then** uses bearer token (`Authorization: Bearer <key>`), supports all public endpoints (feeds, topics, search, analytics), rate limited (100 req/hour free tier)
3. **Given** API rate limit exceeded, **When** receives 429 error, **Then** response includes retry-after header, clear error message, link to upgrade to higher tier (1000 req/hour paid tier)
4. **Given** developer builds integration, **When** consults API docs, **Then** sees OpenAPI spec (Swagger UI), code examples (Python, JavaScript, curl), authentication guide, rate limit details, versioning policy

---

### Edge Cases

- **What happens when dashboard has 50+ widgets and loads slowly?** → Implement lazy loading (load visible widgets first), pagination (max 12 widgets per page), performance warning ("Reduce widgets for faster loading").
- **How does system handle export of 1 million+ articles?** → Implement streaming export (chunked downloads), compression (gzip), Parquet format for large datasets, max 500k rows per export (suggest filtering).
- **What happens when cohort has <100 users (insufficient sample size)?** → Show warning "Sample size too small for statistical significance", display data but mark as "Indicative only", suggest expanding cohort criteria.
- **How does system prevent API key leakage?** → Show key only once on creation (copy to clipboard, never display again), support key rotation (create new, deprecate old), detect suspicious usage patterns (multiple IPs, sudden spike).
- **What happens when dashboard widget data source deleted (feed removed)?** → Mark widget as "Data source unavailable", show placeholder with error message, suggest reconfiguring widget or removing it.
- **How does system handle time zone differences in analytics?** → Store all timestamps in UTC, display in user's timezone (detected or set in preferences), allow selecting timezone for exports.
- **What happens when export job fails after 2 hours of processing?** → Retry automatically (3 attempts with exponential backoff), send email notification on failure, preserve partial results for debugging.
- **How does system scale dashboard queries with 100 concurrent users?** → Implement query result caching (Redis, 5-minute TTL), pre-aggregate common metrics (hourly batch jobs), optimize database indexes.

---

## Requirements

### Functional Requirements - Custom Dashboards

- **FR-001**: System MUST provide dashboard builder: drag-and-drop interface, grid layout (12-column responsive), widget library (20+ widget types), preview mode
- **FR-002**: System MUST support widget types: Line Chart (time-series), Bar Chart (comparisons), Pie Chart (distributions), Gauge (KPIs), Heatmap (correlations), Table (raw data), KPI Card (single metric)
- **FR-003**: System MUST allow widget configuration: data source selection (topics/feeds/entities), time range (custom or preset), visualization options (colors, legends, axis labels), refresh interval (real-time/1min/5min/1hour/daily)
- **FR-004**: System MUST support dashboard actions: Create, Read, Update, Delete, Duplicate, Share (read-only URL), Set as default, Export (PDF/PNG)
- **FR-005**: System MUST implement dashboard permissions: Owner (full control), Editor (modify widgets, cannot delete), Viewer (read-only), Public (unauthenticated access)
- **FR-006**: System MUST provide dashboard templates: "Executive Overview" (high-level KPIs), "Research Dashboard" (trending topics, entity frequency), "Feed Health Monitor" (uptime, quality scores), "Community Insights" (user activity, popular collections)
- **FR-007**: System MUST optimize dashboard performance: lazy loading (load visible widgets first), query caching (5-minute TTL), pre-aggregation (hourly batch jobs for common metrics)
- **FR-008**: System MUST support dashboard filters: global filters apply to all widgets (date range, topics, feeds), widget-specific filters override globals

### Functional Requirements - Data Export

- **FR-009**: System MUST provide export UI: data scope selection (topics, feeds, entities, date range), field selection (metadata, enriched, engagement), format selection (CSV, JSON, JSONL, Parquet, Excel)
- **FR-010**: System MUST support export formats:
  - **CSV**: Flat tabular format, UTF-8 encoding, comma-delimited, header row
  - **JSON**: Nested structure, array of objects, pretty-printed optional
  - **JSONL**: JSON Lines (one object per line), streaming-friendly
  - **Parquet**: Columnar storage, compressed (gzip), efficient for large datasets
  - **Excel**: Multiple sheets (feeds, articles, entities), formatted headers, filter buttons
- **FR-011**: System MUST implement async export: for exports >10k rows or processing time >30 seconds, create background job, send email notification when ready, provide download link (expires in 7 days)
- **FR-012**: System MUST support export customization: include/exclude fields, date format (ISO 8601, Unix timestamp, human-readable), entity normalization (resolve aliases), sentiment aggregation (per topic)
- **FR-013**: System MUST implement export limits: max 500k rows per export, max 10 concurrent exports per user, max 50 exports per day per user, suggest filtering/pagination for larger datasets
- **FR-014**: System MUST provide export API: programmatic export via API (`POST /api/v1/export`), supports same formats, returns job ID, poll for completion (`GET /api/v1/export/{job_id}`)
- **FR-015**: System MUST track export jobs: status (pending/running/completed/failed), progress percentage, error messages, created/completed timestamps, download link

### Functional Requirements - Cohort Analysis

- **FR-016**: System MUST support cohort definition: signup date range, first action type, feature usage criteria (followed feeds, used search, created collection), combine with AND/OR logic
- **FR-017**: System MUST compute retention metrics: Day 1, 7, 14, 30, 60, 90 retention rates, cohort size, comparison to baseline cohort, statistical significance (p-value, confidence intervals)
- **FR-018**: System MUST visualize retention curves: line chart with multiple cohorts overlaid, retention percentage on y-axis, days since signup on x-axis, interactive tooltips (exact values, sample size)
- **FR-019**: System MUST support cohort segmentation: by user attributes (acquisition source, topic interests, notification preferences), feature usage heatmap (which features correlated with retention), funnel analysis (onboarding steps)
- **FR-020**: System MUST provide cohort comparison: A/B test analysis (compare two cohorts), statistical tests (t-test, chi-square), effect size (Cohen's d), recommended actions based on insights
- **FR-021**: System MUST generate cohort reports: PDF export with executive summary, retention charts, statistical tests, feature usage breakdown, recommended actions
- **FR-022**: System MUST implement cohort privacy: anonymize user data, aggregate metrics only (no individual user tracking visible), GDPR/CCPA compliant

### Functional Requirements - API Access

- **FR-023**: System MUST provide API key management: create keys (name, expiration, scopes), list keys, revoke keys, view usage stats (requests/hour, total requests, bandwidth)
- **FR-024**: System MUST support API authentication: bearer token (`Authorization: Bearer <key>`), API key in header (`X-API-Key: <key>`), OAuth 2.0 (future phase)
- **FR-025**: System MUST implement rate limiting: 100 requests/hour (free tier), 1000 requests/hour (paid tier), 429 error when exceeded, retry-after header, clear error messages
- **FR-026**: System MUST provide API endpoints: feeds list (`GET /api/v1/feeds`), feed detail (`GET /api/v1/feeds/{id}`), search (`GET /api/v1/search`), topics (`GET /api/v1/topics`), analytics (`GET /api/v1/analytics/*`), export (`POST /api/v1/export`)
- **FR-027**: System MUST support API pagination: cursor-based pagination (scalable), page size limit (max 100 items per page), next/previous URLs in response, total count in headers
- **FR-028**: System MUST provide API documentation: OpenAPI 3.0 spec (Swagger UI), code examples (Python, JavaScript, curl), authentication guide, rate limit details, error codes, versioning policy (/api/v1, /api/v2)
- **FR-029**: System MUST implement API versioning: major version in URL path, deprecation notices (6-month warning), backward compatibility within major version, changelog with migration guides
- **FR-030**: System MUST track API usage: per-key metrics (requests, errors, latency), anomaly detection (sudden spike, multiple IPs, suspicious patterns), auto-revoke on abuse

### Functional Requirements - Advanced Metrics

- **FR-031**: System MUST compute engagement metrics: average read time per article, bounce rate (opened but not read), completion rate (scrolled to end), share rate, save rate
- **FR-032**: System MUST compute discovery metrics: search-to-follow conversion rate, recommendation click-through rate, collection-driven follows, trending topic engagement
- **FR-033**: System MUST compute content metrics: article volume per topic (daily/weekly/monthly), author productivity (articles per author), feed activity (articles per feed), entity mentions (frequency per entity)
- **FR-034**: System MUST compute quality metrics: feed health scores over time, quality score distributions, quality vs engagement correlation
- **FR-035**: System MUST provide metric comparisons: period-over-period (this week vs last week), cohort comparisons (new users vs returning), segment comparisons (topic A vs topic B)

---

## Success Criteria

### Measurable Outcomes - Custom Dashboards

- **SC-001**: 30% of power users create at least 1 custom dashboard
- **SC-002**: Dashboard usage ≥3x per week per active dashboard user (daily engagement)
- **SC-003**: Widget library usage: top 5 widgets account for 70% of usage (identify most valuable)
- **SC-004**: Dashboard load time ≤2 seconds (95th percentile, with 12 widgets)

### Measurable Outcomes - Data Export

- **SC-005**: 15% of users export data at least once (research/analysis use cases)
- **SC-006**: CSV and JSON account for 80% of exports (most popular formats)
- **SC-007**: Export failure rate <5% (reliable data delivery)
- **SC-008**: Academic citations of AIWebFeeds data ≥5 papers within 6 months (research impact)

### Measurable Outcomes - Cohort Analysis

- **SC-009**: Product team uses cohort analysis for ≥3 feature decisions (data-driven)
- **SC-010**: Cohort insights lead to 10% retention improvement (actionable insights)
- **SC-011**: Statistical significance achieved for 70% of cohort comparisons (adequate sample sizes)

### Measurable Outcomes - API Access

- **SC-012**: 5% of users generate API keys (developer adoption)
- **SC-013**: ≥10 third-party integrations built within 6 months (ecosystem growth)
- **SC-014**: API uptime ≥99.5% (enterprise reliability)
- **SC-015**: API documentation satisfaction score ≥4.0/5.0 (developer experience)

### Business Metrics

- **SC-016**: Enterprise customer conversion ≥3 paying orgs within 6 months (B2B revenue)
- **SC-017**: Premium tier adoption ≥2% (advanced features drive paid conversions)
- **SC-018**: Monthly active API users ≥100 (developer ecosystem thriving)
- **SC-019**: Platform NPS score for power users ≥60 (high satisfaction in target segment)

---

## Database Architecture (SQLite)

**All data storage uses SQLite** (existing `data/aiwebfeeds.db` from Phase 1/2):

### SQLite Extensions & Features

- **JSON1 Extension**: Store dashboard configurations, widget settings, and API responses as JSON
- **FTS5**: Full-text search on dashboard names and descriptions
- **Window Functions**: Compute cohort retention metrics and time-series analytics
- **WAL Mode**: Write-Ahead Logging for concurrent dashboard access
- **Materialized Views** (via triggers): Pre-compute expensive analytics queries

### Phase 3E Tables (SQLite)

```sql
-- Store custom dashboards
CREATE TABLE dashboards (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    layout TEXT NOT NULL, -- JSON: grid layout configuration
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    access_key TEXT UNIQUE, -- For shared dashboards
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_dashboards_user ON dashboards(user_id);
CREATE INDEX idx_dashboards_public ON dashboards(is_public);

-- Store dashboard widgets
CREATE TABLE dashboard_widgets (
    id TEXT PRIMARY KEY, -- UUID
    dashboard_id TEXT NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    widget_type TEXT NOT NULL CHECK(widget_type IN ('line_chart', 'bar_chart', 'pie_chart', 'gauge', 'heatmap', 'table', 'kpi_card')),
    config TEXT NOT NULL, -- JSON: {data_sources, time_range, visualization_options}
    position INTEGER NOT NULL, -- Grid position
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_widgets_dashboard ON dashboard_widgets(dashboard_id);

-- Store data export jobs
CREATE TABLE export_jobs (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL,
    export_format TEXT NOT NULL CHECK(export_format IN ('csv', 'json', 'jsonl', 'parquet', 'excel')),
    scope TEXT NOT NULL, -- JSON: {topics, feeds, date_range, fields}
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    progress_percentage INTEGER DEFAULT 0,
    row_count INTEGER,
    file_size_bytes INTEGER,
    download_url TEXT,
    expires_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);
CREATE INDEX idx_export_jobs_user ON export_jobs(user_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);

-- Store user cohorts
CREATE TABLE cohorts (
    id TEXT PRIMARY KEY, -- UUID
    name TEXT NOT NULL,
    description TEXT,
    created_by_user_id TEXT NOT NULL,
    criteria TEXT NOT NULL, -- JSON: [{field, operator, value}]
    user_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cohorts_creator ON cohorts(created_by_user_id);

-- Store cohort retention metrics (materialized view)
CREATE TABLE cohort_retention (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    day_offset INTEGER NOT NULL, -- Days since cohort start (0, 1, 7, 14, 30, 60, 90)
    retained_users INTEGER NOT NULL,
    retention_rate REAL NOT NULL,
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cohort_id, day_offset)
);
CREATE INDEX idx_retention_cohort ON cohort_retention(cohort_id);

-- Store API keys
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of actual key
    name TEXT NOT NULL,
    scopes TEXT NOT NULL, -- JSON array: ["feeds:read", "search:read", "analytics:read"]
    rate_limit_tier TEXT NOT NULL CHECK(rate_limit_tier IN ('free', 'paid')), -- free=100/hr, paid=1000/hr
    request_count INTEGER DEFAULT 0,
    last_used_at DATETIME,
    expires_at DATETIME,
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Store API usage logs
CREATE TABLE api_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id TEXT NOT NULL REFERENCES api_keys(id),
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_api_logs_key ON api_usage_logs(api_key_id);
CREATE INDEX idx_api_logs_created_at ON api_usage_logs(created_at DESC);

-- Store custom metrics
CREATE TABLE custom_metrics (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sql_query TEXT NOT NULL, -- Validated SQL query
    result_cache TEXT, -- JSON: cached query result
    cache_expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_custom_metrics_user ON custom_metrics(user_id);

-- Materialized view for engagement metrics (updated hourly)
CREATE TABLE engagement_metrics_hourly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hour DATETIME NOT NULL UNIQUE,
    avg_read_time_seconds INTEGER,
    bounce_rate REAL,
    completion_rate REAL,
    share_rate REAL,
    save_rate REAL,
    article_count INTEGER,
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_engagement_hour ON engagement_metrics_hourly(hour DESC);

-- Trigger to update dashboard updated_at
CREATE TRIGGER update_dashboard_timestamp AFTER UPDATE ON dashboard_widgets
BEGIN
    UPDATE dashboards SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.dashboard_id;
END;

-- Trigger to update API key request count
CREATE TRIGGER update_api_key_usage AFTER INSERT ON api_usage_logs
BEGIN
    UPDATE api_keys 
    SET request_count = request_count + 1,
        last_used_at = CURRENT_TIMESTAMP
    WHERE id = NEW.api_key_id;
END;
```

**Scaling Considerations**:
- SQLite handles 100k+ dashboard renders/day with query caching
- Window functions enable cohort analytics without external OLAP systems
- Materialized views (via triggers) pre-compute expensive aggregations
- Parquet export offloads large dataset processing to background jobs
- API rate limiting enforced at application layer (Redis optional for distributed systems)

---

## Out of Scope (Phase 3E)

1. **Real-Time Streaming API**: WebSocket/SSE for live data deferred. Polling sufficient for MVP.
2. **SQL Query Interface**: Custom SQL queries on raw data deferred. Predefined endpoints sufficient.
3. **Machine Learning API**: Expose ML models (sentiment, entity extraction) as API endpoints deferred.
4. **Data Marketplace**: Sell curated datasets or premium data access deferred.
5. **Embedded Analytics**: Embed AIWebFeeds charts on external websites (iframe/JavaScript widget) deferred.
6. **White-Label Analytics**: Rebrand dashboards for enterprise customers deferred.
7. **Mobile Dashboard App**: Native mobile app for dashboards deferred. Responsive web sufficient.
8. **Advanced Alerting**: Threshold-based alerts (e.g., "notify when metric drops >20%") deferred.
9. **Predictive Analytics**: Forecasting, trend predictions, anomaly detection deferred to Phase 4.
10. **Data Warehouse Integration**: Direct connectors to Snowflake, BigQuery, Redshift deferred.

---

**Technology Stack (Free & Open-Source)**:

- **Dashboard Framework**: Apache ECharts (Apache 2.0) + Chart.js (MIT) for visualizations
- **Export Formats**: `pandas` (BSD) for CSV/Excel, `pyarrow` (Apache 2.0) for Parquet
- **API Framework**: FastAPI (MIT) with auto-generated OpenAPI docs
- **Rate Limiting**: `slowapi` (MIT) or Redis-based rate limiter
- **Background Jobs**: Celery (BSD) + Redis (BSD) for async export processing
- **PDF Generation**: WeasyPrint (BSD) for dashboard/report PDFs
- **Authentication**: JWT tokens (PyJWT, MIT) with API key fallback

---

**Next Steps**: Run `/speckit.clarify` to identify ambiguities, then `/speckit.plan` to generate technical implementation plan.
