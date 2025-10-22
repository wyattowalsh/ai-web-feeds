# Implementation Tasks: Phase 3B - Real-Time Feed Monitoring & Alerts

**Feature Branch**: `003-real-time-monitoring`  
**Created**: 2025-10-22  
**Status**: Ready for Implementation

---

## Task Summary

**Total Tasks**: 89  
**MVP Tasks (US1 + US2)**: 52  
**Polish Tasks**: 11  
**Test Coverage Target**: ≥90%

### Task Distribution

| Phase | User Story | Task Count | Parallelizable |
|-------|------------|------------|----------------|
| Phase 1 | Setup | 8 | 5 (62%) |
| Phase 2 | Foundational | 12 | 8 (67%) |
| Phase 3 | US1: Real-Time Feed Updates (P1 MVP) | 26 | 18 (69%) |
| Phase 4 | US2: Trending Topics Alerts (P1 MVP) | 14 | 10 (71%) |
| Phase 5 | US3: Email Digests (P2) | 18 | 13 (72%) |
| Phase 6 | Polish & Documentation | 11 | 8 (73%) |

**Parallelization Opportunities**: 62 of 89 tasks (70%) can be executed in parallel

---

## Phase 1: Setup & Infrastructure

**Goal**: Initialize project dependencies, database migrations, and development environment

### Tasks

- [ ] T001 Install Python dependencies: APScheduler 3.10+, python-socketio 5.x+, httpx 0.27+, tenacity 8.x+ in packages/ai_web_feeds/pyproject.toml
- [ ] T002 [P] Install Node.js dependencies: socket.io-client 4.x in apps/web/package.json
- [ ] T003 [P] Create database migration file packages/ai_web_feeds/alembic/versions/003_phase3b_tables.py
- [ ] T004 [P] Implement migration up() function with 6 new tables (feed_entries, feed_poll_jobs, notifications, trending_topics, notification_preferences, email_digests)
- [ ] T005 [P] Implement migration down() function to revert Phase 3B tables
- [ ] T006 Run database migration: uv run alembic upgrade head
- [ ] T007 [P] Create .env.example file with Phase 3B configuration variables (WEBSOCKET_PORT, FEED_POLL_INTERVAL_MIN, etc.)
- [ ] T008 [P] Update packages/ai_web_feeds/src/ai_web_feeds/config.py with Phase 3B settings using pydantic-settings

**Acceptance**: All dependencies installed, database migrated, configuration accessible

---

## Phase 2: Foundational Infrastructure

**Goal**: Build core data models and shared utilities needed by all user stories

### Tasks - Data Models

- [ ] T009 [P] Create FeedEntry SQLModel in packages/ai_web_feeds/src/ai_web_feeds/models.py
- [ ] T010 [P] Create FeedPollJob SQLModel with status enum in packages/ai_web_feeds/src/ai_web_feeds/models.py
- [ ] T011 [P] Create Notification SQLModel with type enum in packages/ai_web_feeds/src/ai_web_feeds/models.py
- [ ] T012 [P] Create TrendingTopic SQLModel in packages/ai_web_feeds/src/ai_web_feeds/models.py
- [ ] T013 [P] Create NotificationPreference SQLModel with frequency/delivery enums in packages/ai_web_feeds/src/ai_web_feeds/models.py
- [ ] T014 [P] Create EmailDigest SQLModel with schedule_type enum in packages/ai_web_feeds/src/ai_web_feeds/models.py

### Tasks - Storage Extensions

- [ ] T015 Extend packages/ai_web_feeds/src/ai_web_feeds/storage.py with feed_entries table queries (create, get_by_guid, get_recent)
- [ ] T016 [P] Extend storage.py with feed_poll_jobs table queries (create, update_status, get_pending)
- [ ] T017 [P] Extend storage.py with notifications table queries (create, get_user_notifications, mark_read, cleanup_old)
- [ ] T018 [P] Extend storage.py with notification_preferences table queries (get, upsert, get_user_preferences)
- [ ] T019 [P] Extend storage.py with trending_topics table queries (create, get_recent, get_by_topic)
- [ ] T020 [P] Extend storage.py with email_digests table queries (get, create, update_send_time, get_due)

**Acceptance**: All models defined with type hints, storage queries implemented, mypy passes

---

## Phase 3: User Story 1 - Real-Time Feed Updates (P1 MVP)

**Goal**: Enable users to receive instant WebSocket notifications when followed feeds publish new content

**Independent Test**: Follow 5 feeds → Trigger manual poll → Receive notification within 60s → Click notification → Navigate to article → Verify marked as "new"

### Tasks - Feed Polling

- [ ] T021 [US1] Create packages/ai_web_feeds/src/ai_web_feeds/polling.py with async httpx client setup
- [ ] T022 [US1] Implement poll_feed() function with conditional requests (ETag, If-Modified-Since) in polling.py
- [ ] T023 [US1] Implement detect_new_articles() function to compare GUIDs against database in polling.py
- [ ] T024 [US1] Implement retry logic with tenacity decorator (3 attempts, exponential backoff) in polling.py
- [ ] T025 [US1] Implement feed health tracking (consecutive failures/successes) in polling.py
- [ ] T026 [US1] Create APScheduler configuration with SQLAlchemyJobStore in polling.py
- [ ] T027 [US1] Implement schedule_all_feeds() function to add jobs for all active feeds in polling.py
- [ ] T028 [US1] Create polling CLI module apps/cli/ai_web_feeds/cli/commands/poll.py
- [ ] T029 [US1] Implement CLI command: aiwebfeeds poll trigger <feed-id> in poll.py
- [ ] T030 [US1] Implement CLI command: aiwebfeeds poll status in poll.py

### Tasks - WebSocket Server

- [ ] T031 [US1] Create packages/ai_web_feeds/src/ai_web_feeds/websocket_server.py with Flask-SocketIO setup
- [ ] T032 [US1] Implement @socketio.on('connect') handler with user_id validation in websocket_server.py
- [ ] T033 [US1] Implement @socketio.on('disconnect') handler with cleanup in websocket_server.py
- [ ] T034 [US1] Implement @socketio.on('notification_ack') handler for delivery tracking in websocket_server.py
- [ ] T035 [US1] Create packages/ai_web_feeds/src/ai_web_feeds/notifications.py notification delivery module
- [ ] T036 [US1] Implement notify_user() function with room-based broadcasting in notifications.py
- [ ] T037 [US1] Implement should_bundle_notifications() check (>3 articles in 5 min) in notifications.py
- [ ] T038 [US1] Implement create_notification_bundle() for spam prevention in notifications.py
- [ ] T039 [US1] Implement in_quiet_hours() check using NotificationPreference in notifications.py

### Tasks - Frontend WebSocket Client

- [ ] T040 [P] [US1] Create apps/web/lib/websocket.ts with Socket.IO client wrapper
- [ ] T041 [P] [US1] Implement getUserId() function using localStorage UUID in websocket.ts
- [ ] T042 [P] [US1] Implement auto-reconnection logic with exponential backoff in websocket.ts
- [ ] T043 [P] [US1] Create apps/web/components/NotificationBell.tsx header component
- [ ] T044 [US1] Implement useWebSocket() React hook for connection management in websocket.ts
- [ ] T045 [US1] Implement useNotifications() React hook for notification state in apps/web/lib/notifications.ts

### Tasks - Notification UI

- [ ] T046 [P] [US1] Create apps/web/components/NotificationCard.tsx for individual notification display
- [ ] T047 [P] [US1] Create apps/web/components/NotificationCenter.tsx for notification list panel
- [ ] T048 [US1] Create apps/web/app/notifications/page.tsx notification center page
- [ ] T049 [P] [US1] Create apps/web/app/api/notifications/route.ts REST endpoint (GET /api/notifications)
- [ ] T050 [P] [US1] Create apps/web/app/api/notifications/[id]/read/route.ts (POST /api/notifications/{id}/read)
- [ ] T051 [P] [US1] Create apps/web/app/api/notifications/[id]/dismiss/route.ts (POST /api/notifications/{id}/dismiss)

### Tasks - Notification Preferences

- [ ] T052 [P] [US1] Create apps/web/app/notifications/preferences/page.tsx preferences UI
- [ ] T053 [P] [US1] Create apps/web/components/NotificationPreferencesForm.tsx form component
- [ ] T054 [P] [US1] Create apps/web/app/api/preferences/route.ts (GET, POST /api/preferences)
- [ ] T055 [US1] Create notification CLI module apps/cli/ai_web_feeds/cli/commands/notify.py
- [ ] T056 [US1] Implement CLI command: aiwebfeeds notify follow <feed-id> in notify.py

### Tasks - Integration & Testing

- [ ] T057 [US1] Create tests/packages/ai_web_feeds/test_polling.py with unit tests (≥95% coverage)
- [ ] T058 [US1] Create tests/packages/ai_web_feeds/test_notifications.py with unit tests (≥90% coverage)
- [ ] T059 [US1] Create tests/packages/ai_web_feeds/integration/test_poll_to_notify.py E2E test (poll → notify flow)
- [ ] T060 [US1] Run integration test: Follow feed → Manual poll → Verify notification received within 60s
- [ ] T061 [US1] Run coverage report: uv run pytest --cov=ai_web_feeds.polling --cov=ai_web_feeds.notifications
- [ ] T062 [US1] Verify WebSocket connection with 10 concurrent users (load test)

**US1 Acceptance**: 
- ✅ Feed polling discovers new articles within 30-minute interval
- ✅ WebSocket notifications delivered within 60 seconds (95th percentile)
- ✅ Notification bundling prevents spam (max 10/hour)
- ✅ Preferences respected (frequency, quiet hours)
- ✅ Test coverage ≥90%

---

## Phase 4: User Story 2 - Trending Topics Alerts (P1 MVP)

**Goal**: Alert users to trending topic spikes using z-score statistical detection

**Independent Test**: Simulate 10 articles mentioning "GPT-5" within 1 hour → Receive trending alert within 15 min → Click alert → View trending dashboard

### Tasks - Trending Detection

- [ ] T063 [P] [US2] Create packages/ai_web_feeds/src/ai_web_feeds/trending.py trending detection module
- [ ] T064 [US2] Implement extract_topics() function to parse article titles/categories in trending.py
- [ ] T065 [US2] Implement compute_baseline() function for 7-day average in trending.py
- [ ] T066 [US2] Implement detect_trending_topics() function with z-score computation (threshold=2.0) in trending.py
- [ ] T067 [US2] Implement filter_trending() function to dedupe and apply minimum thresholds (10 mentions) in trending.py
- [ ] T068 [US2] Implement send_trending_alerts() function to notify interested users in trending.py
- [ ] T069 [US2] Create APScheduler job for trending detection (every 15 minutes) in polling.py

### Tasks - Trending Dashboard UI

- [ ] T070 [P] [US2] Create apps/web/app/trending/page.tsx trending topics page
- [ ] T071 [P] [US2] Create apps/web/components/TrendingTopicCard.tsx topic display component
- [ ] T072 [P] [US2] Create apps/web/components/TrendingChart.tsx time-series chart (Chart.js)
- [ ] T073 [P] [US2] Create apps/web/app/api/trending/route.ts (GET /api/trending?hours=24)

### Tasks - CLI & Testing

- [ ] T074 [US2] Create trending CLI module apps/cli/ai_web_feeds/cli/commands/trending.py
- [ ] T075 [US2] Implement CLI command: aiwebfeeds trending list --hours 24 in trending.py
- [ ] T076 [US2] Implement CLI command: aiwebfeeds trending simulate <topic> --mentions <count> (dev/test) in trending.py

### Tasks - Integration & Testing

- [ ] T077 [US2] Create tests/packages/ai_web_feeds/test_trending.py with unit tests (≥92% coverage)
- [ ] T078 [US2] Create tests/packages/ai_web_feeds/integration/test_trending_alerts.py integration test
- [ ] T079 [US2] Run integration test: Simulate spike → Verify alert sent → Verify no duplicate alerts within 24h
- [ ] T080 [US2] Run coverage report: uv run pytest --cov=ai_web_feeds.trending

**US2 Acceptance**:
- ✅ Trending detection runs every 15 minutes
- ✅ Z-score accurately detects spikes (manual validation of 20 trends)
- ✅ No duplicate alerts within 24-hour window
- ✅ Trending dashboard displays time-series charts
- ✅ Test coverage ≥90%

---

## Phase 5: User Story 3 - Email Digests (P2)

**Goal**: Send daily/weekly email digests with top articles from followed feeds

**Independent Test**: Subscribe to daily digest at 9am → Wait 24 hours → Receive email → Verify 10 articles ranked by score → Click link → Navigate to source

### Tasks - Email Digest Generation

- [ ] T081 [P] [US3] Create packages/ai_web_feeds/src/ai_web_feeds/email_digest.py digest generation module
- [ ] T082 [US3] Implement generate_digest_content() function to query top articles since last digest in email_digest.py
- [ ] T083 [US3] Implement rank_articles_by_engagement() function using popularity score in email_digest.py
- [ ] T084 [US3] Create Jinja2 email template packages/ai_web_feeds/templates/digest_email.html
- [ ] T085 [US3] Implement render_digest_email() function with Jinja2 in email_digest.py
- [ ] T086 [US3] Implement send_email_smtp() function for self-hosted SMTP in email_digest.py
- [ ] T087 [US3] Implement send_email_sendgrid() function for dev/staging in email_digest.py
- [ ] T088 [US3] Implement send_all_due_digests() function to process email_digests table in email_digest.py
- [ ] T089 [US3] Create APScheduler job for digest sending (hourly check) in polling.py

### Tasks - Digest Subscription UI

- [ ] T090 [P] [US3] Create apps/web/app/digests/page.tsx digest subscription page
- [ ] T091 [P] [US3] Create apps/web/components/DigestForm.tsx subscription form component
- [ ] T092 [P] [US3] Create apps/web/app/api/digests/route.ts (GET, POST, DELETE /api/digests)

### Tasks - CLI & Testing

- [ ] T093 [US3] Create digest CLI module apps/cli/ai_web_feeds/cli/commands/digest.py
- [ ] T094 [US3] Implement CLI command: aiwebfeeds digest subscribe --email <email> --schedule daily in digest.py
- [ ] T095 [US3] Implement CLI command: aiwebfeeds digest send-test <email> in digest.py
- [ ] T096 [US3] Implement CLI command: aiwebfeeds digest send-now --user-id <uuid> (force send) in digest.py

### Tasks - Integration & Testing

- [ ] T097 [US3] Create tests/packages/ai_web_feeds/test_email_digest.py with unit tests (≥88% coverage)
- [ ] T098 [US3] Create tests/packages/ai_web_feeds/integration/test_digest_delivery.py integration test
- [ ] T099 [US3] Setup MailHog for local email testing (brew install mailhog)
- [ ] T100 [US3] Run integration test: Subscribe → Send test digest → Verify email in MailHog → Click link → Verify tracking
- [ ] T101 [US3] Verify timezone handling: Subscribe with America/Los_Angeles → Verify sends at 9am Pacific
- [ ] T102 [US3] Run coverage report: uv run pytest --cov=ai_web_feeds.email_digest

**US3 Acceptance**:
- ✅ Daily digests sent at user's local time (timezone-aware)
- ✅ Email contains top 10 articles ranked by engagement
- ✅ Email renders correctly in Gmail, Outlook, Apple Mail
- ✅ Open/click tracking works (UTM parameters)
- ✅ Unsubscribe link functions correctly
- ✅ Test coverage ≥88%

---

## Phase 6: Polish & Documentation

**Goal**: Finalize cross-cutting concerns, documentation, and production readiness

### Tasks - Production Setup

- [ ] T103 [P] Create systemd service file services/polling_scheduler.service for production deployment
- [ ] T104 [P] Create systemd service file services/websocket_server.service for production deployment
- [ ] T105 [P] Create systemd service file services/digest_scheduler.service for production deployment
- [ ] T106 [P] Configure Postfix for production SMTP (self-hosted email delivery)
- [ ] T107 [P] Update .env.production with production settings (SMTP_HOST, WEBSOCKET_PORT, etc.)

### Tasks - Documentation

- [ ] T108 [P] Create apps/web/content/docs/features/real-time-notifications.mdx user-facing documentation
- [ ] T109 [P] Create apps/web/content/docs/development/websocket-architecture.mdx technical documentation
- [ ] T110 [P] Create apps/web/content/docs/guides/configuring-digests.mdx user guide
- [ ] T111 Update apps/web/content/docs/meta.json to add Phase 3B documentation to navigation
- [ ] T112 [P] Update root README.md with Phase 3B features and quickstart link
- [ ] T113 [P] Create CHANGELOG.md entry for Phase 3B release

**Acceptance**:
- ✅ All services deployable via systemd
- ✅ Production SMTP configured and tested
- ✅ Documentation published at aiwebfeeds.com/docs
- ✅ LLM docs regenerated (/llms-full.txt, /llms.txt)

---

## Dependency Graph

### User Story Dependencies

```
Setup (Phase 1)
    ↓
Foundational (Phase 2: Models + Storage)
    ↓
    ├─→ US1: Real-Time Feed Updates (P1) ← MVP Core
    ├─→ US2: Trending Topics Alerts (P1) ← MVP Core
    └─→ US3: Email Digests (P2)
           ↓
    Polish & Documentation (Phase 6)
```

**Key Insights**:
- US1 and US2 are **independent** and can be implemented in parallel after Phase 2
- US3 depends on US1 (needs notification infrastructure) but can start after US1 core is complete
- MVP = Phase 1 + Phase 2 + Phase 3 (US1) + Phase 4 (US2)

### Critical Path

```
T001-T008 (Setup) → T009-T020 (Foundational) → T021-T062 (US1) → T103-T113 (Polish)
```

**Estimated Timeline**:
- Phase 1 (Setup): 2 hours
- Phase 2 (Foundational): 4 hours
- Phase 3 (US1): 16 hours
- Phase 4 (US2): 10 hours  ← Can parallelize with US1
- Phase 5 (US3): 12 hours
- Phase 6 (Polish): 4 hours

**Total**: ~48 hours (6 days at 8 hours/day)  
**MVP**: ~30 hours (Phase 1-4 only)

---

## Parallel Execution Examples

### Phase 2: Foundational (8 tasks in parallel)

```bash
# Terminal 1: Data Models
Task T009: FeedEntry model
Task T010: FeedPollJob model
Task T011: Notification model

# Terminal 2: More Models
Task T012: TrendingTopic model
Task T013: NotificationPreference model
Task T014: EmailDigest model

# Terminal 3: Storage Layer
Task T016: feed_poll_jobs queries
Task T017: notifications queries
Task T018: notification_preferences queries

# Sequential (blocks on models):
Task T015: feed_entries queries (needs T009)
Task T019: trending_topics queries (needs T012)
Task T020: email_digests queries (needs T014)
```

### Phase 3: US1 (18 tasks in parallel)

```bash
# Backend Team
Task T021-T027: Polling module (7 tasks)
Task T031-T039: WebSocket + Notifications (9 tasks)

# Frontend Team (can start early)
Task T040-T042: WebSocket client (3 tasks)
Task T043-T047: Notification UI components (5 tasks)
Task T049-T051: REST API endpoints (3 tasks)
Task T052-T054: Preferences UI (3 tasks)

# CLI Team
Task T028-T030: Polling CLI (3 tasks)
Task T055-T056: Notification CLI (2 tasks)
```

### Phase 4: US2 (10 tasks in parallel)

```bash
# Backend
Task T063-T067: Trending detection (5 tasks)

# Frontend (parallel)
Task T070-T073: Trending UI (4 tasks)

# CLI
Task T074-T076: Trending CLI (3 tasks)
```

---

## Implementation Strategy

### MVP-First Approach (Recommended)

**Week 1**: Phase 1-2 + US1 Core
- Days 1-2: Setup + Foundational (T001-T020)
- Days 3-5: US1 Backend (T021-T039)
- Weekend: US1 Frontend + Testing (T040-T062)

**Week 2**: US2 + Polish
- Days 1-3: US2 Complete (T063-T080)
- Days 4-5: Polish + Documentation (T103-T113)
- **Deploy MVP**: US1 + US2 live

**Week 3**: US3 (Optional P2 Feature)
- Days 1-4: Email Digests (T081-T102)
- Day 5: Final polish, deploy

### Incremental Delivery

1. **Deploy After US1**: Real-time notifications working, gather user feedback
2. **Deploy After US2**: Trending alerts working, measure accuracy
3. **Deploy After US3**: Email digests working, monitor open rates

### Risk Mitigation

**High-Risk Tasks** (allocate extra time):
- T031-T034: WebSocket server (unfamiliar technology)
- T064-T067: Trending detection (complex algorithm)
- T086-T087: Email delivery (SMTP configuration)

**Mitigation**:
- Prototype WebSocket in T031 before full implementation
- Unit test z-score calculation extensively in T077
- Test email with MailHog locally before production SMTP

---

## Testing Strategy

### Unit Test Coverage Targets

| Module | Target | Priority |
|--------|--------|----------|
| `polling.py` | 95% | Critical (feed fetching) |
| `notifications.py` | 90% | High (delivery logic) |
| `trending.py` | 92% | High (algorithm correctness) |
| `email_digest.py` | 88% | Medium (template rendering) |
| `storage.py` extensions | 88% | Medium (CRUD operations) |

### Integration Test Scenarios

1. **Poll → Notify Flow** (T059):
   - Setup: Create user, follow feed, start WebSocket
   - Action: Trigger manual poll
   - Assert: Notification received within 60s

2. **Trending Alert Flow** (T079):
   - Setup: Create 7-day baseline
   - Action: Simulate spike (45 mentions in 1 hour)
   - Assert: Alert sent, no duplicate within 24h

3. **Digest Delivery Flow** (T100):
   - Setup: Subscribe to digest
   - Action: Trigger send_now
   - Assert: Email received in MailHog, links work

### Load Testing

- **WebSocket**: 100 concurrent connections (T062)
- **Feed Polling**: 1000 feeds in 30 minutes (verify post-US1)
- **Trending Detection**: 10k articles processed in 5 minutes (verify post-US2)

---

## Acceptance Criteria

### Phase 3B Complete When:

- [ ] All 89 tasks completed
- [ ] Test coverage ≥90% across all modules
- [ ] All linters pass (Ruff, ESLint, mypy)
- [ ] All integration tests pass
- [ ] Load tests pass (100 WebSocket connections, 1000 feed polls)
- [ ] Documentation published at aiwebfeeds.com/docs
- [ ] Constitution compliance verified (all 7 principles)
- [ ] Production deployment tested (systemd services)
- [ ] User acceptance testing passed (5 beta users)

### MVP Ready When:

- [ ] Phase 1-4 complete (T001-T080)
- [ ] US1 and US2 independently tested and verified
- [ ] Performance benchmarks met (<60s notification latency)
- [ ] Security audit passed (CORS, input validation)
- [ ] Monitoring/logging configured (Loguru)

---

**Version**: 1.0.0 | **Status**: Ready for Implementation | **Estimated**: 48 hours (6 days)

