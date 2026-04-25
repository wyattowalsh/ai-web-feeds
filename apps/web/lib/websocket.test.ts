import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type EventHandler = (...args: unknown[]) => void;

type SocketMock = {
  active?: boolean;
  connected: boolean;
  handlers: Record<string, EventHandler>;
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

let currentSocket: SocketMock;

const ioMock = vi.fn(() => currentSocket);
const ensureAnonymousUserIdMock = vi.fn(async () => "11111111-1111-4111-8111-111111111111");
const fetchWithAnonymousIdentityMock = vi.fn(
  async () =>
    new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "x-aiwf-anonymous-user-id": "11111111-1111-4111-8111-111111111111",
      },
    }),
);

vi.mock("socket.io-client", () => ({
  io: ioMock,
}));

vi.mock("./user-identity", () => ({
  ensureAnonymousUserId: ensureAnonymousUserIdMock,
  fetchWithAnonymousIdentity: fetchWithAnonymousIdentityMock,
}));

function createSocketMock(): SocketMock {
  const handlers: Record<string, EventHandler> = {};
  const socket: SocketMock = {
    active: true,
    connected: false,
    handlers,
    on: vi.fn((event: string, handler: EventHandler) => {
      handlers[event] = handler;
      return socket;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(() => {
      socket.active = false;
      socket.connected = false;
    }),
  };

  return socket;
}

function createNotification(id: number) {
  return {
    id,
    type: "new_article" as const,
    title: `Notification ${id}`,
    message: `Message ${id}`,
    metadata: {},
    created_at: `2025-10-18T00:00:0${id}Z`,
  };
}

describe("websocket", () => {
  beforeEach(() => {
    currentSocket = createSocketMock();
    ioMock.mockClear();
    ensureAnonymousUserIdMock.mockClear();
    fetchWithAnonymousIdentityMock.mockClear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("connects, authenticates, tracks shared state, and notifies subscribers", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { WebSocketClient } = await import("./websocket");

    const client = new WebSocketClient("https://ws.example.com");
    const subscriber = vi.fn();
    const unsubscribe = client.subscribe(subscriber);

    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(1);
    });
    expect(ioMock).toHaveBeenCalledWith(
      "https://ws.example.com",
      expect.objectContaining({
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      }),
    );

    currentSocket.active = true;
    currentSocket.connected = true;
    currentSocket.handlers.connect();

    expect(ensureAnonymousUserIdMock).toHaveBeenCalledTimes(1);
    expect(currentSocket.emit).toHaveBeenCalledWith("authenticate", {
      user_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(client.isConnected()).toBe(true);
    expect(client.getSnapshot()).toMatchObject({ isConnected: true, error: null });

    const firstNotification = createNotification(1);
    const secondNotification = createNotification(2);
    currentSocket.handlers.notifications_history({ notifications: [firstNotification] });
    expect(client.getSnapshot().notifications).toEqual([firstNotification]);

    currentSocket.handlers.notification(secondNotification);
    expect(client.getSnapshot().notifications).toEqual([secondNotification, firstNotification]);

    const alert = {
      topic_id: "ai",
      z_score: 3.2,
      article_count: 14,
      timestamp: 1_728_000_000,
    };
    currentSocket.handlers.trending_alert(alert);
    expect(client.getSnapshot().trendingAlerts).toEqual([alert]);

    currentSocket.handlers.error({ message: "socket blew up" });
    expect(errorSpy).toHaveBeenCalledWith("WebSocket error:", "socket blew up");
    expect(client.getSnapshot().error).toBe("socket blew up");

    client.markRead(2);
    await vi.waitFor(() => {
      expect(fetchWithAnonymousIdentityMock).toHaveBeenCalledWith(
        "/api/notifications/2",
        expect.objectContaining({
          method: "PATCH",
        }),
      );
    });
    expect(client.getSnapshot().notifications[0]).toMatchObject({
      id: 2,
      read_at: expect.any(String),
    });

    client.dismiss(1);
    await vi.waitFor(() => {
      expect(fetchWithAnonymousIdentityMock).toHaveBeenCalledWith(
        "/api/notifications/1",
        expect.objectContaining({
          method: "PATCH",
        }),
      );
    });
    expect(client.getSnapshot().notifications).toHaveLength(1);
    expect(client.getSnapshot().notifications[0]?.id).toBe(2);

    currentSocket.active = false;
    currentSocket.connected = false;
    currentSocket.handlers.disconnect("transport close");
    expect(client.isConnected()).toBe(false);

    currentSocket.handlers.reconnect_failed();
    expect(client.getSnapshot().error).toBe("Connection failed. Please refresh the page.");
    expect(subscriber).toHaveBeenCalled();

    unsubscribe();
    expect(client.getSnapshot()).toEqual({
      notifications: [],
      trendingAlerts: [],
      isConnected: false,
      error: null,
    });

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("shares a single socket across subscribers and reference counts cleanup", async () => {
    const { WebSocketClient } = await import("./websocket");

    const client = new WebSocketClient("https://ws.example.com");
    const firstSubscriber = vi.fn();
    const secondSubscriber = vi.fn();

    const unsubscribeFirst = client.subscribe(firstSubscriber);
    const unsubscribeSecond = client.subscribe(secondSubscriber);

    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(1);
    });

    currentSocket.active = true;
    currentSocket.connected = true;
    currentSocket.handlers.connect();
    expect(firstSubscriber).toHaveBeenCalled();
    expect(secondSubscriber).toHaveBeenCalled();

    unsubscribeFirst();
    expect(currentSocket.disconnect).not.toHaveBeenCalled();

    currentSocket.handlers.notification(createNotification(3));
    expect(secondSubscriber).toHaveBeenCalled();

    unsubscribeSecond();
    expect(currentSocket.disconnect).toHaveBeenCalledTimes(1);
  });

  it("creates a fresh socket after server disconnect and ignores stale socket events", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { WebSocketClient } = await import("./websocket");

    const client = new WebSocketClient("https://ws.example.com");
    client.subscribe(vi.fn());

    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(1);
    });
    currentSocket.active = true;
    currentSocket.connected = true;
    currentSocket.handlers.connect();

    const staleSocket = currentSocket;
    const replacementSocket = createSocketMock();
    currentSocket = replacementSocket;
    staleSocket.active = false;
    staleSocket.connected = false;
    staleSocket.handlers.disconnect("io server disconnect");

    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(2);
    });

    currentSocket.active = true;
    currentSocket.connected = true;
    currentSocket.handlers.connect();

    staleSocket.handlers.notification(createNotification(9));
    expect(client.getSnapshot().notifications).toEqual([]);

    currentSocket.handlers.notification(createNotification(4));
    expect(client.getSnapshot().notifications[0]?.id).toBe(4);

    logSpy.mockRestore();
  });

  it("creates a fresh socket after reconnect failure and resets state on teardown", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { WebSocketClient } = await import("./websocket");

    const client = new WebSocketClient("https://ws.example.com");
    const unsubscribeFirst = client.subscribe(vi.fn());

    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(1);
    });
    currentSocket.active = true;
    currentSocket.connected = true;
    currentSocket.handlers.connect();
    currentSocket.handlers.notifications_history({ notifications: [createNotification(1)] });
    currentSocket.active = false;
    currentSocket.handlers.reconnect_failed();

    expect(client.getSnapshot().error).toBe("Connection failed. Please refresh the page.");

    currentSocket = createSocketMock();
    const unsubscribeSecond = client.subscribe(vi.fn());

    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(2);
    });

    unsubscribeFirst();
    unsubscribeSecond();

    expect(client.getSnapshot()).toEqual({
      notifications: [],
      trendingAlerts: [],
      isConnected: false,
      error: null,
    });

    errorSpy.mockRestore();
  });

  it("updates notification state through HTTP routes even while disconnected", async () => {
    const { WebSocketClient } = await import("./websocket");

    const client = new WebSocketClient("https://ws.example.com");
    client.subscribe(vi.fn());

    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(1);
    });
    currentSocket.active = true;
    currentSocket.connected = true;
    currentSocket.handlers.connect();

    const notification = createNotification(1);
    currentSocket.handlers.notifications_history({ notifications: [notification] });

    currentSocket.active = false;
    currentSocket.connected = false;
    currentSocket.handlers.disconnect("transport close");

    client.markRead(1);
    client.dismiss(1);

    await vi.waitFor(() => {
      expect(fetchWithAnonymousIdentityMock).toHaveBeenCalledWith(
        "/api/notifications/1",
        expect.objectContaining({
          method: "PATCH",
        }),
      );
    });
    expect(client.getSnapshot().notifications).toEqual([]);
  });

  it("reuses the singleton client within a module load", async () => {
    vi.stubEnv("NEXT_PUBLIC_WEBSOCKET_URL", "  https://configured.example.com  ");

    const { getWebSocketClient } = await import("./websocket");
    const first = getWebSocketClient();
    const second = getWebSocketClient();

    expect(first).toBe(second);

    first.connect();
    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(1);
    });

    expect(ioMock).toHaveBeenCalledWith(
      "https://configured.example.com",
      expect.objectContaining({
        transports: ["websocket", "polling"],
      }),
    );
  });

  it("resolves localhost and remote browser websocket URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_WEBSOCKET_URL", "");
    vi.stubGlobal("window", {
      location: {
        hostname: "localhost",
        origin: "http://localhost:3000",
      },
    });

    const localhostModule = await import("./websocket");
    const localhostClient = localhostModule.getWebSocketClient();
    localhostClient.connect();
    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(1);
    });

    expect(ioMock).toHaveBeenCalledWith(
      "http://localhost:8000",
      expect.objectContaining({
        transports: ["websocket", "polling"],
      }),
    );

    vi.resetModules();
    currentSocket = createSocketMock();
    vi.stubEnv("NEXT_PUBLIC_WEBSOCKET_URL", "");
    vi.stubGlobal("window", {
      location: {
        hostname: "aiwebfeeds.com",
        origin: "https://aiwebfeeds.com",
      },
    });

    const remoteModule = await import("./websocket");
    const remoteClient = remoteModule.getWebSocketClient();
    remoteClient.connect();
    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(2);
    });

    expect(ioMock).toHaveBeenCalledWith(
      "https://aiwebfeeds.com",
      expect.objectContaining({
        transports: ["websocket", "polling"],
      }),
    );
  });

  it("falls back to the default server URL during SSR", async () => {
    vi.stubEnv("NEXT_PUBLIC_WEBSOCKET_URL", "");
    vi.stubGlobal("window", undefined);

    const { getWebSocketClient } = await import("./websocket");
    const client = getWebSocketClient();
    client.connect();
    await vi.waitFor(() => {
      expect(ioMock).toHaveBeenCalledTimes(1);
    });

    expect(ioMock).toHaveBeenCalledWith(
      "http://localhost:8000",
      expect.objectContaining({
        transports: ["websocket", "polling"],
      }),
    );
  });
});
