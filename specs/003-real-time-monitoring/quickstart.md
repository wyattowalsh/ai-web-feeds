# Quickstart: Phase 3B - Real-Time Feed Monitoring & Alerts

**Feature Branch**: `003-real-time-monitoring`  
**Created**: 2025-10-22  
**Prerequisites**: Phase 1 & 2 complete, Python 3.13+, Node.js 20+

---

## Overview

This quickstart guide covers setting up the development environment, running the Phase 3B implementation, and verifying real-time notification features.

**Estimated Setup Time**: 15-20 minutes

---

## Prerequisites

### System Requirements

- **Python**: 3.13+ (with `uv` installed)
- **Node.js**: 20+ (with `pnpm` installed)
- **SQLite**: 3.45+ (included with Python)
- **Git**: 2.40+

### Verify Prerequisites

```bash
python --version   # Should be ≥3.13
uv --version       # Should be ≥0.1.0
node --version     # Should be ≥20.0.0
pnpm --version     # Should be ≥8.0.0
sqlite3 --version  # Should be ≥3.45.0
```

---

## Part 1: Initial Setup

### 1. Switch to Feature Branch

```bash
cd /Users/ww/dev/projects/ai-web-feeds
git checkout 003-real-time-monitoring
git pull origin 003-real-time-monitoring
```

### 2. Install Python Dependencies

```bash
# Core package dependencies
cd packages/ai_web_feeds
uv sync

# CLI dependencies
cd ../../apps/cli
uv sync

# Verify installation
uv run python -c "import apscheduler, socketio; print('Dependencies OK')"
```

### 3. Install Node.js Dependencies

```bash
cd ../../apps/web
pnpm install

# Verify Socket.IO client installed
pnpm list socket.io-client
```

### 4. Initialize Database

```bash
# Run Phase 3B migrations
cd ../../packages/ai_web_feeds
uv run alembic upgrade head

# Verify new tables exist
sqlite3 ../../data/aiwebfeeds.db ".tables" | grep -E "feed_entries|notifications"
```

---

## Part 2: Configuration

### 1. Environment Variables

Create `.env` file in repository root:

```bash
# WebSocket Server
WEBSOCKET_HOST=localhost
WEBSOCKET_PORT=5000
WEBSOCKET_CORS_ORIGINS=http://localhost:3000

# Email (Development)
SENDGRID_API_KEY=your_sendgrid_api_key_here  # Optional for testing
SMTP_HOST=localhost
SMTP_PORT=1025  # Use mailhog for local testing

# Polling
FEED_POLL_INTERVAL_MIN=30  # minutes
FEED_POLL_WORKERS=10
FEED_POLL_TIMEOUT=30  # seconds

# Notification Limits
MAX_NOTIFICATIONS_PER_HOUR=10
NOTIFICATION_RETENTION_DAYS=7

# Trending Detection
TRENDING_MIN_MENTIONS=10
TRENDING_Z_SCORE_THRESHOLD=2.0
TRENDING_BASELINE_DAYS=7
```

### 2. Configure Notification Settings

Edit `packages/ai_web_feeds/src/ai_web_feeds/config.py`:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # WebSocket
    websocket_host: str = "localhost"
    websocket_port: int = 5000
    
    # Polling
    feed_poll_interval_min: int = 30
    feed_poll_workers: int = 10
    
    # Trending
    trending_min_mentions: int = 10
    trending_z_score_threshold: float = 2.0
    
    class Config:
        env_file = ".env"

settings = Settings()
```

---

## Part 3: Running Services

### Terminal 1: Feed Polling Service

```bash
cd /Users/ww/dev/projects/ai-web-feeds/packages/ai_web_feeds
uv run python -m ai_web_feeds.polling

# Expected output:
# [INFO] APScheduler started
# [INFO] Scheduled 156 feeds for polling
# [INFO] Polling ai-research-blog (feed 1/156)
# [INFO] Discovered 3 new articles from ai-research-blog
```

### Terminal 2: WebSocket Server

```bash
cd /Users/ww/dev/projects/ai-web-feeds/packages/ai_web_feeds
uv run python -m ai_web_feeds.websocket_server

# Expected output:
# [INFO] Socket.IO server starting on localhost:5000
# [INFO] WebSocket server ready (0 connections)
```

### Terminal 3: Web Frontend

```bash
cd /Users/ww/dev/projects/ai-web-feeds/apps/web
pnpm dev

# Expected output:
# ▲ Next.js 15.0.0
# - Local:   http://localhost:3000
# - Network: http://192.168.1.x:3000
# ✓ Ready in 2.3s
```

### Terminal 4: Email Testing (Optional)

Use [MailHog](https://github.com/mailhog/MailHog) for local email testing:

```bash
# Install MailHog
brew install mailhog  # macOS
# OR
go install github.com/mailhog/MailHog@latest  # Any OS

# Run MailHog
mailhog

# Access web UI: http://localhost:8025
# SMTP server: localhost:1025
```

---

## Part 4: Verification Steps

### Step 1: Verify WebSocket Connection

1. Open browser to `http://localhost:3000`
2. Open browser DevTools → Network → WS tab
3. Look for WebSocket connection to `localhost:5000`
4. Connection status should show `101 Switching Protocols`

**Expected Console Output**:
```
[WebSocket] Connected to server
[WebSocket] Joined room: user:550e8400-e29b-41d4-a716-446655440000
```

### Step 2: Trigger Manual Feed Poll

```bash
# Use CLI to manually poll a feed
cd /Users/ww/dev/projects/ai-web-feeds/apps/cli
uv run aiwebfeeds poll trigger ai-research-blog

# Expected output:
# ✓ Poll job queued for feed 'ai-research-blog'
# ✓ 2 new articles discovered
# ✓ Notifications sent to 5 followers
```

### Step 3: Verify Notification Delivery

**Check Browser**:
1. Watch for toast notification in browser (top-right corner)
2. Notification should appear within 60 seconds of poll completion
3. Click notification → should navigate to article URL

**Check Database**:
```bash
sqlite3 data/aiwebfeeds.db \
  "SELECT id, type, title FROM notifications ORDER BY created_at DESC LIMIT 5;"

# Expected output:
# 12345|new_article|New article from AI Research Blog
# 12344|new_article|Understanding Transformers
```

### Step 4: Verify Trending Detection

```bash
# Simulate trending spike (dev only)
cd /Users/ww/dev/projects/ai-web-feeds/apps/cli
uv run aiwebfeeds trending simulate "GPT-5" --mentions 45

# Expected output:
# ✓ Simulated 45 mentions of 'GPT-5' (z-score: 3.8)
# ✓ Trending alert sent to 12 interested users
```

### Step 5: Test Email Digest

```bash
# Send test digest to yourself
uv run aiwebfeeds digest send-test user@example.com

# Expected output:
# ✓ Test digest sent to user@example.com
# ✓ Check MailHog at http://localhost:8025
```

**Verify Email**:
1. Open MailHog UI: `http://localhost:8025`
2. Look for email from `notifications@aiwebfeeds.com`
3. Verify email contains 10 articles with clickable links

---

## Part 5: Testing

### Run Unit Tests

```bash
cd /Users/ww/dev/projects/ai-web-feeds/tests
uv run pytest packages/ai_web_feeds/test_polling.py -v

# Expected output:
# test_polling.py::test_poll_feed_success PASSED
# test_polling.py::test_poll_feed_with_etag PASSED
# test_polling.py::test_poll_feed_timeout PASSED
# ==================== 15 passed in 2.34s ====================
```

### Run Integration Tests

```bash
uv run pytest packages/ai_web_feeds/integration/test_poll_to_notify.py -v

# Expected output:
# test_poll_to_notify.py::test_poll_triggers_notification PASSED
# test_poll_to_notify.py::test_notification_delivery PASSED
# ==================== 8 passed in 5.67s ====================
```

### Run Coverage Report

```bash
uv run pytest --cov=ai_web_feeds --cov-report=html

# Expected output:
# ==================== Coverage: 92% ====================
# Open tests/reports/coverage/index.html for detailed report
```

---

## Part 6: Development Workflow

### 1. Follow a Feed (Simulate User Action)

```bash
# Add feed follower via CLI
uv run aiwebfeeds notify follow ai-research-blog --user-id <your-uuid>

# Expected output:
# ✓ Now following 'ai-research-blog'
# ✓ Notifications enabled (instant, websocket)
```

### 2. Configure Notification Preferences

```bash
# Set quiet hours
uv run aiwebfeeds notify preferences \
  --user-id <your-uuid> \
  --feed-id ai-research-blog \
  --frequency hourly \
  --quiet-hours 22:00-07:00

# Expected output:
# ✓ Preferences updated for 'ai-research-blog'
# ✓ Frequency: hourly (with quiet hours 22:00-07:00)
```

### 3. Subscribe to Email Digest

```bash
# Subscribe to daily digest
uv run aiwebfeeds digest subscribe \
  --user-id <your-uuid> \
  --email your@email.com \
  --schedule daily \
  --timezone America/Los_Angeles \
  --time 09:00

# Expected output:
# ✓ Subscribed to daily digest at 9:00 AM Pacific
# ✓ Next digest scheduled for tomorrow
```

### 4. View Trending Topics

```bash
# Check current trending topics
uv run aiwebfeeds trending list --hours 24

# Expected output:
# Trending Topics (Last 24 Hours)
# ================================
# 1. GPT-5 (z-score: 3.8, 45 mentions, 4.5x spike)
# 2. RLHF (z-score: 2.9, 28 mentions, 3.2x spike)
# 3. Diffusion Models (z-score: 2.5, 22 mentions, 2.8x spike)
```

---

## Part 7: Troubleshooting

### Issue: WebSocket Connection Fails

**Symptoms**: Browser console shows `WebSocket connection failed`

**Solutions**:
```bash
# 1. Check WebSocket server is running
lsof -i :5000  # Should show Python process

# 2. Check CORS configuration
# Edit packages/ai_web_feeds/src/ai_web_feeds/websocket_server.py
socketio = SocketIO(app, cors_allowed_origins=['http://localhost:3000'])

# 3. Check browser console for errors
# Look for "Access-Control-Allow-Origin" errors

# 4. Restart WebSocket server
# Kill process and restart
```

### Issue: No Notifications Received

**Symptoms**: Feed polled successfully but no notification appears

**Debug Steps**:
```bash
# 1. Verify user is following the feed
sqlite3 data/aiwebfeeds.db \
  "SELECT * FROM followed_feeds WHERE user_id='<your-uuid>';"

# 2. Check notification preferences
sqlite3 data/aiwebfeeds.db \
  "SELECT * FROM notification_preferences WHERE user_id='<your-uuid>';"

# 3. Check notification was created
sqlite3 data/aiwebfeeds.db \
  "SELECT * FROM notifications WHERE user_id='<your-uuid>' ORDER BY created_at DESC LIMIT 5;"

# 4. Check WebSocket room membership
# Look for "[INFO] User <uuid> joined room" in WebSocket server logs

# 5. Test with manual notification
uv run aiwebfeeds notify send-test --user-id <your-uuid>
```

### Issue: Trending Detection Not Working

**Symptoms**: No trending alerts despite article spikes

**Debug Steps**:
```bash
# 1. Check trending detection is running
ps aux | grep trending

# 2. Verify baseline data exists
sqlite3 data/aiwebfeeds.db \
  "SELECT COUNT(*) FROM feed_entries WHERE created_at > datetime('now', '-7 days');"
# Should return >100 for meaningful baseline

# 3. Check z-score computation
uv run python -c "
from ai_web_feeds.trending import detect_trending_topics
topics = detect_trending_topics()
print(f'Found {len(topics)} trending topics')
for t in topics[:5]:
    print(f'  {t[\"topic_name\"]}: z={t[\"z_score\"]:.2f}')
"

# 4. Lower threshold for testing
# Edit config: TRENDING_Z_SCORE_THRESHOLD=1.5 (temporary)
```

### Issue: Email Digests Not Sending

**Symptoms**: Digest scheduled but not received

**Debug Steps**:
```bash
# 1. Check digest subscription
sqlite3 data/aiwebfeeds.db \
  "SELECT * FROM email_digests WHERE user_id='<your-uuid>';"

# 2. Check next_send_at timestamp
sqlite3 data/aiwebfeeds.db \
  "SELECT next_send_at, datetime('now') as now FROM email_digests WHERE user_id='<your-uuid>';"
# next_send_at should be in the past

# 3. Check digest scheduler is running
ps aux | grep digest_scheduler

# 4. Check MailHog received email
curl http://localhost:8025/api/v2/messages

# 5. Force send digest now
uv run aiwebfeeds digest send-now --user-id <your-uuid>
```

---

## Part 8: Production Deployment Checklist

Before deploying Phase 3B to production:

- [ ] All tests passing (`uv run pytest --cov`)
- [ ] Coverage ≥90% (`uv run pytest --cov-report=html`)
- [ ] Linting passes (`uv run ruff check --fix .`)
- [ ] Type checking passes (`uv run mypy .`)
- [ ] Database migrations tested (up and down)
- [ ] WebSocket server tested with 100+ concurrent connections
- [ ] Feed polling tested with 1000+ feeds
- [ ] Email delivery tested (production SMTP)
- [ ] Trending detection accuracy validated (manual review of 20 trends)
- [ ] Rate limiting tested (10 notifications/hour/user)
- [ ] Notification retention tested (7-day cleanup)
- [ ] Documentation updated (`apps/web/content/docs/`)
- [ ] API contracts validated (OpenAPI spec)
- [ ] WebSocket protocol tested (reconnection, fallback)
- [ ] Security audit complete (CORS, input validation)
- [ ] Performance benchmarks met (<60s notification latency)

---

## Part 9: Common Commands Reference

```bash
# Feed Polling
uv run aiwebfeeds poll trigger <feed-id>       # Manual poll single feed
uv run aiwebfeeds poll trigger-all             # Manual poll all feeds
uv run aiwebfeeds poll status                  # Show polling status
uv run aiwebfeeds poll history <feed-id>       # Show poll history

# Notifications
uv run aiwebfeeds notify follow <feed-id>      # Follow feed
uv run aiwebfeeds notify unfollow <feed-id>    # Unfollow feed
uv run aiwebfeeds notify list                  # List notifications
uv run aiwebfeeds notify send-test             # Send test notification

# Preferences
uv run aiwebfeeds notify preferences           # Show current preferences
uv run aiwebfeeds notify preferences --set ... # Update preferences

# Digests
uv run aiwebfeeds digest subscribe             # Subscribe to digest
uv run aiwebfeeds digest unsubscribe           # Unsubscribe
uv run aiwebfeeds digest send-test <email>     # Send test digest
uv run aiwebfeeds digest send-now              # Force send now

# Trending
uv run aiwebfeeds trending list                # Show current trends
uv run aiwebfeeds trending history             # Show historical trends
uv run aiwebfeeds trending simulate <topic>    # Simulate trending (dev)
```

---

## Part 10: Next Steps

Once Phase 3B is working:

1. **Monitor Metrics**: Track notification delivery latency, WebSocket connection stability, trending detection accuracy
2. **Gather Feedback**: Survey early users on notification relevance and frequency
3. **Optimize Performance**: Profile feed polling, database queries, WebSocket message serialization
4. **Plan Scale-Out**: Prepare Redis pub/sub for >1000 concurrent connections
5. **Document Learnings**: Update `apps/web/content/docs/` with production insights

---

**Version**: 1.0.0 | **Status**: Development Guide Complete | **Last Updated**: 2025-10-22

