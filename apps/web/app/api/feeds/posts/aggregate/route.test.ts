import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadAggregatedFeedPostsByIdsMock } = vi.hoisted(() => ({
  loadAggregatedFeedPostsByIdsMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/feed-posts", () => ({
  loadAggregatedFeedPostsByIds: loadAggregatedFeedPostsByIdsMock,
}));

import { GET, POST } from "./route";

describe("GET /api/feeds/posts/aggregate", () => {
  beforeEach(() => {
    loadAggregatedFeedPostsByIdsMock.mockReset();
  });

  it("requires at least one explicit feed id", async () => {
    const response = await GET(new Request("http://localhost/api/feeds/posts/aggregate"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'At least one "feed" query parameter is required',
    });
  });

  it("filters, sorts, paginates, and forwards refresh parameters for full streams", async () => {
    loadAggregatedFeedPostsByIdsMock.mockResolvedValue({
      posts: [
        {
          id: "post-1",
          feedId: "feed-1",
          feedTitle: "Agent Systems Daily",
          sourceUrl: "https://example.com/feed-1",
          title: "Agent planning for real teams",
          link: "https://example.com/post-1",
          summary: "Agent orchestration in production",
          author: "Alice",
          categories: ["agents"],
          publishedAt: "2026-04-05T12:00:00.000Z",
        },
        {
          id: "post-2",
          feedId: "feed-2",
          feedTitle: "Reader Signals",
          sourceUrl: "https://example.com/feed-2",
          title: "Agents and feeds",
          link: "https://example.com/post-2",
          summary: "Reader alignment",
          author: "Bob",
          categories: ["feeds"],
          publishedAt: "2026-04-03T12:00:00.000Z",
        },
        {
          id: "post-3",
          feedId: "feed-1",
          feedTitle: "Agent Systems Daily",
          sourceUrl: "https://example.com/feed-1",
          title: "Catalog maintenance",
          link: "https://example.com/post-3",
          summary: "No keyword match here",
          author: "Carol",
          categories: ["catalog"],
          publishedAt: "2026-04-01T12:00:00.000Z",
        },
        {
          id: "post-4",
          feedId: "feed-2",
          feedTitle: "Reader Signals",
          sourceUrl: "https://example.com/feed-2",
          title: "Feed agents in practice",
          link: "https://example.com/post-4",
          summary: "Why agent readers matter",
          author: "Dana",
          categories: ["agents"],
          publishedAt: "2026-04-02T12:00:00.000Z",
        },
      ],
      feeds: [],
      fetchedAt: "2026-04-06T12:00:00.000Z",
      expiresAt: "2026-04-06T12:10:00.000Z",
      cacheState: "live",
      totalSources: 2,
      successfulSources: 2,
      failedSources: 0,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/feeds/posts/aggregate?feed=feed-1,feed-2&q=agents&sort=oldest&limit=1&cursor=1&per_feed_limit=2&refresh=true&stream=all",
      ),
    );

    expect(loadAggregatedFeedPostsByIdsMock).toHaveBeenCalledWith(["feed-1", "feed-2"], 48, 2, {
      forceRefresh: true,
    });
    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        cursor: 1,
        next_cursor: 2,
        total_matched_posts: 3,
        applied_query: "agents",
        applied_sort: "oldest",
        applied_stream: "all",
        posts: [
          expect.objectContaining({
            id: "post-2",
          }),
        ],
      }),
    );
  });

  it("treats sample streams as non-paginated previews with the lower per-feed default", async () => {
    loadAggregatedFeedPostsByIdsMock.mockResolvedValue({
      posts: [
        {
          id: "post-1",
          feedId: "feed-1",
          feedTitle: "Agent Systems Daily",
          sourceUrl: "https://example.com/feed-1",
          title: "Agent planning for real teams",
          link: "https://example.com/post-1",
          summary: "Agent orchestration in production",
          author: "Alice",
          categories: ["agents"],
          publishedAt: "2026-04-05T12:00:00.000Z",
        },
      ],
      feeds: [],
      fetchedAt: "2026-04-06T12:00:00.000Z",
      expiresAt: "2026-04-06T12:10:00.000Z",
      cacheState: "live",
      totalSources: 1,
      successfulSources: 1,
      failedSources: 0,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/feeds/posts/aggregate?feed=feed-1&stream=sample&limit=1&cursor=3",
      ),
    );

    expect(loadAggregatedFeedPostsByIdsMock).toHaveBeenCalledWith(["feed-1"], 48, 3, {
      forceRefresh: false,
    });
    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        cursor: 0,
        next_cursor: null,
        applied_stream: "sample",
      }),
    );
  });

  it("clamps GET per-feed depth to the raised ceiling of 8", async () => {
    loadAggregatedFeedPostsByIdsMock.mockResolvedValue({
      posts: [],
      feeds: [],
      fetchedAt: "2026-04-06T12:00:00.000Z",
      expiresAt: "2026-04-06T12:10:00.000Z",
      cacheState: "live",
      totalSources: 1,
      successfulSources: 1,
      failedSources: 0,
    });

    const response = await GET(
      new Request("http://localhost/api/feeds/posts/aggregate?feed=feed-1&per_feed_limit=99"),
    );

    expect(response.status).toBe(200);
    expect(loadAggregatedFeedPostsByIdsMock).toHaveBeenCalledWith(["feed-1"], 48, 8, {
      forceRefresh: false,
    });
  });

  it("clamps POST per-feed depth to the raised ceiling of 8", async () => {
    loadAggregatedFeedPostsByIdsMock.mockResolvedValue({
      posts: [],
      feeds: [],
      fetchedAt: "2026-04-06T12:00:00.000Z",
      expiresAt: "2026-04-06T12:10:00.000Z",
      cacheState: "live",
      totalSources: 1,
      successfulSources: 1,
      failedSources: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/feeds/posts/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedIds: ["feed-1"],
          limit: 24,
          perFeedLimit: 99,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(loadAggregatedFeedPostsByIdsMock).toHaveBeenCalledWith(["feed-1"], 48, 8, {
      forceRefresh: false,
    });
  });

  it("filters and sorts POST bootstrap requests without relying on long query strings", async () => {
    loadAggregatedFeedPostsByIdsMock.mockResolvedValue({
      posts: [
        {
          id: "post-1",
          feedId: "feed-1",
          feedTitle: "Agent Systems Daily",
          sourceUrl: "https://example.com/feed-1",
          title: "Other topic",
          link: "https://example.com/post-1",
          summary: "No keyword",
          author: "Alice",
          categories: ["ops"],
          publishedAt: "2026-04-05T12:00:00.000Z",
        },
        {
          id: "post-2",
          feedId: "feed-2",
          feedTitle: "Reader Signals",
          sourceUrl: "https://example.com/feed-2",
          title: "Agent reader update",
          link: "https://example.com/post-2",
          summary: "Agent workflow",
          author: "Bob",
          categories: ["agents"],
          publishedAt: "2026-04-03T12:00:00.000Z",
        },
      ],
      feeds: [],
      fetchedAt: "2026-04-06T12:00:00.000Z",
      expiresAt: "2026-04-06T12:10:00.000Z",
      cacheState: "live",
      totalSources: 2,
      successfulSources: 2,
      failedSources: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/feeds/posts/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedIds: ["feed-1", "feed-2"],
          limit: 1,
          perFeedLimit: 3,
          refresh: true,
          q: "agents",
          sort: "oldest",
        }),
      }),
    );

    expect(loadAggregatedFeedPostsByIdsMock).toHaveBeenCalledWith(["feed-1", "feed-2"], 48, 3, {
      forceRefresh: true,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        applied_query: "agents",
        applied_sort: "oldest",
        total_matched_posts: 1,
        posts: [expect.objectContaining({ id: "post-2" })],
      }),
    );
  });
});
