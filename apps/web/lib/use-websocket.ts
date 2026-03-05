/**
 * React hook for WebSocket notifications
 *
 * Provides React components with real-time notification functionality.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getWebSocketClient,
  WebSocketNotification,
  TrendingAlert,
} from "./websocket";

/**
 * WebSocket connection hook
 *
 * Usage:
 * ```tsx
 * const { notifications, isConnected, markRead, dismiss } = useWebSocket();
 * ```
 */
export function useWebSocket() {
  const [notifications, setNotifications] = useState<WebSocketNotification[]>([]);
  const [trendingAlerts, setTrendingAlerts] = useState<TrendingAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = getWebSocketClient();

  useEffect(() => {
    // Connect to WebSocket server
    client.connect({
      onConnect: () => {
        setIsConnected(true);
        setError(null);
      },

      onDisconnect: () => {
        setIsConnected(false);
      },

      onNotification: (notification) => {
        setNotifications((prev) => [notification, ...prev]);
      },

      onTrendingAlert: (alert) => {
        setTrendingAlerts((prev) => [alert, ...prev].slice(0, 10)); // Keep last 10
      },

      onNotificationsHistory: (history) => {
        setNotifications(history);
      },

      onError: (errorMessage) => {
        setError(errorMessage);
      },
    });

    // Cleanup on unmount
    return () => {
      client.disconnect();
    };
  }, [client]);

  const markRead = useCallback(
    (notificationId: number) => {
      client.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
    },
    [client]
  );

  const dismiss = useCallback(
    (notificationId: number) => {
      client.dismiss(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    },
    [client]
  );

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    notifications,
    trendingAlerts,
    isConnected,
    error,
    unreadCount,
    markRead,
    dismiss,
  };
}

/**
 * Lightweight hook for connection status only
 */
export function useWebSocketStatus() {
  const [isConnected, setIsConnected] = useState(false);

  const client = getWebSocketClient();

  useEffect(() => {
    setIsConnected(client.isConnected());

    const interval = setInterval(() => {
      setIsConnected(client.isConnected());
    }, 5000); // Check every 5s

    return () => clearInterval(interval);
  }, [client]);

  return { isConnected };
}

