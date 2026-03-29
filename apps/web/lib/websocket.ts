/**
 * WebSocket client for real-time notifications
 *
 * Socket.IO client wrapper for connecting to the Phase 3B WebSocket server.
 */

import { io, Socket } from "socket.io-client";
import { getUserId } from "./user-identity";

/**
 * Notification message from WebSocket
 */
export interface WebSocketNotification {
  id: number;
  type: "new_article" | "trending_topic" | "feed_updated" | "system_alert";
  title: string;
  message: string;
  action_url?: string;
  metadata: Record<string, unknown>;
  read_at?: string;
  dismissed_at?: string;
  created_at: string;
}

/**
 * Trending topic alert from WebSocket
 */
export interface TrendingAlert {
  topic_id: string;
  z_score: number;
  article_count: number;
  timestamp: number;
}

export interface WebSocketState {
  notifications: WebSocketNotification[];
  trendingAlerts: TrendingAlert[];
  isConnected: boolean;
  error: string | null;
}

export const EMPTY_WEBSOCKET_STATE: WebSocketState = {
  notifications: [],
  trendingAlerts: [],
  isConnected: false,
  error: null,
};

type WebSocketSubscriber = () => void;

type SocketWithLifecycle = Socket & {
  active?: boolean;
};

function createInitialWebSocketState(): WebSocketState {
  return {
    notifications: [],
    trendingAlerts: [],
    isConnected: false,
    error: null,
  };
}

/**
 * WebSocket connection manager
 */
export class WebSocketClient {
  private socket: SocketWithLifecycle | null = null;
  private readonly subscribers = new Set<WebSocketSubscriber>();
  private readonly serverUrl: string;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private state = createInitialWebSocketState();

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  subscribe(listener: WebSocketSubscriber): () => void {
    this.subscribers.add(listener);
    this.connect();

    return () => {
      this.subscribers.delete(listener);

      if (this.subscribers.size === 0) {
        this.disconnect();
      }
    };
  }

  getSnapshot(): WebSocketState {
    return this.state;
  }

  /**
   * Connect to WebSocket server and authenticate
   */
  connect(): void {
    if (this.socket?.connected || this.socket?.active) {
      return;
    }

    if (this.socket) {
      const staleSocket = this.socket;
      this.socket = null;
      staleSocket.disconnect();
    }

    const socket = io(this.serverUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    }) as SocketWithLifecycle;

    this.socket = socket;
    this.registerSocketHandlers(socket);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      const activeSocket = this.socket;
      this.socket = null;
      activeSocket.disconnect();
    }

    this.updateState(() => createInitialWebSocketState());
  }

  /**
   * Mark notification as read
   */
  markRead(notificationId: number): void {
    const socket = this.socket;
    if (!socket?.connected) {
      return;
    }

    socket.emit("mark_read", { notification_id: notificationId });

    this.updateState((state) => {
      let didUpdate = false;
      const notifications = state.notifications.map((notification) => {
        if (notification.id !== notificationId || notification.read_at) {
          return notification;
        }

        didUpdate = true;
        return { ...notification, read_at: new Date().toISOString() };
      });

      return didUpdate ? { ...state, notifications } : state;
    });
  }

  /**
   * Dismiss notification
   */
  dismiss(notificationId: number): void {
    const socket = this.socket;
    if (!socket?.connected) {
      return;
    }

    socket.emit("dismiss", { notification_id: notificationId });

    this.updateState((state) => {
      const notifications = state.notifications.filter((notification) => notification.id !== notificationId);
      return notifications.length === state.notifications.length ? state : { ...state, notifications };
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  private registerSocketHandlers(socket: SocketWithLifecycle): void {
    socket.on("connect", () => {
      if (this.socket !== socket) {
        return;
      }

      console.log("WebSocket connected");
      this.reconnectAttempts = 0;

      const userId = getUserId();
      socket.emit("authenticate", { user_id: userId });

      this.updateState((state) => ({ ...state, isConnected: true, error: null }));
    });

    socket.on("disconnect", (reason) => {
      if (this.socket !== socket) {
        return;
      }

      console.log("WebSocket disconnected:", reason);
      const shouldReconnect = reason === "io server disconnect" && this.subscribers.size > 0;
      if (shouldReconnect) {
        this.socket = null;
      }
      this.updateState((state) => (state.isConnected ? { ...state, isConnected: false } : state));

      if (shouldReconnect) {
        this.connect();
      }
    });

    socket.on("notification", (data: WebSocketNotification) => {
      if (this.socket !== socket) {
        return;
      }

      this.updateState((state) => ({
        ...state,
        notifications: [data, ...state.notifications],
      }));
    });

    socket.on("trending_alert", (data: TrendingAlert) => {
      if (this.socket !== socket) {
        return;
      }

      this.updateState((state) => ({
        ...state,
        trendingAlerts: [data, ...state.trendingAlerts].slice(0, 10),
      }));
    });

    socket.on("notifications_history", (data: { notifications: WebSocketNotification[] }) => {
      if (this.socket !== socket) {
        return;
      }

      this.updateState((state) => ({ ...state, notifications: data.notifications }));
    });

    socket.on("error", (data: { message: string }) => {
      if (this.socket !== socket) {
        return;
      }

      console.error("WebSocket error:", data.message);
      this.updateState((state) => ({ ...state, error: data.message }));
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
      if (this.socket !== socket) {
        return;
      }

      this.reconnectAttempts = attemptNumber;
      console.log(`WebSocket reconnect attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
    });

    socket.on("reconnect_failed", () => {
      if (this.socket !== socket) {
        return;
      }

      console.error("WebSocket reconnection failed after max attempts");
      this.socket = null;
      this.updateState((state) => ({
        ...state,
        error: "Connection failed. Please refresh the page.",
      }));
    });
  }

  private updateState(updater: (state: WebSocketState) => WebSocketState): void {
    const nextState = updater(this.state);

    if (nextState === this.state) {
      return;
    }

    this.state = nextState;
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    for (const subscriber of [...this.subscribers]) {
      subscriber();
    }
  }
}

// Singleton instance for app-wide use
let globalWebSocket: WebSocketClient | null = null;

function resolveWebSocketServerUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }

  const isLocalHost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocalHost) {
    return "http://localhost:8000";
  }

  return window.location.origin;
}

/**
 * Get global WebSocket client instance
 */
export function getWebSocketClient(): WebSocketClient {
  if (!globalWebSocket) {
    const serverUrl = resolveWebSocketServerUrl();
    globalWebSocket = new WebSocketClient(serverUrl);
  }
  return globalWebSocket;
}
