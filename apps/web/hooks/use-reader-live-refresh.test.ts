import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { FeedSource } from "@/lib/feeds-filters";
import type { WorkspaceArticle } from "@/lib/reader";
import { useReaderLiveRefresh } from "./use-reader-live-refresh";

const liveRefreshSource = readFileSync(
  join(process.cwd(), "hooks/use-reader-live-refresh.ts"),
  "utf8",
);

describe("useReaderLiveRefresh", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never imports or uses router navigation (stays in-place)", () => {
    expect(liveRefreshSource).not.toMatch(/from ["']next\/navigation["']/);
    expect(liveRefreshSource).not.toMatch(/useRouter|router\.(push|replace|back)\s*\(/);
  });

  it("returns error when no feed ids", async () => {
    const { result } = renderHook(() =>
      useReaderLiveRefresh({
        candidateFeeds: [],
        feedIds: [],
        query: "",
        sort: "latest",
        mergedArticles: [],
      }),
    );

    await act(async () => {
      await result.current.refreshLatest();
    });

    expect(result.current.refreshError).toBe("Choose at least one source to refresh.");
    expect(result.current.refreshing).toBe(false);
    expect(result.current.liveProgress).toBeNull();
  });

  it("merges overlay on successful JSON response", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      // intentionally no .body so hook takes the JSON fallback path
      json: async () => ({
        posts: [
          {
            id: "p1",
            feedId: "f1",
            feedTitle: "Feed One",
            title: "New Live Post",
            link: "https://ex.com/1",
            summary: "summary here",
            sourceUrl: "https://ex.com/f1",
            resolvedFeedUrl: "https://ex.com/f1",
            author: "Author",
            rawCategories: ["cat"],
            publishedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
        fetchedAt: "2026-06-16T00:00:00.000Z",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const candidate: FeedSource[] = [{ id: "f1", url: "https://ex.com/feed", title: "Feed One" }];
    const merged: WorkspaceArticle[] = [];

    const { result } = renderHook(() =>
      useReaderLiveRefresh({
        candidateFeeds: candidate,
        feedIds: ["f1"],
        query: "",
        sort: "latest",
        mergedArticles: merged,
      }),
    );

    await act(async () => {
      await result.current.refreshLatest(true);
    });

    await waitFor(() => {
      expect(result.current.overlayArticles.length).toBe(1);
    });

    const overlay = result.current.overlayArticles[0];
    expect(overlay.title).toBe("New Live Post");
    expect(overlay.freshness).toBe("live");
    expect(overlay.id).toBe("f1:p1");
    expect(overlay.feed_id).toBe("f1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/feeds/posts/aggregate/stream");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body.feedIds).toEqual(["f1"]);
    expect(body.limit).toBe(48);
  });
});
