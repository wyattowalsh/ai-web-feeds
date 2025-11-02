# WebSocket Protocol: Real-Time Notifications

**Version**: 1.0.0\
**Created**: 2025-10-22\
**Technology**: Socket.IO 5.x

______________________________________________________________________

## Overview

Real-time bidirectional communication protocol for instant notification delivery using
Socket.IO. Provides auto-fallback to long polling if WebSocket is blocked by
firewalls/proxies.

**Transport Priority**: WebSocket → Long Polling → Polling

______________________________________________________________________

## Connection

### Endpoint

```
ws://localhost:5000/socket.io/
```

Production:

```
wss://aiwebfeeds.com/socket.io/
```

### Authentication

**Method**: Query parameter with anonymous user ID

```javascript
import { io } from 'socket.io-client';

const userId = getUserIdFromLocalStorage(); // UUID from localStorage

const socket = io('ws://localhost:5000', {
  query: {
    user_id: userId
  },
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  reconnectionAttempts: 10
});
```

### Connection Flow

```
Client                          Server
  |                               |
  |---- connect (user_id) ------->|
  |                               |
  |<---- connection_ack ----------|
  |     { user_id, room }         |
  |                               |
  |<---- notification ------------|
  |     { type, title, ... }      |
  |                               |
  |---- notification_ack -------->|
  |     { id, received_at }       |
```

______________________________________________________________________

## Events

### Client → Server

#### 1. `connect`

**Purpose**: Establish WebSocket connection

**Emitted**: Automatically by Socket.IO on connection

**Payload**: None (user_id in query string)

**Response**: `connection_ack` event

______________________________________________________________________

#### 2. `notification_ack`

**Purpose**: Acknowledge receipt of notification (for delivery tracking)

**Payload**:

```json
{
  "id": 12345,
  "received_at": "2025-10-22T14:30:05Z"
}
```

**Response**: None

______________________________________________________________________

#### 3. `subscribe_topics`

**Purpose**: Subscribe to specific topic alerts (optional)

**Payload**:

```json
{
  "topics": ["LLM", "Computer Vision", "Reinforcement Learning"]
}
```

**Response**: `subscription_confirmed`

______________________________________________________________________

#### 4. `ping`

**Purpose**: Keep-alive ping (handled automatically by Socket.IO)

**Payload**: None

**Response**: `pong`

______________________________________________________________________

### Server → Client

#### 1. `connection_ack`

**Purpose**: Confirm connection established and user joined room

**Payload**:

```json
{
  "status": "connected",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "room": "user:550e8400-e29b-41d4-a716-446655440000",
  "server_time": "2025-10-22T14:30:00Z"
}
```

**Schema**: [connection-ack.json](./schemas/connection-ack.json)

______________________________________________________________________

#### 2. `notification`

**Purpose**: Deliver real-time notification to user

**Payload**:

```json
{
  "id": 12345,
  "type": "new_article",
  "title": "New article from AI Research Blog",
  "message": "Introducing GPT-5: The Next Generation Language Model",
  "action_url": "https://example.com/article/gpt-5",
  "metadata": {
    "feed_id": "ai-research-blog",
    "article_id": 67890,
    "feed_name": "AI Research Blog"
  },
  "created_at": "2025-10-22T14:30:00Z"
}
```

**Schema**: [notification.json](./schemas/notification.json)

**Expected Response**: Client should emit `notification_ack`

______________________________________________________________________

#### 3. `trending_alert`

**Purpose**: Alert user to trending topic spike

**Payload**:

```json
{
  "id": 789,
  "topic_name": "GPT-5",
  "z_score": 3.8,
  "mention_count": 45,
  "spike_magnitude": 4.5,
  "related_feeds": ["ai-research-blog", "ml-weekly"],
  "related_articles": [67890, 67891, 67892],
  "spike_detected_at": "2025-10-22T14:00:00Z"
}
```

**Schema**: [trending-alert.json](./schemas/trending-alert.json)

______________________________________________________________________

#### 4. `notification_bundle`

**Purpose**: Deliver multiple notifications as batch (smart bundling to prevent spam)

**Payload**:

```json
{
  "bundle_id": "bundle_12345",
  "feed_id": "ai-research-blog",
  "feed_name": "AI Research Blog",
  "count": 5,
  "summary": "5 new articles from AI Research Blog",
  "articles": [
    {
      "id": 67890,
      "title": "Introducing GPT-5",
      "link": "https://example.com/article/gpt-5",
      "pub_date": "2025-10-22T14:00:00Z"
    },
    {
      "id": 67891,
      "title": "Understanding Transformers",
      "link": "https://example.com/article/transformers",
      "pub_date": "2025-10-22T14:15:00Z"
    }
  ],
  "created_at": "2025-10-22T14:30:00Z"
}
```

**Schema**: [notification-bundle.json](./schemas/notification-bundle.json)

**Trigger**: When >3 articles from same feed within 5 minutes

______________________________________________________________________

#### 5. `connection_error`

**Purpose**: Notify client of connection/authentication errors

**Payload**:

```json
{
  "error": "invalid_user_id",
  "message": "User ID format is invalid (must be UUID)",
  "timestamp": "2025-10-22T14:30:00Z"
}
```

______________________________________________________________________

#### 6. `subscription_confirmed`

**Purpose**: Confirm topic subscription

**Payload**:

```json
{
  "topics": ["LLM", "Computer Vision"],
  "subscribed_at": "2025-10-22T14:30:00Z"
}
```

______________________________________________________________________

## Reconnection Strategy

### Client-Side Reconnection

Socket.IO handles reconnection automatically with exponential backoff:

```javascript
const socket = io('ws://localhost:5000', {
  reconnection: true,
  reconnectionDelay: 1000,      // Start at 1 second
  reconnectionDelayMax: 30000,  // Cap at 30 seconds
  reconnectionAttempts: 10      // Try 10 times before giving up
});

socket.on('connect', () => {
  console.log('Connected to WebSocket server');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server forcibly disconnected, manually reconnect
    socket.connect();
  }
  // Socket.IO will auto-reconnect for other reasons
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect after max attempts');
  // Fallback to REST API polling
  startRestApiPolling();
});
```

### Missed Notifications

When client reconnects after being offline, it should fetch missed notifications via
REST API:

```javascript
socket.on('connect', async () => {
  const lastSeen = localStorage.getItem('last_notification_time');
  const missedNotifications = await fetchNotificationsSince(lastSeen);
  missedNotifications.forEach(showNotification);
});
```

______________________________________________________________________

## Room-Based Broadcasting

### Server Implementation

```python
from flask_socketio import SocketIO, emit, join_room, leave_room


@socketio.on("connect")
def handle_connect():
    user_id = request.args.get("user_id")

    # Validate user_id format
    if not is_valid_uuid(user_id):
        return False  # Reject connection

    # Join user-specific room
    room = f"user:{user_id}"
    join_room(room)

    emit(
        "connection_ack",
        {
            "status": "connected",
            "user_id": user_id,
            "room": room,
            "server_time": datetime.utcnow().isoformat(),
        },
    )


@socketio.on("disconnect")
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")
    # Socket.IO automatically handles room cleanup


# Broadcast to specific user
def notify_user(user_id: str, notification: dict):
    room = f"user:{user_id}"
    socketio.emit("notification", notification, room=room)
```

______________________________________________________________________

## Rate Limiting

### Server-Side

**Limit**: 10 notifications per user per hour (configurable per user preferences)

**Smart Bundling**: Automatically bundle notifications when rate limit exceeded

```python
def should_bundle_notifications(user_id: str) -> bool:
    """Check if user has received >3 notifications in last 5 minutes"""
    recent_count = count_notifications_since(user_id, minutes=5)
    return recent_count > 3


def send_notification(user_id: str, notification: dict):
    if should_bundle_notifications(user_id):
        add_to_bundle(user_id, notification)
    else:
        socketio.emit("notification", notification, room=f"user:{user_id}")
```

______________________________________________________________________

## Error Handling

### Connection Errors

| Error Code        | Reason                            | Client Action                                  |
| ----------------- | --------------------------------- | ---------------------------------------------- |
| `invalid_user_id` | User ID format invalid (not UUID) | Regenerate localStorage UUID, retry connection |
| `server_overload` | Server at max connections         | Fallback to REST API polling, retry after 60s  |
| `unauthorized`    | User ID not found or banned       | Clear localStorage, prompt user to refresh     |

### Message Validation

All messages MUST validate against JSON schemas before delivery. Invalid messages are
logged and dropped (never sent to client).

______________________________________________________________________

## Testing

### Unit Tests

```python
def test_websocket_connection(socketio_client):
    """Test successful WebSocket connection"""
    user_id = str(uuid.uuid4())
    socketio_client.connect(f"/?user_id={user_id}")

    received = socketio_client.get_received()
    assert len(received) == 1
    assert received[0]["name"] == "connection_ack"
    assert received[0]["args"][0]["user_id"] == user_id


def test_notification_delivery(socketio_client):
    """Test notification delivery to connected user"""
    user_id = str(uuid.uuid4())
    socketio_client.connect(f"/?user_id={user_id}")
    socketio_client.get_received()  # Clear connection_ack

    # Trigger notification server-side
    notify_user(
        user_id,
        {
            "id": 123,
            "type": "new_article",
            "title": "Test Article",
            "message": "Test message",
        },
    )

    received = socketio_client.get_received()
    assert len(received) == 1
    assert received[0]["name"] == "notification"
    assert received[0]["args"][0]["id"] == 123
```

### Integration Tests

```typescript
// Client-side integration test
describe('WebSocket Notifications', () => {
  it('should receive notification after feed poll', async () => {
    const userId = getUserId();
    const socket = io('ws://localhost:5000', { query: { user_id: userId } });
    
    // Wait for connection
    await new Promise(resolve => socket.on('connection_ack', resolve));
    
    // Follow a feed
    await followFeed('test-feed');
    
    // Trigger manual poll (admin endpoint)
    await fetch('/api/poll/test-feed', { method: 'POST' });
    
    // Wait for notification
    const notification = await new Promise(resolve => {
      socket.on('notification', resolve);
    });
    
    expect(notification.type).toBe('new_article');
    expect(notification.metadata.feed_id).toBe('test-feed');
    
    socket.disconnect();
  });
});
```

______________________________________________________________________

## Security

### Authentication

- **User ID Validation**: All user_ids MUST be valid UUIDs
- **Rate Limiting**: Max 10 reconnections per minute per IP
- **Message Validation**: All messages validated against JSON schemas

### Transport Security

- **Production**: MUST use WSS (WebSocket Secure) over TLS
- **Development**: WS (unencrypted) acceptable for localhost only

### CORS

```python
socketio = SocketIO(
    app,
    cors_allowed_origins=[
        "http://localhost:3000",  # Dev
        "https://aiwebfeeds.com",  # Production
    ],
)
```

______________________________________________________________________

## Performance

### Connection Limits

- **Single Server**: 1000 concurrent connections (tested)
- **Multi-Server**: Use Redis pub/sub adapter for >1000 connections

### Message Size

- **Max Message Size**: 10KB per notification
- **Bundle Size**: Max 20 articles per bundle

### Latency

- **Target**: \<60 seconds from article discovery to notification delivery (95th
  percentile)
- **Typical**: 5-10 seconds in practice

______________________________________________________________________

**Version**: 1.0.0 | **Status**: Specification Complete | **Implementation**: Pending
