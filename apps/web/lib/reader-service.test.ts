import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AggregateFeedPost, AggregateFeedPostsResponse } from "@/lib/feed-posts";
import {
  compareTimelineArticles,
  fetchFollows,
  fetchFollowsResult,
  fetchTimeline,
  filterToFollowedFeeds,
  getFollowedFeedIds,
  normalizeAggregateFeedPost,
  normalizeAggregateResponse,
  sortTimelineArticles,
} from "@/lib/reader-service";
import type { NormalizedArticle, SubscriptionEntry } from "@/lib/reader-types";
import { fetchWithAnonymousIdentity } from "@/lib/user-identity";

vi.mock("@/lib/user-identity", () => ({
  fetchWithAnonymousIdentity: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePost(overrides: Partial<AggregateFeedPost> = {}): AggregateFeedPost {
  return {
    id: "post-1",
    title: "Test Post",
    link: "https://example.com/post-1",
    publishedAt: "2025-01-01T12:00:00Z",
    summary: "A test post",
    author: "Author",
    categories: ["tech"],
    feedId: "feed-1",
    feedTitle: "Test Feed",
    sourceUrl: "https://example.com",
    resolvedFeedUrl: "https://example.com/feed.xml",
    ...overrides,
  };
}

function makeResponse(
  overrides: Partial<AggregateFeedPostsResponse> = {},
): AggregateFeedPostsResponse {
  const now = new Date().toISOString();
  return {
    posts: [makePost()],
    feeds: [],
    fetchedAt: now,
    expiresAt: now,
    cacheState: "live",
    totalSources: 1,
    successfulSources: 1,
    failedSources: 0,
    ...overrides,
  };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("reader-service fetchers", () => {
  beforeEach(() => {
    vi.mocked(fetchWithAnonymousIdentity).mockReset();
    vi.unstubAllGlobals();
  });

  it("posts aggregate timeline requests with the shared contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(makeResponse()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTimeline({
      feedIds: ["feed-1"],
      limit: 10,
      perFeedLimit: 3,
      forceRefresh: true,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/feeds/posts/aggregate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedIds: ["feed-1"],
        limit: 10,
        perFeedLimit: 3,
        refresh: true,
      }),
    });
    expect(result.articles).toHaveLength(1);
  });

  it("returns the server-resolved user id for follows payloads", async () => {
    vi.mocked(fetchWithAnonymousIdentity).mockResolvedValue(
      jsonResponse({
        user_id: "22222222-2222-4222-8222-222222222222",
        follows: [
          {
            feed_id: "feed-a",
            followed_at: "2025-01-01T00:00:00Z",
          },
        ],
      }),
    );

    const result = await fetchFollowsResult("11111111-1111-4111-8111-111111111111");

    expect(fetchWithAnonymousIdentity).toHaveBeenCalledWith(
      "/api/follows?user_id=11111111-1111-4111-8111-111111111111",
    );
    expect(result).toEqual({
      userId: "22222222-2222-4222-8222-222222222222",
      follows: [{ feedId: "feed-a", followedAt: "2025-01-01T00:00:00Z" }],
    });
  });

  it("falls back to empty follows when the request fails", async () => {
    vi.mocked(fetchWithAnonymousIdentity).mockRejectedValue(new Error("network down"));

    await expect(fetchFollows()).resolves.toEqual([]);
  });
});

// ─── normalizeAggregateFeedPost ───────────────────────────────────────────────

describe("normalizeAggregateFeedPost", () => {
  it("maps all core fields", () => {
    const post = makePost();
    const result = normalizeAggregateFeedPost(post);

    expect(result.id).toBe("post-1");
    expect(result.feedId).toBe("feed-1");
    expect(result.feedTitle).toBe("Test Feed");
    expect(result.sourceUrl).toBe("https://example.com");
    expect(result.title).toBe("Test Post");
    expect(result.link).toBe("https://example.com/post-1");
    expect(result.summary).toBe("A test post");
    expect(result.author).toBe("Author");
    expect(result.categories).toEqual(["tech"]);
    expect(result.publishedAt).toBe("2025-01-01T12:00:00Z");
  });

  it("converts a valid publishedAt to milliseconds", () => {
    const result = normalizeAggregateFeedPost(makePost({ publishedAt: "2025-01-01T12:00:00Z" }));
    expect(result.publishedAtMs).toBe(new Date("2025-01-01T12:00:00Z").getTime());
  });

  it("sets publishedAtMs to null when publishedAt is null", () => {
    const result = normalizeAggregateFeedPost(makePost({ publishedAt: null }));
    expect(result.publishedAtMs).toBeNull();
  });

  it("sets publishedAtMs to null for an invalid date string", () => {
    const result = normalizeAggregateFeedPost(makePost({ publishedAt: "not-a-date" }));
    expect(result.publishedAtMs).toBeNull();
  });

  it("initialises all local-state fields to false", () => {
    const result = normalizeAggregateFeedPost(makePost());
    expect(result.read).toBe(false);
    expect(result.starred).toBe(false);
    expect(result.archived).toBe(false);
    expect(result.bookmarked).toBe(false);
  });

  it("returns a defensive copy of categories", () => {
    const post = makePost({ categories: ["a", "b"] });
    const result = normalizeAggregateFeedPost(post);
    result.categories.push("c");
    expect(post.categories).toHaveLength(2);
  });
});

// ─── normalizeAggregateResponse ───────────────────────────────────────────────

describe("normalizeAggregateResponse", () => {
  it("converts each post to a NormalizedArticle", () => {
    const response = makeResponse({ posts: [makePost({ id: "p1" }), makePost({ id: "p2" })] });
    const result = normalizeAggregateResponse(response);

    expect(result.articles).toHaveLength(2);
    expect(result.articles[0].id).toBe("p1");
    expect(result.articles[1].id).toBe("p2");
  });

  it("passes metadata through unchanged", () => {
    const response = makeResponse({ cacheState: "cached", failedSources: 3 });
    const result = normalizeAggregateResponse(response);

    expect(result.cacheState).toBe("cached");
    expect(result.failedSources).toBe(3);
    expect(result.totalSources).toBe(1);
    expect(result.successfulSources).toBe(1);
  });

  it("handles empty posts gracefully", () => {
    const result = normalizeAggregateResponse(makeResponse({ posts: [] }));
    expect(result.articles).toHaveLength(0);
  });

  it("sorts normalized posts by publish date with a deterministic tie-breaker", () => {
    const response = makeResponse({
      posts: [
        makePost({
          id: "b",
          title: "B",
          publishedAt: "2025-01-01T10:00:00Z",
        }),
        makePost({
          id: "a",
          title: "A",
          publishedAt: "2025-01-01T10:00:00Z",
        }),
        makePost({
          id: "older",
          title: "Older",
          publishedAt: "2024-12-31T10:00:00Z",
        }),
      ],
    });

    const result = normalizeAggregateResponse(response);
    expect(result.articles.map((article) => article.id)).toEqual(["a", "b", "older"]);
  });
});

describe("timeline sorting helpers", () => {
  it("sorts null timestamps after dated articles", () => {
    const sorted = sortTimelineArticles([
      {
        id: "no-date",
        feedId: "feed-1",
        feedTitle: "Feed",
        sourceUrl: "",
        title: "No date",
        link: "",
        summary: null,
        author: null,
        categories: [],
        publishedAt: null,
        publishedAtMs: null,
        read: false,
        starred: false,
        archived: false,
        bookmarked: false,
      },
      {
        id: "dated",
        feedId: "feed-1",
        feedTitle: "Feed",
        sourceUrl: "",
        title: "Dated",
        link: "",
        summary: null,
        author: null,
        categories: [],
        publishedAt: "2025-01-01T00:00:00Z",
        publishedAtMs: new Date("2025-01-01T00:00:00Z").getTime(),
        read: false,
        starred: false,
        archived: false,
        bookmarked: false,
      },
    ]);

    expect(sorted.map((article) => article.id)).toEqual(["dated", "no-date"]);
    expect(compareTimelineArticles(sorted[0], sorted[1])).toBeLessThan(0);
  });
});

// ─── getFollowedFeedIds ───────────────────────────────────────────────────────

describe("getFollowedFeedIds", () => {
  it("returns a Set of feedIds", () => {
    const follows: SubscriptionEntry[] = [
      { feedId: "feed-a", followedAt: null },
      { feedId: "feed-b", followedAt: "2025-01-01T00:00:00Z" },
    ];
    const ids = getFollowedFeedIds(follows);

    expect(ids.has("feed-a")).toBe(true);
    expect(ids.has("feed-b")).toBe(true);
    expect(ids.has("feed-c")).toBe(false);
    expect(ids.size).toBe(2);
  });

  it("returns an empty Set for no follows", () => {
    expect(getFollowedFeedIds([])).toEqual(new Set());
  });
});

// ─── filterToFollowedFeeds ────────────────────────────────────────────────────

describe("filterToFollowedFeeds", () => {
  function makeArticle(feedId: string): NormalizedArticle {
    return {
      id: `art-${feedId}`,
      feedId,
      feedTitle: feedId,
      sourceUrl: "",
      title: "Test",
      link: "",
      summary: null,
      author: null,
      categories: [],
      publishedAt: null,
      publishedAtMs: null,
      read: false,
      starred: false,
      archived: false,
      bookmarked: false,
    };
  }

  it("returns only articles whose feedId is followed", () => {
    const articles = [makeArticle("feed-a"), makeArticle("feed-b"), makeArticle("feed-c")];
    const follows: SubscriptionEntry[] = [
      { feedId: "feed-a", followedAt: null },
      { feedId: "feed-c", followedAt: null },
    ];
    const filtered = filterToFollowedFeeds(articles, follows);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((a) => a.feedId)).toEqual(expect.arrayContaining(["feed-a", "feed-c"]));
  });

  it("returns an empty array when follows is empty", () => {
    const articles = [makeArticle("feed-a")];
    expect(filterToFollowedFeeds(articles, [])).toHaveLength(0);
  });

  it("returns an empty array when no article matches", () => {
    const articles = [makeArticle("feed-x")];
    const follows: SubscriptionEntry[] = [{ feedId: "feed-a", followedAt: null }];
    expect(filterToFollowedFeeds(articles, follows)).toHaveLength(0);
  });
});
