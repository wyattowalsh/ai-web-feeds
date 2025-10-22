# Feature Specification: Phase 3 - Community Curation & Social Features

**Feature Branch**: `004-community-curation`  
**Created**: 2025-10-22  
**Status**: Draft → Awaiting Approval  
**Priority**: High  
**Dependencies**: Phase 1 (Foundation), Phase 2 (Analytics & Discovery), Phase 3A (User Accounts - Recommended)

---

## Executive Summary

Enable users to create, share, and collaborate on curated feed collections, transforming AIWebFeeds from a personal tool into a community-driven platform. This phase adds social features that leverage collective intelligence for content discovery, increasing platform value through network effects.

**Value Proposition**: Discover quality feeds through trusted curators, build reputation as an expert, collaborate on comprehensive topic resources.

---

## User Scenarios & Testing

### User Story 1 - Public Feed Collections (Priority: P1) 🎯 MVP

As a **subject matter expert**, I want to **create and share curated feed collections** so that I can **help others discover quality sources in my field**.

**Why this priority**: Core value proposition. Enables knowledge sharing and community building. Collections are the foundation for all other social features.

**Independent Test**: Create collection "Best LLM Research Feeds" → Add 10 feeds → Set to public → Get shareable URL → Share link → Another user views collection → Follows collection → Receives notification when feeds added

**Acceptance Scenarios**:

1. **Given** curator creates new collection with name "Best LLM Research Feeds" and description, **When** adds 10 feeds from search/followed feeds, **Then** collection appears in curator's profile with feed count, creation date, and follower count
2. **Given** collection is set to public, **When** curator copies shareable URL (`/collections/abc123`), **Then** URL works for any user (no authentication required) and shows collection metadata, feed list, and curator info
3. **Given** public collection exists, **When** user clicks "Follow Collection", **Then** user receives updates when curator adds/removes feeds, collection appears in user's "Followed Collections" list
4. **Given** collection has 100+ followers, **When** curator adds new feed, **Then** followers see notification "New feed added to 'Best LLM Research Feeds'" (respecting notification preferences)

---

### User Story 2 - Community Discovery (Priority: P1) 🎯 MVP

As a **beginner**, I want to **browse community-curated collections** so that I can **quickly find trusted sources without manually vetting feeds**.

**Why this priority**: Reduces onboarding friction. New users benefit from expert curation immediately. Drives network effects (more curators → more value → more users → more curators).

**Independent Test**: Visit `/collections` discover page → Browse trending collections → Filter by topic "LLM" → View collection with 500 followers → See curator reputation badge → Follow collection → Receive welcome email with collection summary

**Acceptance Scenarios**:

1. **Given** user visits collections discovery page, **When** views trending collections (sorted by follower count), **Then** sees top 20 collections with metadata: name, curator, follower count, feed count, topics, last updated
2. **Given** user filters by topic "LLM", **When** applies filter, **Then** sees only collections tagged with "LLM", sorted by relevance score (followers + recency + curator reputation)
3. **Given** user views collection detail page, **When** sees curator profile, **Then** displays curator reputation score (based on followers, collection quality, activity), verified badge (if applicable), collection count, total followers
4. **Given** user likes collection, **When** clicks "Like" (bookmark), **Then** collection appears in user's "Liked Collections" for quick access, curator sees like count increase

---

### User Story 3 - Collaborative Curation (Priority: P2)

As a **collaborator**, I want to **invite others to co-curate collections** so that we can **build comprehensive topic resources together**.

**Why this priority**: Enables team curation. Scales collection quality through collaboration. Important for large collections (50+ feeds) that require domain expertise.

**Independent Test**: Create collection "AI Safety Resources" → Invite 2 co-editors via email → Co-editor accepts invitation → Co-editor adds 5 feeds → View changelog → See who added what and when → Remove co-editor → Verify removed editor can no longer edit

**Acceptance Scenarios**:

1. **Given** collection owner invites user as co-editor, **When** invitation sent, **Then** invitee receives email with accept/decline links, invitation appears in invitee's notification center
2. **Given** co-editor accepts invitation, **When** views collection, **Then** sees "Edit" button (same permissions as owner except delete collection), can add/remove feeds, update description
3. **Given** multiple editors collaborate, **When** collection changelog viewed, **Then** shows chronological history: "Alice added 'Feed X' on Oct 22", "Bob removed 'Feed Y' on Oct 23", with reverting capability
4. **Given** collection has 3 co-editors, **When** owner removes co-editor, **Then** removed editor loses edit permissions (can still view if public), receives notification "You were removed from 'AI Safety Resources'"

---

### Edge Cases

- **What happens when collection name conflicts (duplicate name)?** → Allow duplicates (namespace by curator). Show "AI Research" by @alice vs "AI Research" by @bob.
- **How does system handle spam collections (low-quality, promotional)?** → Implement reporting mechanism. 3 reports trigger manual review. Automated spam detection: new account creating 10+ collections in 1 day = flag for review.
- **What happens when curator deletes account?** → Collections become orphaned. Options: (1) Transfer to co-editor if exists, (2) Archive publicly (read-only), (3) Delete after 30-day grace period.
- **How does system prevent collection hijacking?** → Only owner can delete collection or change ownership. Co-editors cannot remove owner. Transfer ownership requires email confirmation.
- **What happens when collection has 0 feeds?** → Allow empty collections (work in progress). Show "No feeds yet" message. Optionally hide from discovery page until ≥3 feeds added.
- **How does system handle OPML export with 1000+ feeds?** → Paginate export (max 500 feeds per OPML file). Show download links: "Part 1 (500 feeds)", "Part 2 (500 feeds)".
- **What happens when user follows 100+ collections?** → Implement pagination and search in "Followed Collections" list. Allow organizing into folders (Phase 4).
- **How does system calculate curator reputation score?** → Algorithm: (total_followers * 2) + (total_collection_likes * 1) + (verified_badge * 100) + (avg_collection_health_score * 50). Cap at 1000. Updated nightly.

---

## Requirements

### Functional Requirements - Collection Management

- **FR-001**: System MUST allow users to create collections with fields: name (required, max 100 chars), description (optional, max 500 chars), topics (multi-select from taxonomy), visibility (public/private/unlisted)
- **FR-002**: System MUST support adding feeds to collections: search interface, drag-and-drop from followed feeds, bulk import via OPML, add from collection detail page
- **FR-003**: System MUST allow reordering feeds within collection: drag-and-drop UI, numerical ordering input, "Move to top/bottom" shortcuts
- **FR-004**: System MUST support multi-collection membership: single feed can belong to multiple collections, show "In 5 collections" badge on feed detail page
- **FR-005**: System MUST provide collection settings: rename, change description, update topics, change visibility, transfer ownership, delete (with confirmation)
- **FR-006**: System MUST implement soft delete: deleted collections archived for 30 days (owner can restore), permanent delete after 30 days
- **FR-007**: System MUST generate shareable URLs: `/collections/{collection_id}` for public, `/collections/{collection_id}?key={access_key}` for unlisted
- **FR-008**: System MUST support OPML export: single-click download, includes collection metadata as OPML outline, compatible with Feedly/Inoreader/NewsBlur
- **FR-009**: System MUST track collection metadata: created_at, updated_at, feed_count, follower_count, like_count, view_count (public collections only)
- **FR-010**: System MUST display collection cards: thumbnail (auto-generated from feed logos), name, curator, follower/feed counts, topics, last updated

### Functional Requirements - Community Discovery

- **FR-011**: System MUST provide collections discovery page (`/collections`) with tabs: Trending (most followed this week), Popular (all-time followers), Recent (newest collections), Recommended (personalized)
- **FR-012**: System MUST implement search: search by name, description, curator, topic, with filters (min followers, min feeds, verification status, last updated)
- **FR-013**: System MUST rank trending collections: by follower growth rate (7-day window), weighted by curator reputation, boosted by recent activity (feed additions within 7 days)
- **FR-014**: System MUST provide topic filtering: sidebar with topic taxonomy, multi-select, show collection count per topic
- **FR-015**: System MUST display curator profiles: username, avatar, bio, reputation score, verified badge, collection count, total followers, join date
- **FR-016**: System MUST implement collection recommendations: "Users who followed X also followed Y", "Collections similar to Z" (based on feed overlap), "Popular in LLM" (topic-based)
- **FR-017**: System MUST support social interactions: Follow collection (subscribe to updates), Like collection (bookmark), Share collection (copy link, email, social media)
- **FR-018**: System MUST track user activity feed: "Alice created 'ML Resources'", "Bob followed 'AI Safety'", "Carol added 5 feeds to 'LLM Papers'" (privacy-respecting, opt-in)

### Functional Requirements - Collaborative Curation

- **FR-019**: System MUST support co-editor invitations: invite by username or email, pending/accepted/declined status, expiration after 7 days
- **FR-020**: System MUST implement permission levels: Owner (full control), Editor (add/remove feeds, update description), Viewer (read-only, for private collections)
- **FR-021**: System MUST provide collection changelog: chronological history, "Who added what when", revert capability (undo feed addition/removal)
- **FR-022**: System MUST support suggest feed additions: non-editors can suggest feeds (approval workflow), owner/editors see suggestions in pending list, approve/reject with comment
- **FR-023**: System MUST implement collection forking: "Fork this collection" creates copy under user's ownership, preserves attribution to original, tracks fork count
- **FR-024**: System MUST support merge requests: fork owner can propose changes to original (add/remove feeds), original owner reviews and approves/rejects, shows diff view
- **FR-025**: System MUST notify co-editors: when feed added/removed, when new editor invited, when collection settings changed, when suggestions pending review

### Functional Requirements - Quality & Moderation

- **FR-026**: System MUST implement curator reputation system: score based on followers, likes, collection health, verified badge, displayed as stars (1-5) or numerical (0-1000)
- **FR-027**: System MUST support verified curator badges: manual approval process, criteria (domain expert, active curator, high-quality collections), displayed with checkmark icon
- **FR-028**: System MUST calculate collection quality scores: based on feed health scores, curator reputation, update frequency, follower engagement (likes, follows)
- **FR-029**: System MUST implement reporting mechanism: report spam, low-quality, offensive content, inappropriate naming, impersonation, with report reason dropdown
- **FR-030**: System MUST provide moderation tools: moderator dashboard, review reported collections, suspend/ban users, hide collections, bulk actions
- **FR-031**: System MUST implement spam detection: rate limiting (max 5 collections/day for new users), keyword filtering (promotional terms), quality thresholds (min 3 feeds to publish)
- **FR-032**: System MUST support content policy enforcement: display policy link in footer, show warning on collection creation, automatic flagging based on heuristics

---

## Success Criteria

### Measurable Outcomes - Collection Creation

- **SC-001**: 20% of users create at least 1 public collection within first month
- **SC-002**: Collections have average 8-12 feeds (not too sparse, not overwhelming)
- **SC-003**: 60% of collections have ≥3 followers (indicates quality/relevance)
- **SC-004**: OPML export used by 15% of collection creators (portability valued)

### Measurable Outcomes - Community Discovery

- **SC-005**: 50% of users follow at least 1 community collection
- **SC-006**: Collections account for 30% of new feed follows (discovery channel effectiveness)
- **SC-007**: Collection discovery page has ≥5% click-through rate from homepage
- **SC-008**: Average user follows 3-5 collections (healthy engagement level)

### Measurable Outcomes - Collaboration

- **SC-009**: 10% of collections have ≥2 co-editors (collaborative curation adoption)
- **SC-010**: Feed suggestions acceptance rate ≥40% (community contributions valuable)
- **SC-011**: Collection forks account for 5% of new collections (building on existing work)
- **SC-012**: Curator retention rate ≥70% (active after 3 months)

### Business Metrics

- **SC-013**: Monthly active users increase by 25% (network effects)
- **SC-014**: User retention (Day 30) increases by 20% (community engagement)
- **SC-015**: Feed follows increase by 60% (collections drive discovery)
- **SC-016**: Platform NPS score increases by 15 points (community value)

---

## Database Architecture (SQLite)

**All data storage uses SQLite** (existing `data/aiwebfeeds.db` from Phase 1/2):

### SQLite Extensions & Features

- **JSON1 Extension**: Store collection metadata, feed lists, and co-editor permissions as JSON
- **FTS5**: Full-text search on collection names, descriptions, and curator profiles
- **Triggers**: Maintain denormalized follower counts and collection statistics
- **WAL Mode**: Write-Ahead Logging for concurrent access
- **Recursive CTEs**: Query collection hierarchies and fork lineage

### Phase 3C Tables (SQLite)

```sql
-- Store feed collections
CREATE TABLE collections (
    id TEXT PRIMARY KEY, -- UUID
    name TEXT NOT NULL,
    description TEXT,
    owner_user_id TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK(visibility IN ('public', 'private', 'unlisted')),
    topics TEXT, -- JSON array
    access_key TEXT UNIQUE, -- For unlisted collections
    feed_count INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    forked_from TEXT REFERENCES collections(id),
    fork_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_collections_owner ON collections(owner_user_id);
CREATE INDEX idx_collections_visibility ON collections(visibility);
CREATE INDEX idx_collections_created_at ON collections(created_at DESC);
CREATE INDEX idx_collections_follower_count ON collections(follower_count DESC);

-- Store collection feeds (many-to-many)
CREATE TABLE collection_feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    feed_id TEXT NOT NULL REFERENCES feeds(id),
    position INTEGER NOT NULL, -- For ordering
    added_by_user_id TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_id, feed_id)
);
CREATE INDEX idx_collection_feeds_collection ON collection_feeds(collection_id);
CREATE INDEX idx_collection_feeds_feed ON collection_feeds(feed_id);

-- Store collection collaborators
CREATE TABLE collection_collaborators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
    invited_by_user_id TEXT NOT NULL,
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    UNIQUE(collection_id, user_id)
);
CREATE INDEX idx_collection_collabs_collection ON collection_collaborators(collection_id);
CREATE INDEX idx_collection_collabs_user ON collection_collaborators(user_id);

-- Store collection followers
CREATE TABLE collection_followers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    followed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_id, user_id)
);
CREATE INDEX idx_collection_followers_collection ON collection_followers(collection_id);
CREATE INDEX idx_collection_followers_user ON collection_followers(user_id);

-- Store collection likes (bookmarks)
CREATE TABLE collection_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_id, user_id)
);
CREATE INDEX idx_collection_likes_collection ON collection_likes(collection_id);
CREATE INDEX idx_collection_likes_user ON collection_likes(user_id);

-- Store collection changelog
CREATE TABLE collection_changelog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('created', 'feed_added', 'feed_removed', 'updated', 'collaborator_added', 'collaborator_removed')),
    details TEXT, -- JSON: {feed_id, feed_name, old_value, new_value}
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_changelog_collection ON collection_changelog(collection_id);
CREATE INDEX idx_changelog_created_at ON collection_changelog(created_at DESC);

-- Store curator profiles
CREATE TABLE curator_profiles (
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    reputation_score INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    collection_count INTEGER DEFAULT 0,
    total_followers INTEGER DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_curator_reputation ON curator_profiles(reputation_score DESC);
CREATE INDEX idx_curator_username ON curator_profiles(username);

-- FTS5 virtual table for collection search
CREATE VIRTUAL TABLE collections_fts USING fts5(
    collection_id UNINDEXED,
    name,
    description,
    curator_username,
    topics
);

-- Triggers to maintain denormalized counts
CREATE TRIGGER update_collection_feed_count AFTER INSERT ON collection_feeds
BEGIN
    UPDATE collections SET feed_count = feed_count + 1 WHERE id = NEW.collection_id;
END;

CREATE TRIGGER update_collection_follower_count AFTER INSERT ON collection_followers
BEGIN
    UPDATE collections SET follower_count = follower_count + 1 WHERE id = NEW.collection_id;
END;

CREATE TRIGGER update_curator_total_followers AFTER INSERT ON collection_followers
BEGIN
    UPDATE curator_profiles 
    SET total_followers = (
        SELECT COUNT(*) 
        FROM collection_followers cf 
        JOIN collections c ON cf.collection_id = c.id 
        WHERE c.owner_user_id = curator_profiles.user_id
    )
    WHERE user_id = (SELECT owner_user_id FROM collections WHERE id = NEW.collection_id);
END;
```

**Scaling Considerations**:
- SQLite handles 100k collections with millions of relationships (tested)
- JSON1 extension provides flexible schema for evolving metadata
- FTS5 provides fast full-text search without external services
- Triggers automatically maintain computed fields (counts, scores)

---

## Out of Scope (Phase 3C)

1. **Comments on Collections**: User comments/reviews deferred to Phase 4. Like/follow interactions sufficient for MVP.
2. **User Messaging**: Direct messages between curators deferred. Use external email for collaboration in Phase 3C.
3. **Collection Analytics Dashboard**: View counts, click-through rates, follower demographics deferred. Basic metrics stored but not visualized.
4. **Collection Categories/Folders**: Organizing collections into user-defined categories deferred. Simple list view sufficient for MVP.
5. **Advanced Search**: Boolean operators, fuzzy matching, saved searches deferred. Simple keyword search sufficient.
6. **Collection Templates**: Pre-defined collection structures (e.g., "Research Papers Collection") deferred.
7. **Gamification**: Badges, achievements, leaderboards deferred to Phase 4.
8. **Collection Embedding**: Embed collections on external websites deferred.
9. **RSS Feed for Collections**: Auto-generated RSS feed per collection deferred.
10. **Automated Collection Updates**: AI-powered feed suggestions for collections deferred to Phase 3D.

---

**Next Steps**: Run `/speckit.clarify` to identify ambiguities, then `/speckit.plan` to generate technical implementation plan.
