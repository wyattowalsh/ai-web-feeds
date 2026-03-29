import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_WEBSOCKET_STATE,
  getWebSocketClient,
  type WebSocketState,
} from "./websocket";

function useSharedWebSocketState(): {
  client: ReturnType<typeof getWebSocketClient> | null;
  snapshot: WebSocketState;
} {
  const client = typeof window === "undefined" ? null : getWebSocketClient();

  const subscribe = useCallback(
    (listener: () => void) => (client ? client.subscribe(listener) : () => {}),
    [client],
  );

  const getSnapshot = useCallback(
    () => (client ? client.getSnapshot() : EMPTY_WEBSOCKET_STATE),
    [client],
  );

  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_WEBSOCKET_STATE,
  );

  return { client, snapshot };
}

/**
 * React hook for WebSocket notifications and trending alerts.
 *
 * Multiple consumers safely share the singleton client and receive the same
 * state updates without overwriting each other's handlers.
 *
 * Usage:
 * ```tsx
 * const { notifications, isConnected, markRead, dismiss } = useWebSocket();
 * ```
 */
export function useWebSocket() {
  const { client, snapshot } = useSharedWebSocketState();

  const markRead = useCallback(
    (notificationId: number) => {
      client?.markRead(notificationId);
    },
    [client],
  );

  const dismiss = useCallback(
    (notificationId: number) => {
      client?.dismiss(notificationId);
    },
    [client],
  );

  const unreadCount = snapshot.notifications.filter((notification) => !notification.read_at).length;

  return {
    notifications: snapshot.notifications,
    trendingAlerts: snapshot.trendingAlerts,
    isConnected: snapshot.isConnected,
    error: snapshot.error,
    unreadCount,
    markRead,
    dismiss,
  };
}

/**
 * Lightweight hook for connection status only.
 */
export function useWebSocketStatus() {
  const { snapshot } = useSharedWebSocketState();
  return { isConnected: snapshot.isConnected };
}
