import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  compareByPublishedAsc,
  compareByPublishedDesc,
  computeArticleStableId,
  getArticleSortComparator,
  normalizeCachedArticle,
  normalizeLiveArticle,
} from "./article-normalize";

function expectedStableId(
  feedId: string,
  guid: string | null | undefined,
  link: string | null | undefined,
): string | null {
  const identity = (guid?.trim().toLowerCase() || link?.trim().toLowerCase() || "").trim();
  if (!feedId || !identity) {
    return null;
  }

  const digest = createHash("sha256").update(identity, "utf8").digest("hex");
  return `${feedId}:${digest}`;
}

describe("article-normalize", () => {
  it("compareByPublishedAsc orders oldest first", () => {
    expect(compareByPublishedAsc({ published_at_ms: 100 }, { published_at_ms: 200 })).toBeLessThan(
      0,
    );
    expect(
      compareByPublishedAsc({ published_at_ms: 300 }, { published_at_ms: 200 }),
    ).toBeGreaterThan(0);
  });

  it("getArticleSortComparator respects oldest vs latest", () => {
    const asc = getArticleSortComparator("oldest");
    const desc = getArticleSortComparator("latest");
    expect(asc({ published_at_ms: 100 }, { published_at_ms: 200 })).toBeLessThan(0);
    expect(desc({ published_at_ms: 100 }, { published_at_ms: 200 })).toBeGreaterThan(0);
  });

  it("compareByPublishedDesc orders newest first", () => {
    expect(
      compareByPublishedDesc({ published_at_ms: 100 }, { published_at_ms: 200 }),
    ).toBeGreaterThan(0);
    expect(compareByPublishedDesc({ published_at_ms: 300 }, { published_at_ms: 200 })).toBeLessThan(
      0,
    );
  });

  it("normalizeCachedArticle maps IndexedDB articles into workspace shape", () => {
    const article = normalizeCachedArticle(
      {
        id: "cached-1",
        feedId: "feed-1",
        title: "Cached headline",
        link: "https://example.com/cached",
        content: "<p>Body</p>",
        summary: "Cached summary",
        author: "Author",
        pubDate: 1_700_000_000_000,
        topics: ["ai"],
        rawCategories: [],
        sourceTopics: ["ml"],
        enclosures: [],
        read: false,
        starred: false,
        archived: false,
        tags: [],
        cachedAt: 1_700_000_100_000,
        lastModified: 1_700_000_100_000,
      },
      "Agent Feed",
    );

    expect(article.freshness).toBe("cached");
    expect(article.feed_title).toBe("Agent Feed");
    expect(article.content_html).toBe("<p>Body</p>");
    expect(article.published_at_ms).toBe(1_700_000_000_000);
    expect(article.stable_id).toBe(
      expectedStableId("feed-1", "cached-1", "https://example.com/cached"),
    );
  });

  it("computeArticleStableId prefers guid over link and matches Python normalization", () => {
    const stableId = computeArticleStableId({
      feed_id: "feed-1",
      guid: "GUID-ABC",
      link: "https://example.com/a",
    });

    expect(stableId).toBe(expectedStableId("feed-1", "GUID-ABC", "https://example.com/a"));
  });

  it("computeArticleStableId falls back to link when guid is missing", () => {
    const stableId = computeArticleStableId({
      feed_id: "feed-1",
      guid: null,
      link: "https://Example.com/a",
    });

    expect(stableId).toBe(expectedStableId("feed-1", null, "https://Example.com/a"));
  });

  it("normalizeLiveArticle includes stable_id", () => {
    const article = normalizeLiveArticle({
      id: "post-1",
      feedId: "feed-1",
      feedTitle: "Live Feed",
      title: "Live headline",
      link: "https://example.com/live",
      summary: null,
      author: null,
      rawCategories: [],
      publishedAt: null,
    });

    expect(article.stable_id).toBe(
      expectedStableId("feed-1", "post-1", "https://example.com/live"),
    );
  });
});
