import { beforeEach, describe, expect, it, vi } from "vitest";

const { browseArticleCorpusMock } = vi.hoisted(() => ({
  browseArticleCorpusMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/article-corpus", () => ({
  browseArticleCorpus: browseArticleCorpusMock,
}));

async function loadRouteModule() {
  return import("./route");
}

function createRequest(url: string): Request {
  return new Request(url);
}

describe("GET /api/articles", () => {
  beforeEach(() => {
    vi.resetModules();
    browseArticleCorpusMock.mockReset();
  });

  it("filters, sorts, and paginates the article corpus", async () => {
    const { GET } = await loadRouteModule();
    browseArticleCorpusMock.mockResolvedValue({
      items: [
        {
          id: "article-2",
          feed_id: "feed-2",
          feed_title: "Reader Signals",
          title: "Agents and feeds",
          link: "https://example.com/post-2",
          summary: "Reader alignment",
          content_html: "<p>Reader alignment</p>",
          author: "Bob",
          published_at: "2026-04-03T12:00:00.000Z",
          topics: ["feeds"],
          raw_categories: ["feeds"],
          source_topics: ["feeds"],
          source_type: "newsletter",
          verified: false,
          is_active: true,
        },
      ],
      next_cursor: 2,
      total_matched: 4,
      cursor: 1,
      limit: 1,
      applied_query: "agents",
      applied_sort: "oldest",
      filters: {
        feedIds: ["feed-1", "feed-2"],
        sourceType: "newsletter",
        topics: ["ml", "agents"],
        verified: false,
      },
      corpus: {
        generated_at: "2026-04-06T12:00:00.000Z",
        source_db: "data/ai-web-feeds.db",
        article_count: 4,
        feed_count: 2,
        latest_published_at: "2026-04-05T12:00:00.000Z",
        is_empty: false,
      },
    });

    const response = await GET(
      createRequest(
        "http://localhost/api/articles?q=%20agents%20&feed=feed-1&feed=feed-2&source_type=newsletter&topics=ml,agents,ml&verified=false&sort=oldest&cursor=1&limit=1",
      ),
    );

    expect(response.status).toBe(200);
    expect(browseArticleCorpusMock).toHaveBeenCalledWith({
      q: "agents",
      feedIds: ["feed-1", "feed-2"],
      sourceType: "newsletter",
      topics: ["ml", "agents"],
      verified: false,
      sort: "oldest",
      cursor: 1,
      limit: 1,
    });
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: "article-2",
            feed_id: "feed-2",
          }),
        ],
        next_cursor: 2,
        total_matched: 4,
        corpus: expect.objectContaining({
          article_count: 4,
          is_empty: false,
        }),
      }),
    );
  });

  it("returns a dedicated empty corpus payload when no corpus has been built", async () => {
    const { GET } = await loadRouteModule();
    browseArticleCorpusMock.mockResolvedValue({
      items: [],
      next_cursor: null,
      total_matched: 0,
      cursor: 0,
      limit: 24,
      applied_query: null,
      applied_sort: "latest",
      filters: {},
      corpus: {
        generated_at: null,
        source_db: "data/ai-web-feeds.db",
        article_count: 0,
        feed_count: 0,
        latest_published_at: null,
        is_empty: true,
      },
    });

    const response = await GET(createRequest("http://localhost/api/articles"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        items: [],
        total_matched: 0,
        corpus: expect.objectContaining({
          is_empty: true,
          article_count: 0,
        }),
      }),
    );
  });
});
