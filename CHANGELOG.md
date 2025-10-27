# Changelog

All notable changes to AI Web Feeds will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

