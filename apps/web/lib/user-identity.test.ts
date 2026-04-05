import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANON_USER_ID_RESPONSE_HEADER } from "@/lib/user-auth";
import {
  clearUserId,
  ensureAnonymousUserId,
  fetchWithAnonymousIdentity,
  getStoredUserId,
  getUserId,
  hasUserId,
  syncAnonymousUserIdFromResponse,
} from "@/lib/user-identity";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

function createStorageMock() {
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

describe("user-identity", () => {
  beforeEach(() => {
    const localStorageMock = createStorageMock();
    vi.stubGlobal("window", {
      localStorage: localStorageMock,
    });
    clearUserId();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns null during SSR instead of an SSR placeholder", () => {
    vi.stubGlobal("window", undefined);

    expect(getUserId()).toBeNull();
    expect(hasUserId()).toBe(false);
  });

  it("syncs anonymous identity headers into localStorage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          [ANON_USER_ID_RESPONSE_HEADER]: VALID_USER_ID,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithAnonymousIdentity("/api/test");

    expect(syncAnonymousUserIdFromResponse(response)).toBe(VALID_USER_ID);
    expect(getStoredUserId()).toBe(VALID_USER_ID);
    expect(hasUserId()).toBe(true);
  });

  it("bootstraps anonymous identity once per page lifecycle", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user_id: VALID_USER_ID }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          [ANON_USER_ID_RESPONSE_HEADER]: VALID_USER_ID,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([ensureAnonymousUserId(), ensureAnonymousUserId()]);

    expect(first).toBe(VALID_USER_ID);
    expect(second).toBe(VALID_USER_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getStoredUserId()).toBe(VALID_USER_ID);
  });

  it("reuses the stored identity after bootstrap without issuing another network request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user_id: VALID_USER_ID }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          [ANON_USER_ID_RESPONSE_HEADER]: VALID_USER_ID,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await ensureAnonymousUserId()).toBe(VALID_USER_ID);
    expect(await ensureAnonymousUserId()).toBe(VALID_USER_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getStoredUserId()).toBe(VALID_USER_ID);
  });

  it("does not clear stored identity when a response omits the anonymous identity header", () => {
    const response = new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });

    syncAnonymousUserIdFromResponse(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          [ANON_USER_ID_RESPONSE_HEADER]: VALID_USER_ID,
        },
      }),
    );

    expect(syncAnonymousUserIdFromResponse(response)).toBe(VALID_USER_ID);
    expect(getStoredUserId()).toBe(VALID_USER_ID);
  });
});
