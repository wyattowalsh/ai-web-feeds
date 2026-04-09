import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Annotation, Article, SyncQueueItem } from "@/lib/db";
import type { NormalizedArticle } from "@/lib/reader-types";

// ─── Mock the db module ───────────────────────────────────────────────────────
// vi.mock is hoisted; the mock store must live at module scope so the factory
// closure can reference it.

const mockStore = new Map<string, Article>();
const mockAnnotations = new Map<string, Annotation>();
const mockSyncQueue = new Map<string, SyncQueueItem>();

vi.mock("@/lib/db", () => ({
  articles: {
    get: vi.fn(async (id: string) => mockStore.get(id)),
    put: vi.fn(async (article: unknown) => {
      const a = article as Article;
      mockStore.set(a.id, a);
    }),
  },
  annotations: {
    get: vi.fn(async (id: string) => mockAnnotations.get(id)),
    put: vi.fn(async (annotation: unknown) => {
      const next = annotation as Annotation;
      mockAnnotations.set(next.id, next);
    }),
    delete: vi.fn(async (id: string) => {
      mockAnnotations.delete(id);
    }),
    getByArticle: vi.fn(async (articleId: string) =>
      Array.from(mockAnnotations.values()).filter(
        (annotation) => annotation.articleId === articleId,
      ),
    ),
  },
  syncQueue: {
    put: vi.fn(async (item: unknown) => {
      const next = item as SyncQueueItem;
      mockSyncQueue.set(next.id, next);
    }),
    getPending: vi.fn(async () =>
      Array.from(mockSyncQueue.values()).filter((item) => !item.synced),
    ),
  },
}));

// Import under test AFTER the mock is declared so it picks up the mocked db.
import {
  bulkGetLocalState,
  enrichArticlesWithLocalState,
  getArticleState,
  getOrDefaultArticleState,
  markRead,
  markUnread,
  setArticleState,
  toggleArchive,
  toggleBookmark,
  toggleStar,
} from "@/lib/reader-local-state";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeIDBArticle(overrides: Partial<Article> = {}): Article {
  const now = Date.now();
  return {
    id: "article-1",
    feedId: "feed-1",
    title: "Test Article",
    link: "https://example.com/1",
    content: "",
    pubDate: now,
    categories: [],
    enclosures: [],
    read: false,
    starred: false,
    archived: false,
    tags: [],
    cachedAt: now,
    lastModified: now,
    ...overrides,
  };
}

function makeNormalizedArticle(overrides: Partial<NormalizedArticle> = {}): NormalizedArticle {
  return {
    id: "article-1",
    feedId: "feed-1",
    feedTitle: "Test Feed",
    sourceUrl: "https://example.com",
    title: "Test Article",
    link: "https://example.com/1",
    summary: null,
    author: null,
    categories: [],
    publishedAt: null,
    publishedAtMs: null,
    read: false,
    starred: false,
    archived: false,
    bookmarked: false,
    ...overrides,
  };
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockStore.clear();
  mockAnnotations.clear();
  mockSyncQueue.clear();
  window.localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  mockStore.clear();
  mockAnnotations.clear();
  mockSyncQueue.clear();
  window.localStorage.clear();
});

// ─── getArticleState ─────────────────────────────────────────────────────────

describe("getArticleState", () => {
  it("returns null for an article not in IndexedDB", async () => {
    expect(await getArticleState("missing")).toBeNull();
  });

  it("reflects read / starred / archived from IDB", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", read: true, starred: true, archived: false }));
    const state = await getArticleState("a1");
    expect(state).toEqual({ read: true, starred: true, archived: false, bookmarked: false });
  });

  it('detects bookmarked via the "bookmarked" tag', async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", tags: ["bookmarked"] }));
    const state = await getArticleState("a1");
    expect(state?.bookmarked).toBe(true);
  });

  it("returns bookmarked=false when the tag is absent", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", tags: ["other-tag"] }));
    const state = await getArticleState("a1");
    expect(state?.bookmarked).toBe(false);
  });
});

// ─── getOrDefaultArticleState ────────────────────────────────────────────────

describe("getOrDefaultArticleState", () => {
  it("returns the default (all-false) state for a missing article", async () => {
    const state = await getOrDefaultArticleState("not-found");
    expect(state).toEqual({ read: false, starred: false, archived: false, bookmarked: false });
  });

  it("returns actual state when the article exists", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", starred: true }));
    const state = await getOrDefaultArticleState("a1");
    expect(state.starred).toBe(true);
  });
});

// ─── setArticleState ─────────────────────────────────────────────────────────

describe("setArticleState", () => {
  it("updates an existing IDB article", async () => {
    const article = makeIDBArticle({ id: "a1", read: false });
    mockStore.set("a1", article);

    await setArticleState("a1", { read: true });

    expect(mockStore.get("a1")?.read).toBe(true);
  });

  it("adds the bookmarked tag when bookmarked is set to true", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", tags: [] }));

    await setArticleState("a1", { bookmarked: true });

    expect(mockStore.get("a1")?.tags).toContain("bookmarked");
  });

  it("removes the bookmarked tag when bookmarked is set to false", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", tags: ["bookmarked"] }));

    await setArticleState("a1", { bookmarked: false });

    expect(mockStore.get("a1")?.tags).not.toContain("bookmarked");
  });

  it("does not duplicate the bookmarked tag", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", tags: ["bookmarked"] }));

    await setArticleState("a1", { bookmarked: true });

    const tags = mockStore.get("a1")?.tags ?? [];
    expect(tags.filter((t) => t === "bookmarked")).toHaveLength(1);
  });

  it("creates a stub when article is missing and context is provided", async () => {
    const context = makeNormalizedArticle({
      id: "new-1",
      categories: ["tech", "bookmarked"],
      bookmarked: true,
      publishedAtMs: null,
    });

    await setArticleState("new-1", { starred: true, bookmarked: true }, context);

    expect(mockStore.has("new-1")).toBe(true);
    expect(mockStore.get("new-1")?.starred).toBe(true);
    expect(mockStore.get("new-1")).toEqual(
      expect.objectContaining({
        categories: ["tech", "bookmarked"],
        tags: ["bookmarked"],
        pubDate: null,
      }),
    );
    expect(mockSyncQueue.get("reader:new-1:star")?.type).toBe("star");
  });

  it("records a conflict annotation when article context is missing", async () => {
    await expect(setArticleState("ghost", { read: true })).resolves.toBeUndefined();
    expect(mockStore.has("ghost")).toBe(false);
    expect(mockAnnotations.get("conflict:ghost")?.type).toBe("note");
  });
});

// ─── markRead / markUnread ───────────────────────────────────────────────────

describe("markRead", () => {
  it("sets read to true", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", read: false }));
    await markRead("a1");
    expect(mockStore.get("a1")?.read).toBe(true);
  });
});

describe("markUnread", () => {
  it("sets read to false", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", read: true }));
    await markUnread("a1");
    expect(mockStore.get("a1")?.read).toBe(false);
  });
});

// ─── toggleStar ──────────────────────────────────────────────────────────────

describe("toggleStar", () => {
  it("flips false → true and returns true", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", starred: false }));
    const next = await toggleStar("a1");
    expect(next).toBe(true);
    expect(mockStore.get("a1")?.starred).toBe(true);
  });

  it("flips true → false and returns false", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", starred: true }));
    const next = await toggleStar("a1");
    expect(next).toBe(false);
    expect(mockStore.get("a1")?.starred).toBe(false);
  });
});

// ─── toggleArchive ────────────────────────────────────────────────────────────

describe("toggleArchive", () => {
  it("flips false → true", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", archived: false }));
    const next = await toggleArchive("a1");
    expect(next).toBe(true);
    expect(mockStore.get("a1")?.archived).toBe(true);
  });

  it("flips true → false", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", archived: true }));
    const next = await toggleArchive("a1");
    expect(next).toBe(false);
  });
});

// ─── toggleBookmark ───────────────────────────────────────────────────────────

describe("toggleBookmark", () => {
  it("adds the bookmarked tag when not bookmarked", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", tags: [] }));
    const next = await toggleBookmark("a1");
    expect(next).toBe(true);
    expect(mockStore.get("a1")?.tags).toContain("bookmarked");
  });

  it("removes the bookmarked tag when already bookmarked", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", tags: ["bookmarked"] }));
    const next = await toggleBookmark("a1");
    expect(next).toBe(false);
    expect(mockStore.get("a1")?.tags).not.toContain("bookmarked");
  });
});

// ─── bulkGetLocalState ───────────────────────────────────────────────────────

describe("bulkGetLocalState", () => {
  it("returns default state for all missing articles", async () => {
    const map = await bulkGetLocalState(["x", "y", "z"]);
    expect(map.size).toBe(3);
    for (const state of map.values()) {
      expect(state).toEqual({ read: false, starred: false, archived: false, bookmarked: false });
    }
  });

  it("deduplicates article IDs", async () => {
    const map = await bulkGetLocalState(["a", "a", "b"]);
    expect(map.size).toBe(2);
  });

  it("mixes real and default states", async () => {
    mockStore.set("real", makeIDBArticle({ id: "real", read: true }));
    const map = await bulkGetLocalState(["real", "missing"]);
    expect(map.get("real")?.read).toBe(true);
    expect(map.get("missing")?.read).toBe(false);
  });
});

// ─── enrichArticlesWithLocalState ─────────────────────────────────────────────

describe("enrichArticlesWithLocalState", () => {
  it("enriches articles that exist in IndexedDB", async () => {
    mockStore.set("a1", makeIDBArticle({ id: "a1", read: true, starred: true }));
    const [enriched] = await enrichArticlesWithLocalState([makeNormalizedArticle({ id: "a1" })]);
    expect(enriched.read).toBe(true);
    expect(enriched.starred).toBe(true);
  });

  it("applies default state for articles not in IndexedDB", async () => {
    const [enriched] = await enrichArticlesWithLocalState([
      makeNormalizedArticle({ id: "no-idb" }),
    ]);
    expect(enriched.read).toBe(false);
    expect(enriched.bookmarked).toBe(false);
  });

  it("handles an empty input array", async () => {
    const result = await enrichArticlesWithLocalState([]);
    expect(result).toHaveLength(0);
  });

  it("preserves non-state fields unchanged", async () => {
    const article = makeNormalizedArticle({ id: "a2", title: "My Title", feedId: "f1" });
    const [enriched] = await enrichArticlesWithLocalState([article]);
    expect(enriched.title).toBe("My Title");
    expect(enriched.feedId).toBe("f1");
  });
});
