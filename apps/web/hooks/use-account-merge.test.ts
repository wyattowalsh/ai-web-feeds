import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const ANON_USER_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_USER_ID = "session-user-abc123";

const { getStoredUserIdMock, setUserIdMock, useSessionMock, getSessionMock, onMergedMock } =
  vi.hoisted(() => ({
    getStoredUserIdMock: vi.fn(() => ANON_USER_ID),
    setUserIdMock: vi.fn(),
    useSessionMock: vi.fn(),
    getSessionMock: vi.fn(),
    onMergedMock: vi.fn(),
  }));

vi.mock("@/lib/user-identity", () => ({
  getStoredUserId: getStoredUserIdMock,
  setUserId: setUserIdMock,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: useSessionMock,
    getSession: getSessionMock,
  },
}));

import {
  isMergeDoneForSession,
  markMergeDoneForSession,
  mergeAnonymousAccount,
  mergeDoneStorageKey,
  runPostAuthSync,
  useAccountMerge,
} from "./use-account-merge";

function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("mergeAnonymousAccount", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    getStoredUserIdMock.mockReturnValue(ANON_USER_ID);
    setUserIdMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips when merge was already completed for the session", async () => {
    markMergeDoneForSession(SESSION_USER_ID);
    const fetchMock = vi.fn();

    const result = await mergeAnonymousAccount({
      sessionUserId: SESSION_USER_ID,
      fetchImpl: fetchMock,
    });

    expect(result).toEqual({
      success: true,
      skipped: true,
      reason: "already_merged",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips when no anonymous user id is stored", async () => {
    getStoredUserIdMock.mockReturnValue(null);
    const fetchMock = vi.fn();

    const result = await mergeAnonymousAccount({
      sessionUserId: SESSION_USER_ID,
      fetchImpl: fetchMock,
    });

    expect(result).toEqual({
      success: true,
      skipped: true,
      reason: "no_anonymous_user",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts merge payload and marks completion on success", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        merged: { reader_filters: 2, follows: 1 },
      }),
    })) as unknown as typeof fetch;

    const result = await mergeAnonymousAccount({
      sessionUserId: SESSION_USER_ID,
      anonymousUserId: ANON_USER_ID,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/user/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        from_user_id: ANON_USER_ID,
        to_user_id: SESSION_USER_ID,
      }),
    });
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.merged).toEqual({ reader_filters: 2, follows: 1 });
    expect(isMergeDoneForSession(SESSION_USER_ID)).toBe(true);
    expect(setUserIdMock).toHaveBeenCalledWith(SESSION_USER_ID);
  });

  it("uses the expected localStorage flag key", () => {
    expect(mergeDoneStorageKey(SESSION_USER_ID)).toBe(`aiwf_merge_done_for:${SESSION_USER_ID}`);
  });
});

describe("runPostAuthSync", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    getStoredUserIdMock.mockReturnValue(ANON_USER_ID);
    getSessionMock.mockResolvedValue({
      data: { user: { id: SESSION_USER_ID } },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges and hydrates when a session is available", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, merged: { follows: 1 } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const hydrateMock = vi.fn(async () => undefined);
    const onSuccessMock = vi.fn();

    const result = await runPostAuthSync({
      hydrate: hydrateMock,
      onSuccess: onSuccessMock,
    });

    expect(result.merge.success).toBe(true);
    expect(result.hydrated).toBe(true);
    expect(hydrateMock).toHaveBeenCalledTimes(1);
    expect(onSuccessMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/user/merge",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});

describe("useAccountMerge", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
    getStoredUserIdMock.mockReturnValue(ANON_USER_ID);
    onMergedMock.mockReset();
    useSessionMock.mockReturnValue({
      data: { user: { id: SESSION_USER_ID } },
      isPending: false,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, merged: { saved_searches: 1 } }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auto-runs merge when a session is present", async () => {
    renderHook(() =>
      useAccountMerge({
        onMerged: onMergedMock,
      }),
    );

    await waitFor(() => {
      expect(onMergedMock).toHaveBeenCalled();
    });

    expect(isMergeDoneForSession(SESSION_USER_ID)).toBe(true);
    expect(setUserIdMock).toHaveBeenCalledWith(SESSION_USER_ID);
  });

  it("exposes manual runMerge", async () => {
    const { result } = renderHook(() => useAccountMerge({ enabled: false }));

    await act(async () => {
      const mergeResult = await result.current.runMerge(SESSION_USER_ID);
      expect(mergeResult.success).toBe(true);
    });
  });
});
