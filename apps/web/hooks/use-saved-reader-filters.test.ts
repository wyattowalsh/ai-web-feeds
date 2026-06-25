import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { FeedsWorkspaceInitialState } from "@/lib/reader-route-types";

import {
  filterPayloadToUrlOverrides,
  hasSavableReaderFilters,
  readerStateToFilterPayload,
  useSavedReaderFilters,
  type SavedReaderFilter,
} from "./use-saved-reader-filters";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";
const FILTER_ID = "33333333-3333-4333-8333-333333333333";

const { getStoredUserIdMock } = vi.hoisted(() => ({
  getStoredUserIdMock: vi.fn(() => VALID_USER_ID),
}));

vi.mock("@/lib/user-identity", () => ({
  getStoredUserId: getStoredUserIdMock,
}));

const defaultState: FeedsWorkspaceInitialState = {
  query: "",
  feedIds: [],
  sourceType: null,
  topics: [],
  verified: null,
  sort: "latest",
  readerView: "latest",
  cursor: 0,
};

const sampleFilter: SavedReaderFilter = {
  id: FILTER_ID,
  user_id: VALID_USER_ID,
  filter_name: "Unread agents",
  payload: {
    query: "agent",
    feedIds: ["feed-1"],
    sourceType: "blog",
    topics: ["agents"],
    verified: true,
    sort: "latest",
    readerView: "unread",
  },
  schema_version: "reader-filter-v1",
  use_count: 1,
  pinned: false,
  is_default: false,
  created_at: "2026-01-01T00:00:00.000Z",
  last_used_at: "2026-01-02T00:00:00.000Z",
};

describe("saved reader filter helpers", () => {
  it("maps reader state into a versioned payload", () => {
    expect(
      readerStateToFilterPayload({
        ...defaultState,
        query: "agents",
        topics: ["ml"],
        readerView: "unread",
      }),
    ).toEqual({
      query: "agents",
      feedIds: [],
      sourceType: null,
      topics: ["ml"],
      verified: null,
      sort: "latest",
      readerView: "unread",
    });
  });

  it("maps payload into URL overrides", () => {
    expect(filterPayloadToUrlOverrides(sampleFilter.payload)).toEqual({
      q: "agent",
      source_type: "blog",
      topics: "agents",
      verified: "true",
      reader_view: "unread",
      sort: null,
      feed: ["feed-1"],
      cursor: null,
    });
  });

  it("detects savable reader filters", () => {
    expect(hasSavableReaderFilters(defaultState)).toBe(false);
    expect(hasSavableReaderFilters({ ...defaultState, query: "ai" })).toBe(true);
    expect(hasSavableReaderFilters({ ...defaultState, readerView: "starred" })).toBe(true);
  });
});

describe("useSavedReaderFilters", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let onApplyPayload: ReturnType<typeof vi.fn>;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    onApplyPayload = vi.fn();
    getStoredUserIdMock.mockReturnValue(VALID_USER_ID);
    vi.stubGlobal("fetch", fetchMock);
  });

  it("loads saved filters for the stored user id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ filters: [sampleFilter], count: 1 }),
    });

    const { result } = renderHook(() =>
      useSavedReaderFilters({
        currentState: defaultState,
        onApplyPayload,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/user/filters?user_id=${encodeURIComponent(VALID_USER_ID)}`,
    );
    expect(result.current.userId).toBe(VALID_USER_ID);
    expect(result.current.filters).toEqual([sampleFilter]);
  });

  it("skips loading when no stored user id", async () => {
    getStoredUserIdMock.mockReturnValue(null);

    const { result } = renderHook(() =>
      useSavedReaderFilters({
        currentState: defaultState,
        onApplyPayload,
      }),
    );

    await waitFor(() => {
      expect(result.current.userId).toBeNull();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.filters).toEqual([]);
  });

  it("saves the current reader state as a preset", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ filters: [], count: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, filter: sampleFilter }),
      });

    const currentState = {
      ...defaultState,
      query: "agent",
      readerView: "unread" as const,
    };

    const { result } = renderHook(() =>
      useSavedReaderFilters({
        currentState,
        onApplyPayload,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let saved = false;
    await act(async () => {
      saved = await result.current.saveFilter("Unread agents");
    });

    expect(saved).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/user/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: VALID_USER_ID,
        filter_name: "Unread agents",
        payload: readerStateToFilterPayload(currentState),
      }),
    });
    expect(result.current.filters).toEqual([sampleFilter]);
  });

  it("deletes a saved preset", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ filters: [sampleFilter], count: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, id: FILTER_ID }),
      });

    const { result } = renderHook(() =>
      useSavedReaderFilters({
        currentState: defaultState,
        onApplyPayload,
      }),
    );

    await waitFor(() => {
      expect(result.current.filters).toHaveLength(1);
    });

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteFilter(FILTER_ID);
    });

    expect(deleted).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/user/filters?user_id=${encodeURIComponent(VALID_USER_ID)}&id=${encodeURIComponent(
        FILTER_ID,
      )}`,
      { method: "DELETE" },
    );
    expect(result.current.filters).toEqual([]);
  });

  it("applies a saved preset through the callback", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ filters: [sampleFilter], count: 1 }),
    });

    const { result } = renderHook(() =>
      useSavedReaderFilters({
        currentState: defaultState,
        onApplyPayload,
      }),
    );

    await waitFor(() => {
      expect(result.current.filters).toHaveLength(1);
    });

    act(() => {
      result.current.loadFilter(sampleFilter);
    });

    expect(onApplyPayload).toHaveBeenCalledWith(sampleFilter.payload);
  });
});
