import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Article } from "@/lib/db";
import { getSearchIndexManager, SearchIndexManager } from "./index-manager";

const source = readFileSync(join(process.cwd(), "lib/search/index-manager.ts"), "utf8");

const PUB_DATE = 1_700_000_000_000;

function article(id: string): Article {
  return {
    id,
    feedId: "feed-1",
    title: `${id} title`,
    link: `https://example.com/${id}`,
    content: `${id} content`,
    summary: `${id} summary`,
    author: `${id} author`,
    pubDate: PUB_DATE,
    topics: ["agents"],
    rawCategories: ["news"],
    sourceTopics: ["ml"],
    enclosures: [],
    read: false,
    starred: false,
    archived: false,
    tags: ["llm"],
    cachedAt: 1_700_000_100_000,
    lastModified: 1_700_000_200_000,
  };
}

function expectedWorkerArticle(id: string) {
  return {
    id,
    title: `${id} title`,
    summary: `${id} summary`,
    content: `${id} content`,
    author: `${id} author`,
    topics: ["agents", "ml"],
    tags: ["llm"],
    pubDate: PUB_DATE,
    feedId: "feed-1",
  };
}

class MockSearchWorker {
  static latest: MockSearchWorker | null = null;
  static instances: MockSearchWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly posted: unknown[] = [];
  terminated = false;

  constructor(
    readonly url: string | URL,
    readonly options?: { type?: string },
  ) {
    MockSearchWorker.latest = this;
    MockSearchWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  deliver(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

function latestWorker(): MockSearchWorker {
  const worker = MockSearchWorker.latest;
  if (!worker) {
    throw new Error("SearchIndexManager did not construct a worker");
  }
  return worker;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function postedQuery(worker: MockSearchWorker): {
  query: string;
  limit: number;
  requestId: string;
} {
  const message = worker.posted.at(-1);
  if (
    !isRecord(message) ||
    message.type !== "query" ||
    typeof message.query !== "string" ||
    typeof message.limit !== "number" ||
    typeof message.requestId !== "string"
  ) {
    throw new Error("SearchIndexManager did not post a query");
  }
  return {
    query: message.query,
    limit: message.limit,
    requestId: message.requestId,
  };
}

describe("search index manager", () => {
  beforeEach(() => {
    MockSearchWorker.latest = null;
    MockSearchWorker.instances = [];
    vi.useRealTimers();
    vi.stubGlobal("Worker", MockSearchWorker);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("SearchIndexManager", () => {
    it("start throws when Worker is undefined", async () => {
      vi.stubGlobal("Worker", undefined);
      const manager = new SearchIndexManager("/search.worker.js");
      const pending = manager.start([article("alpha")]);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error("start did not reject"));
        }, 40);
      });

      try {
        await expect(Promise.race([pending, timedOut])).rejects.toThrow(
          "Web Workers are not available in this environment",
        );
        expect(MockSearchWorker.instances).toHaveLength(0);
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
        MockSearchWorker.latest?.deliver({ type: "ready", count: 1 });
      }
    });

    it("a ready message resolves start with the count", async () => {
      const indexed = [article("alpha"), article("beta")];
      const ready = { type: "ready" as const, count: indexed.length };
      const manager = new SearchIndexManager("/search.worker.js");
      const pending = manager.start(indexed);
      let worker: MockSearchWorker | null = null;

      try {
        worker = latestWorker();
        const early = await Promise.race([
          pending.then(
            () => "settled" as const,
            () => "settled" as const,
          ),
          new Promise<"waiting">((resolve) => {
            setTimeout(() => resolve("waiting"), 20);
          }),
        ]);

        expect(early).toBe("waiting");
        expect(worker.options).toEqual({ type: "module" });
        expect(worker.url).toBe("/search.worker.js");
        expect(worker.posted).toEqual([
          {
            type: "build",
            articles: [expectedWorkerArticle("alpha"), expectedWorkerArticle("beta")],
          },
        ]);

        worker.deliver(ready);
        await expect(pending).resolves.toBe(ready.count);
      } finally {
        worker?.deliver(ready);
      }
    });

    it("a results message resolves the pending query with the hits and elapsedMs the worker sent", async () => {
      const indexed = [article("alpha"), article("beta")];
      const ready = { type: "ready" as const, count: indexed.length };
      const manager = new SearchIndexManager("/search.worker.js");
      const pendingStart = manager.start(indexed);
      const worker = latestWorker();

      try {
        worker.deliver(ready);
        await expect(pendingStart).resolves.toBe(ready.count);

        const pendingQuery = manager.query("language models", 5);
        const queryMessage = postedQuery(worker);
        const hits = [
          { id: "article-alpha", score: 11, matchedFields: ["title"] },
          { id: "article-beta", score: 3, matchedFields: ["content", "tags"] },
        ];
        const elapsedMs = 18;

        expect(queryMessage.query).toBe("language models");
        expect(queryMessage.limit).toBe(5);
        expect(queryMessage.requestId).not.toBe("");

        worker.deliver({
          type: "results",
          requestId: queryMessage.requestId,
          hits,
          elapsedMs,
        });

        await expect(pendingQuery).resolves.toEqual({ hits, elapsedMs });
      } finally {
        worker.deliver(ready);
      }
    });

    it("an unknown request id does not invent a hit", async () => {
      const ready = { type: "ready" as const, count: 1 };
      const manager = new SearchIndexManager("/search.worker.js");
      const pendingStart = manager.start([article("alpha")]);
      const worker = latestWorker();

      try {
        worker.deliver(ready);
        await expect(pendingStart).resolves.toBe(ready.count);

        const pendingQuery = manager.query("agents", 4);
        const queryMessage = postedQuery(worker);
        const unrelated = [{ id: "unrelated-article", score: 4, matchedFields: ["title"] }];
        const hits = [{ id: "article-alpha", score: 6, matchedFields: ["summary"] }];
        const elapsedMs = 21;
        let settled = false;
        const tracked = pendingQuery.then((result) => {
          settled = true;
          return result;
        });

        expect(queryMessage.requestId).not.toBe("missing-request");
        worker.deliver({
          type: "results",
          requestId: "missing-request",
          hits: unrelated,
          elapsedMs: 3,
        });

        await Promise.resolve();
        await Promise.resolve();
        expect(settled).toBe(false);

        worker.deliver({
          type: "results",
          requestId: queryMessage.requestId,
          hits,
          elapsedMs,
        });

        await expect(tracked).resolves.toEqual({ hits, elapsedMs });
      } finally {
        worker.deliver(ready);
      }
    });
  });

  describe("getSearchIndexManager", () => {
    it("returns one shared SearchIndexManager for the search worker module", async () => {
      const first = getSearchIndexManager();
      const ready = { type: "ready" as const, count: 1 };
      let worker: MockSearchWorker | null = null;

      expect(first).toBeInstanceOf(SearchIndexManager);
      expect(getSearchIndexManager()).toBe(first);
      expect(MockSearchWorker.instances).toHaveLength(0);

      const pending = first.start([article("alpha")]);

      try {
        worker = latestWorker();
        const url = worker.url instanceof URL ? worker.url.href : String(worker.url);

        expect(MockSearchWorker.instances).toHaveLength(1);
        expect(getSearchIndexManager()).toBe(first);
        expect(url).toContain("/workers/search.worker.ts");
        expect(worker.options).toEqual({ type: "module" });

        worker.deliver(ready);
        await expect(pending).resolves.toBe(ready.count);
      } finally {
        worker?.deliver(ready);
      }
    });
  });

  describe("source", () => {
    it("keeps SearchIndexManager and getSearchIndexManager", () => {
      expect(source).toContain("export class SearchIndexManager");
      expect(source).toContain("export function getSearchIndexManager");
      expect(source).toContain('new URL("../../workers/search.worker.ts", import.meta.url)');
      expect(source).toContain(
        'throw new Error("Web Workers are not available in this environment")',
      );
      expect(source).not.toContain("Math.random");
      expect(source).not.toMatch(/\bfetch\s*\(/);
    });
  });
});
