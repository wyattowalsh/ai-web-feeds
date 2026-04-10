import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadAggregatedFeedPostsByIdsMock, loadFeedCatalogMock } = vi.hoisted(() => ({
  loadAggregatedFeedPostsByIdsMock: vi.fn(),
  loadFeedCatalogMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/feed-posts", () => ({
  loadAggregatedFeedPostsByIds: loadAggregatedFeedPostsByIdsMock,
}));

vi.mock("@/lib/feeds", async () => {
  const actual = await vi.importActual<typeof import("@/lib/feeds")>("@/lib/feeds");
  return {
    ...actual,
    loadFeedCatalog: loadFeedCatalogMock,
  };
});

import { runLocalSearch } from "./search-local";

describe("runLocalSearch", () => {
  beforeEach(() => {
    loadAggregatedFeedPostsByIdsMock.mockReset();
    loadFeedCatalogMock.mockReset();
  });

  it("ignores verified-only filtering when the catalog has no verification metadata", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sources: [
        {
          id: "feed-1",
          title: "Agent Feed",
          url: "https://example.com/feed-1.xml",
          source_type: "blog",
          topics: ["agents"],
        },
      ],
    });

    const payload = await runLocalSearch({
      query: "agent",
      scope: "sources",
      limit: 10,
      verified: true,
    });

    expect(payload.scope).toBe("sources");
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]).toEqual(
      expect.objectContaining({
        title: "Agent Feed",
      }),
    );
  });

  it("rebalances article results so one source does not monopolize the first page", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sources: [
        {
          id: "feed-1",
          title: "Agent Alpha",
          url: "https://example.com/feed-1.xml",
          source_type: "blog",
          topics: ["agents"],
        },
        {
          id: "feed-2",
          title: "Agent Beta",
          url: "https://example.com/feed-2.xml",
          source_type: "newsletter",
          topics: ["agents"],
        },
        {
          id: "feed-3",
          title: "Agent Gamma",
          url: "https://example.com/feed-3.xml",
          source_type: "podcast",
          topics: ["agents"],
        },
      ],
    });

    loadAggregatedFeedPostsByIdsMock.mockResolvedValue({
      posts: [
        {
          id: "alpha-1",
          feedId: "feed-1",
          feedTitle: "Agent Alpha",
          sourceUrl: "https://example.com/feed-1",
          title: "Agents agents agents alpha",
          link: "https://example.com/alpha-1",
          summary: "agents alpha",
          author: "A",
          categories: ["agents"],
          publishedAt: "2026-04-06T12:00:00.000Z",
        },
        {
          id: "alpha-2",
          feedId: "feed-1",
          feedTitle: "Agent Alpha",
          sourceUrl: "https://example.com/feed-1",
          title: "Agents alpha follow-up",
          link: "https://example.com/alpha-2",
          summary: "agents alpha",
          author: "A",
          categories: ["agents"],
          publishedAt: "2026-04-05T12:00:00.000Z",
        },
        {
          id: "beta-1",
          feedId: "feed-2",
          feedTitle: "Agent Beta",
          sourceUrl: "https://example.com/feed-2",
          title: "Agents beta dispatch",
          link: "https://example.com/beta-1",
          summary: "agents beta",
          author: "B",
          categories: ["agents"],
          publishedAt: "2026-04-04T12:00:00.000Z",
        },
        {
          id: "gamma-1",
          feedId: "feed-3",
          feedTitle: "Agent Gamma",
          sourceUrl: "https://example.com/feed-3",
          title: "Agents gamma briefing",
          link: "https://example.com/gamma-1",
          summary: "agents gamma",
          author: "C",
          categories: ["agents"],
          publishedAt: "2026-04-03T12:00:00.000Z",
        },
      ],
      feeds: [],
      fetchedAt: "2026-04-06T12:00:00.000Z",
      expiresAt: "2026-04-06T12:10:00.000Z",
      cacheState: "live",
      totalSources: 3,
      successfulSources: 3,
      failedSources: 0,
    });

    const payload = await runLocalSearch({
      query: "agents",
      scope: "articles",
      limit: 3,
    });

    expect(payload.scope).toBe("articles");
    expect(payload.results.map((result) => result.feed_id)).toEqual(["feed-1", "feed-2", "feed-3"]);
  });

  it("respects explicit feed-id slices before ranking article results", async () => {
    loadFeedCatalogMock.mockReturnValue({
      sources: [
        {
          id: "feed-1",
          title: "Agent Alpha",
          url: "https://example.com/feed-1.xml",
          source_type: "blog",
          topics: ["agents"],
        },
        {
          id: "feed-2",
          title: "Agent Beta",
          url: "https://example.com/feed-2.xml",
          source_type: "newsletter",
          topics: ["agents"],
        },
      ],
    });

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

    await runLocalSearch({
      query: "agents",
      scope: "articles",
      limit: 10,
      feedIds: ["feed-2", "feed-2"],
    });

    expect(loadAggregatedFeedPostsByIdsMock).toHaveBeenCalledWith(["feed-2"], 120, 3);
  });
});
