import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchBackendMock, searchArticlesInCorpusMock, searchCatalogSourcesMock } = vi.hoisted(
  () => ({
    fetchBackendMock: vi.fn(),
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

vi.mock("@/lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/lib/backend")>("@/lib/backend");
  return {
    ...actual,
    fetchBackend: fetchBackendMock,
  };
});

import { ANON_USER_BINDING_COOKIE } from "@/lib/user-auth";
import { BackendConfigurationError, BackendError } from "@/lib/backend";

function createRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

async function loadRouteModule() {
  return import("./route");
}

describe("/api/search route", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchBackendMock.mockReset();
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

  it("treats legacy semantic scope as article search", async () => {
    const { GET } = await loadRouteModule();
    searchArticlesInCorpusMock.mockResolvedValue({
      scope: "articles",
      results: [],
      meta: {
        mode: "bounded",
        bounded: true,
        candidate_sources: 0,
        scanned_sources: 0,
        scan_limit: 18,
        per_source_limit: null,
        truncated: false,
      },
    });

    const response = await GET(
      createRequest("http://localhost/api/search?q=agents&scope=semantic"),
    );

    expect(response.status).toBe(200);
    expect(searchArticlesInCorpusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "agents",
      }),
    );
  });

  it("binds anonymous identity and forwards user_id for POST analytics", async () => {
    const { POST } = await loadRouteModule();
    fetchBackendMock.mockResolvedValue({ success: true });

    const response = await POST(
      createRequest("http://localhost/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "test query",
          type: "full_text",
          filters: {},
          clicked_results: [],
          result_count: 12,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(fetchBackendMock).toHaveBeenCalledWith("/search/log", {
      method: "POST",
      body: expect.objectContaining({
        query: "test query",
        type: "full_text",
        result_count: 12,
        user_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    });
  });

  it("normalizes whitespace and filters before forwarding POST analytics", async () => {
    const { POST } = await loadRouteModule();
    fetchBackendMock.mockResolvedValue({ success: true });

    const response = await POST(
      createRequest("http://localhost/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "  agent   systems  ",
          type: "semantic",
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
    expect(fetchBackendMock).toHaveBeenCalledWith("/search/log", {
      method: "POST",
      body: expect.objectContaining({
        query: "agent systems",
        type: "semantic",
        filters: {
          topics: ["ml", "agents"],
          verified: false,
          threshold: 0.5,
        },
      }),
    });
  });

  it("preserves backend status code fidelity on POST failures", async () => {
    const { POST } = await loadRouteModule();
    fetchBackendMock.mockRejectedValue(
      new BackendError(422, "UNPROCESSABLE_ENTITY", "Search analytics rejected the payload"),
    );

    const response = await POST(
      createRequest("http://localhost/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "test query",
          type: "full_text",
          filters: {},
          clicked_results: [],
        }),
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Search analytics rejected the payload",
      code: "UNPROCESSABLE_ENTITY",
    });
  });

  it("returns an accepted response when backend logging is unavailable", async () => {
    const { POST } = await loadRouteModule();
    fetchBackendMock.mockRejectedValue(new BackendConfigurationError("missing backend"));

    const response = await POST(
      createRequest("http://localhost/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "test query",
          type: "full_text",
          filters: {},
          clicked_results: [],
        }),
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      success: false,
      skipped: true,
      code: "BACKEND_UNAVAILABLE",
      error: "Search analytics logging is unavailable in this deployment.",
    });
  });
});
