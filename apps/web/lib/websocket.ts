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
  metadata: Record<string, any>;
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

/**
 * WebSocket event handlers
 */
export interface WebSocketHandlers {
  onNotification?: (notification: WebSocketNotification) => void;
  onTrendingAlert?: (alert: TrendingAlert) => void;
  onNotificationsHistory?: (notifications: WebSocketNotification[]) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * WebSocket connection manager
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private handlers: WebSocketHandlers = {};
  private serverUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(serverUrl: string = "http://localhost:8000") {
    this.serverUrl = serverUrl;
  }

  /**
   * Connect to WebSocket server and authenticate
   */
  connect(handlers: WebSocketHandlers = {}): void {
    if (this.socket?.connected) {
      console.warn("WebSocket already connected");
      return;
    }

    this.handlers = handlers;

    // Create Socket.IO client
    this.socket = io(this.serverUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Register event handlers
    this.socket.on("connect", () => {
      console.log("WebSocket connected");
      this.reconnectAttempts = 0;

      // Authenticate with user ID
      const userId = getUserId();
      this.socket?.emit("authenticate", { user_id: userId });

      this.handlers.onConnect?.();
    });

    this.socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
      this.handlers.onDisconnect?.();
    });

    this.socket.on("notification", (data: WebSocketNotification) => {
      this.handlers.onNotification?.(data);
    });

    this.socket.on("trending_alert", (data: TrendingAlert) => {
      this.handlers.onTrendingAlert?.(data);
    });

    this.socket.on("notifications_history", (data: { notifications: WebSocketNotification[] }) => {
      this.handlers.onNotificationsHistory?.(data.notifications);
    });

    this.socket.on("error", (data: { message: string }) => {
      console.error("WebSocket error:", data.message);
      this.handlers.onError?.(data.message);
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`WebSocket reconnect attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
    });

    this.socket.on("reconnect_failed", () => {
      console.error("WebSocket reconnection failed after max attempts");
      this.handlers.onError?.("Connection failed. Please refresh the page.");
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Mark notification as read
   */
  markRead(notificationId: number): void {
    this.socket?.emit("mark_read", { notification_id: notificationId });
  }

  /**
   * Dismiss notification
   */
  dismiss(notificationId: number): void {
    this.socket?.emit("dismiss", { notification_id: notificationId });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance for app-wide use
let globalWebSocket: WebSocketClient | null = null;

/**
 * Get global WebSocket client instance
 */
export function getWebSocketClient(): WebSocketClient {
  if (!globalWebSocket) {
    const serverUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:8000";
    globalWebSocket = new WebSocketClient(serverUrl);
  }
  return globalWebSocket;
}

