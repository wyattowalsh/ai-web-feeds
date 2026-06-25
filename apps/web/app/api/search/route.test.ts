import { beforeEach, describe, expect, it, vi } from "vitest";

const { logSearchQueryMock, searchArticlesInCorpusMock, searchCatalogSourcesMock } = vi.hoisted(
  () => ({
    logSearchQueryMock: vi.fn(),
    searchArticlesInCorpusMock: vi.fn(),
    searchCatalogSourcesMock: vi.fn(),
  }),
);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/article-corpus", () => ({
  searchArticlesInCorpus: searchArticlesInCorpusMock,
  searchCatalogSources: searchCatalogSourcesMock,
}));

vi.mock("@/lib/server/search-log", () => ({
  logSearchQuery: logSearchQueryMock,
}));

import { ANON_USER_BINDING_COOKIE } from "@/lib/user-auth";

function createRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

async function loadRouteModule() {
  return import("./route");
}

describe("/api/search route", () => {
  beforeEach(() => {
    vi.resetModules();
    logSearchQueryMock.mockReset();
    searchArticlesInCorpusMock.mockReset();
    searchCatalogSourcesMock.mockReset();
  });

  it("runs catalog source search for GET requests", async () => {
    const { GET } = await loadRouteModule();
    searchCatalogSourcesMock.mockResolvedValue({
      scope: "sources",
      results: [
        {
          kind: "source",
          id: "feed-1",
          title: "Agent Systems Daily",
          description: "Source result",
          url: "https://example.com/agents",
          topics: ["agents"],
          source_type: "blog",
          verified: true,
          is_active: true,
          match_score: 24,
        },
      ],
      meta: {
        mode: "unbounded",
        bounded: false,
        candidate_sources: 42,
        scanned_sources: 42,
        scan_limit: null,
        per_source_limit: null,
        truncated: false,
      },
    });

    const response = await GET(
      createRequest("http://localhost/api/search?q=agent%20systems&scope=sources&verified=true"),
    );

    expect(response.status).toBe(200);
    expect(searchCatalogSourcesMock).toHaveBeenCalledWith({
      query: "agent systems",
      limit: 20,
      feedIds: [],
      sourceType: undefined,
      topics: undefined,
      verified: true,
    });
    expect(response.headers.get("cache-control")).toContain("s-maxage=120");
    await expect(response.json()).resolves.toEqual({
      results: [
        expect.objectContaining({
          id: "feed-1",
          kind: "source",
        }),
      ],
      scope: "sources",
      meta: expect.objectContaining({
        mode: "unbounded",
        bounded: false,
      }),
    });
  });

  it("routes article searches through the corpus-backed index", async () => {
    const { GET } = await loadRouteModule();
    searchArticlesInCorpusMock.mockResolvedValue({
      scope: "articles",
      results: [
        {
          kind: "article",
          id: "feed-1:article-1",
          title: "Agent planning roundup",
          description: "Corpus-backed article",
          url: "https://example.com/article-1",
          topics: ["agents"],
          source_type: "blog",
          verified: true,
          is_active: true,
          match_score: 18,
          feed_id: "feed-1",
          feed_title: "Agent Feed",
          published_at: "2026-04-05T12:00:00.000Z",
        },
      ],
      meta: {
        mode: "bounded",
        bounded: true,
        candidate_sources: 8,
        scanned_sources: 6,
        scan_limit: 18,
        per_source_limit: null,
        truncated: true,
      },
    });

    const response = await GET(
      createRequest(
        "http://localhost/api/search?q=%20rag%20pipelines%20&scope=articles&source_type=podcast&topics=ml,%20agents,,ml",
      ),
    );

    expect(response.status).toBe(200);
    expect(searchArticlesInCorpusMock).toHaveBeenCalledWith({
      q: "rag pipelines",
      limit: 20,
      feedIds: [],
      sourceType: "podcast",
      topics: ["ml", "agents"],
      verified: undefined,
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        scope: "articles",
        results: [
          expect.objectContaining({
            id: "feed-1:article-1",
            feed_id: "feed-1",
          }),
        ],
      }),
    );
  });

  it("preserves explicit feed ids when the article scope is narrowed from catalog mode", async () => {
    const { GET } = await loadRouteModule();
    searchArticlesInCorpusMock.mockResolvedValue({
      scope: "articles",
      results: [],
      meta: {
        mode: "bounded",
        bounded: true,
        candidate_sources: 2,
        scanned_sources: 2,
        scan_limit: 18,
        per_source_limit: null,
        truncated: false,
      },
    });

    const response = await GET(
      createRequest(
        "http://localhost/api/search?q=agents&scope=articles&feed=feed-2&feed=feed-1&feed=feed-2",
      ),
    );

    expect(response.status).toBe(200);
    expect(searchArticlesInCorpusMock).toHaveBeenCalledWith({
      q: "agents",
      limit: 20,
      feedIds: ["feed-2", "feed-1"],
      sourceType: undefined,
      topics: undefined,
      verified: undefined,
    });
  });

  it("returns a 400 when q is missing on GET", async () => {
    const { GET } = await loadRouteModule();
    const response = await GET(createRequest("http://localhost/api/search?scope=sources"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Query parameter "q" is required',
    });
    expect(searchCatalogSourcesMock).not.toHaveBeenCalled();
    expect(searchArticlesInCorpusMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported semantic scope on GET", async () => {
    const { GET } = await loadRouteModule();

    const response = await GET(
      createRequest("http://localhost/api/search?q=agents&scope=semantic"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid search scope" });
    expect(searchCatalogSourcesMock).not.toHaveBeenCalled();
    expect(searchArticlesInCorpusMock).not.toHaveBeenCalled();
  });

  it("binds anonymous identity and inserts SearchQuery for POST analytics", async () => {
    const { POST } = await loadRouteModule();
    logSearchQueryMock.mockResolvedValue({
      id: "0194f2a0-0000-7000-8000-000000000001",
      user_id: "user-1",
      query_text: "test query",
      search_type: "full_text",
      filters_applied: {},
      result_count: 12,
      clicked_results: [],
      timestamp: "2026-06-25T12:00:00.000Z",
    });

    const response = await POST(
      createRequest("http://localhost/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "test query",
          type: "sources",
          filters: {},
          clicked_results: [],
          result_count: 12,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(logSearchQueryMock).toHaveBeenCalledWith({
      user_id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      query_text: "test query",
      search_type: "full_text",
      filters_applied: {},
      clicked_results: [],
      result_count: 12,
    });
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("normalizes whitespace and filters before inserting POST analytics", async () => {
    const { POST } = await loadRouteModule();
    logSearchQueryMock.mockResolvedValue({
      id: "0194f2a0-0000-7000-8000-000000000002",
      user_id: "user-1",
      query_text: "agent systems",
      search_type: "semantic",
      filters_applied: {
        topics: ["ml", "agents"],
        verified: false,
        threshold: 0.5,
      },
      result_count: 0,
      clicked_results: [],
      timestamp: "2026-06-25T12:00:00.000Z",
    });

    const response = await POST(
      createRequest("http://localhost/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "  agent   systems  ",
          type: "articles",
          filters: {
            topics: ["ml", " agents ", "ml"],
            verified: "false",
            threshold: "0.2",
          },
          clicked_results: [],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(logSearchQueryMock).toHaveBeenCalledWith({
      user_id: expect.any(String),
      query_text: "agent systems",
      search_type: "semantic",
      filters_applied: {
        topics: ["ml", "agents"],
        verified: false,
        threshold: 0.5,
      },
      clicked_results: [],
      result_count: 0,
    });
  });

  it("returns an accepted response when Neon logging is unavailable", async () => {
    const { DatabaseNotConfiguredError } = await import("@/lib/server/db");
    const { POST } = await loadRouteModule();
    logSearchQueryMock.mockRejectedValue(new DatabaseNotConfiguredError("missing database"));

    const response = await POST(
      createRequest("http://localhost/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "test query",
          type: "sources",
          filters: {},
          clicked_results: [],
        }),
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      success: false,
      skipped: true,
      code: "DATABASE_UNAVAILABLE",
      error: "Search analytics logging is unavailable in this deployment.",
    });
  });

  it("best-effort skips POST analytics when Neon insert fails", async () => {
    const { POST } = await loadRouteModule();
    logSearchQueryMock.mockRejectedValue(new Error("connection reset"));

    const response = await POST(
      createRequest("http://localhost/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "test query",
          type: "sources",
          filters: {},
          clicked_results: [],
        }),
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      success: false,
      skipped: true,
      code: "LOGGING_FAILED",
      error: "Search analytics logging failed; search results are unaffected.",
    });
  });
});
