# Data Model: Phase 3B - Real-Time Feed Monitoring & Alerts

**Feature Branch**: `003-real-time-monitoring`\
**Created**: 2025-10-22\
**Status**: Design Complete

______________________________________________________________________

## Overview

This document defines the complete data model for Phase 3B features: Feed Monitoring,
Real-Time Notifications, Trending Topics, and Email Digests. All entities use SQLModel
for type-safe database interactions and Pydantic v2 for validation.

**Database**: SQLite (`data/aiwebfeeds.db`) with JSON1, FTS5, triggers, and WAL mode

______________________________________________________________________

## Entity Relationship Diagram

```
┌──────────────┐       ┌─────────────────┐       ┌──────────────────┐
│   Feeds      │──────<│  FeedEntries   │>──────│  Notifications   │
│  (Phase 1)   │       │  (articles)     │       │  (user alerts)   │
└──────────────┘       └─────────────────┘       └──────────────────┘
       │                       │                          │
       │                       │                          │
       ▼                       ▼                          ▼
┌──────────────┐       ┌─────────────────┐       ┌──────────────────┐
│ FeedPollJobs │       │ TrendingTopics  │       │ NotificationPrefs│
│ (scheduling) │       │ (spike detect)  │       │ (user settings)  │
└──────────────┘       └─────────────────┘       └──────────────────┘
                                                         │
                                                         │
                                                         ▼
                                                  ┌──────────────────┐
                                                  │  EmailDigests    │
                                                  │ (subscriptions)  │
                                                  └──────────────────┘
```

______________________________________________________________________

## Core Entities (Phase 3B)

### 1. FeedEntry (Article)

**Purpose**: Stores discovered articles from feed polling for notification and trending
detection.

**SQLModel Schema**:

```python
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional


class FeedEntry(SQLModel, table=True):
    """Individual article entry from a feed"""

    __tablename__ = "feed_entries"

    id: Optional[int] = Field(default=None, primary_key=True)
    feed_id: str = Field(foreign_key="feeds.id", index=True)
    guid: str = Field(unique=True, index=True)  # RSS/Atom unique identifier
    link: str = Field(max_length=2048)
    title: str = Field(max_length=512)
    summary: Optional[str] = Field(default=None)
    content_html: Optional[str] = Field(
        default=None
    )  # Full article content if available
    pub_date: datetime = Field(index=True)
    author: Optional[str] = Field(default=None, max_length=255)
    categories: Optional[str] = Field(
        default=None
    )  # JSON array: ["LLM", "Computer Vision"]
    discovered_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    feed: Optional["Feed"] = Relationship(back_populates="entries")  # From Phase 1
    notifications: list["Notification"] = Relationship(back_populates="article")


class FeedEntryCreate(SQLModel):
    """Pydantic model for creating feed entries"""

    feed_id: str
    guid: str
    link: str
    title: str
    summary: Optional[str] = None
    content_html: Optional[str] = None
    pub_date: datetime
    author: Optional[str] = None
    categories: list[str] = []


class FeedEntryPublic(SQLModel):
    """Public-facing feed entry (API response)"""

    id: int
    feed_id: str
    title: str
    link: str
    summary: Optional[str]
    pub_date: datetime
    author: Optional[str]
    categories: list[str]
```

**Validation Rules**:

- `guid` MUST be unique (enforced by database UNIQUE constraint)
- `link` MUST be valid URL (validated by Pydantic HttpUrl)
- `pub_date` MUST be in UTC
- `categories` MUST be valid JSON array when stored

**State Transitions**: None (immutable after creation)

**Indexes**:

- Primary key on `id`
- Unique index on `guid`
- Index on `feed_id` (foreign key)
- Index on `pub_date DESC` (time-series queries)

______________________________________________________________________

### 2. FeedPollJob

**Purpose**: Tracks scheduled and completed feed polling jobs for monitoring and
debugging.

**SQLModel Schema**:

```python
from enum import Enum


class PollStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILURE = "failure"


class FeedPollJob(SQLModel, table=True):
    """Feed polling job tracking"""

    __tablename__ = "feed_poll_jobs"

    id: Optional[int] = Field(default=None, primary_key=True)
    feed_id: str = Field(foreign_key="feeds.id", index=True)
    scheduled_at: datetime = Field(index=True)
    started_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)
    status: PollStatus = Field(default=PollStatus.PENDING, index=True)
    error_message: Optional[str] = Field(default=None)
    articles_discovered: int = Field(default=0)
    response_time_ms: Optional[int] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    feed: Optional["Feed"] = Relationship(back_populates="poll_jobs")


class FeedPollJobCreate(SQLModel):
    feed_id: str
    scheduled_at: datetime


class FeedPollJobUpdate(SQLModel):
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: Optional[PollStatus] = None
    error_message: Optional[str] = None
    articles_discovered: Optional[int] = None
    response_time_ms: Optional[int] = None
```

**Validation Rules**:

- `scheduled_at` < `started_at` < `completed_at` (temporal ordering)
- `status` MUST be one of: pending, running, success, failure
- `articles_discovered` MUST be ≥0
- `response_time_ms` MUST be >0 if status=success

**State Transitions**:

```
pending → running → (success | failure)
```

**Indexes**:

- Primary key on `id`
- Index on `feed_id` (foreign key)
- Index on `scheduled_at DESC` (job queue queries)
- Index on `status` (filter pending/running jobs)

______________________________________________________________________

### 3. Notification

**Purpose**: Stores user notifications for WebSocket delivery and in-app notification
center.

**SQLModel Schema**:

```python
class NotificationType(str, Enum):
    NEW_ARTICLE = "new_article"
    TRENDING_TOPIC = "trending_topic"
    FEED_UPDATED = "feed_updated"
    SYSTEM_ALERT = "system_alert"


class Notification(SQLModel, table=True):
    """User notification"""

    __tablename__ = "notifications"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # localStorage UUID
    type: NotificationType = Field(index=True)
    title: str = Field(max_length=255)
    message: str = Field(max_length=1000)
    action_url: Optional[str] = Field(default=None, max_length=2048)
    metadata: Optional[str] = Field(
        default=None
    )  # JSON: {feed_id, article_id, trend_score}
    read_at: Optional[datetime] = Field(default=None)
    dismissed_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    # Relationships
    article: Optional[FeedEntry] = Relationship(back_populates="notifications")


class NotificationCreate(SQLModel):
    user_id: str
    type: NotificationType
    title: str
    message: str
    action_url: Optional[str] = None
    metadata: dict = {}


class NotificationPublic(SQLModel):
    """Public-facing notification (WebSocket/API response)"""

    id: int
    type: NotificationType
    title: str
    message: str
    action_url: Optional[str]
    metadata: dict
    read: bool  # Derived from read_at is not None
    created_at: datetime
```

**Validation Rules**:

- `user_id` MUST be valid UUID (localStorage format)
- `type` MUST be one of: new_article, trending_topic, feed_updated, system_alert
- `title` MUST be ≤255 characters
- `message` MUST be ≤1000 characters
- `metadata` MUST be valid JSON when stored
- `read_at` and `dismissed_at` MUST be ≥created_at

**State Transitions**:

```
created → (read | dismissed)
```

**Retention**: Hard delete after 7 days (automated cleanup job)

**Indexes**:

- Primary key on `id`
- Index on `user_id` (user-specific queries)
- Index on `created_at DESC` (chronological display)
- Index on `type` (filter by notification type)

______________________________________________________________________

### 4. TrendingTopic

**Purpose**: Stores detected trending topics with z-score and related metadata for
alerts.

**SQLModel Schema**:

```python
class TrendingTopic(SQLModel, table=True):
    """Detected trending topic (z-score ≥2)"""

    __tablename__ = "trending_topics"

    id: Optional[int] = Field(default=None, primary_key=True)
    topic_name: str = Field(max_length=100)
    z_score: float = Field(ge=2.0)  # Minimum z-score of 2
    mention_count: int = Field(ge=10)  # Minimum 10 mentions
    baseline_frequency: float = Field(ge=0.0)
    spike_detected_at: datetime = Field(index=True)
    spike_duration_hours: int = Field(default=0, ge=0)
    related_feed_ids: Optional[str] = Field(default=None)  # JSON array
    related_article_ids: Optional[str] = Field(default=None)  # JSON array
    user_interest_matches: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TrendingTopicCreate(SQLModel):
    topic_name: str
    z_score: float
    mention_count: int
    baseline_frequency: float
    spike_detected_at: datetime
    related_feed_ids: list[str] = []
    related_article_ids: list[int] = []


class TrendingTopicPublic(SQLModel):
    """Public-facing trending topic"""

    id: int
    topic_name: str
    z_score: float
    mention_count: int
    spike_magnitude: float  # Derived: mention_count / baseline_frequency
    spike_detected_at: datetime
    related_feeds: list[str]  # Parsed from JSON
    related_articles: list[int]  # Parsed from JSON
```

**Validation Rules**:

- `z_score` MUST be ≥2.0 (2 standard deviations above baseline)
- `mention_count` MUST be ≥10 (minimum threshold)
- `baseline_frequency` MUST be >0
- `related_feed_ids` and `related_article_ids` MUST be valid JSON arrays

**Deduplication**: Only send alerts once per topic per 24-hour window

**Indexes**:

- Primary key on `id`
- Index on `spike_detected_at DESC` (chronological display)
- Index on `z_score DESC` (sort by significance)

______________________________________________________________________

### 5. NotificationPreference

**Purpose**: Stores user notification settings (frequency, delivery method, quiet
hours).

**SQLModel Schema**:

```python
class DeliveryMethod(str, Enum):
    WEBSOCKET = "websocket"
    EMAIL = "email"
    PUSH = "push"  # Browser Push API (deferred to Phase 4)
    IN_APP = "in_app"


class Frequency(str, Enum):
    INSTANT = "instant"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    OFF = "off"


class NotificationPreference(SQLModel, table=True):
    """User notification preferences"""

    __tablename__ = "notification_preferences"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    feed_id: Optional[str] = Field(
        default=None, foreign_key="feeds.id"
    )  # NULL = global
    delivery_method: DeliveryMethod
    frequency: Frequency
    quiet_hours_start: Optional[str] = Field(default=None)  # TIME format: "22:00"
    quiet_hours_end: Optional[str] = Field(default=None)  # TIME format: "07:00"
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            "user_id", "feed_id", "delivery_method", name="unique_user_feed_method"
        ),
    )


class NotificationPreferenceCreate(SQLModel):
    user_id: str
    feed_id: Optional[str] = None
    delivery_method: DeliveryMethod
    frequency: Frequency
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None


class NotificationPreferencePublic(SQLModel):
    id: int
    feed_id: Optional[str]
    delivery_method: DeliveryMethod
    frequency: Frequency
    quiet_hours_start: Optional[str]
    quiet_hours_end: Optional[str]
```

**Validation Rules**:

- `user_id` MUST be valid UUID
- `feed_id` MUST exist in feeds table (if not NULL)
- `delivery_method` MUST be one of: websocket, email, push, in_app
- `frequency` MUST be one of: instant, hourly, daily, weekly, off
- `quiet_hours_start` and `quiet_hours_end` MUST be valid TIME format (HH:MM)
- UNIQUE constraint on (user_id, feed_id, delivery_method)

**Defaults**: If no preference exists, use global defaults (instant, websocket)

**Indexes**:

- Primary key on `id`
- Index on `user_id` (user-specific queries)
- Unique index on (user_id, feed_id, delivery_method)

______________________________________________________________________

### 6. UserFeedFollow

**Purpose**: Stores which feeds a user follows for notification targeting and
personalization.

**SQLModel Schema**:

```python
class UserFeedFollow(SQLModel, table=True):
    """User feed follow relationship"""

    __tablename__ = "user_feed_follows"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)  # localStorage UUID
    feed_id: str = Field(foreign_key="feeds.id", index=True)
    followed_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    feed: Optional["Feed"] = Relationship(back_populates="followers")

    __table_args__ = (UniqueConstraint("user_id", "feed_id", name="unique_user_feed"),)


class UserFeedFollowCreate(SQLModel):
    """Create follow relationship"""

    user_id: str
    feed_id: str


class UserFeedFollowPublic(SQLModel):
    """Public-facing follow relationship"""

    id: int
    feed_id: str
    followed_at: datetime
```

**Validation Rules**:

- `user_id` MUST be valid UUID (localStorage format)
- `feed_id` MUST exist in feeds table (foreign key constraint)
- UNIQUE constraint on (user_id, feed_id) prevents duplicate follows
- `followed_at` MUST be ≥feed.created_at

**Usage**:

- **Follow Feed**: Insert new row, auto-create default NotificationPreference (instant,
  websocket)
- **Unfollow Feed**: Delete row, optionally delete associated NotificationPreferences
- **Get Followers**: Query all user_ids for given feed_id (for notification targeting)
- **Get User Follows**: Query all feed_ids for given user_id (for digest generation)

**Indexes**:

- Primary key on `id`
- Index on `user_id` (user's followed feeds)
- Index on `feed_id` (feed's followers)
- Unique index on (user_id, feed_id)

______________________________________________________________________

### 7. EmailDigest

**Purpose**: Stores email digest subscriptions and engagement tracking.

**SQLModel Schema**:

```python
class ScheduleType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    CUSTOM = "custom"


class EmailDigest(SQLModel, table=True):
    """Email digest subscription"""

    __tablename__ = "email_digests"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    email: str = Field(max_length=255)
    schedule_type: ScheduleType
    schedule_cron: str = Field(max_length=50)  # Cron expression: "0 9 * * *"
    timezone: str = Field(
        default="UTC", max_length=50
    )  # IANA timezone: "America/Los_Angeles"
    last_sent_at: Optional[datetime] = Field(default=None)
    next_send_at: datetime = Field(index=True)
    article_count: int = Field(default=0, ge=0)
    open_count: int = Field(default=0, ge=0)
    click_count: int = Field(default=0, ge=0)
    unsubscribed_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EmailDigestCreate(SQLModel):
    user_id: str
    email: str
    schedule_type: ScheduleType
    schedule_cron: str
    timezone: str = "UTC"
    next_send_at: datetime


class EmailDigestPublic(SQLModel):
    id: int
    schedule_type: ScheduleType
    timezone: str
    next_send_at: datetime
    open_rate: float  # Derived: open_count / article_count
    click_rate: float  # Derived: click_count / open_count
    active: bool  # Derived: unsubscribed_at is None
```

**Validation Rules**:

- `email` MUST be valid email format
- `schedule_type` MUST be one of: daily, weekly, custom
- `schedule_cron` MUST be valid cron expression
- `timezone` MUST be valid IANA timezone
- `next_send_at` MUST be ≥created_at
- `open_count` ≤ `article_count`
- `click_count` ≤ `open_count`

**Engagement Tracking**: Track open/click via email tracking pixels and UTM links

**Indexes**:

- Primary key on `id`
- Index on `user_id` (user-specific queries)
- Index on `next_send_at` (job queue processing)

______________________________________________________________________

## Relationships

### Feed → FeedEntry (One-to-Many)

- One feed has many articles
- Cascade delete: If feed deleted, delete all associated entries

### FeedEntry → Notification (One-to-Many)

- One article can trigger multiple notifications (one per follower)
- Optional relationship: Notifications can exist without article (e.g., system alerts)

### Feed → FeedPollJob (One-to-Many)

- One feed has many poll jobs (historical tracking)
- Cascade delete: If feed deleted, delete all associated poll jobs

### User → Notification (One-to-Many)

- One user has many notifications
- Indexed by user_id for efficient queries

### User → UserFeedFollow (One-to-Many)

- One user can follow many feeds
- UNIQUE constraint prevents duplicate follows
- Following a feed auto-creates default NotificationPreference

### User → NotificationPreference (One-to-Many)

- One user has multiple preferences (per feed, per delivery method)
- UNIQUE constraint prevents duplicates
- Automatically created when following a feed (default: instant, websocket)

### User → EmailDigest (One-to-One)

- One user has at most one active digest subscription
- Soft delete (unsubscribed_at) preserves engagement data

### Feed → UserFeedFollow (One-to-Many)

- One feed can have many followers
- Used for notification targeting (who to notify when feed publishes)

______________________________________________________________________

## Database Triggers

### 1. Cleanup Old Notifications

```sql
CREATE TRIGGER cleanup_old_notifications
AFTER INSERT ON notifications
BEGIN
    DELETE FROM notifications
    WHERE created_at < datetime('now', '-7 days');
END;
```

### 2. Update Feed Health Score

```sql
CREATE TRIGGER update_feed_health
AFTER INSERT ON feed_poll_jobs
BEGIN
    UPDATE feeds
    SET health_score = (
        SELECT CAST(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS REAL) /
               COUNT(*) * 100
        FROM feed_poll_jobs
        WHERE feed_id = NEW.feed_id
        AND created_at > datetime('now', '-7 days')
    )
    WHERE id = NEW.feed_id;
END;
```

______________________________________________________________________

## Migrations

### Migration 1: Add Phase 3B Tables

**File**: `packages/ai_web_feeds/alembic/versions/003_phase3b_tables.py`

```python
"""Add Phase 3B real-time monitoring tables

Revision ID: 003_phase3b_tables
Revises: 002_phase2_tables
Create Date: 2025-10-22

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.sqlite import JSON

revision = "003_phase3b_tables"
down_revision = "002_phase2_tables"


def upgrade():
    # Create feed_entries table
    op.create_table(
        "feed_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("feed_id", sa.String(), nullable=False),
        sa.Column("guid", sa.String(), nullable=False),
        sa.Column("link", sa.String(length=2048), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("content_html", sa.Text(), nullable=True),
        sa.Column("pub_date", sa.DateTime(), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=True),
        sa.Column("categories", sa.String(), nullable=True),
        sa.Column("discovered_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["feed_id"], ["feeds.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("guid"),
    )
    op.create_index("idx_feed_entries_feed_id", "feed_entries", ["feed_id"])
    op.create_index("idx_feed_entries_pub_date", "feed_entries", ["pub_date"])

    # Create feed_poll_jobs table
    op.create_table(
        "feed_poll_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("feed_id", sa.String(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("articles_discovered", sa.Integer(), nullable=False),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["feed_id"], ["feeds.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_poll_jobs_feed_id", "feed_poll_jobs", ["feed_id"])
    op.create_index("idx_poll_jobs_status", "feed_poll_jobs", ["status"])

    # Create notifications table
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.String(length=1000), nullable=False),
        sa.Column("action_url", sa.String(length=2048), nullable=True),
        sa.Column("metadata", sa.String(), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_notifications_user_id", "notifications", ["user_id"])
    op.create_index("idx_notifications_created_at", "notifications", ["created_at"])
    op.create_index("idx_notifications_type", "notifications", ["type"])

    # Create user_feed_follows table
    op.create_table(
        "user_feed_follows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("feed_id", sa.String(), nullable=False),
        sa.Column("followed_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["feed_id"], ["feeds.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "feed_id", name="unique_user_feed"),
    )
    op.create_index("idx_follows_user", "user_feed_follows", ["user_id"])
    op.create_index("idx_follows_feed", "user_feed_follows", ["feed_id"])

    # Additional tables: trending_topics, notification_preferences, email_digests
    # (Full migration script would include all 7 tables)


def downgrade():
    op.drop_table("email_digests")
    op.drop_table("notification_preferences")
    op.drop_table("user_feed_follows")
    op.drop_table("trending_topics")
    op.drop_table("notifications")
    op.drop_table("feed_poll_jobs")
    op.drop_table("feed_entries")
```

______________________________________________________________________

**Next Steps**: Generate API contracts (OpenAPI spec, WebSocket protocol, JSON schemas)
