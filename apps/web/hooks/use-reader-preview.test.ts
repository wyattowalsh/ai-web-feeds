import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { DEFAULT_ARTICLE_STATE, type WorkspaceArticle } from "@/lib/reader";

import { useReaderPreview } from "./use-reader-preview";

function makeArticle(id: string): WorkspaceArticle {
  return {
    id,
    feed_id: "feed-1",
    feed_title: "Feed",
    title: `Article ${id}`,
    link: `https://example.com/${id}`,
    summary: null,
    content_html: null,
    author: null,
    published_at: "2026-06-01T00:00:00.000Z",
    topics: [],
    source_topics: [],
    raw_categories: [],
    source_type: "blog",
    verified: false,
    is_active: true,
    freshness: "corpus",
    published_at_ms: Date.parse("2026-06-01T00:00:00.000Z"),
  } as WorkspaceArticle;
}

describe("useReaderPreview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives selected article + state from preview id", () => {
    const articles = [makeArticle("a1"), makeArticle("a2")];
    const { result } = renderHook(() =>
      useReaderPreview({
        visibleArticles: articles,
        articleStateMap: {
          a1: { read: true, starred: false, archived: false, bookmarked: false },
        },
      }),
    );

    act(() => {
      result.current.setPreviewArticleId("a1");
    });

    expect(result.current.selectedArticle?.id).toBe("a1");
    expect(result.current.selectedArticleState.read).toBe(true);
  });

  it("clears preview when article leaves visible list", () => {
    const initial = [makeArticle("a1")];
    const { result, rerender } = renderHook(
      ({ visibleArticles }) =>
        useReaderPreview({
          visibleArticles,
          articleStateMap: {},
        }),
      { initialProps: { visibleArticles: initial } },
    );

    act(() => {
      result.current.setPreviewArticleId("a1");
    });
    expect(result.current.previewArticleId).toBe("a1");

    rerender({ visibleArticles: [] });
    expect(result.current.previewArticleId).toBeNull();
  });

  it("clearPreview and Escape both dismiss the pane", () => {
    const articles = [makeArticle("a1")];
    const { result } = renderHook(() =>
      useReaderPreview({
        visibleArticles: articles,
        articleStateMap: {},
      }),
    );

    act(() => {
      result.current.setPreviewArticleId("a1");
    });

    act(() => {
      result.current.clearPreview();
    });
    expect(result.current.previewArticleId).toBeNull();

    act(() => {
      result.current.setPreviewArticleId("a1");
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.previewArticleId).toBeNull();
  });

  it("falls back to default article state when map entry is missing", () => {
    const articles = [makeArticle("a1")];
    const { result } = renderHook(() =>
      useReaderPreview({
        visibleArticles: articles,
        articleStateMap: {},
      }),
    );

    act(() => {
      result.current.setPreviewArticleId("a1");
    });

    expect(result.current.selectedArticleState).toEqual(DEFAULT_ARTICLE_STATE);
  });
});
