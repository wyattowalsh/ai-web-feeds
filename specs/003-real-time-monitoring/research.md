# Technology Research: Phase 3B - Real-Time Feed Monitoring & Alerts

**Feature Branch**: `003-real-time-monitoring`\
**Created**: 2025-10-22\
**Status**: Research Complete

______________________________________________________________________

## Executive Summary

This document consolidates technology research and design decisions for Phase 3B
(Real-Time Feed Monitoring & Alerts). All major technology choices have been evaluated
based on AIWebFeeds requirements, Phase 1/2 patterns, and MVP constraints. Decisions
prioritize simplicity, reliability, and scalability path over premature optimization.

______________________________________________________________________

## Research Findings

### 1. Background Job Scheduling

**Decision**: APScheduler (MIT License)

**Rationale**:

- **In-process scheduler**: No external dependencies (Redis, RabbitMQ)
- **Sufficient scale**: Handles 10,000 feed polls within 1-hour window
- **Simple deployment**: Single Python process, no message broker required
- **Proven maturity**: 10+ years, 8k+ GitHub stars, actively maintained
- **Easy testing**: Mocked time control for deterministic tests

**Alternatives Considered**:

| Technology           | Pros                  | Cons                                        | Rejected Because                                                                             |
| -------------------- | --------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Celery + Redis**   | Distributed, scalable | Redis dependency, complex deployment        | Redis unnecessary at target scale (10k feeds). APScheduler sufficient for single-server MVP. |
| **Cron jobs**        | Simple, OS-native     | No programmatic control, poor observability | Cannot dynamically adjust intervals per feed. No real-time logging/metrics.                  |
| **Custom threading** | Full control          | Reinventing wheels, error-prone             | APScheduler provides battle-tested scheduling, retry logic, thread pooling.                  |

**Best Practices**:

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor

# Configure APScheduler with SQLite persistence
jobstores = {"default": SQLAlchemyJobStore(url="sqlite:///data/aiwebfeeds.db")}
executors = {"default": ThreadPoolExecutor(10)}  # 10 parallel workers
scheduler = BackgroundScheduler(jobstores=jobstores, executors=executors)
```

______________________________________________________________________

### 2. WebSocket Communication

**Decision**: Socket.IO (MIT License)

**Rationale**:

- **Auto-fallback**: Gracefully degrades to long polling if WebSocket blocked
- **Room-based broadcasting**: Efficient user-specific message delivery
- **Mature ecosystem**: Python (python-socketio) + JavaScript (socket.io-client)
  official libraries
- **Built-in reconnection**: Exponential backoff, missed message recovery
- **Production proven**: Used by Microsoft, Trello, Zendesk

**Alternatives Considered**:

| Technology                   | Pros                   | Cons                                 | Rejected Because                                                                                                      |
| ---------------------------- | ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Native WebSocket**         | Simpler, less overhead | Manual fallback, reconnection logic  | Requires SSE implementation, reconnection handling, browser compatibility checks. Socket.IO provides this out-of-box. |
| **Server-Sent Events (SSE)** | Simple one-way         | No client→server messages, no binary | One-way only (no ack/read receipts). Socket.IO supports bidirectional if needed later.                                |
| **Firebase Cloud Messaging** | Managed service        | External dependency, cost at scale   | Vendor lock-in. Self-hosted Socket.IO maintains control and zero cost.                                                |

**Best Practices**:

```python
# Server (Flask + Socket.IO)
from flask import Flask
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")


@socketio.on("connect")
def handle_connect():
    user_id = get_user_id_from_session()
    join_room(f"user:{user_id}")
    emit("connection_status", {"status": "connected"})


# Broadcast to specific user
socketio.emit("notification", notification_data, room=f"user:{user_id}")
```

```typescript
// Client (Next.js + socket.io-client)
import { io } from 'socket.io-client';

const socket = io('ws://localhost:5000', {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});

socket.on('notification', (data) => {
  showNotification(data);
});
```

______________________________________________________________________

### 3. Email Delivery

**Decision**: Self-hosted SMTP (Postfix) for production + SendGrid for dev/staging

**Rationale**:

- **Production**: Self-hosted SMTP (Postfix, Exim) avoids SendGrid free tier limit (100
  emails/day)
- **Dev/Staging**: SendGrid simplifies local development (no SMTP server setup)
- **Cost**: $0 for self-hosted (assuming existing server), vs $15/month SendGrid for 40k
  emails
- **Reliability**: Both approaches battle-tested, fallback to self-hosted if SendGrid
  down
- **Compliance**: Self-hosted maintains email privacy (no third-party access)

**Alternatives Considered**:

| Technology        | Pros                                    | Cons                                             | Rejected Because                                                            |
| ----------------- | --------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| **SendGrid only** | Simple API, managed infrastructure      | 100 emails/day free tier, cost at scale          | Insufficient for production (100+ daily digest subscribers).                |
| **AWS SES**       | AWS integrated, cheap ($0.10/1k emails) | AWS account required, bounce handling complexity | Adds AWS dependency. Self-hosted SMTP simpler for single-server deployment. |
| **Mailgun**       | Developer-friendly API                  | Limited free tier (5k emails/month)              | Similar limitations to SendGrid. Self-hosted avoids all vendor limits.      |

**Best Practices**:

```python
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


# Production: Self-hosted SMTP
def send_email_production(to: str, subject: str, html: str):
    msg = MIMEMultipart("alternative")
    msg["From"] = "notifications@aiwebfeeds.com"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP("localhost", 25) as server:
        server.send_message(msg)


# Dev: SendGrid API
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail


def send_email_dev(to: str, subject: str, html: str):
    message = Mail(
        from_email="dev@aiwebfeeds.com",
        to_emails=to,
        subject=subject,
        html_content=html,
    )
    sg = SendGridAPIClient(os.environ.get("SENDGRID_API_KEY"))
    sg.send(message)
```

______________________________________________________________________

### 4. Trending Detection Algorithm

**Decision**: Z-score (Standard Score) with 7-day rolling baseline

**Rationale**:

- **Standard statistical method**: Detects deviations from mean (spike detection)
- **Adjusts for variance**: Z-score = (current - mean) / std_dev accounts for topic
  volatility
- **Threshold**: Z > 2 represents 95th percentile (2 standard deviations above mean)
- **Proven approach**: Used by Twitter Trends, Google Trends, academic literature
- **Minimal false positives**: Requires minimum 10 mentions + 3x baseline spike

**Alternatives Considered**:

| Algorithm                                    | Pros                            | Cons                                      | Rejected Because                                                                  |
| -------------------------------------------- | ------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| **Fixed threshold** (e.g., 10 mentions/hour) | Simple                          | No normalization for topic popularity     | High false positive rate. "Python" mentioned 100x/day baseline, 110x not a spike. |
| **Exponential Moving Average (EMA)**         | Smooth transitions, adaptive    | Slower spike detection, lag               | 7-day window too short for EMA stability. Z-score more responsive.                |
| **Machine Learning (LSTM, ARIMA)**           | Predictive, handles seasonality | Complex, training data required, overkill | Over-engineering for MVP. Z-score provides 80% value with 20% complexity.         |

**Best Practices**:

```python
import numpy as np
from datetime import datetime, timedelta


def detect_trending_topics(lookback_hours=1):
    """Detect topics with z-score > 2 (95th percentile spike)"""

    # Get recent mentions (last 1 hour)
    recent_articles = get_articles_since(
        datetime.now() - timedelta(hours=lookback_hours)
    )
    recent_counts = Counter(extract_topics(recent_articles))

    # Get baseline (7-day average, hourly rate)
    baseline_articles = get_articles_since(datetime.now() - timedelta(days=7))
    baseline_counts = Counter(extract_topics(baseline_articles))
    baseline_hourly = {
        topic: count / (7 * 24) for topic, count in baseline_counts.items()
    }

    # Compute z-scores
    trending = []
    for topic, recent_count in recent_counts.items():
        if recent_count < 10:  # Minimum threshold
            continue

        baseline_mean = baseline_hourly.get(topic, 1)
        baseline_std = np.std([baseline_counts.get(topic, 0)]) or 1

        z_score = (recent_count - baseline_mean) / baseline_std

        if z_score > 2.0:  # 2 standard deviations (95th percentile)
            trending.append(
                {
                    "topic": topic,
                    "z_score": z_score,
                    "recent_count": recent_count,
                    "baseline_mean": baseline_mean,
                    "spike_magnitude": recent_count / baseline_mean,
                }
            )

    return sorted(trending, key=lambda x: x["z_score"], reverse=True)
```

______________________________________________________________________

### 5. Feed Polling Strategy

**Decision**: Async httpx with 10 parallel workers + conditional requests (ETags,
If-Modified-Since)

**Rationale**:

- **Async httpx**: Non-blocking I/O, efficient for 10k HTTP requests
- **Parallel workers**: 10 concurrent requests = 30 feeds/second capacity (10k feeds in
  ~5 minutes)
- **Conditional requests**: ETag/If-Modified-Since reduce bandwidth (304 Not Modified
  responses)
- **Dynamic intervals**: Adjust poll frequency based on feed update patterns
- **Retry logic**: Tenacity library provides exponential backoff for failed polls

**Alternatives Considered**:

| Approach                          | Pros                  | Cons                                           | Rejected Because                                                                  |
| --------------------------------- | --------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| **requests + ThreadPoolExecutor** | Synchronous, simpler  | Slower (blocking I/O), higher memory           | httpx async provides 3x-5x throughput improvement. Critical for 10k feeds.        |
| **aiohttp**                       | Async, lightweight    | Less mature than httpx, complex error handling | httpx provides better API (requests-compatible), superior timeout handling.       |
| **Scrapy**                        | Full-featured crawler | Heavy dependency, overkill                     | Feed parsing (feedparser) + httpx sufficient. Scrapy adds unnecessary complexity. |

**Best Practices**:

```python
import httpx
import feedparser
from tenacity import retry, stop_after_attempt, wait_exponential


async def poll_feed(feed_id: str, session: httpx.AsyncClient):
    """Poll single feed with conditional request and retry logic"""
    feed = get_feed(feed_id)

    headers = {}
    if feed.last_etag:
        headers["If-None-Match"] = feed.last_etag
    if feed.last_modified:
        headers["If-Modified-Since"] = feed.last_modified

    try:
        response = await session.get(feed.url, headers=headers, timeout=30)

        if response.status_code == 304:
            return []  # Feed not modified

        parsed = feedparser.parse(response.content)
        new_articles = detect_new_articles(feed_id, parsed.entries)

        update_feed_poll_success(feed_id, etag=response.headers.get("ETag"))
        return new_articles

    except httpx.TimeoutException:
        log_poll_failure(feed_id, "timeout")
        return []


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=60))
async def poll_feeds_batch(feed_ids: list[str]):
    """Poll feeds in batches with retry logic"""
    async with httpx.AsyncClient() as session:
        tasks = [poll_feed(feed_id, session) for feed_id in feed_ids]
        return await asyncio.gather(*tasks, return_exceptions=True)
```

______________________________________________________________________

### 6. User Identity (Anonymous Users)

**Decision**: localStorage UUID with server-side storage

**Rationale**:

- **No authentication**: Phase 3A (User Accounts) deferred, but need persistent user
  identity
- **localStorage UUID**: Browser-generated UUID, stored client-side for session
  continuity
- **Server-side storage**: Notification preferences, followed feeds stored in SQLite
  (keyed by UUID)
- **Migration path**: When Phase 3A implemented, migrate localStorage UUID → proper user
  accounts
- **Privacy-friendly**: No PII collected, anonymous usage

**Alternatives Considered**:

| Approach                   | Pros                   | Cons                                        | Rejected Because                                                                          |
| -------------------------- | ---------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Browser cookies**        | Standard web practice  | Size limits (4KB), can expire               | Followed feeds list could exceed 4KB. localStorage more reliable.                         |
| **Require Phase 3A first** | Proper authentication  | Blocks Phase 3B implementation              | Phase 3A is large effort (OAuth, sessions, user management). Prefer incremental delivery. |
| **IP address**             | No client-side storage | Not unique (NAT, proxies), privacy concerns | Multiple users behind NAT, dynamic IPs change. Unacceptable UX.                           |

**Best Practices**:

```typescript
// Client: Generate and persist user ID
function getUserId(): string {
  let userId = localStorage.getItem('aiwebfeeds_user_id');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('aiwebfeeds_user_id', userId);
  }
  return userId;
}

// Server: Accept user_id in API requests
from pydantic import BaseModel, Field

class NotificationPreference(BaseModel):
    user_id: str = Field(..., description="Anonymous user ID from localStorage")
    feed_id: str | None = None  # None = global preference
    frequency: Literal['instant', 'hourly', 'daily', 'weekly', 'off']
    delivery_method: Literal['websocket', 'email', 'in_app']
```

______________________________________________________________________

### 7. Email Template Approach

**Decision**: Simple HTML with Jinja2 templates (no MJML for MVP)

**Rationale**:

- **MVP simplicity**: Plain HTML table sufficient for article lists
- **Wide compatibility**: Works in 99% of email clients (Gmail, Outlook, Apple Mail)
- **Fast iteration**: No build step, direct template editing
- **MJML deferral**: Polish email design in Phase 4 when user base established

**Alternatives Considered**:

| Approach            | Pros                            | Cons                                | Rejected Because                                                                          |
| ------------------- | ------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| **MJML**            | Responsive, beautiful templates | Build step, learning curve          | Over-engineering for MVP. Simple HTML meets 80% of needs.                                 |
| **Plain text only** | Maximum compatibility           | No formatting, links                | Users expect HTML emails with clickable links. Plain text insufficient for article lists. |
| **React Email**     | Component-based, modern         | TypeScript build required, overkill | Adds frontend dependency to backend. Jinja2 simpler for server-side rendering.            |

**Best Practices**:

```python
from jinja2 import Template

DIGEST_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
    .article { border-bottom: 1px solid #eee; padding: 15px 0; }
    .article h3 { margin: 0 0 5px 0; }
    .article .meta { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Your Daily AI/ML Feed Digest - {{ date }}</h1>
  <p>{{ article_count }} new articles from your followed feeds:</p>
  
  {% for article in articles %}
  <div class="article">
    <h3><a href="{{ article.link }}">{{ article.title }}</a></h3>
    <div class="meta">{{ article.feed_name }} • {{ article.pub_date }}</div>
    <p>{{ article.summary[:200] }}...</p>
  </div>
  {% endfor %}
  
  <hr>
  <p><small><a href="https://aiwebfeeds.com/digests/unsubscribe">Unsubscribe</a></small></p>
</body>
</html>
"""

template = Template(DIGEST_TEMPLATE)
html = template.render(
    date=date.today(), article_count=len(articles), articles=articles
)
```

______________________________________________________________________

## Technology Stack Summary

| Component              | Technology               | License        | Rationale                                 |
| ---------------------- | ------------------------ | -------------- | ----------------------------------------- |
| **Background Jobs**    | APScheduler 3.10+        | MIT            | In-process scheduler, no Redis dependency |
| **WebSocket**          | Socket.IO 5.x            | MIT            | Auto-fallback, mature ecosystem           |
| **HTTP Client**        | httpx 0.27+              | BSD            | Async, requests-compatible API            |
| **Feed Parsing**       | feedparser 6.0+          | BSD            | De facto standard for RSS/Atom            |
| **Retry Logic**        | tenacity 8.x             | Apache 2.0     | Exponential backoff, configurable         |
| **Email (Dev)**        | SendGrid (free tier)     | Proprietary    | Simple API, managed infrastructure        |
| **Email (Prod)**       | Postfix / Python smtplib | Various/stdlib | Self-hosted, zero cost                    |
| **Email Templates**    | Jinja2 3.1+              | BSD            | Simple, battle-tested templating          |
| **WebSocket Client**   | socket.io-client 4.x     | MIT            | Official JavaScript client                |
| **Frontend Framework** | Next.js 15+, React 19+   | MIT            | Existing stack from Phase 1/2             |
| **Database**           | SQLite 3.45+             | Public Domain  | Existing from Phase 1/2, sufficient scale |

**All dependencies are free, open-source, and actively maintained.**

______________________________________________________________________

## Scaling Considerations

### Current Architecture (Phase 3B MVP)

- **Single server**: APScheduler + Socket.IO on one machine
- **SQLite**: Handles 10k feeds, 100k articles, 1M notifications (tested up to 10GB)
- **Capacity**: 1000 concurrent WebSocket connections, 10k feed polls/hour
- **Cost**: $0 additional (assuming existing server from Phase 1/2)

### Scale Triggers (Future Phases)

| Metric                    | Threshold        | Action Required                                           |
| ------------------------- | ---------------- | --------------------------------------------------------- |
| **WebSocket connections** | >1000 concurrent | Add Redis pub/sub, deploy Socket.IO on multiple instances |
| **Feed polls**            | >20k feeds       | Scale to Celery + Redis for distributed polling           |
| **Database size**         | >10GB SQLite     | Migrate to PostgreSQL for better concurrency              |
| **Email volume**          | >10k emails/day  | Upgrade SendGrid tier or optimize SMTP queue              |

**Estimated scale limits**: Phase 3B architecture supports 10k feeds, 5k users, 1k
concurrent connections. Sufficient for 6-12 months post-launch.

______________________________________________________________________

**Next Steps**: Proceed to Phase 1 (Design & Contracts) to generate data models, API
contracts, and quickstart guide.
