import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildAutocompleteSuggestionsMock } = vi.hoisted(() => ({
  buildAutocompleteSuggestionsMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/article-corpus", () => ({
  buildAutocompleteSuggestions: buildAutocompleteSuggestionsMock,
}));

async function loadRouteModule() {
  return import("./route");
}

describe("GET /api/search/autocomplete", () => {
  beforeEach(() => {
    vi.resetModules();
    buildAutocompleteSuggestionsMock.mockReset();
  });

  it("returns unified feed, article, and topic suggestions from the shared index", async () => {
    const { GET } = await loadRouteModule();
    buildAutocompleteSuggestionsMock.mockResolvedValue({
      feeds: [
        {
          type: "feed",
          id: "feed-1",
          title: "Agent Systems Daily",
          url: "https://example.com/agents",
          source_type: "blog",
          verified: true,
          is_active: true,
          topics: ["agents"],
          match_score: 24,
        },
      ],
      articles: [
        {
          type: "article",
          id: "feed-1:article-1",
          title: "Agent planning roundup",
          url: "https://example.com/article-1",
          feed_id: "feed-1",
          feed_title: "Agent Systems Daily",
          published_at: "2026-04-05T12:00:00.000Z",
          match_score: 18,
        },
      ],
      topics: [
        {
          type: "topic",
          label: "agents",
          feed_count: 12,
          match_score: 14,
        },
      ],
      corpus: {
        generated_at: "2026-04-06T12:00:00.000Z",
        source_db: "data/ai-web-feeds.db",
        article_count: 120,
        feed_count: 12,
        latest_published_at: "2026-04-05T12:00:00.000Z",
        is_empty: false,
      },
      query: "agent",
      limit: 8,
    });

    const response = await GET(
      new Request("http://localhost/api/search/autocomplete?prefix=agent"),
    );

    expect(response.status).toBe(200);
    expect(buildAutocompleteSuggestionsMock).toHaveBeenCalledWith("agent", 8);
    expect(response.headers.get("cache-control")).toContain("s-maxage=60");
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        feeds: [
          expect.objectContaining({
            id: "feed-1",
            type: "feed",
          }),
        ],
        articles: [
          expect.objectContaining({
            id: "feed-1:article-1",
            type: "article",
          }),
        ],
        topics: [
          expect.objectContaining({
            label: "agents",
            type: "topic",
          }),
        ],
      }),
    );
  });

  it("preserves empty corpus responses without dropping catalog suggestions", async () => {
    const { GET } = await loadRouteModule();
    buildAutocompleteSuggestionsMock.mockResolvedValue({
      feeds: [],
      articles: [],
      topics: [],
      corpus: {
        generated_at: null,
        source_db: "data/ai-web-feeds.db",
        article_count: 0,
        feed_count: 0,
        latest_published_at: null,
        is_empty: true,
      },
      query: "ag",
      limit: 8,
    });

    const response = await GET(new Request("http://localhost/api/search/autocomplete?prefix=ag"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        feeds: [],
        articles: [],
        topics: [],
        corpus: expect.objectContaining({
          is_empty: true,
        }),
      }),
    );
  });
});
