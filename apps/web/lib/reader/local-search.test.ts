import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildLocalSearchIndex,
  searchArticlesLocal,
  searchArticlesLocalSimple,
  tokenizeQuery,
} from "./local-search";
import { articles, closeDB } from "@/lib/db";
import type { Article } from "@/lib/db";

function makeArticle(overrides: Partial<Article> = {}): Article {
  const now = Date.now();
  return {
    id: overrides.id ?? "art-" + Math.random().toString(36).slice(2),
    feedId: overrides.feedId ?? "feed-1",
    title: overrides.title ?? "Default Title",
    link: overrides.link ?? "https://example.com/a",
    content: overrides.content ?? "The body of the article here.",
    summary: overrides.summary,
    author: overrides.author,
    pubDate: overrides.pubDate ?? now - 1000 * 60 * 60 * 24 * 2, // 2 days ago
    topics: overrides.topics ?? [],
    rawCategories: overrides.rawCategories ?? [],
    sourceTopics: overrides.sourceTopics ?? [],
    enclosures: overrides.enclosures ?? [],
    read: overrides.read ?? false,
    starred: overrides.starred ?? false,
    archived: overrides.archived ?? false,
    tags: overrides.tags ?? [],
    cachedAt: overrides.cachedAt ?? now,
    lastModified: overrides.lastModified ?? now,
    ...overrides,
  } as Article;
}

async function seedArticles(list: Article[]) {
  for (const a of list) {
    await articles.put(a);
  }
}

async function clearTestArticles() {
  // best effort remove test ids
  const candidates = ["a1", "a2", "a3", "a4", "a5", "b1", "recent1"];
  for (const id of candidates) {
    try {
      await articles.delete(id);
    } catch {
      // ignore missing
    }
  }
}

describe("local-search", () => {
  beforeEach(async () => {
    await clearTestArticles();
  });

  afterEach(async () => {
    await clearTestArticles();
    try {
      closeDB();
    } catch {
      // ignore
    }
  });

  describe("tokenizeQuery", () => {
    it("returns empty for empty or whitespace", () => {
      expect(tokenizeQuery("")).toEqual([]);
      expect(tokenizeQuery("   \t ")).toEqual([]);
    });

    it("splits on whitespace and lowercases", () => {
      expect(tokenizeQuery("AI News")).toEqual(["ai", "news"]);
    });

    it("supports single and double quoted phrases as single terms", () => {
      expect(tokenizeQuery('"large language" model')).toEqual(["large language", "model"]);
      expect(tokenizeQuery("'open source' ai")).toEqual(["open source", "ai"]);
    });

    it("mixes quoted and bare terms", () => {
      const terms = tokenizeQuery('foo "bar baz" qux');
      expect(terms).toEqual(["foo", "bar baz", "qux"]);
    });
  });

  describe("searchArticlesLocal filters", () => {
    it("respects unreadOnly, starredOnly, feedIds, topics", async () => {
      await seedArticles([
        makeArticle({ id: "a1", read: false, starred: false, feedId: "f1", topics: ["ai"], title: "Alpha", content: "x" }),
        makeArticle({ id: "a2", read: true, starred: true, feedId: "f1", topics: ["ml"], title: "Beta", content: "y" }),
        makeArticle({ id: "a3", read: false, starred: false, feedId: "f2", topics: ["ai", "ml"], title: "Gamma", content: "z" }),
      ]);

      const unread = await searchArticlesLocal("", { unreadOnly: true });
      expect(unread.map((r) => r.article.id).sort()).toEqual(["a1", "a3"]);

      const starred = await searchArticlesLocal("", { starredOnly: true });
      expect(starred.map((r) => r.article.id)).toEqual(["a2"]);

      const feedF2 = await searchArticlesLocal("", { feedIds: ["f2"] });
      expect(feedF2.map((r) => r.article.id)).toEqual(["a3"]);

      const topicAi = await searchArticlesLocal("", { topics: ["ai"] });
      expect(topicAi.map((r) => r.article.id).sort()).toEqual(["a1", "a3"]);
    });

    it("bookmarkedOnly returns empty array (overlay-only filter)", async () => {
      await seedArticles([makeArticle({ id: "a1", title: "Bm", content: "bm" })]);
      const res = await searchArticlesLocal("bm", { bookmarkedOnly: true });
      expect(res).toEqual([]);
    });

    it("returns recent sorted results when no query terms", async () => {
      const old = makeArticle({ id: "old", pubDate: Date.now() - 1000 * 86400 * 100, title: "Old" });
      const recent = makeArticle({ id: "recent1", pubDate: Date.now(), title: "New" });
      await seedArticles([old, recent]);
      const res = await searchArticlesLocal("", { limit: 10 });
      expect(res[0].article.id).toBe("recent1");
      expect(res[0].score).toBe(1);
    });
  });

  describe("search scoring and ranking", () => {
    it("scores title highest, then summary, author, content, topics/tags", async () => {
      await seedArticles([
        makeArticle({
          id: "t",
          title: "Alpha about transformers",
          summary: "",
          content: "",
          author: "",
          topics: [],
          tags: [],
        }),
        makeArticle({
          id: "s",
          title: "Something",
          summary: "discusses transformers",
          content: "",
          author: "",
          topics: [],
          tags: [],
        }),
        makeArticle({
          id: "c",
          title: "Unrelated",
          summary: "",
          content: "deep dive transformers training",
          author: "",
          topics: [],
          tags: [],
        }),
        makeArticle({
          id: "a",
          title: "Authored work on ML",
          summary: "",
          content: "",
          author: "Transformers Lab",
          topics: [],
          tags: [],
        }),
      ]);

      const res = await searchArticlesLocal("transformers", { limit: 10 });
      const ids = res.map((r) => r.article.id);
      // title match first (score +8)
      expect(ids[0]).toBe("t");
      // then summary (+4); author match now +3 (its title has no term)
      expect(["s", "a"]).toContain(ids[1]);
    });

    it("awards exact title and whole-word bonuses", async () => {
      await seedArticles([
        makeArticle({ id: "exact", title: "exactmatch", content: "x" }),
        makeArticle({ id: "word", title: "the exactmatch word here", content: "x" }),
        makeArticle({ id: "partial", title: "preexactmatchpost", content: "x" }),
      ]);
      const res = await searchArticlesLocal("exactmatch", { limit: 5 });
      const ids = res.map((r) => r.article.id);
      expect(ids[0]).toBe("exact"); // exact title +6
      expect(ids).toContain("word");
    });

    it("applies freshness bonus for recent articles", async () => {
      const fresh = makeArticle({ id: "fresh", pubDate: Date.now() - 1000 * 86400 * 5, title: "Fresh ai news", content: "ai" });
      const old = makeArticle({ id: "old", pubDate: Date.now() - 1000 * 86400 * 400, title: "Old ai news", content: "ai" });
      await seedArticles([fresh, old]);
      const res = await searchArticlesLocal("ai", { limit: 2 });
      expect(res[0].article.id).toBe("fresh");
    });

    it("matches on topics and tags", async () => {
      await seedArticles([
        makeArticle({ id: "tp", title: "T", topics: ["llm"], sourceTopics: [], content: "" }),
        makeArticle({ id: "tg", title: "T", tags: ["gpt"], content: "" }),
      ]);
      const byTopic = await searchArticlesLocal("llm");
      const byTag = await searchArticlesLocal("gpt");
      expect(byTopic.map((r) => r.article.id)).toContain("tp");
      expect(byTag.map((r) => r.article.id)).toContain("tg");
    });
  });

  it("searchArticlesLocalSimple returns plain articles", async () => {
    await seedArticles([makeArticle({ id: "simp", title: "Simple", content: "query term" })]);
    const list = await searchArticlesLocalSimple("term", 5);
    expect(list.map((a) => a.id)).toContain("simp");
  });

  it("buildLocalSearchIndex provides in-memory search with same semantics", async () => {
    await seedArticles([
      makeArticle({ id: "i1", title: "Index one", content: "about vector search", feedId: "fidx" }),
      makeArticle({ id: "i2", title: "Index two", content: "unrelated", feedId: "fidx" }),
    ]);
    const idx = await buildLocalSearchIndex();
    expect(idx.articles.length).toBeGreaterThanOrEqual(2);
    const hits = idx.search("vector", { feedIds: ["fidx"] });
    expect(hits.map((h) => h.article.id)).toContain("i1");
    // bookmarked filter still suppresses
    expect(idx.search("vector", { bookmarkedOnly: true })).toEqual([]);
  });
});
