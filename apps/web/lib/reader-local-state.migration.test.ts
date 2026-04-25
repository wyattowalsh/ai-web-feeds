import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Annotation, Article, SyncQueueItem } from "@/lib/db";
import {
  READER_LOCAL_STATE_STORAGE_KEY,
  getArticleState,
  migrateReaderLocalStateSnapshot,
  parseReaderLocalStateSnapshot,
  serializeReaderLocalStateSnapshot,
} from "@/lib/reader-local-state";
import {
  DEFAULT_READER_PREFERENCES,
  READER_LOCAL_STATE_VERSION,
  type ReaderLocalStateSnapshot,
} from "@/lib/reader-types";

const mockArticles = new Map<string, Article>();
const mockAnnotations = new Map<string, Annotation>();
const mockSyncQueue = new Map<string, SyncQueueItem>();

vi.mock("@/lib/db", () => ({
  articles: {
    get: vi.fn(async (id: string) => mockArticles.get(id)),
    put: vi.fn(async (article: unknown) => {
      const next = article as Article;
      mockArticles.set(next.id, next);
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

function makeIDBArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    feedId: "feed-1",
    title: "Test Article",
    link: "https://example.com/1",
    content: "",
    pubDate: 100,
    categories: [],
    enclosures: [],
    read: false,
    starred: false,
    archived: false,
    tags: [],
    cachedAt: 100,
    lastModified: 100,
    ...overrides,
  };
}

beforeEach(() => {
  mockArticles.clear();
  mockAnnotations.clear();
  mockSyncQueue.clear();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("reader local-state snapshot migrations", () => {
  it("migrates legacy v1 snapshots into the versioned shape", () => {
    const migrated = migrateReaderLocalStateSnapshot({
      version: 1,
      updatedAt: 123,
      preferences: {
        theme: "dark",
        fontSize: 20,
      },
      articleStateById: {
        "article-1": {
          read: true,
          bookmark: true,
          lastModified: 456,
        },
      },
    });

    expect(migrated).toEqual({
      version: READER_LOCAL_STATE_VERSION,
      updatedAt: 456,
      preferences: {
        ...DEFAULT_READER_PREFERENCES,
        theme: "dark",
        fontSize: 20,
        updatedAt: 123,
      },
      articles: {
        "article-1": {
          read: true,
          starred: false,
          archived: false,
          bookmarked: true,
          lastModified: 456,
        },
      },
    } satisfies ReaderLocalStateSnapshot);
  });

  it("round-trips current snapshots through serialize + parse", () => {
    const snapshot: ReaderLocalStateSnapshot = {
      version: READER_LOCAL_STATE_VERSION,
      updatedAt: 999,
      preferences: {
        ...DEFAULT_READER_PREFERENCES,
        showImages: false,
        updatedAt: 999,
      },
      articles: {
        "article-1": {
          read: true,
          starred: true,
          archived: false,
          bookmarked: false,
          lastModified: 999,
        },
      },
    };

    expect(parseReaderLocalStateSnapshot(serializeReaderLocalStateSnapshot(snapshot))).toEqual(
      snapshot,
    );
  });

  it("falls back to an empty snapshot on corrupted JSON", () => {
    expect(parseReaderLocalStateSnapshot("{not-json")).toEqual({
      version: READER_LOCAL_STATE_VERSION,
      updatedAt: 0,
      preferences: {
        ...DEFAULT_READER_PREFERENCES,
        updatedAt: 0,
      },
      articles: {},
    });
  });

  it("normalizes invalid preference values while migrating snapshots", () => {
    const migrated = migrateReaderLocalStateSnapshot({
      version: READER_LOCAL_STATE_VERSION,
      updatedAt: 100,
      preferences: {
        ...DEFAULT_READER_PREFERENCES,
        theme: "sepia",
        fontSize: Number.NaN,
        showImages: "sometimes",
      },
      articles: {},
    });

    expect(migrated.preferences).toEqual({
      ...DEFAULT_READER_PREFERENCES,
      updatedAt: 100,
    });
  });

  it("prefers a newer migrated snapshot over a stale IndexedDB record", async () => {
    mockArticles.set(
      "article-1",
      makeIDBArticle({
        id: "article-1",
        read: false,
        tags: [],
        lastModified: 50,
      }),
    );
    window.localStorage.setItem(
      READER_LOCAL_STATE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        updatedAt: 100,
        articleStateById: {
          "article-1": {
            read: true,
            bookmark: true,
            lastModified: 200,
          },
        },
      }),
    );

    await expect(getArticleState("article-1")).resolves.toEqual({
      read: true,
      starred: false,
      archived: false,
      bookmarked: true,
    });
  });
});
