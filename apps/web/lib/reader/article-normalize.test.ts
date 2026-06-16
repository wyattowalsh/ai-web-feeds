import { describe, expect, it } from "vitest";

import { compareByPublishedDesc, normalizeCachedArticle } from "./article-normalize";

describe("article-normalize", () => {
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
  });
});
