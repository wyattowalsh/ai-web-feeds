import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { articles, closeDB, initializeDB, syncQueue, type Article } from "@/lib/db";
import {
  clearAllPending,
  queueMarkRead,
  queueMarkStar,
  reconcilePending,
} from "@/lib/offline/offline-sync";

function sampleArticle(overrides: Partial<Article> = {}): Article {
  const now = Date.now();
  return {
    id: "art-1",
    feedId: "feed-1",
    title: "Cached article",
    link: "https://example.com/a1",
    content: "Body",
    pubDate: now,
    topics: ["ai"],
    rawCategories: [],
    sourceTopics: ["ai"],
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

describe("offline-sync integration", () => {
  beforeEach(async () => {
    closeDB();
    await initializeDB();
    await clearAllPending();
    const all = await articles.getAll();
    for (const article of all) {
      await articles.delete(article.id);
    }
  });

  afterEach(() => {
    closeDB();
  });

  it("queues read operations and applies them on reconcile", async () => {
    await articles.put(sampleArticle());

    await queueMarkRead("art-1", true);
    const pending = await syncQueue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.type).toBe("read");

    const result = await reconcilePending();
    expect(result.applied).toBe(1);
    expect(result.errors).toHaveLength(0);

    const updated = await articles.get("art-1");
    expect(updated?.read).toBe(true);
  });

  it("collapses duplicate read/star queue entries for the same article", async () => {
    await articles.put(sampleArticle());
    await queueMarkRead("art-1", true);
    await queueMarkRead("art-1", false);

    const pending = await syncQueue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.data?.read).toBe(false);
  });

  it("local wins when star state diverged after queue timestamp", async () => {
    const stale = sampleArticle({ starred: false, lastModified: Date.now() + 5_000 });
    await articles.put(stale);
    await queueMarkStar("art-1", true);

    const result = await reconcilePending();
    expect(result.applied).toBe(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.reason).toContain("star");

    const updated = await articles.get("art-1");
    expect(updated?.starred).toBe(true);
  });

  it("creates a stub article when reconciling flags without cached content", async () => {
    await queueMarkRead("art-missing", true);

    const result = await reconcilePending();
    expect(result.applied).toBe(1);

    const stub = await articles.get("art-missing");
    expect(stub?.read).toBe(true);
    expect(stub?.feedId).toBe("unknown");
  });
});
