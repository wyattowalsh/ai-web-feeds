# Clarifications Needed: Phase 1 - Data Discovery & Analytics

**Spec**: `specs/002-data-discovery-analytics/spec.md`\
**Date**: 2025-10-22\
**Status**: Awaiting User Input

______________________________________________________________________

## High-Impact Clarifications (Block Implementation)

These ambiguities must be resolved before technical design can proceed.

______________________________________________________________________

### 1. Analytics Dashboard: Data Freshness vs Performance Trade-off

**Current Spec**: FR-009 says "cache analytics queries for 5 minutes", but FR-010 says
"show data freshness indicator with auto-refresh option". Success criteria SC-001
requires "≤2 second load time".

**Ambiguity**: How should we balance real-time data vs performance?

**Options**:

**A. Smart Caching (Recommended)**

- Cache expensive queries (5min TTL) by default
- "Refresh Now" button triggers background job, returns immediately
- Live updates via polling (every 30s) for critical metrics only
- Trade-off: 5-minute data delay, but instant page loads

**B. Real-Time Priority**

- No caching, all queries hit database directly
- Use materialized views + triggers for instant updates
- Optimize with indexes and query planning
- Trade-off: May exceed 2s load time for complex aggregations

**C. Hybrid Approach**

- Static metrics (total feeds, verified count) cached (1 hour)
- Dynamic metrics (trending topics, recent validations) refreshed (5 min)
- User can toggle "Live Mode" for real-time data (warns of slower performance)
- Trade-off: More complex implementation, best UX

**Question**: Which caching strategy should we implement?

**Recommendation**: **Option C (Hybrid)** - balances performance with freshness, gives
users control

______________________________________________________________________

### 2. Semantic Search: Vector Storage Implementation

**Current Spec**: FR-020 mentions "configurable local vs API generation" and technical
section shows two vector storage options (NumPy+BLOB vs sqlite-vec).

**Ambiguity**: Which vector storage approach should we use for MVP?

**Options**:

**A. NumPy + SQLite BLOB (Simpler)**

- Store embeddings as BLOB in SQLite
- Brute-force cosine similarity in Python
- Pros: Zero dependencies, works everywhere
- Cons: Slower for 10,000+ embeddings (~2s search time)
- Best for: \<5,000 feeds

**B. sqlite-vec Extension (Faster)**

- Install `sqlite-vec` extension (MIT license)
- Native SQL vector operations
- Pros: 10-100x faster, SQL-based queries
- Cons: Requires compilation/installation
- Best for: 5,000-50,000 feeds

**C. Dual Implementation (Future-Proof)**

- Start with NumPy+BLOB (MVP)
- Add sqlite-vec as optional optimization
- Auto-detect which is available at runtime
- Best for: Gradual scaling

**Question**: Which vector storage should we implement first?

**Recommendation**: **Option A (NumPy+BLOB) for MVP**, with Option C path for future
optimization

______________________________________________________________________

### 3. AI Recommendations: Collaborative Filtering Data Requirements

**Current Spec**: FR-029 says "collaborative filtering based on feed co-occurrence" but
US3 is Priority P2 and assumes user accounts don't exist yet (localStorage only).

**Ambiguity**: How do we collect collaborative data without user accounts in Phase 1?

**Options**:

**A. Anonymous Tracking (Privacy-First)**

- Use browser localStorage + anonymous session IDs
- Track "follows" and "likes" without authentication
- Aggregate anonymously for collaborative matrix
- Pros: Works without accounts, privacy-friendly
- Cons: Data lost on browser clear, can't sync across devices

**B. Deferred Collaborative (Content-Only MVP)**

- Skip collaborative filtering in Phase 1 entirely
- Use only content-based recommendations (topic similarity, popularity)
- Save collaborative filtering for Phase 2 (user accounts)
- Pros: Simpler implementation, no privacy concerns
- Cons: Less personalized recommendations

**C. Hybrid Recommendation (Best of Both)**

- Phase 1: Content-based (80%) + popularity (20%)
- Collect anonymous interaction data for future collaborative
- Phase 2: Add collaborative filtering (60/30/10 split as spec'd)
- Pros: Immediate value, prepares for future
- Cons: Spec says hybrid already, need to clarify P1 vs P2 mix

**Question**: Should Phase 1 include collaborative filtering, or defer to Phase 2?

**Recommendation**: **Option B (Deferred Collaborative)** - simplify P1, make US3 fully
content-based until user accounts exist

______________________________________________________________________

### 4. Search Autocomplete: Data Source for Suggestions

**Current Spec**: FR-013 says autocomplete shows "matching feeds (top 5), matching
topics (top 3), recent searches (top 3)" within 200ms.

**Ambiguity**: What powers the autocomplete? Pre-built index? Real-time FTS5 query?

**Options**:

**A. Pre-Built Trie/Prefix Index**

- Build in-memory trie structure on app startup
- Contains all feed titles + topic names
- Lightning-fast prefix matching (\<10ms)
- Pros: Fastest, consistent performance
- Cons: Memory overhead (~10-20MB), rebuild on data changes

**B. SQLite FTS5 Query**

- Use FTS5 prefix matching: `title:query*`
- Cache results with functools.lru_cache
- Pros: Simple, always in-sync with database
- Cons: May exceed 200ms for complex queries

**C. Hybrid: Trie + FTS5**

- Trie for titles/topics (fast, cached)
- FTS5 for recent searches (user-specific)
- Best of both worlds
- Pros: Fast + flexible
- Cons: More code complexity

**Question**: How should autocomplete be implemented?

**Recommendation**: **Option A (Pre-Built Trie)** for MVP - simplest to implement, meets
200ms requirement

______________________________________________________________________

### 5. Analytics Export: PDF Generation Approach

**Current Spec**: External dependencies mention "Playwright (Apache 2.0) or WeasyPrint
(BSD)" for PDF generation.

**Ambiguity**: Which PDF library should we use, and what's the export format?

**Options**:

**A. Playwright (Browser-Based)**

- Use headless Chromium to render HTML → PDF
- Pros: Perfect rendering of charts, same as web UI
- Cons: Heavy dependency (~300MB), slower generation
- Best for: Complex charts with JavaScript

**B. WeasyPrint (HTML/CSS Only)**

- Pure Python PDF generation from HTML/CSS
- Pros: Lightweight, faster, no browser needed
- Cons: Limited JS support, charts need static SVG/PNG
- Best for: Simple reports with static images

**C. Chart.js Server-Side + WeasyPrint**

- Generate chart images server-side (canvas or node-canvas)
- Use WeasyPrint for layout
- Pros: Good balance, no browser needed
- Cons: Requires Node.js for chart rendering

**D. CSV Only (Simplest MVP)**

- Skip PDF entirely for Phase 1
- Provide CSV export only (raw data)
- Users generate PDFs in Excel/Google Sheets
- Defer PDF to Phase 2

**Question**: Which PDF export approach for analytics reports?

**Recommendation**: **Option D (CSV Only)** for MVP - simplest, users have own tools.
Add PDF in Phase 2 if requested.

______________________________________________________________________

## Medium-Priority Clarifications (Affects Design)

These should be clarified during planning phase.

______________________________________________________________________

### 6. Trending Topics Calculation

**Current Spec**: FR-005 says "calculate trending topics by article publication
frequency (last 30 days), weighted by feed quality scores".

**Ambiguity**: We don't fetch article content in Phase 1 (out of scope per spec). How do
we calculate publication frequency without article data?

**Options**:

**A. Use Validation Frequency as Proxy**

- Trending = feeds with high validation frequency
- Assumption: Frequently validated feeds are actively publishing
- Pros: Uses existing data
- Cons: Not true "trending topics", more like "active feeds"

**B. Defer Trending Topics to Phase 2**

- Skip trending calculation in Phase 1
- Show "Most Popular Feeds" instead (by follow count)
- Add true trending when article fetching implemented
- Pros: Honest about data limitations
- Cons: Reduces Phase 1 value

**C. Add Lightweight Feed Parsing**

- Fetch feed RSS/Atom once daily (no full article content)
- Extract publication dates only (not content)
- Calculate trending from pub date frequency
- Pros: True trending topics
- Cons: Adds complexity, contradicts "out of scope"

**Question**: How should "trending topics" be calculated without article data?

**Recommendation**: **Option A (Validation Frequency Proxy)** - use existing data,
rename to "Most Active Topics" for clarity

______________________________________________________________________

### 7. Recommendation Diversity Constraints

**Current Spec**: FR-032 says "enforce diversity constraints: max 3 feeds per topic,
minimum 2 topics represented".

**Ambiguity**: What happens if user's interests are in only 1 topic (e.g., only follows
"LLM" feeds)?

**Options**:

**A. Strict Enforcement (Force Diversity)**

- Always show at least 2 topics, even if low relevance
- Include "serendipity" feeds from adjacent topics
- Pros: Encourages exploration
- Cons: May show irrelevant content

**B. Flexible Constraints (User Intent)**

- If user follows only 1 topic, show best feeds from that topic
- Relax "min 2 topics" to "best effort"
- Pros: Respects user focus
- Cons: Creates filter bubbles

**C. Configurable Diversity**

- Let users toggle "Explore Mode" (diversity on) vs "Focus Mode" (diversity off)
- Default to Explore Mode
- Pros: User control
- Cons: More UI complexity

**Question**: How strict should diversity constraints be enforced?

**Recommendation**: **Option B (Flexible)** - respect user intent, suggest "Explore
similar topics" if too narrow

______________________________________________________________________

### 8. Search Zero Results: "Contact Us" Action

**Current Spec**: FR-023 says zero results should show "contact form" option.

**Ambiguity**: This implies user accounts or email collection. How do we handle without
authentication?

**Options**:

**A. GitHub Issues**

- "Can't find what you need? [Create a GitHub issue]"
- Links to repo's "Add Feed" issue template
- Pros: No backend needed, public tracking
- Cons: Requires GitHub account

**B. Simple Email Link**

- "Suggest a feed: [mailto:feeds@aiwebfeeds.com]"
- User's default email client opens
- Pros: No backend, works for everyone
- Cons: No tracking, spam risk

**C. Anonymous Suggestion Form**

- Simple form: feed URL + category (no auth)
- Stores in database for curator review
- Pros: Lowest friction
- Cons: Spam risk, needs moderation

**Question**: How should "contact us for missing feeds" work?

**Recommendation**: **Option A (GitHub Issues)** - aligns with open-source nature,
built-in moderation

______________________________________________________________________

### 9. Saved Searches: Persistence Without Authentication

**Current Spec**: FR-021 says "Save Search button stores query+filters" and FR-022
mentions "localStorage or database if logged in".

**Ambiguity**: Phase 1 has no user accounts. Should saved searches sync across devices?

**Options**:

**A. LocalStorage Only (Simple)**

- Saved searches stored in browser localStorage
- No sync, lost if user clears data
- Pros: Zero backend, instant implementation
- Cons: Not portable, lost on browser clear

**B. Anonymous Cloud Storage**

- Generate anonymous user ID on first visit
- Store saved searches in database with anonymous ID
- User gets shareable link to "restore" on other devices
- Pros: Cross-device sync (via link)
- Cons: Privacy concerns, needs cleanup policy

**C. Export/Import JSON**

- Save to localStorage by default
- Provide "Export Searches" → JSON file
- User can "Import Searches" on other devices
- Pros: User control, privacy-friendly
- Cons: Manual process, friction

**Question**: How should saved searches persist in Phase 1 (no auth)?

**Recommendation**: **Option A (localStorage) + Option C (Export/Import)** - simple MVP
with user control

______________________________________________________________________

### 10. Semantic Search Performance: Acceptable Latency

**Current Spec**: NFR-004 says "semantic search MUST return results within 3 seconds",
but NFR-011b says "vector similarity MUST complete in \<2s for 10,000 embeddings".

**Ambiguity**: Is 2s or 3s the target? What's included in timing (just vector search or
full result rendering)?

**Options**:

**A. 2s Vector Search + 1s Rendering = 3s Total**

- 2s for cosine similarity computation
- 1s for database lookups and result formatting
- Total 3s end-to-end acceptable
- Clear performance budget allocation

**B. 2s End-to-End**

- Everything must complete in 2s
- Requires highly optimized vector search (\<1s)
- May need sqlite-vec extension or GPU

**C. Progressive Loading**

- Show FTS5 results immediately (\<500ms)
- Semantic results load progressively ("Finding similar feeds...")
- User sees results quickly, semantic adds to it
- Total may exceed 3s but perceived as faster

**Question**: What's the acceptable latency for semantic search?

**Recommendation**: **Option A (3s Total with Budget)** - clear, achievable with NumPy,
can optimize later

______________________________________________________________________

## Low-Priority Clarifications (Can Decide During Implementation)

These can be resolved by developers during implementation without blocking.

______________________________________________________________________

### 11. Chart Library: Chart.js vs Apache ECharts

**Spec**: Lists both as options. Which should we standardize on?

**Recommendation**: **Chart.js** - simpler API, lighter weight, already in Next.js
ecosystem

______________________________________________________________________

### 12. SQLite FTS5 Tokenizer: Porter vs Unicode61

**Spec**: Shows `tokenize='porter unicode61'` but both tokenizers listed.

**Recommendation**: **Porter + Unicode61** - best for English AI/ML terms with
international names

______________________________________________________________________

### 13. Embedding Model Size: 384-dim vs 768-dim

**Spec**: Says all-MiniLM-L6-v2 is 384-dim in one place, 768-dim in another.

**Clarification**: all-MiniLM-L6-v2 is **384 dimensions** (confirmed)

______________________________________________________________________

## Summary: Decisions Needed

| #   | Question                       | Priority | Blocking? | Recommendation                   |
| --- | ------------------------------ | -------- | --------- | -------------------------------- |
| 1   | Analytics caching strategy     | High     | Yes       | Hybrid (static 1h, dynamic 5min) |
| 2   | Vector storage approach        | High     | Yes       | NumPy+BLOB for MVP               |
| 3   | Collaborative filtering in P1? | High     | Yes       | Defer to Phase 2                 |
| 4   | Autocomplete implementation    | High     | Yes       | Pre-built Trie index             |
| 5   | PDF export library             | High     | Yes       | CSV only for MVP                 |
| 6   | Trending topics calculation    | Medium   | No        | Validation frequency proxy       |
| 7   | Recommendation diversity       | Medium   | No        | Flexible (respect user intent)   |
| 8   | Zero results contact method    | Medium   | No        | GitHub Issues                    |
| 9   | Saved searches persistence     | Medium   | No        | localStorage + export            |
| 10  | Semantic search latency target | Medium   | No        | 3s total (2s vector + 1s render) |

______________________________________________________________________

## Questions for User

Please respond with your choices for the **High Priority** questions (1-5):

1. **Analytics Caching**: A (Smart), B (Real-Time), or C (Hybrid)?
1. **Vector Storage**: A (NumPy), B (sqlite-vec), or C (Dual)?
1. **Collaborative Filtering**: A (Anonymous), B (Defer to P2), or C (Hybrid)?
1. **Autocomplete**: A (Trie), B (FTS5), or C (Hybrid)?
1. **PDF Export**: A (Playwright), B (WeasyPrint), C (Chart.js+WeasyPrint), or D (CSV
   Only)?

For medium priority (6-10), I can proceed with recommendations unless you prefer
different approaches.

______________________________________________________________________

**Next Step**: Once clarifications are received, run `/speckit.plan` to generate
technical implementation plan.
