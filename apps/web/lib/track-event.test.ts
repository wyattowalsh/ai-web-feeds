import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TELEMETRY_EVENTS_ENDPOINT,
  TELEMETRY_SESSION_STORAGE_KEY,
  getTelemetrySessionId,
  trackEvent,
} from "@/lib/track-event";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

function createSessionStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

describe("track-event", () => {
  beforeEach(() => {
    const sessionStorageMock = createSessionStorageMock();
    const localStorageMock = createLocalStorageMock();

    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "22222222-2222-4222-8222-222222222222"),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 202 })));
    vi.stubGlobal("window", {
      sessionStorage: sessionStorageMock,
      localStorage: localStorageMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates and reuses a telemetry session id in sessionStorage", () => {
    const first = getTelemetrySessionId();
    const second = getTelemetrySessionId();

    expect(first).toBe("22222222-2222-4222-8222-222222222222");
    expect(second).toBe(first);
    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
      TELEMETRY_SESSION_STORAGE_KEY,
      first,
    );
  });

  it("posts client events with session_id, surface, and properties", async () => {
    window.localStorage.setItem("aiwebfeeds_user_id", VALID_USER_ID);

    await trackEvent("reader.article.open", {
      surface: "reader",
      properties: { articleId: "article-1" },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toBe(TELEMETRY_EVENTS_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(init?.keepalive).toBe(true);

    const body = JSON.parse(String(init?.body));
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      eventName: "reader.article.open",
      surface: "reader",
      sessionId: "22222222-2222-4222-8222-222222222222",
      userId: VALID_USER_ID,
      properties: { articleId: "article-1" },
    });
  });

  it("no-ops during SSR", async () => {
    vi.stubGlobal("window", undefined);

    await trackEvent("reader.scroll", { surface: "reader" });

    expect(fetch).not.toHaveBeenCalled();
  });
});
