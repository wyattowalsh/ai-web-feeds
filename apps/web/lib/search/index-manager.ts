/**
 * Orchestrates the search Web Worker lifecycle and query execution.
 */

import type { Article } from "@/lib/db";
import type { WorkerArticle, WorkerSearchHit } from "../../workers/search.worker";

export type SearchWorkerResult = {
  hits: WorkerSearchHit[];
  elapsedMs: number;
};

type WorkerReady = { type: "ready"; count: number };
type WorkerResults = {
  type: "results";
  requestId: string;
  hits: WorkerSearchHit[];
  elapsedMs: number;
};

type WorkerOutbound = WorkerReady | WorkerResults;

function toWorkerArticle(article: Article): WorkerArticle {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    content: article.content,
    author: article.author,
    topics: [...(article.topics || []), ...(article.sourceTopics || [])],
    tags: article.tags || [],
    pubDate: article.pubDate,
    feedId: article.feedId,
  };
}

export class SearchIndexManager {
  private worker: Worker | null = null;
  private ready = false;
  private pending = new Map<
    string,
    { resolve: (value: SearchWorkerResult) => void; reject: (reason?: unknown) => void }
  >();

  constructor(private readonly workerUrl: string | URL) {}

  async start(articles: Article[]): Promise<number> {
    if (typeof Worker === "undefined") {
      throw new Error("Web Workers are not available in this environment");
    }

    if (!this.worker) {
      this.worker = new Worker(this.workerUrl, { type: "module" });
      this.worker.onmessage = (event: MessageEvent<WorkerOutbound>) => {
        const data = event.data;
        if (data.type === "ready") {
          this.ready = true;
          return;
        }
        if (data.type === "results") {
          const pending = this.pending.get(data.requestId);
          if (pending) {
            this.pending.delete(data.requestId);
            pending.resolve({ hits: data.hits, elapsedMs: data.elapsedMs });
          }
        }
      };
      this.worker.onerror = (error) => {
        for (const [, handlers] of this.pending) {
          handlers.reject(error);
        }
        this.pending.clear();
      };
    }

    this.ready = false;
    this.worker.postMessage({
      type: "build",
      articles: articles.map(toWorkerArticle),
    });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (this.ready) resolve();
        else setTimeout(check, 5);
      };
      check();
    });

    return articles.length;
  }

  async query(query: string, limit = 50): Promise<SearchWorkerResult> {
    if (!this.worker) {
      throw new Error("Search worker is not started");
    }

    const requestId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return new Promise<SearchWorkerResult>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker?.postMessage({ type: "query", query, limit, requestId });
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.pending.clear();
  }
}

let sharedManager: SearchIndexManager | null = null;

export function getSearchIndexManager(): SearchIndexManager {
  if (!sharedManager) {
    sharedManager = new SearchIndexManager(
      new URL("../../workers/search.worker.ts", import.meta.url),
    );
  }
  return sharedManager;
}
