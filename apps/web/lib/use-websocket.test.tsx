import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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
const getUserIdMock = vi.fn(() => "user-123");

vi.mock("socket.io-client", () => ({
  io: ioMock,
}));

vi.mock("./user-identity", () => ({
  getUserId: getUserIdMock,
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

describe("useWebSocket", () => {
  beforeEach(() => {
    currentSocket = createSocketMock();
    ioMock.mockClear();
    getUserIdMock.mockClear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shares one websocket connection across mounted consumers", async () => {
    const { useWebSocket } = await import("./use-websocket");

    function Probe({ name }: { name: string }) {
      const { notifications, unreadCount, isConnected } = useWebSocket();

      return (
        <div>
          <div data-testid={`${name}-count`}>{notifications.length}</div>
          <div data-testid={`${name}-unread`}>{unreadCount}</div>
          <div data-testid={`${name}-connected`}>{String(isConnected)}</div>
        </div>
      );
    }

    function Harness() {
      const [showSecondary, setShowSecondary] = useState(true);

      return (
        <>
          <Probe name="primary" />
          {showSecondary ? <Probe name="secondary" /> : null}
          <button onClick={() => setShowSecondary(false)}>hide secondary</button>
        </>
      );
    }

    const { unmount } = render(<Harness />);

    expect(ioMock).toHaveBeenCalledTimes(1);

    act(() => {
      currentSocket.active = true;
      currentSocket.connected = true;
      currentSocket.handlers.connect();
      currentSocket.handlers.notifications_history({ notifications: [createNotification(1)] });
    });

    expect(screen.getByTestId("primary-count").textContent).toBe("1");
    expect(screen.getByTestId("secondary-count").textContent).toBe("1");
    expect(screen.getByTestId("primary-unread").textContent).toBe("1");
    expect(screen.getByTestId("secondary-unread").textContent).toBe("1");
    expect(screen.getByTestId("primary-connected").textContent).toBe("true");
    expect(screen.getByTestId("secondary-connected").textContent).toBe("true");

    act(() => {
      currentSocket.handlers.notification(createNotification(2));
    });

    expect(screen.getByTestId("primary-count").textContent).toBe("2");
    expect(screen.getByTestId("secondary-count").textContent).toBe("2");

    fireEvent.click(screen.getByText("hide secondary"));
    expect(currentSocket.disconnect).not.toHaveBeenCalled();

    act(() => {
      currentSocket.handlers.notification(createNotification(3));
    });

    expect(screen.getByTestId("primary-count").textContent).toBe("3");
    expect(screen.queryByTestId("secondary-count")).toBeNull();

    unmount();
    expect(currentSocket.disconnect).toHaveBeenCalledTimes(1);

    currentSocket = createSocketMock();
    const { unmount: unmountFresh } = render(<Probe name="fresh" />);

    expect(ioMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("fresh-count").textContent).toBe("0");
    expect(screen.getByTestId("fresh-unread").textContent).toBe("0");
    expect(screen.getByTestId("fresh-connected").textContent).toBe("false");

    unmountFresh();
  });
});
