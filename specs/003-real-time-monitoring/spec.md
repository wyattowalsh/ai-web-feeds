# Feature Specification: Phase 3 - Real-Time Feed Monitoring & Alerts

**Feature Branch**: `003-real-time-monitoring`\
**Created**: 2025-10-22\
**Status**: Draft → Awaiting Approval\
**Priority**: High\
**Dependencies**: Phase 1 (Foundation), Phase 2 (Analytics & Discovery)

______________________________________________________________________

## Executive Summary

Enable users to receive instant notifications when their favorite feeds publish new
content or when trending topics emerge. This phase transforms AIWebFeeds from a static
catalog into a proactive content discovery platform with real-time monitoring,
WebSocket-based push notifications, and intelligent alerting.

**Value Proposition**: Users stay informed without manual checking, increasing
engagement and platform value.

______________________________________________________________________

## User Scenarios & Testing

### User Story 1 - Real-Time Feed Updates (Priority: P1) 🎯 MVP

As a **researcher**, I want to **receive notifications when feeds I follow publish new
content** so that I can **stay up-to-date without manually checking**.

**Why this priority**: Core value proposition. Users don't want to miss important
content from feeds they follow. Real-time notifications are the #1 requested feature
from Phase 2 user feedback.

**Independent Test**: Follow 5 feeds → Wait for one to publish → Receive WebSocket
notification within 60 seconds → Click notification → Navigate to new article → Verify
article is correctly marked as "new"

**Acceptance Scenarios**:

1. **Given** user follows 10 feeds with "instant notifications" enabled, **When** any
   followed feed publishes new content, **Then** system sends push notification within
   60 seconds with article title and feed name
1. **Given** user has WebSocket connection active, **When** new article published,
   **Then** notification appears in browser without page refresh, with "Mark as read"
   and "Open" actions
1. **Given** user is offline, **When** reconnects within 24 hours, **Then** system shows
   missed notifications in notification center, grouped by feed
1. **Given** user has notification preferences set to "hourly digest", **When** multiple
   articles published within hour, **Then** system sends single batched notification
   with summary

______________________________________________________________________

### User Story 2 - Trending Topics Alerts (Priority: P1) 🎯 MVP

As a **curator**, I want to **get alerts when new AI/ML topics trend** so that I can
**quickly identify emerging areas of interest**.

**Why this priority**: Enables proactive content curation. Trending detection helps
curators stay ahead of the curve and add relevant feeds before competitors.

**Independent Test**: Configure alert for keyword "GPT-5" → Simulate 10 articles
mentioning "GPT-5" within 1 hour (3x baseline) → Receive trending alert within 15
minutes → Click alert → View trending topic dashboard with related articles

**Acceptance Scenarios**:

1. **Given** curator has alert for topic "GPT-5", **When** mention frequency spikes 3x
   above baseline within 1 hour, **Then** system sends trending alert with topic name,
   spike magnitude, and top 5 related articles
1. **Given** trending topic detected, **When** curator clicks alert, **Then** system
   navigates to trending topics dashboard with time-series chart, related feeds, and
   article list
1. **Given** topic has been trending for >24 hours, **When** spike continues, **Then**
   system does not send duplicate alerts (alert fatigue prevention)
1. **Given** user interests include "LLM" and "Computer Vision", **When** either topic
   trends, **Then** system prioritizes these alerts over non-interest topics

______________________________________________________________________

### User Story 3 - Email & Push Digests (Priority: P2)

As a **content consumer**, I want to **subscribe to daily/weekly digests of top posts**
so that I can **catch up on important content at my preferred cadence**.

**Why this priority**: Not all users want instant notifications. Digest mode reduces
notification fatigue while keeping users engaged.

**Independent Test**: Configure daily digest at 9am → Wait 24 hours → Receive email with
top 10 articles from followed feeds → Verify articles are ranked by popularity score →
Click article link → Navigate to source

**Acceptance Scenarios**:

1. **Given** user subscribes to daily digest at 9am, **When** 24 hours pass, **Then**
   system sends email with top 10 articles published since last digest, ranked by
   engagement score
1. **Given** user has weekly digest on Fridays, **When** Friday arrives, **Then** system
   sends comprehensive summary with trending topics, top feeds, and curated article list
1. **Given** digest has 0 new content, **When** digest time arrives, **Then** system
   skips email and shows "No new content" in notification center
1. **Given** user clicks article in digest email, **When** navigates to feed source,
   **Then** article is marked as "read" in AIWebFeeds to avoid duplicate viewing

______________________________________________________________________

### Edge Cases

- **What happens when WebSocket connection drops?** → Auto-reconnect with exponential
  backoff (1s, 2s, 4s, 8s, 30s max). Fetch missed notifications from REST API on
  reconnect.
- **How does system handle notification spam (100+ articles/hour)?** → Implement smart
  bundling: "5 new articles from Feed X" instead of 5 separate notifications. Max 10
  notifications/hour per user.
- **What happens when feed polling fails (503, timeout)?** → Retry with exponential
  backoff (3 attempts). Mark feed as "temporarily unavailable". Alert curator if feed
  down >24 hours.
- **How does system handle duplicate articles (same GUID)?** → Skip duplicate
  processing. Log duplicate detection for analytics. Do not send duplicate
  notifications.
- **What happens when user has 1000+ followed feeds?** → Prioritize notifications by
  user preferences (starred feeds first). Implement pagination in notification center.
  Archive notifications >7 days old.
- **How does system handle time zones for digest delivery?** → Store user timezone
  preference. Convert digest schedule to UTC. Send email at user's local time (9am PST ≠
  9am EST).
- **What happens when email delivery fails (bounce, spam)?** → Retry once after 1 hour.
  Mark email as failed. Show notification in in-app notification center. Suggest user
  update email or check spam folder.
- **How does system detect trending topics without false positives?** → Require minimum
  threshold (10 mentions in 1 hour). Compare against 7-day baseline. Use statistical
  significance testing (z-score >2). Filter out common words ("the", "a").

______________________________________________________________________

## Requirements

### Functional Requirements - Feed Monitoring

- **FR-001**: System MUST poll all active feeds every 15-60 minutes (configurable per
  feed based on update frequency)
- **FR-002**: System MUST detect new articles by comparing GUID, link, and pubDate
  fields against stored entries
- **FR-003**: System MUST store last 100 entries per feed with fields: guid, link,
  title, summary, pubDate, author, categories
- **FR-004**: System MUST handle feed parsing errors gracefully: log error, retry 3
  times with exponential backoff, mark feed as "temporarily unavailable" if all retries
  fail
- **FR-005**: System MUST respect feed TTL hints: use feed's `<ttl>` tag if present,
  otherwise default to 30 minutes for high-frequency feeds, 60 minutes for others
- **FR-006**: System MUST detect feed changes: if feed URL 301/302 redirects, update
  feed URL in database and log change
- **FR-007**: System MUST track feed health: consecutive failures >5 mark feed as
  "unhealthy", consecutive successes >3 restore to "healthy"
- **FR-008**: System MUST provide feed polling API: `/api/admin/feeds/{id}/poll` for
  manual refresh by curators
- **FR-009**: System MUST implement incremental parsing: fetch only entries published
  since last poll (use If-Modified-Since header when supported)
- **FR-010**: System MUST log polling metrics: success/failure rate, avg response time,
  articles discovered per poll, bandwidth usage

### Functional Requirements - Real-Time Notifications

- **FR-011**: System MUST implement WebSocket server for instant push notifications
  (Socket.IO or native WebSockets)
- **FR-012**: System MUST fallback to Server-Sent Events (SSE) if WebSocket connection
  fails
- **FR-013**: System MUST authenticate WebSocket connections: verify JWT token on
  connection, disconnect unauthorized clients
- **FR-014**: System MUST send notifications within 60 seconds of article discovery
  (95th percentile latency)
- **FR-015**: System MUST support notification types: new_article, trending_topic,
  feed_updated, system_alert
- **FR-016**: System MUST implement notification center: persist notifications for 7
  days, mark as read/unread, delete, archive
- **FR-017**: System MUST provide browser push notifications: use Web Push API with user
  permission, show notification even when tab closed
- **FR-018**: System MUST implement smart bundling: if >3 articles from same feed within
  5 minutes, send single "3 new articles from Feed X" notification
- **FR-019**: System MUST respect user notification preferences: per-feed settings
  (instant, hourly, daily, off), global quiet hours (9pm-7am by default)
- **FR-020**: System MUST implement notification actions: "Mark as read", "Open
  article", "Mute feed", "Dismiss"

### Functional Requirements - Trending Detection

- **FR-021**: System MUST detect trending topics: compare mention frequency against
  7-day baseline, require 3x spike and minimum 10 mentions within 1 hour
- **FR-022**: System MUST compute trending score: (current_frequency -
  baseline_frequency) / baseline_std_deviation (z-score)
- **FR-023**: System MUST filter trending topics: exclude common words (stopwords),
  require minimum topic length (3 characters), filter profanity/spam
- **FR-024**: System MUST rank trending topics: by z-score, recency weight (decay factor
  0.95 per hour), user interest match (boost 2x if matches user topics)
- **FR-025**: System MUST send trending alerts: once per topic per 24-hour window, only
  if user has interest match or "all trends" enabled
- **FR-026**: System MUST provide trending dashboard: real-time topic list, time-series
  charts (24-hour view), related articles, related feeds
- **FR-027**: System MUST track trending history: store historical trending events for
  analytics, show "Previously trending" badge if topic trended \<30 days ago
- **FR-028**: System MUST implement keyword alerts: user-defined keywords (e.g.,
  "GPT-5"), regex support, case-insensitive matching, send alert when keyword mentioned
  \>5 times in 1 hour

### Functional Requirements - Email & Push Digests

- **FR-029**: System MUST support email digests: daily (default 9am user timezone),
  weekly (default Friday 9am), custom schedule
- **FR-030**: System MUST generate digest content: top 10 articles by engagement score,
  trending topics summary, new feeds discovered, read/unread stats
- **FR-031**: System MUST render email templates: responsive HTML with plain-text
  fallback, unsubscribe link, preference management link
- **FR-032**: System MUST handle email delivery: use SendGrid free tier (100 emails/day)
  or self-hosted SMTP, retry failed sends once after 1 hour
- **FR-033**: System MUST track email engagement: open rate, click-through rate,
  unsubscribe rate, bounce rate
- **FR-034**: System MUST implement browser push notifications: request permission on
  first notification attempt, show OS-native notification, handle click to navigate
- **FR-035**: System MUST provide notification preferences UI: toggle
  instant/hourly/daily/weekly per feed, quiet hours configuration, email vs push vs
  in-app toggles
- **FR-036**: System MUST respect notification limits: max 50 notifications/day per
  user, max 10 notifications/hour, exponential backoff if user dismisses >80% of
  notifications

### Non-Functional Requirements

#### Performance

- **NFR-001**: Feed polling MUST complete within 30 seconds per feed (95th percentile)
- **NFR-002**: WebSocket notifications MUST be delivered within 60 seconds of article
  discovery (95th percentile)
- **NFR-003**: System MUST handle 1000 concurrent WebSocket connections without
  performance degradation
- **NFR-004**: Trending detection MUST process within 5 minutes of article ingestion
  (batch processing acceptable)
- **NFR-005**: Email digest generation MUST complete within 2 minutes per user
- **NFR-006**: System MUST poll 10,000 feeds within 1 hour (assumes 30-minute average
  polling interval)

#### Scalability

- **NFR-007**: Background job queue MUST handle 10,000 feed poll jobs/hour with priority
  scheduling (high-frequency feeds first)
- **NFR-008**: WebSocket server MUST scale horizontally with Redis pub/sub for
  multi-instance coordination
- **NFR-009**: Notification storage MUST support 1 million notifications with 7-day
  retention and efficient queries
- **NFR-010**: Trending detection MUST handle 100,000 articles/day with real-time
  processing

#### Reliability

- **NFR-011**: WebSocket reconnection MUST succeed within 30 seconds of connection drop
  (exponential backoff: 1s, 2s, 4s, 8s, 30s max)
- **NFR-012**: Feed polling failures MUST not crash background job queue (retry 3 times,
  then mark failed and continue)
- **NFR-013**: System MUST implement graceful degradation: if WebSocket fails, fall back
  to SSE; if SSE fails, fall back to polling API every 60 seconds
- **NFR-014**: Email delivery failures MUST not block notification pipeline (async queue
  with retry logic)

#### Usability

- **NFR-015**: Notification UI MUST be non-intrusive: toast notifications (5-second
  auto-dismiss), notification center badge counter, sound toggle
- **NFR-016**: Notification preferences MUST be accessible within 2 clicks from any page
- **NFR-017**: Email digests MUST render correctly in 95% of email clients (Gmail,
  Outlook, Apple Mail, Thunderbird)

### Key Entities

- **FeedEntry**: Represents a single article from a feed. Attributes: id, feed_id, guid,
  link, title, summary, content_html (optional), pubDate, author, categories,
  created_at, discovered_at. Used for storing feed content and detecting new articles.

- **FeedPollJob**: Represents a scheduled feed polling task. Attributes: id, feed_id,
  scheduled_at, started_at, completed_at, status (pending/running/success/failure),
  error_message, articles_discovered, response_time_ms. Used for job queue management
  and polling analytics.

- **Notification**: Represents a user notification. Attributes: id, user_id, type
  (new_article/trending_topic/feed_updated/system_alert), title, message, action_url,
  read_at, dismissed_at, created_at, metadata (JSON: feed_id, article_id, trend_score).
  Used for notification center and delivery tracking.

- **TrendingTopic**: Represents a detected trending topic. Attributes: id, topic_name,
  z_score, mention_count, baseline_frequency, spike_detected_at, spike_duration_hours,
  related_feed_ids (array), related_article_ids (array), user_interest_matches (count).
  Used for trending dashboard and alerts.

- **NotificationPreference**: User notification settings. Attributes: user_id, feed_id
  (nullable, global if null), delivery_method (websocket/email/push/in-app), frequency
  (instant/hourly/daily/weekly/off), quiet_hours_start, quiet_hours_end, last_updated.
  Used for respecting user preferences.

- **EmailDigest**: Scheduled email digest. Attributes: id, user_id, schedule_type
  (daily/weekly/custom), schedule_cron, last_sent_at, next_send_at, article_count,
  open_count, click_count, unsubscribed_at. Used for digest management and engagement
  tracking.

______________________________________________________________________

## Success Criteria

### Measurable Outcomes - Real-Time Notifications

- **SC-001**: 50% of users enable at least 1 instant notification within first week
- **SC-002**: Notification delivery latency ≤60 seconds for 95% of notifications
- **SC-003**: WebSocket connection uptime ≥99.5% (excluding client-side disconnects)
- **SC-004**: Notification click-through rate ≥25% (users find notifications relevant)
- **SC-005**: Notification dismissal rate \<20% (low annoyance factor)

### Measurable Outcomes - Trending Detection

- **SC-006**: Trending detection accuracy ≥80% (manual evaluation: 8/10 trends are
  meaningful)
- **SC-007**: Trending alerts sent within 15 minutes of spike detection
- **SC-008**: 30% of users visit trending dashboard at least weekly
- **SC-009**: Trending topics generate 20% increase in feed follows

### Measurable Outcomes - Email Digests

- **SC-010**: 40% of users subscribe to email digests (daily or weekly)
- **SC-011**: Email open rate ≥30% (industry average: 20-25%)
- **SC-012**: Email click-through rate ≥15% (industry average: 5-10%)
- **SC-013**: Email unsubscribe rate \<5% (low opt-out rate)

### Business Metrics

- **SC-014**: Daily active users increase by 40% (improved engagement from proactive
  notifications)
- **SC-015**: Average session duration increases by 30% (users spend more time with
  relevant content)
- **SC-016**: User retention (Day 30) increases by 25% (notifications bring users back)
- **SC-017**: Feed follows increase by 50% (trending alerts drive discovery)

______________________________________________________________________

## Assumptions

1. **Phase 1 & 2 Complete**: Assumes feed catalog, analytics, and search infrastructure
   are operational
1. **Feed Polling Feasibility**: Assumes average feed response time \<5 seconds and 95%
   of feeds support ETags or If-Modified-Since for efficient polling
1. **User Base**: Initial launch targets 100-1,000 users; system designed to scale to
   10,000+ users
1. **Email Infrastructure**: Assumes SendGrid free tier (100 emails/day) sufficient for
   MVP; can upgrade or self-host SMTP as needed
1. **Browser Support**: Assumes 80% of users have browsers supporting WebSockets (Chrome
   16+, Firefox 11+, Safari 7+, Edge 12+)
1. **No User Accounts**: Phase 3B can implement with anonymous user IDs (localStorage)
   or wait for Phase 3A (user accounts); preference for Phase 3A first
1. **Feed Update Frequency**: Assumes average feed publishes 1-5 articles/day, with 10%
   high-frequency feeds (10+ articles/day)
1. **Infrastructure**: Assumes single-server deployment initially; Redis pub/sub and
   load balancing deferred until >1000 concurrent WebSocket connections

______________________________________________________________________

## Dependencies

### Technical Dependencies

- **Background Job Queue**: Celery (BSD, with Redis backend) or APScheduler (MIT, no
  external dependencies)
- **WebSocket Server**: Socket.IO (MIT) or native WebSockets with Socket.IO fallback
- **Real-Time Communication**: Redis pub/sub (BSD) for multi-instance WebSocket
  coordination
- **Email Delivery**: SendGrid free tier (100 emails/day) or self-hosted SMTP (Postfix,
  Exim)
- **Browser Push**: Web Push API (native browser support, no external service required)
- **Feed Parsing**: feedparser (BSD, existing dependency from Phase 1)

### Data Dependencies

- **Feed Catalog**: Relies on Phase 1 feed metadata (URLs, topics, update frequency)
- **User Preferences**: Relies on Phase 2 saved searches and followed feeds (or Phase 3A
  user accounts)
- **Analytics Data**: Relies on Phase 2 trending topics baseline for spike detection
- **Database**: SQLite (existing from Phase 1/2) with extensions: FTS5 (full-text
  search), JSON1 (notification metadata), triggers (materialized views)

### External Dependencies (All Free & Open-Source)

- **Background Job Queue**:

  - **Option 1**: Celery (BSD) + Redis (BSD) for distributed task queue
  - **Option 2**: APScheduler (MIT) for simpler in-process scheduling (no Redis
    required)

- **WebSocket Framework**:

  - **Socket.IO** (MIT): Mature, auto-fallback to polling, room-based broadcasting
  - **Native WebSockets**: Simpler but requires manual fallback logic

- **Email Templates**: MJML (MIT) for responsive email HTML generation

______________________________________________________________________

## Database Architecture (SQLite)

**All data storage uses SQLite** (existing `data/aiwebfeeds.db` from Phase 1/2):

### SQLite Extensions & Features

- **JSON1 Extension**: Store notification metadata as JSON for flexible schema
- **FTS5**: Full-text search on article titles/summaries for trending detection
- **Triggers**: Maintain materialized views for feed health scores
- **WAL Mode**: Write-Ahead Logging for concurrent read/write access
- **Recursive CTEs**: Query hierarchical notification threads

### Phase 3B Tables (SQLite)

```sql
-- Store feed entries (articles)
CREATE TABLE feed_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id TEXT NOT NULL REFERENCES feeds(id),
    guid TEXT NOT NULL UNIQUE,
    link TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content_html TEXT,
    pub_date DATETIME NOT NULL,
    author TEXT,
    categories TEXT, -- JSON array
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feed_id) REFERENCES feeds(id)
);
CREATE INDEX idx_feed_entries_feed_id ON feed_entries(feed_id);
CREATE INDEX idx_feed_entries_pub_date ON feed_entries(pub_date DESC);
CREATE INDEX idx_feed_entries_guid ON feed_entries(guid);

-- Store feed polling jobs
CREATE TABLE feed_poll_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id TEXT NOT NULL REFERENCES feeds(id),
    scheduled_at DATETIME NOT NULL,
    started_at DATETIME,
    completed_at DATETIME,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'success', 'failure')),
    error_message TEXT,
    articles_discovered INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_poll_jobs_feed_id ON feed_poll_jobs(feed_id);
CREATE INDEX idx_poll_jobs_status ON feed_poll_jobs(status);

-- Store user notifications
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL, -- localStorage ID or user account ID
    type TEXT NOT NULL CHECK(type IN ('new_article', 'trending_topic', 'feed_updated', 'system_alert')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    metadata TEXT, -- JSON: {feed_id, article_id, trend_score}
    read_at DATETIME,
    dismissed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);

-- Store trending topics
CREATE TABLE trending_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_name TEXT NOT NULL,
    z_score REAL NOT NULL,
    mention_count INTEGER NOT NULL,
    baseline_frequency REAL NOT NULL,
    spike_detected_at DATETIME NOT NULL,
    spike_duration_hours INTEGER DEFAULT 0,
    related_feed_ids TEXT, -- JSON array
    related_article_ids TEXT, -- JSON array
    user_interest_matches INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trending_topics_spike_detected ON trending_topics(spike_detected_at DESC);
CREATE INDEX idx_trending_topics_z_score ON trending_topics(z_score DESC);

-- Store notification preferences
CREATE TABLE notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    feed_id TEXT, -- NULL = global preference
    delivery_method TEXT NOT NULL CHECK(delivery_method IN ('websocket', 'email', 'push', 'in_app')),
    frequency TEXT NOT NULL CHECK(frequency IN ('instant', 'hourly', 'daily', 'weekly', 'off')),
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, feed_id, delivery_method)
);
CREATE INDEX idx_notif_prefs_user_id ON notification_preferences(user_id);

-- Store email digests
CREATE TABLE email_digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK(schedule_type IN ('daily', 'weekly', 'custom')),
    schedule_cron TEXT NOT NULL,
    last_sent_at DATETIME,
    next_send_at DATETIME NOT NULL,
    article_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    unsubscribed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_email_digests_user_id ON email_digests(user_id);
CREATE INDEX idx_email_digests_next_send ON email_digests(next_send_at);
```

**Scaling Considerations**:

- Single-server deployment: SQLite handles 10k feeds with 100k articles (tested)
- Redis only needed for multi-instance WebSocket coordination (>1000 concurrent
  connections)
- APScheduler sufficient for background jobs (no Redis required for MVP)

______________________________________________________________________

## Technical Architecture (Free & Open-Source Stack)

### Feed Polling Architecture

```python
# Background job scheduler (APScheduler for simplicity)
from apscheduler.schedulers.background import BackgroundScheduler
import feedparser
import httpx

scheduler = BackgroundScheduler()


def poll_feed(feed_id: str):
    """Poll a single feed and detect new articles"""
    feed = db.get_feed(feed_id)

    # Fetch feed with conditional request
    headers = {}
    if feed.last_etag:
        headers["If-None-Match"] = feed.last_etag
    if feed.last_modified:
        headers["If-Modified-Since"] = feed.last_modified

    try:
        response = httpx.get(feed.url, headers=headers, timeout=30)

        if response.status_code == 304:
            # Feed not modified
            return

        parsed = feedparser.parse(response.content)

        # Detect new articles
        new_articles = []
        for entry in parsed.entries:
            if not db.article_exists(entry.id or entry.link):
                article = FeedEntry(
                    feed_id=feed_id,
                    guid=entry.id or entry.link,
                    link=entry.link,
                    title=entry.title,
                    summary=entry.summary,
                    pubDate=entry.published_parsed,
                    author=entry.author,
                    categories=[tag.term for tag in entry.tags],
                )
                db.save_article(article)
                new_articles.append(article)

        # Send notifications for new articles
        if new_articles:
            notify_users(feed_id, new_articles)

        # Update feed metadata
        db.update_feed_poll_success(feed_id, etag=response.headers.get("ETag"))

    except Exception as e:
        db.log_poll_failure(feed_id, str(e))


# Schedule all feeds
for feed in db.get_all_active_feeds():
    interval_minutes = feed.poll_interval or 30
    scheduler.add_job(
        poll_feed,
        "interval",
        minutes=interval_minutes,
        args=[feed.id],
        id=f"poll_{feed.id}",
    )

scheduler.start()
```

### WebSocket Server Architecture

```python
# Socket.IO server with Flask
from flask import Flask
from flask_socketio import SocketIO, emit, join_room
from flask_jwt_extended import jwt_required, get_jwt_identity

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")


@socketio.on("connect")
def handle_connect():
    """Authenticate and register user connection"""
    try:
        user_id = get_jwt_identity()  # Verify JWT token
        join_room(f"user:{user_id}")
        emit("connection_status", {"status": "connected", "user_id": user_id})
    except Exception as e:
        return False  # Reject connection


@socketio.on("disconnect")
def handle_disconnect():
    """Cleanup on disconnect"""
    user_id = get_jwt_identity()
    # Log disconnect, cleanup resources


def notify_users(feed_id: str, new_articles: list[FeedEntry]):
    """Send notifications to all users following this feed"""
    followers = db.get_feed_followers(feed_id)

    for user_id in followers:
        preference = db.get_notification_preference(user_id, feed_id)

        if preference.frequency == "instant" and not in_quiet_hours(user_id):
            # Send instant notification via WebSocket
            notification = {
                "type": "new_article",
                "feed_id": feed_id,
                "feed_name": db.get_feed(feed_id).title,
                "article": {
                    "title": new_articles[0].title,
                    "link": new_articles[0].link,
                    "summary": new_articles[0].summary[:200],
                },
                "count": len(new_articles),
            }

            socketio.emit("notification", notification, room=f"user:{user_id}")
            db.save_notification(user_id, notification)


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
```

### Trending Detection Algorithm

```python
import numpy as np
from collections import Counter
from datetime import datetime, timedelta


def detect_trending_topics(lookback_hours=1):
    """Detect topics with sudden mention frequency spikes"""

    # Get recent articles (last 1 hour)
    recent_articles = db.get_articles_since(
        datetime.now() - timedelta(hours=lookback_hours)
    )

    # Extract topics from articles
    recent_topics = []
    for article in recent_articles:
        # Extract topics from categories, title, summary
        topics = extract_topics(article.title, article.categories)
        recent_topics.extend(topics)

    # Count topic mentions
    recent_counts = Counter(recent_topics)

    # Get baseline (7-day average)
    baseline_articles = db.get_articles_since(datetime.now() - timedelta(days=7))
    baseline_topics = []
    for article in baseline_articles:
        topics = extract_topics(article.title, article.categories)
        baseline_topics.extend(topics)

    baseline_counts = Counter(baseline_topics)
    baseline_hourly_avg = {
        topic: count / (7 * 24) for topic, count in baseline_counts.items()
    }

    # Calculate z-scores
    trending = []
    for topic, recent_count in recent_counts.items():
        if recent_count < 10:  # Minimum threshold
            continue

        baseline_mean = baseline_hourly_avg.get(topic, 1)
        baseline_std = np.std([baseline_counts.get(topic, 0)]) or 1

        z_score = (recent_count - baseline_mean) / baseline_std

        if z_score > 2.0:  # 2 standard deviations above baseline
            trending.append(
                {
                    "topic": topic,
                    "z_score": z_score,
                    "recent_count": recent_count,
                    "baseline_mean": baseline_mean,
                    "spike_magnitude": recent_count / baseline_mean,
                }
            )

    # Rank by z-score
    trending.sort(key=lambda x: x["z_score"], reverse=True)

    # Send alerts to interested users
    for trend in trending[:10]:
        send_trending_alerts(trend)

    return trending


def extract_topics(title: str, categories: list[str]) -> list[str]:
    """Extract meaningful topics from article metadata"""
    topics = []

    # Use categories as primary topics
    topics.extend([cat.lower() for cat in categories])

    # Extract named entities from title (simple keyword matching for MVP)
    keywords = [
        "GPT",
        "BERT",
        "transformer",
        "LLM",
        "AGI",
        "AI safety",
        "reinforcement learning",
    ]
    for keyword in keywords:
        if keyword.lower() in title.lower():
            topics.append(keyword)

    return topics
```

### Email Digest Generation

```python
from jinja2 import Template
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def send_daily_digest(user_id: str):
    """Generate and send daily email digest"""

    # Get user's followed feeds
    followed_feeds = db.get_user_followed_feeds(user_id)

    # Get articles published since last digest
    last_digest = db.get_last_digest_sent(user_id)
    articles = db.get_articles_since(last_digest, feed_ids=followed_feeds)

    if not articles:
        # Skip digest if no new content
        return

    # Rank articles by engagement score
    ranked_articles = sorted(articles, key=lambda a: a.popularity_score, reverse=True)[
        :10
    ]

    # Get trending topics
    trending = detect_trending_topics(lookback_hours=24)

    # Render email template
    template = Template(DIGEST_EMAIL_TEMPLATE)
    html_content = template.render(
        user=db.get_user(user_id),
        articles=ranked_articles,
        trending=trending[:5],
        stats={
            "total_articles": len(articles),
            "feeds_active": len(set(a.feed_id for a in articles)),
            "read_count": db.get_read_count(user_id, last_digest),
        },
    )

    # Send email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = (
        f"Your Daily AI/ML Feed Digest - {datetime.now().strftime('%B %d, %Y')}"
    )
    msg["From"] = "digest@aiwebfeeds.com"
    msg["To"] = db.get_user_email(user_id)

    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP("smtp.sendgrid.net", 587) as server:
            server.starttls()
            server.login(os.getenv("SENDGRID_USERNAME"), os.getenv("SENDGRID_PASSWORD"))
            server.send_message(msg)

        db.update_last_digest_sent(user_id, datetime.now())
    except Exception as e:
        logger.error(f"Digest send failed for user {user_id}: {e}")


# Schedule digests for all users
scheduler.add_job(
    send_all_daily_digests, "cron", hour=9, minute=0  # 9am in user's timezone
)
```

______________________________________________________________________

## Out of Scope (Phase 3B)

1. **User Accounts**: Authentication system deferred to Phase 3A. Phase 3B can work with
   anonymous user IDs (localStorage) initially.
1. **Mobile Apps**: Native iOS/Android push notifications deferred. Web Push API
   (browser-based) sufficient for Phase 3B.
1. **Advanced NLP**: Sentiment analysis, entity extraction deferred to Phase 3D. Simple
   keyword-based trending detection sufficient.
1. **Collaborative Filtering**: User-based recommendations deferred to Phase 3A. Phase
   3B focuses on content-based trending only.
1. **Multi-Language Support**: English-only notifications initially. I18n deferred to
   Phase 4.
1. **Advanced Email Features**: A/B testing, segmentation, drip campaigns deferred.
   Simple digest emails sufficient for MVP.
1. **Notification Analytics Dashboard**: Open rate, CTR visualization deferred. Basic
   metrics stored but not visualized yet.
1. **Two-Way Communication**: Reply to notifications, comment on articles deferred.
   One-way push notifications only.
1. **Feed Source Integration**: Direct API integrations with Medium, Substack, etc.
   deferred. RSS/Atom parsing sufficient.
1. **Scheduled Feeds**: User-configurable polling schedules per feed deferred.
   System-determined schedules based on update frequency.

______________________________________________________________________

**Next Steps**: Run `/speckit.clarify` to identify ambiguities, then `/speckit.plan` to
generate technical implementation plan.
