# Clarifications: Phase 3B - Real-Time Feed Monitoring & Alerts

**Feature Branch**: `003-real-time-monitoring`  
**Created**: 2025-10-22  
**Status**: Clarification Phase

---

## 🎯 Purpose

This document identifies ambiguities in the Phase 3B specification and provides clarifying questions to resolve them before implementation planning.

---

## 📋 Clarification Questions

### **Section 1: User Management & Authentication**

#### Q1: User Identity Without Phase 3A (User Accounts)
**Ambiguity**: Spec assumes "user_id" in database tables, but Phase 3A (User Accounts) is not a dependency.

**Question**: How do we identify users for notification preferences without authentication?
- **Option A**: Use browser localStorage with generated UUID (anonymous users, data not portable)
- **Option B**: Require Phase 3A (User Accounts) as prerequisite dependency
- **Option C**: Simple email-based identification (no password, just email for digests)

**Recommendation**: **Option A** for MVP - localStorage UUID. Migrate to Phase 3A accounts later.

**Impact**: Medium - Affects notification_preferences table, API authentication, data portability

---

#### Q2: "Followed Feeds" Without User Accounts
**Ambiguity**: User Story 1 mentions "feeds I follow" but Phase 2 doesn't implement persistent "follow" functionality.

**Question**: How are followed feeds stored?
- **Option A**: localStorage array of feed IDs (client-side only)
- **Option B**: Server-side storage with anonymous user_id (from Q1)
- **Option C**: Browser cookies (limited size, can expire)

**Recommendation**: **Option B** - Server-side storage with localStorage-based user_id for reliability.

**Impact**: High - Core feature dependency, affects notification targeting

---

### **Section 2: Feed Polling Architecture**

#### Q3: Background Job Queue Selection
**Ambiguity**: Spec mentions two options: Celery+Redis vs APScheduler, but doesn't recommend one.

**Question**: Which background job system should we use?
- **Option A**: **APScheduler** (MIT, in-process, simpler, no Redis required)
- **Option B**: **Celery + Redis** (distributed, scalable, adds infrastructure complexity)

**Recommendation**: **Option A (APScheduler)** for MVP. Redis only needed at >1000 concurrent WebSocket connections (not MVP scale).

**Impact**: Medium - Infrastructure complexity, deployment requirements

---

#### Q4: Feed Polling Prioritization
**Ambiguity**: With 10,000 feeds and 30-minute average interval, how do we prioritize when system is overloaded?

**Question**: What is the polling priority algorithm?
- **Option A**: FIFO (first in, first out - simple but unfair to slow feeds)
- **Option B**: Priority based on follower count (popular feeds polled more frequently)
- **Option C**: Dynamic priority based on update frequency (feeds that update often get priority)

**Recommendation**: **Option C** - Dynamic priority based on historical update frequency.

**Impact**: Medium - Affects user experience for high-value feeds

---

### **Section 3: Notification Delivery**

#### Q5: WebSocket Server Implementation
**Ambiguity**: Spec mentions Socket.IO vs native WebSockets but doesn't specify which.

**Question**: Which WebSocket implementation?
- **Option A**: **Socket.IO** (MIT, mature, auto-fallback, room-based broadcasting)
- **Option B**: Native WebSockets (simpler, requires manual SSE fallback)

**Recommendation**: **Option A (Socket.IO)** - Proven reliability, built-in fallback.

**Impact**: Low - Both viable, Socket.IO reduces implementation complexity

---

#### Q6: Browser Push Notifications Without Service Worker
**Ambiguity**: FR-017 mentions browser push notifications, but spec doesn't detail service worker setup.

**Question**: Do we implement browser push notifications (Web Push API) in Phase 3B?
- **Option A**: **Yes** - Full Web Push API with service worker (notifications when tab closed)
- **Option B**: **No** - In-app notifications only (simpler, notifications only when app open)
- **Option C**: **Defer to Phase 4** - Focus on WebSocket + email digests first

**Recommendation**: **Option B** for MVP - In-app notifications only. Web Push API in Phase 4.

**Impact**: Medium - Affects user experience when app is backgrounded

---

#### Q7: Notification Persistence Duration
**Ambiguity**: FR-016 says "persist notifications for 7 days" but edge cases mention "archive notifications >7 days old".

**Question**: What happens to notifications after 7 days?
- **Option A**: Hard delete (free up storage)
- **Option B**: Soft delete (archive, queryable but not shown in UI)
- **Option C**: Configurable retention (admin setting)

**Recommendation**: **Option A** - Hard delete after 7 days. Disk space is cheap, but queries get slower with millions of rows.

**Impact**: Low - Affects SQLite database size, query performance

---

### **Section 4: Email Digests**

#### Q8: SendGrid Free Tier Limitation
**Ambiguity**: Spec mentions SendGrid free tier (100 emails/day) but doesn't address scaling beyond that.

**Question**: What happens when digest subscriptions exceed 100/day?
- **Option A**: Implement self-hosted SMTP fallback (Postfix, Exim)
- **Option B**: Upgrade to SendGrid paid tier ($15/month for 40k emails)
- **Option C**: Implement queueing system (send 100/day, queue rest)

**Recommendation**: **Option A** - Self-hosted SMTP for production, SendGrid for dev/staging.

**Impact**: High - Affects production scalability, infrastructure costs

---

#### Q9: Email Template Complexity
**Ambiguity**: Spec mentions MJML for email templates but doesn't specify template structure.

**Question**: How complex should email digests be?
- **Option A**: Simple HTML with table of articles (fast to implement, limited design)
- **Option B**: MJML responsive templates with charts, images, branding (polished but complex)
- **Option C**: Plain text + basic HTML (accessible, works everywhere)

**Recommendation**: **Option A** for MVP - Simple HTML table. MJML polish in Phase 4.

**Impact**: Low - Affects development time, user perception

---

### **Section 5: Trending Detection**

#### Q10: Trending Topic Baseline Computation
**Ambiguity**: FR-021 says "compare against 7-day baseline" but doesn't specify how to compute baseline for new topics.

**Question**: How do we handle trending detection for brand new topics with no baseline?
- **Option A**: Skip trending alerts until 7 days of data accumulated
- **Option B**: Use global average as proxy baseline
- **Option C**: Require minimum 3-day baseline (shorter window for new topics)

**Recommendation**: **Option C** - 3-day minimum baseline. Enables faster trending detection for emerging topics.

**Impact**: Medium - Affects trending alert relevance, false positive rate

---

#### Q11: Keyword Alert Regex Support
**Ambiguity**: FR-028 mentions "regex support" for keyword alerts, but regex can be dangerous (ReDoS attacks).

**Question**: Do we allow arbitrary regex patterns?
- **Option A**: **No regex** - Simple case-insensitive substring matching only
- **Option B**: **Limited regex** - Whitelist safe patterns (no lookaheads, backtracking)
- **Option C**: **Full regex** - Allow any pattern with timeout protection

**Recommendation**: **Option A** for MVP - Simple substring matching. Regex in Phase 4 with proper sandboxing.

**Impact**: Low - Affects keyword alert flexibility, security

---

### **Section 6: Data & Storage**

#### Q12: Feed Entry Storage Limit
**Ambiguity**: FR-003 says "store last 100 entries per feed" but doesn't specify what happens to older entries.

**Question**: How do we handle feeds with >100 articles?
- **Option A**: Delete oldest entries (FIFO queue, simple)
- **Option B**: Archive to separate table (queryable but not in active table)
- **Option C**: No limit (store all entries, use pagination)

**Recommendation**: **Option C** - Store all entries. SQLite handles millions of rows efficiently. Disk is cheap.

**Impact**: Medium - Affects trending detection accuracy (needs historical data)

---

#### Q13: SQLite Database Size Limits
**Ambiguity**: Spec says SQLite handles "10k feeds with 100k articles" but doesn't specify max database size.

**Question**: What are the SQLite database size limits for Phase 3B?
- **10k feeds × 100 articles/feed = 1M articles**
- **1M articles × ~1KB metadata = ~1GB database**
- **Add notifications, polling logs = ~2GB total**

**Clarification Needed**: Are these limits acceptable for MVP?

**Recommendation**: Yes - 2GB SQLite database is well within limits (SQLite supports up to 281TB). Monitor and optimize indexes.

**Impact**: Low - SQLite performance remains good up to 10GB+ with proper indexing

---

### **Section 7: Performance & Scalability**

#### Q14: WebSocket Connection Limits
**Ambiguity**: NFR-003 says "handle 1000 concurrent WebSocket connections" but doesn't specify single vs multi-instance.

**Question**: At what point do we scale WebSocket server horizontally?
- **Option A**: Single instance handles all connections (simpler, requires Redis pub/sub at >1000)
- **Option B**: Multi-instance from start (complex, enables unlimited scale)

**Recommendation**: **Option A** - Single instance for MVP. Add Redis pub/sub when approaching 1000 concurrent connections.

**Impact**: Medium - Affects infrastructure planning, deployment complexity

---

#### Q15: Feed Polling Parallelization
**Ambiguity**: Spec says "poll 10,000 feeds within 1 hour" but doesn't specify concurrency.

**Question**: How many feeds should we poll in parallel?
- **10,000 feeds ÷ 60 minutes = ~167 feeds/minute**
- **167 feeds/minute ÷ 60 seconds = ~3 feeds/second**
- **Parallel workers**: 10 workers = 30 feeds/second capacity

**Clarification Needed**: How many parallel workers?

**Recommendation**: Start with **10 parallel workers** (httpx async). Monitor CPU/network usage, scale up if needed.

**Impact**: Medium - Affects feed freshness, server resource usage

---

## 🎯 Priority Questions for Immediate Resolution

**Critical (Must resolve before implementation)**:
1. **Q1**: User identity approach (localStorage vs accounts)
2. **Q2**: Followed feeds storage mechanism
3. **Q3**: Background job queue selection (APScheduler vs Celery)
4. **Q8**: SendGrid scaling strategy

**High (Should resolve before Phase 2 - Design)**:
5. **Q4**: Feed polling prioritization algorithm
6. **Q6**: Browser Push API scope (defer or include)
7. **Q10**: Trending baseline for new topics

**Medium (Can resolve during implementation)**:
8. **Q5**: WebSocket implementation (Socket.IO vs native)
9. **Q7**: Notification retention policy
10. **Q9**: Email template complexity
11. **Q11**: Keyword alert regex support
12. **Q12**: Feed entry storage limit

**Low (Optimization decisions)**:
13. **Q13**: SQLite database size monitoring
14. **Q14**: WebSocket horizontal scaling trigger
15. **Q15**: Feed polling parallelization tuning

---

## ✅ Proposed Resolutions (Awaiting Confirmation)

Based on AIWebFeeds architecture and Phase 1/2 patterns:

1. **User Identity**: localStorage UUID (anonymous users) → Migrate to Phase 3A later
2. **Followed Feeds**: Server-side storage with localStorage user_id
3. **Background Jobs**: APScheduler (no Redis for MVP)
4. **Email Delivery**: Self-hosted SMTP (production) + SendGrid (dev)
5. **WebSocket**: Socket.IO (mature, auto-fallback)
6. **Browser Push**: **Defer to Phase 4** (focus on in-app + email)
7. **Trending Baseline**: 3-day minimum for new topics
8. **Feed Entry Limit**: Store all entries (no limit)
9. **Notification Retention**: Hard delete after 7 days
10. **Email Templates**: Simple HTML (no MJML for MVP)

---

**Status**: ⏳ Awaiting user confirmation on proposed resolutions  
**Next Step**: Once confirmed, proceed to `/speckit.plan` for implementation planning

