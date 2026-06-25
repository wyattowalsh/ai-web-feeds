import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const SESSION_USER_ID = "session-user-abc123";
const FILTER_ID = "33333333-3333-4333-8333-333333333333";

const { saveArticleStatesToIDBMock, preferencesGetMock, preferencesPutMock } = vi.hoisted(() => ({
  saveArticleStatesToIDBMock: vi.fn(async () => undefined),
  preferencesGetMock: vi.fn(async () => ({
    id: "user_prefs" as const,
    theme: "system" as const,
    fontSize: 16,
    fontFamily: "system-ui",
    readingWidth: "medium" as const,
    layout: "cards" as const,
    showImages: true,
    showSummaries: true,
    markAsReadOnScroll: false,
    keyboardShortcuts: {},
    offlineMode: false,
    syncOnStartup: true,
    updatedAt: 1,
  })),
  preferencesPutMock: vi.fn(async () => undefined),
}));

vi.mock("@/lib/reader/hydrate-article-state", () => ({
  saveArticleStatesToIDB: saveArticleStatesToIDBMock,
}));

vi.mock("@/lib/db", () => ({
  preferences: {
    get: preferencesGetMock,
    put: preferencesPutMock,
  },
}));

import {
  hydrateFromServer,
  persistServerUserCache,
  useServerHydration,
} from "./use-server-hydration";

function createFetchMock(handlers: Record<string, () => Promise<Response>>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const handler = Object.entries(handlers).find(([pattern]) => url.includes(pattern))?.[1];
    if (!handler) {
      throw new Error(`Unhandled fetch: ${url}`);
    }
    return handler();
  }) as unknown as typeof fetch;
}

describe("persistServerUserCache", () => {
  beforeEach(() => {
    saveArticleStatesToIDBMock.mockClear();
    preferencesGetMock.mockClear();
    preferencesPutMock.mockClear();
  });

  it("writes article states and server snapshots into preferences", async () => {
    await persistServerUserCache({
      sessionUserId: SESSION_USER_ID,
      filters: [
        {
          id: FILTER_ID,
          user_id: SESSION_USER_ID,
          filter_name: "Agents",
          payload: {
            query: "agent",
            feedIds: [],
            sourceType: null,
            topics: [],
            verified: null,
            sort: "latest",
            readerView: "latest",
          },
          schema_version: "reader-filter-v1",
          use_count: 0,
          pinned: false,
          is_default: false,
          created_at: "2026-01-01T00:00:00.000Z",
          last_used_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      follows: [{ source_id: "openai-blog", followed_at: "2026-01-01T00:00:00.000Z" }],
      savedSearches: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          user_id: SESSION_USER_ID,
          search_name: "Agents",
          query_text: "agent",
          filters: {},
          created_at: "2026-01-01T00:00:00.000Z",
          last_used_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      articleStates: [
        {
          article_key: "feed-1:https://example.com/post",
          read: true,
          starred: false,
          archived: false,
          bookmarked: true,
        },
      ],
    });

    expect(saveArticleStatesToIDBMock).toHaveBeenCalledWith({
      "feed-1:https://example.com/post": {
        read: true,
        starred: false,
        archived: false,
        bookmarked: true,
      },
    });

    expect(preferencesPutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user_prefs",
        serverReaderFilters: [expect.objectContaining({ filter_name: "Agents" })],
        serverFollows: [expect.objectContaining({ source_id: "openai-blog" })],
        serverSavedSearches: [expect.objectContaining({ search_name: "Agents" })],
        serverHydratedForUserId: SESSION_USER_ID,
      }),
    );
  });
});

describe("hydrateFromServer", () => {
  beforeEach(() => {
    saveArticleStatesToIDBMock.mockClear();
    preferencesPutMock.mockClear();
  });

  it("fetches filters, follows, saved searches, and article state", async () => {
    const fetchImpl = createFetchMock({
      "/api/user/filters": async () =>
        new Response(
          JSON.stringify({
            filters: [
              {
                id: FILTER_ID,
                user_id: SESSION_USER_ID,
                filter_name: "Unread",
                payload: {
                  query: "",
                  feedIds: [],
                  sourceType: null,
                  topics: [],
                  verified: null,
                  sort: "latest",
                  readerView: "unread",
                },
                schema_version: "reader-filter-v1",
                use_count: 0,
                pinned: false,
                is_default: false,
                created_at: "2026-01-01T00:00:00.000Z",
                last_used_at: "2026-01-02T00:00:00.000Z",
              },
            ],
          }),
          { status: 200 },
        ),
      "/api/follows": async () =>
        new Response(
          JSON.stringify({
            follows: [{ source_id: "anthropic-blog", followed_at: "2026-01-01T00:00:00.000Z" }],
          }),
          { status: 200 },
        ),
      "/api/search/saved": async () =>
        new Response(
          JSON.stringify([
            {
              id: "55555555-5555-4555-8555-555555555555",
              user_id: SESSION_USER_ID,
              search_name: "RAG",
              query_text: "rag",
              filters: {},
              created_at: "2026-01-01T00:00:00.000Z",
              last_used_at: "2026-01-02T00:00:00.000Z",
            },
          ]),
          { status: 200 },
        ),
      "/api/user/state": async () =>
        new Response(
          JSON.stringify({
            states: [
              {
                article_key: "feed-2:https://example.com/two",
                read: false,
                starred: true,
                archived: false,
                bookmarked: false,
              },
            ],
          }),
          { status: 200 },
        ),
    });

    const summary = await hydrateFromServer({
      sessionUserId: SESSION_USER_ID,
      fetchImpl,
    });

    expect(summary).toEqual({
      filters: 1,
      follows: 1,
      savedSearches: 1,
      articleStates: 1,
      errors: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(preferencesPutMock).toHaveBeenCalled();
  });

  it("treats 503 responses as a soft failure without recording errors", async () => {
    const fetchImpl = createFetchMock({
      "/api/user/filters": async () =>
        new Response(JSON.stringify({ error: "DATABASE_URL missing" }), { status: 503 }),
      "/api/follows": async () => new Response(JSON.stringify({ follows: [] }), { status: 200 }),
      "/api/search/saved": async () => new Response(JSON.stringify([]), { status: 200 }),
      "/api/user/state": async () => new Response(JSON.stringify({ states: [] }), { status: 200 }),
    });

    const summary = await hydrateFromServer({
      sessionUserId: SESSION_USER_ID,
      fetchImpl,
    });

    expect(summary.filters).toBe(0);
    expect(summary.errors).toEqual([]);
  });
});

describe("useServerHydration", () => {
  it("hydrates when autoRun is enabled", async () => {
    const fetchImpl = createFetchMock({
      "/api/user/filters": async () =>
        new Response(JSON.stringify({ filters: [] }), { status: 200 }),
      "/api/follows": async () => new Response(JSON.stringify({ follows: [] }), { status: 200 }),
      "/api/search/saved": async () => new Response(JSON.stringify([]), { status: 200 }),
      "/api/user/state": async () => new Response(JSON.stringify({ states: [] }), { status: 200 }),
    });

    vi.stubGlobal("fetch", fetchImpl);

    const { result } = renderHook(() =>
      useServerHydration({
        sessionUserId: SESSION_USER_ID,
        autoRun: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.lastSummary).not.toBeNull();
    });

    expect(result.current.lastSummary?.errors).toEqual([]);

    await act(async () => {
      const summary = await result.current.hydrate(SESSION_USER_ID);
      expect(summary.savedSearches).toBe(0);
    });

    vi.unstubAllGlobals();
  });
});
