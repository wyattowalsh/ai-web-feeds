# Changelog

All notable changes to AI Web Feeds will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0-beta] - 2025-10-30

### 🎉 Major Release: Advanced AI/NLP Features (Phase 5)

This release introduces comprehensive NLP processing with quality scoring, entity extraction, sentiment analysis, and topic modeling.

### ✨ Added

#### Quality Scoring (Phase 5A)
- **Heuristic Scoring**: Multi-dimensional quality assessment (depth, references, author, domain, engagement)
- **Batch Processing**: Automatic scoring every 30 minutes via APScheduler
- **Overall Score**: Weighted combination (0-100) of component scores
- **CLI Commands**: `aiwebfeeds nlp quality`, `aiwebfeeds nlp stats`
- **Database Tables**: `article_quality_scores` with 6 score components
- **Test Coverage**: 25 tests, 95% coverage

#### Entity Extraction (Phase 5B)
- **spaCy NER**: Named entity recognition using `en_core_web_sm` model
- **Entity Types**: person, organization, technique, dataset, concept
- **Normalization**: Levenshtein distance-based entity merging
- **FTS5 Search**: Full-text search across entities and aliases
- **Batch Processing**: Hourly entity extraction jobs
- **CLI Commands**: `aiwebfeeds nlp entities`, `list-entities`, `show-entity`, `add-alias`, `merge-entities`
- **Database Tables**: `entities`, `entity_mentions`, `entities_fts`

#### Sentiment Analysis (Phase 5C)
- **DistilBERT Model**: Transformer-based sentiment classification
- **Sentiment Scores**: Range from -1.0 (negative) to +1.0 (positive)
- **Trend Tracking**: Daily sentiment aggregation by topic
- **Shift Detection**: 7-day moving average for detecting sentiment changes
- **Batch Processing**: Hourly sentiment analysis + aggregation
- **CLI Commands**: `aiwebfeeds nlp sentiment`, `sentiment-trend`, `sentiment-shifts`, `sentiment-compare`
- **Database Tables**: `article_sentiment`, `topic_sentiment_daily`

#### Topic Modeling (Phase 5D)
- **LDA Algorithm**: Gensim-based topic discovery
- **Subtopic Extraction**: Automatic clustering of articles into subtopics
- **Topic Evolution**: Detection of splits, merges, emergence, decline
- **Coherence Scoring**: C_v metric for topic quality (threshold: 0.5)
- **Manual Curation**: Approve/rename/delete workflow for subtopics
- **Batch Processing**: Monthly topic modeling (1st of month, 3 AM)
- **CLI Commands**: `aiwebfeeds nlp topics`, `review-subtopics`, `approve-subtopic`, `topic-evolution`
- **Database Tables**: `subtopics`, `topic_evolution_events`

#### Database Schema
- **8 New Tables**: quality_scores, entities, entity_mentions, entities_fts, article_sentiment, topic_sentiment_daily, subtopics, topic_evolution_events
- **Extended feed_entries**: Added 9 processing columns (quality_processed, entities_processed, etc.)
- **FTS5 Integration**: Full-text search for entity names and aliases
- **Triggers**: Automatic entity frequency updates, FTS5 sync
- **Indexes**: Performance-optimized partial indexes for unprocessed articles

#### NLP Infrastructure
- **New Package**: `packages/ai_web_feeds/src/ai_web_feeds/nlp/`
  - `quality_scorer.py` (235 LOC)
  - `entity_extractor.py` (280 LOC)
  - `sentiment_analyzer.py` (150 LOC)
  - `topic_modeler.py` (350 LOC)
  - `scheduler.py` (140 LOC)
  - Jobs: `quality_job.py`, `entity_job.py`, `sentiment_job.py`, `topic_job.py`
- **APScheduler Jobs**: Automated batch processing (hourly/monthly schedules)
- **Model Management**: Automatic download of spaCy and Hugging Face models

#### Documentation
- **New Feature Docs**: 4 comprehensive MDX documentation files
  - `/docs/features/quality-scoring.mdx`
  - `/docs/features/entity-extraction.mdx`
  - `/docs/features/sentiment-analysis.mdx`
  - `/docs/features/topic-modeling.mdx`
- **Architecture Diagrams**: Mermaid flowcharts for each NLP pipeline
- **Usage Examples**: CLI commands, Python API, batch processing
- **Troubleshooting Guides**: Common issues and solutions

#### Configuration
- **Phase5Settings**: Comprehensive config with batch sizes, schedules, thresholds
- **Environment Variables**: `PHASE5_*` prefix for all NLP settings
- **Model Configuration**: Configurable spaCy and transformer models

### 🔧 Changed
- **CLI Structure**: Added `nlp` subcommand group with 6 commands
- **Storage Module**: Extended with 30+ CRUD methods for NLP tables
- **Models**: Added 8 new SQLModel classes for NLP entities
- **Config**: Added Phase5Settings to main Settings class

### 📦 Dependencies
- **spacy>=3.7.0**: NER and entity extraction
- **transformers>=4.40.0**: Sentiment analysis models
- **torch>=2.0.0**: PyTorch for transformers (CPU-only)
- **gensim>=4.3.0**: LDA topic modeling
- **langdetect>=1.0.9**: Language detection
- **scikit-learn>=1.4.0**: TF-IDF and clustering

### 📊 Performance
- **Quality Scoring**: ~100 articles/minute
- **Entity Extraction**: ~50 articles/hour (spaCy overhead)
- **Sentiment Analysis**: ~100 articles/hour (DistilBERT inference)
- **Topic Modeling**: ~5-10 minutes for 1000 articles

### 🚀 Migration
- **Migration Script**: `packages/ai_web_feeds/src/ai_web_feeds/migrations/run_migration.py`
- **Run**: `uv run python packages/ai_web_feeds/src/ai_web_feeds/migrations/run_migration.py`
- **Tables Created**: 7 main tables + 1 FTS5 virtual table

---

## [0.2.0-beta] - 2025-10-27

### 🎉 Major Release: Real-Time Feed Monitoring & Alerts (Phase 3B)

This release introduces a comprehensive real-time monitoring system with WebSocket notifications, trending topic detection, and email digest subscriptions.

### ✨ Added

#### Real-Time Notifications (US1)
- **WebSocket Server**: Real-time push notifications via Socket.IO
- **Feed Polling**: Background polling with configurable intervals (default: 15 min)
- **Follow System**: User can follow/unfollow feeds for notifications
- **Notification Bundling**: Group up to 5 articles per notification
- **Notification Center**: In-app notification panel with read/dismiss actions
- **CLI Commands**: `monitor start/stop/status/follow/unfollow/list-follows`

#### Trending Topics Detection (US2)
- **Z-Score Algorithm**: Statistical trending detection (default: z-score > 2.0)
- **Hourly Updates**: Automatic trending topic refresh
- **Representative Articles**: Top 5 most recent articles per trend
- **REST API**: `GET /api/trending` endpoint
- **Frontend Component**: Trending topics display widget
- **Test Coverage**: 10 tests, 95.86% coverage

#### Email Digests (US3)
- **Digest Subscriptions**: Daily, weekly, and hourly digest options
- **HTML Email Templates**: Responsive email design with inline CSS
- **SMTP Delivery**: TLS/authentication support
- **Cron Scheduling**: Flexible scheduling with timezone support
- **Article Selection**: Smart selection from followed feeds (max 20 articles)
- **CLI Commands**: `subscribe-digest/unsubscribe-digest/list-digests`
- **REST API**: `GET/POST /api/digests` endpoints
- **Test Coverage**: 16 tests, 97.50% coverage

#### Backend Infrastructure
- **New Modules**:
  - `polling.py` (165 LOC) - Feed fetching with retry logic
  - `notifications.py` (159 LOC) - Notification management
  - `trending.py` (238 LOC) - Trending detection algorithm
  - `digests.py` (189 LOC) - Email generation and delivery
  - `scheduler.py` (201 LOC) - APScheduler job management
  - `websocket_server.py` (191 LOC) - Socket.IO server

- **Database Schema**: 7 new tables
  - `feed_entries` - Cached feed articles
  - `feed_poll_jobs` - Polling history and status
  - `user_feed_follows` - User-feed relationships
  - `notifications` - User notifications
  - `trending_topics` - Detected trending topics
  - `notification_preferences` - User notification settings
  - `email_digests` - Digest subscriptions

- **Storage Layer**: 30+ new CRUD methods in `storage.py`

#### Frontend Components
- **WebSocket Client**: `lib/websocket.ts` - Socket.IO client wrapper
- **User Identity**: `lib/user-identity.ts` - localStorage UUID management
- **React Hook**: `lib/use-websocket.ts` - WebSocket state management
- **UI Components**:
  - `notification-bell.tsx` - Bell icon with unread badge
  - `notification-center.tsx` - Slide-in notification panel
  - `follow-button.tsx` - Feed follow/unfollow toggle
  - `trending-topics.tsx` - Trending topics display

#### API Routes
- `GET /api/notifications` - List user notifications
- `PATCH /api/notifications/:id` - Mark notification as read/dismissed
- `GET/POST /api/follows` - Manage feed follows
- `GET /api/trending` - Retrieve trending topics
- `GET/POST /api/digests` - Manage digest subscriptions
- `GET/PUT /api/preferences` - Notification preferences

#### CLI Features
- **New Command Group**: `aiwebfeeds monitor`
  - `start` - Launch monitoring server (scheduler + WebSocket)
  - `stop` - Stop monitoring server
  - `status` - Show server and job status
  - `follow <user_id> <feed_id>` - Follow a feed
  - `unfollow <user_id> <feed_id>` - Unfollow a feed
  - `list-follows <user_id>` - List followed feeds
  - `subscribe-digest <user_id> <email>` - Subscribe to digests
  - `unsubscribe-digest <digest_id>` - Cancel subscription
  - `list-digests <user_id>` - Show digest subscriptions

#### Documentation
- **Comprehensive Guide**: `apps/web/content/docs/features/real-time-monitoring.mdx`
  - Architecture diagrams (Mermaid)
  - API reference (REST + WebSocket)
  - CLI commands reference
  - Configuration guide
  - Frontend integration guide
  - Troubleshooting section
- **OpenAPI Specification**: Full REST API documentation
- **WebSocket Protocol**: Complete WebSocket event documentation
- **JSON Schemas**: Validation schemas for notifications, trending alerts, bundles

#### Testing
- **53 New Tests**: Comprehensive test coverage
  - `test_polling.py` (9 tests) - Feed fetching and parsing
  - `test_notifications.py` (8 tests) - Notification management
  - `test_scheduler.py` (10 tests) - Job scheduling
  - `test_trending.py` (10 tests) - Trending detection (95.86% coverage)
  - `test_digests.py` (16 tests) - Email digests (97.50% coverage)
- **Mocking Strategy**: All external dependencies mocked (HTTP, SMTP, DB)
- **Property-Based Testing**: Used in trending detection tests

### 🔧 Changed

#### Configuration
- **Settings Refactor**: Added `Phase3BSettings` class to `config.py`
- **Environment Variables**: 38 new configuration options in `env.example`
  - WebSocket configuration (port, CORS origins)
  - Feed polling settings (interval, workers, timeout, retries)
  - Notification settings (retention, bundling)
  - Trending detection parameters (threshold, lookback, min articles)
  - Email digest configuration (SMTP, max articles)
- **Global Settings**: Added module-level `settings` instance for backward compatibility

#### Storage
- **Import Updates**: Added `Optional` to type imports
- **Method Extensions**: 30+ new methods for Phase 3B entities
- **Query Optimization**: Added indexes for real-time queries

#### Models
- **7 New SQLModel Entities**: Complete data models with relationships
- **Field Rename**: `Notification.metadata` → `context_data` (reserved keyword fix)
- **Type Safety**: All models fully type-hinted with Pydantic v2

### 📦 Dependencies

#### Python Packages Added
```toml
apscheduler = "^3.10.4"      # Background job scheduling
python-socketio = "^5.11.0"  # WebSocket server
httpx = "^0.28.1"            # HTTP client for polling
tenacity = "^9.0.0"          # Retry logic
aiohttp = "^3.11.11"         # Async HTTP
croniter = "^5.0.1"          # Cron expression parsing
numpy = "^2.2.1"             # Z-score calculations
```

#### TypeScript Packages Added
```json
{
  "socket.io-client": "^4.8.1"  // WebSocket client
}
```

### 🐛 Fixed

- **Socket.io-client version**: Changed `^4.8.3` → `^4.8.1` (version availability)
- **SQLModel reserved keyword**: Renamed `metadata` field to `context_data`
- **APScheduler test mocking**: Used `PropertyMock` for read-only properties
- **Settings import**: Added global `settings` instance for CLI compatibility
- **User identity task ordering**: Reordered T040/T041 for correct dependency flow

### 🔒 Security

- **Anonymous User Tracking**: localStorage UUIDs (no PII collection)
- **SMTP Security**: TLS/STARTTLS support with credential encryption
- **WebSocket CORS**: Configurable CORS origins
- **Data Retention**: 7-day auto-cleanup for notifications

### 📊 Performance

- **Feed Polling**: 10 parallel workers with 3-retry strategy
- **WebSocket**: <100ms notification delivery
- **Trending Detection**: O(n) algorithm complexity
- **Email Digests**: Batched delivery with minute-level precision

### 📈 Statistics

- **Code Changes**: +11,189 lines across 48 files
- **Commits**: 16 commits
- **Modules Created**: 6 backend, 7 frontend components
- **API Endpoints**: 6 REST routes
- **CLI Commands**: 9 new commands
- **Test Coverage**: 95-97% for critical modules

### 🎯 Breaking Changes

None. This release is backward compatible with Phase 2 (Data Discovery & Analytics).

### 📝 Notes

- User authentication is **not** included in Phase 3B (planned for Phase 4)
- Web Push API is **not** included (planned for Phase 4)
- SQLite is used for all data storage (PostgreSQL support planned)
- Email digests require external SMTP server configuration

### 🔗 References

- **Specification**: `specs/003-real-time-monitoring/spec.md`
- **Completion Report**: `specs/003-real-time-monitoring/COMPLETION.md`
- **Documentation**: [Real-Time Monitoring Guide](https://aiwebfeeds.com/docs/features/real-time-monitoring)
- **OpenAPI**: `specs/003-real-time-monitoring/contracts/openapi.yaml`

---

## [0.1.0] - 2025-10-15

### 🎉 Initial Release: Core Project & Data Discovery (Phases 1-2)

Initial release with core feed management and analytics capabilities.

### ✨ Added

#### Core Package (`packages/ai_web_feeds/`)
- **Feed Loading**: YAML feed definitions with validation
- **Feed Enrichment**: AI-powered metadata enhancement
- **Topic Taxonomy**: Graph-structured topic system
- **Database**: SQLite/PostgreSQL support with SQLModel
- **Validation**: JSON Schema validation for data files
- **Export**: JSON/OPML export functionality
- **Logging**: Structured logging with Loguru
- **Configuration**: Pydantic-based settings management

#### Data Discovery & Analytics (Phase 2)
- **Feed Analytics**: Statistical analysis and metrics
- **Search**: Full-text search capabilities
- **Recommendations**: Topic-based feed recommendations
- **Embeddings**: Vector similarity search support

#### CLI Application (`apps/cli/`)
- **Commands**: fetch, validate, export, stats, analytics
- **Rich Output**: Tables, progress bars, formatted output
- **Testing**: Comprehensive CLI test suite

#### Web Documentation (`apps/web/`)
- **Next.js Site**: Documentation website with MDX
- **API Docs**: Auto-generated from OpenAPI specs
- **Guides**: User guides and tutorials
- **Search**: Full-text documentation search

#### Testing (`tests/`)
- **Unit Tests**: Module-level test coverage
- **Integration Tests**: Cross-module functionality
- **Test Coverage**: ≥90% coverage requirement
- **Property-Based Testing**: Using Hypothesis

### 📦 Dependencies

#### Core Python Stack
- Python 3.13+
- SQLModel / SQLAlchemy 2.0
- Pydantic v2
- Loguru
- httpx
- PyYAML

#### Web Stack
- Next.js 15
- React 19
- TypeScript 5.9+
- Tailwind CSS 4
- Fumadocs (documentation)

### 📝 Notes

- Initial beta release
- Production-ready for Phase 1-2 features
- Phase 3+ features in development

---

## Release Tags

- `v0.2.0-beta` - Phase 3B: Real-Time Monitoring (2025-10-27)
- `v0.1.0` - Phase 1-2: Core + Analytics (2025-10-15)

---

**Legend**:
- ✨ Added - New features
- 🔧 Changed - Changes in existing functionality
- 🐛 Fixed - Bug fixes
- 🔒 Security - Security improvements
- 📦 Dependencies - Dependency updates
- 📊 Performance - Performance improvements
- 📝 Notes - Additional information
- 🎯 Breaking Changes - Breaking changes

