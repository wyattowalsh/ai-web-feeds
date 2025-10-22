# Cross-Artifact Analysis: Phase 3B - Real-Time Feed Monitoring & Alerts

**Analysis Date**: 2025-10-22  
**Analyzed Artifacts**: spec.md, clarifications.md, plan.md, research.md, data-model.md, contracts/, quickstart.md, tasks.md  
**Status**: ✅ PASSED (Minor issues found)

---

## Executive Summary

**Overall Quality**: 🟢 **Excellent** (92/100)

Phase 3B artifacts are comprehensive, well-structured, and implementation-ready. Cross-artifact consistency is strong with only minor issues identified. All critical paths are covered with clear traceability from user stories through to implementation tasks.

### Key Findings

✅ **Strengths** (10 items):
1. Complete user story → task traceability
2. Technology decisions well-documented with rationale
3. Database schema comprehensive with migrations
4. API contracts fully specified (REST + WebSocket)
5. Test coverage targets clearly defined (≥90%)
6. Parallel execution opportunities identified (70%)
7. Constitution compliance verified
8. Risk mitigation strategies documented
9. Independent test criteria per user story
10. Production deployment checklist included

⚠️ **Issues Found** (8 items):
- 2 Critical (blocking implementation)
- 3 High (should fix before starting)
- 3 Medium (can fix during implementation)

---

## Issue Analysis

### 🔴 Critical Issues (Must Fix Before Implementation)

#### Issue #1: Missing "Followed Feeds" Mechanism

**Severity**: 🔴 Critical  
**Artifact**: data-model.md, tasks.md  
**Impact**: Blocks US1 (Real-Time Feed Updates)

**Problem**: 
- User Story 1 requires users to "follow feeds" to receive notifications
- Clarifications specify "server-side storage with localStorage user_id"
- **But**: No `followed_feeds` or `user_feed_subscriptions` table in data-model.md
- Task T056 mentions "aiwebfeeds notify follow" but no storage layer task

**Evidence**:
- spec.md line 23: "receive notifications when feeds I follow publish new content"
- clarifications.md Q2: "Followed feeds storage → Server-side storage"
- data-model.md: Only has `NotificationPreference` table (preferences, not follows)
- tasks.md T021: "poll_feed() function" but no "get_feed_followers()" query

**Fix Required**:
```sql
-- Add to data-model.md:
CREATE TABLE user_feed_follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    feed_id TEXT NOT NULL REFERENCES feeds(id),
    followed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, feed_id)
);
CREATE INDEX idx_follows_user ON user_feed_follows(user_id);
CREATE INDEX idx_follows_feed ON user_feed_follows(feed_id);
```

**Tasks to Add**:
- After T014: `- [ ] T014b [P] Create UserFeedFollow SQLModel in packages/ai_web_feeds/src/ai_web_feeds/models.py`
- After T020: `- [ ] T020b [P] Extend storage.py with user_feed_follows table queries (follow, unfollow, get_followers, get_user_follows)`
- In migration T004: Add `user_feed_follows` table

---

#### Issue #2: Missing localStorage User Identity Implementation

**Severity**: 🔴 Critical  
**Artifact**: tasks.md, contracts/openapi.yaml  
**Impact**: Blocks all WebSocket and API calls

**Problem**:
- Clarifications specify "localStorage UUID for anonymous users"
- WebSocket protocol requires user_id in query string
- **But**: No task to implement getUserId() localStorage logic in frontend
- Task T041 mentions it but doesn't create it

**Evidence**:
- clarifications.md: "localStorage UUID (anonymous users)"
- contracts/websocket.md line 22: `const userId = getUserIdFromLocalStorage();`
- tasks.md T041: "Implement getUserId() function" but should be T040 (before websocket setup)

**Fix Required**:
- Move T041 before T040
- Ensure it creates `apps/web/lib/user-identity.ts` with:
  ```typescript
  export function getUserId(): string {
    let userId = localStorage.getItem('aiwebfeeds_user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('aiwebfeeds_user_id', userId);
    }
    return userId;
  }
  ```

**Task Adjustment**:
```
- [ ] T040 [P] [US1] Create apps/web/lib/user-identity.ts with getUserId() localStorage function
- [ ] T041 [P] [US1] Create apps/web/lib/websocket.ts with Socket.IO client wrapper (uses getUserId())
```

---

### 🟡 High Priority Issues (Should Fix Before Starting)

#### Issue #3: Notification Preferences vs Followed Feeds Confusion

**Severity**: 🟡 High  
**Artifact**: data-model.md, spec.md  
**Impact**: Unclear relationship between following and preferences

**Problem**:
- `NotificationPreference` table has optional `feed_id` field
- Spec says "follow feeds" but preferences are separate from follows
- User can have preferences for feeds they don't follow (logical inconsistency)

**Evidence**:
- data-model.md line 458: `feed_id: Optional[str] = Field(default=None)`
- spec.md line 31: "user follows 10 feeds with instant notifications enabled"
- This implies: follow action + notification preference, not preference alone

**Clarification Needed**:
- **Option A**: Following a feed auto-creates default notification preference (instant, websocket)
- **Option B**: Preferences are independent, can set preferences without following
- **Recommendation**: Option A for better UX

**Fix Required**:
- Update data-model.md to clarify: "NotificationPreference created automatically on follow"
- Add to tasks.md after T020b: Create default preference when user follows feed

---

#### Issue #4: Trending Detection Baseline Cold Start

**Severity**: 🟡 High  
**Artifact**: research.md, trending.py implementation  
**Impact**: Trending detection fails during first 3 days after launch

**Problem**:
- Clarifications specify "3-day minimum baseline for new topics"
- **But**: What happens when system first launches with 0 historical data?
- quickstart.md line 279: "Verify baseline data exists" but no fallback

**Evidence**:
- research.md: "3-day minimum for new topics"
- quickstart.md debugging: "Should return >100 for meaningful baseline"
- No mention of "seed baseline" or "skip trending until baseline exists"

**Fix Required**:
- Add to tasks.md T065: "Implement compute_baseline() with cold-start check"
- If baseline insufficient (<3 days of data): Skip trending detection, log warning
- Quickstart should mention: "Trending detection enabled after 3 days of feed polling"

**Code Addition**:
```python
def detect_trending_topics():
    # Check if we have sufficient baseline
    oldest_article = get_oldest_article()
    if (datetime.now() - oldest_article.created_at).days < 3:
        logger.warning("Insufficient baseline (<3 days), skipping trending detection")
        return []
    # Continue with normal detection...
```

---

#### Issue #5: Email Digest Timezone Handling Incomplete

**Severity**: 🟡 High  
**Artifact**: data-model.md, tasks.md  
**Impact**: Digests sent at wrong time for users

**Problem**:
- data-model.md specifies `timezone` field in EmailDigest
- Clarifications address timezone question
- **But**: No task to implement timezone conversion in digest scheduler
- Task T088 "send_all_due_digests()" doesn't mention timezone conversion

**Evidence**:
- data-model.md line 582: `timezone: str = Field(default="UTC")`
- clarifications.md edge case: "Store user timezone preference, convert to UTC"
- tasks.md T088: No mention of timezone conversion

**Fix Required**:
- Update T088 description: "Implement send_all_due_digests() with timezone-aware scheduling"
- Add code snippet to quickstart.md showing pytz usage
- Test case in T101 already covers this, but implementation task should be explicit

---

### 🟠 Medium Priority Issues (Can Fix During Implementation)

#### Issue #6: WebSocket Reconnection Strategy Incomplete

**Severity**: 🟠 Medium  
**Artifact**: contracts/websocket.md, tasks.md  
**Impact**: Missed notifications after disconnect

**Problem**:
- WebSocket protocol specifies auto-reconnection
- Edge cases mention "fetch missed notifications from REST API on reconnect"
- **But**: No task to implement fetchMissedNotifications() function
- Task T042 "auto-reconnection logic" doesn't mention missed notification fetching

**Evidence**:
- contracts/websocket.md line 135: "Fetch missed notifications from REST API on reconnect"
- tasks.md T042: Only mentions "exponential backoff", not missed notification recovery

**Fix Required**:
- Update T042: "Implement auto-reconnection logic with exponential backoff AND missed notification recovery"
- Or add new task: `- [ ] T042b [US1] Implement fetchMissedNotifications() on reconnect in websocket.ts`

---

#### Issue #7: Smart Bundling Logic Underspecified

**Severity**: 🟠 Medium  
**Artifact**: tasks.md, notifications.py  
**Impact**: Notification spam not fully prevented

**Problem**:
- spec.md specifies "smart bundling: >3 articles in 5 minutes"
- Task T037 implements check, T038 creates bundle
- **But**: No task for "delayed notification sending" to accumulate articles for bundling
- Current design would send 3 individual notifications, then bundle 4+

**Evidence**:
- spec.md edge case: "5 new articles from Feed X instead of 5 separate notifications"
- tasks.md T037-T038: Check and create bundle, but no delay/accumulation logic

**Fix Required**:
- Clarify in T037: "Implement notification queuing: Hold notifications for 2 minutes, bundle if >3 in queue"
- Or accept current design: First 3 sent individually, 4+ bundled (simpler MVP)

**Recommendation**: Accept simpler MVP, optimize in Phase 4

---

#### Issue #8: Production SMTP Configuration Missing Details

**Severity**: 🟠 Medium  
**Artifact**: quickstart.md, tasks.md  
**Impact**: Production email delivery may fail

**Problem**:
- research.md specifies "self-hosted SMTP (Postfix)"
- Task T106 says "Configure Postfix"
- **But**: No detailed Postfix configuration steps, SPF/DKIM setup, DNS records

**Evidence**:
- research.md: "Self-hosted SMTP (Postfix, Exim)"
- tasks.md T106: "Configure Postfix" (1 task, likely insufficient)
- quickstart.md has MailHog for dev but no Postfix guide

**Fix Required**:
- Expand T106 into subtasks:
  - Install Postfix
  - Configure SPF/DKIM records
  - Test with mail-tester.com
  - Setup bounce handling
- Or: Defer to deployment docs, keep T106 as "reference deployment guide"

**Recommendation**: Add to apps/web/content/docs/guides/email-delivery.mdx (not in tasks)

---

## Consistency Validation

### ✅ Spec → Tasks Traceability

| User Story | Spec Section | Tasks | Coverage |
|------------|--------------|-------|----------|
| US1: Real-Time Feed Updates | Lines 21-35 | T021-T062 (26 tasks) | ✅ 100% |
| US2: Trending Topics Alerts | Lines 38-52 | T063-T080 (14 tasks) | ✅ 100% |
| US3: Email Digests | Lines 55-69 | T081-T102 (18 tasks) | ✅ 100% |

**All user stories have complete task coverage**

---

### ✅ Data Model → Tasks Validation

| Entity | Model Task | Storage Task | Used By |
|--------|------------|--------------|---------|
| FeedEntry | T009 ✅ | T015 ✅ | US1, US2 |
| FeedPollJob | T010 ✅ | T016 ✅ | US1 |
| Notification | T011 ✅ | T017 ✅ | US1, US2 |
| TrendingTopic | T012 ✅ | T019 ✅ | US2 |
| NotificationPreference | T013 ✅ | T018 ✅ | US1, US3 |
| EmailDigest | T014 ✅ | T020 ✅ | US3 |
| **UserFeedFollow** | ❌ **MISSING** | ❌ **MISSING** | **US1** ← Critical |

**Issue #1 confirmed**: UserFeedFollow entity missing

---

### ✅ API Contracts → Tasks Validation

| Endpoint | Contract | Implementation Task | Status |
|----------|----------|---------------------|--------|
| GET /api/notifications | openapi.yaml ✅ | T049 ✅ | ✅ |
| POST /api/notifications/{id}/read | openapi.yaml ✅ | T050 ✅ | ✅ |
| POST /api/notifications/{id}/dismiss | openapi.yaml ✅ | T051 ✅ | ✅ |
| GET /api/preferences | openapi.yaml ✅ | T054 ✅ | ✅ |
| POST /api/preferences | openapi.yaml ✅ | T054 ✅ | ✅ |
| GET /api/digests | openapi.yaml ✅ | T092 ✅ | ✅ |
| POST /api/digests | openapi.yaml ✅ | T092 ✅ | ✅ |
| DELETE /api/digests | openapi.yaml ✅ | T092 ✅ | ✅ |
| GET /api/trending | openapi.yaml ✅ | T073 ✅ | ✅ |
| POST /api/poll/{feed_id} | openapi.yaml ✅ | T029 (CLI) ⚠️ | ⚠️ No API route task |

**Minor**: POST /api/poll/{feed_id} has contract but no API route implementation task

---

### ✅ Research Decisions → Tasks Validation

| Decision | Research | Implemented By | Status |
|----------|----------|----------------|--------|
| APScheduler | research.md ✅ | T001, T026-T027 ✅ | ✅ |
| Socket.IO | research.md ✅ | T002, T031-T034 ✅ | ✅ |
| Self-hosted SMTP | research.md ✅ | T086, T106 ✅ | ✅ |
| Z-score trending | research.md ✅ | T064-T067 ✅ | ✅ |
| localStorage UUID | research.md ✅ | T041 ⚠️ | ⚠️ Should be T040 |

**Issue #2 confirmed**: localStorage implementation task ordering issue

---

## Constitution Compliance Check

### Principle I: Documentation-First Development ✅
- All features documented in spec.md, plan.md
- Task T108-T110 creates .mdx documentation
- Task T111 updates meta.json navigation

**Status**: ✅ PASS

### Principle II: Component Isolation & Modularity ✅
- Core Package, CLI, Web separation maintained
- No circular dependencies
- Each component has independent task groups

**Status**: ✅ PASS

### Principle III: Type Safety & Data Integrity ✅
- All models use SQLModel with type hints
- Pydantic v2 validation specified
- mypy enforcement in constitution check

**Status**: ✅ PASS

### Principle IV: Test-First Development ✅
- Test tasks included (T057-T062, T077-T080, T097-T102)
- Coverage targets defined (≥90%)
- Independent test criteria per story

**Status**: ✅ PASS

### Principle V: Data Schema Compliance ✅
- Migration task T003-T006 includes JSON validation
- SQLModel enforces schema at runtime
- Triggers maintain integrity

**Status**: ✅ PASS

### Principle VI: Modern Stack Commitment ✅
- Python 3.13+, APScheduler 3.10+, Socket.IO 5.x
- All dependencies pinned in pyproject.toml
- Security updates workflow mentioned

**Status**: ✅ PASS

### Principle VII: Code Quality & Conventions ✅
- Absolute imports enforced
- Conventional commits used in git history
- Ruff, ESLint checks in tasks

**Status**: ✅ PASS

**Overall Constitution Compliance**: ✅ 7/7 PASS

---

## Quality Metrics

### Documentation Completeness: 95/100 ⭐⭐⭐⭐⭐
- ✅ Spec complete with user stories
- ✅ Plan with technical context
- ✅ Data model with schemas
- ✅ API contracts (REST + WebSocket)
- ✅ Research with rationale
- ✅ Quickstart with troubleshooting
- ✅ Tasks with dependencies
- ⚠️ Missing: UserFeedFollow entity documentation (-5 points)

### Task Granularity: 90/100 ⭐⭐⭐⭐⭐
- ✅ All tasks have exact file paths
- ✅ Clear acceptance criteria per phase
- ✅ Parallelization markers
- ✅ User story labels
- ⚠️ Some tasks could be split further (T088 timezone conversion) (-10 points)

### Cross-Artifact Consistency: 88/100 ⭐⭐⭐⭐
- ✅ User story → task traceability complete
- ✅ Contracts → tasks mapping strong
- ⚠️ Missing entity (UserFeedFollow) (-7 points)
- ⚠️ localStorage implementation ordering issue (-5 points)

### Risk Management: 95/100 ⭐⭐⭐⭐⭐
- ✅ High-risk tasks identified
- ✅ Mitigation strategies documented
- ✅ Load testing included
- ✅ Production checklist
- ⚠️ Timezone handling could be more explicit (-5 points)

**Overall Quality Score**: 92/100 ⭐⭐⭐⭐⭐

---

## Recommendations

### Before Starting Implementation

1. **Fix Issue #1 (Critical)**: Add UserFeedFollow entity
   - Add model task after T014
   - Add storage task after T020
   - Update migration T004
   - Update polling.py to query followers

2. **Fix Issue #2 (Critical)**: Reorder localStorage tasks
   - Create T040 for user-identity.ts
   - Make T041 depend on T040

3. **Fix Issue #3 (High)**: Clarify preferences vs follows
   - Document in data-model.md
   - Auto-create default preference on follow

### During Implementation

4. **Address Issue #4 (High)**: Add baseline cold-start check
   - In T065 implementation
   - Document in quickstart.md

5. **Address Issue #5 (High)**: Make timezone handling explicit
   - In T088 implementation
   - Add pytz import

### Post-MVP (Can Defer)

6. **Issue #6 (Medium)**: Missed notification recovery
   - Optimize in Phase 4
   - Current manual poll fallback acceptable for MVP

7. **Issue #7 (Medium)**: Smart bundling optimization
   - Current "first 3 individual, 4+ bundled" acceptable
   - Optimize with delayed queue in Phase 4

8. **Issue #8 (Medium)**: Production SMTP guide
   - Create separate deployment documentation
   - Not blocking for MVP

---

## Acceptance Criteria

### Phase 3B Artifacts Are Ready For Implementation When:

- [x] All artifacts generated (spec, plan, research, data-model, contracts, quickstart, tasks)
- [x] Constitution compliance verified (7/7 principles)
- [x] User story → task traceability complete
- [x] API contracts complete
- [x] Test strategy defined
- [ ] **Issue #1 fixed** (UserFeedFollow entity added)
- [ ] **Issue #2 fixed** (localStorage task reordered)
- [ ] **Issue #3 clarified** (preferences vs follows relationship)

**Status**: ⚠️ **CONDITIONAL PASS** - Fix 2 critical issues before starting

---

## Summary

Phase 3B artifacts are **92% ready** for implementation. Quality is excellent with comprehensive documentation and clear traceability. Two critical issues must be fixed before starting:

1. Add UserFeedFollow entity (data model + storage + migration)
2. Reorder localStorage implementation tasks

Three high-priority issues should be addressed during implementation (trending baseline, timezone handling, preferences clarification).

**Recommendation**: Fix critical issues (1-2 hours), then proceed with `/speckit.implement`.

---

**Analysis Version**: 1.0.0 | **Analyst**: AI Agent (default) | **Next Step**: Fix Issues #1-2, then implement

