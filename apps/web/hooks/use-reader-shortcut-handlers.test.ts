import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import type { WorkspaceArticle, ReaderArticleState } from "@/lib/reader";
import { DEFAULT_ARTICLE_STATE } from "@/lib/reader";
import { useReaderShortcutHandlers } from "./use-reader-shortcut-handlers";

const { useRouterMock, useReaderShortcutsMock } = vi.hoisted(() => ({
  useRouterMock: vi.fn(() => ({ push: vi.fn() })),
  useReaderShortcutsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

vi.mock("@/hooks/use-reader-shortcuts", () => ({
  useReaderShortcuts: useReaderShortcutsMock,
}));

function makeArticle(id: string, link = `https://example.com/${id}`): WorkspaceArticle {
  return {
    id,
    feed_id: "feed-1",
    feed_title: "Test Feed",
    title: `Article ${id}`,
    link,
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

describe("useReaderShortcutHandlers", () => {
  let setPreviewArticleId: ReturnType<typeof vi.fn>;
  let updateState: ReturnType<typeof vi.fn>;
  let refreshLatest: ReturnType<typeof vi.fn>;
  let updateUrl: ReturnType<typeof vi.fn>;
  let queryInputRef: { current: { focus: ReturnType<typeof vi.fn> } | null };
  let router: { push: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    setPreviewArticleId = vi.fn();
    updateState = vi.fn();
    refreshLatest = vi.fn();
    updateUrl = vi.fn();
    queryInputRef = { current: { focus: vi.fn() } };
    router = { push: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderWith(params: Partial<Parameters<typeof useReaderShortcutHandlers>[0]> = {}) {
    const base: Parameters<typeof useReaderShortcutHandlers>[0] = {
      visibleArticles: [],
      previewArticleId: null,
      setPreviewArticleId,
      selectedArticle: null,
      selectedArticleState: DEFAULT_ARTICLE_STATE,
      updateState,
      refreshLatest,
      queryInputRef,
      router,
      updateUrl,
      ...params,
    };
    return renderHook(() => useReaderShortcutHandlers(base));
  }

  it("returns the expected API shape and internally calls useReaderShortcuts", () => {
    const { result } = renderWith();

    expect(typeof result.current.handleSelectArticle).toBe("function");
    expect(typeof result.current.selectAdjacentArticle).toBe("function");
    expect(result.current.shortcutHandlers).toBeTypeOf("object");

    expect(useReaderShortcutsMock).toHaveBeenCalledTimes(1);
    const passedHandlers = useReaderShortcutsMock.mock.calls[0]?.[0];
    expect(passedHandlers).toBe(result.current.shortcutHandlers);
  });

  it("handleSelectArticle toggles via functional update (select then deselect)", () => {
    const { result } = renderWith();

    result.current.handleSelectArticle("a42");
    expect(setPreviewArticleId).toHaveBeenCalledTimes(1);
    const updater = setPreviewArticleId.mock.calls[0][0];
    expect(updater("a42")).toBe(null);
    expect(updater("other")).toBe("a42");
  });

  it("selectAdjacentArticle no-ops on empty corpus", () => {
    const { result } = renderWith({ visibleArticles: [] });

    result.current.selectAdjacentArticle(1);
    result.current.selectAdjacentArticle(-1);
    expect(setPreviewArticleId).not.toHaveBeenCalled();
  });

  it("selectAdjacentArticle picks first on next-from-none, last on prev-from-none, then deltas and clamps", () => {
    const articles = [makeArticle("a1"), makeArticle("a2"), makeArticle("a3")];
    const { result, rerender } = renderWith({
      visibleArticles: articles,
      previewArticleId: null,
      selectedArticle: null,
    });

    result.current.selectAdjacentArticle(1);
    expect(setPreviewArticleId).toHaveBeenLastCalledWith("a1");

    result.current.selectAdjacentArticle(-1);
    expect(setPreviewArticleId).toHaveBeenLastCalledWith("a3");

    // now select middle
    rerender();
    // simulate parent updating the preview id prop for next render
    // (renderHook rerender passes new params via closure; we re-invoke with updated)
    const { result: r2 } = renderWith({
      visibleArticles: articles,
      previewArticleId: "a1",
      selectedArticle: articles[0],
      setPreviewArticleId,
    });
    r2.current.selectAdjacentArticle(1);
    expect(setPreviewArticleId).toHaveBeenLastCalledWith("a2");

    r2.current.selectAdjacentArticle(10); // clamp
    expect(setPreviewArticleId).toHaveBeenLastCalledWith("a3");

    r2.current.selectAdjacentArticle(-5); // clamp to 0
    expect(setPreviewArticleId).toHaveBeenLastCalledWith("a1");
  });

  it("shortcutHandlers: navigation delegates to adjacent selectors", () => {
    const articles = [makeArticle("x1"), makeArticle("x2")];
    const { result } = renderWith({ visibleArticles: articles, previewArticleId: "x1" });

    const h = result.current.shortcutHandlers;
    h.next_article?.();
    expect(setPreviewArticleId).toHaveBeenLastCalledWith("x2");

    h.previous_article?.();
    expect(setPreviewArticleId).toHaveBeenLastCalledWith("x1");
  });

  it("shortcutHandlers: triage actions (mark/star/archive) call updateState only when selected", () => {
    const sel = makeArticle("sel");
    const state: ReaderArticleState = {
      read: false,
      starred: false,
      archived: true,
      bookmarked: false,
    };
    const { result } = renderWith({
      visibleArticles: [sel],
      previewArticleId: "sel",
      selectedArticle: sel,
      selectedArticleState: state,
    });

    const h = result.current.shortcutHandlers;

    h.mark_as_read?.();
    expect(updateState).toHaveBeenCalledWith("sel", { read: true });

    h.star?.();
    expect(updateState).toHaveBeenCalledWith("sel", { starred: true });

    h.archive?.();
    expect(updateState).toHaveBeenCalledWith("sel", { archived: false });

    // no selected: no-ops
    const { result: rNoSel } = renderWith({
      selectedArticle: null,
      selectedArticleState: DEFAULT_ARTICLE_STATE,
    });
    rNoSel.current.shortcutHandlers.mark_as_read?.();
    rNoSel.current.shortcutHandlers.star?.();
    rNoSel.current.shortcutHandlers.archive?.();
    // count should be previous 3 only
    expect(updateState).toHaveBeenCalledTimes(3);
  });

  it("shortcutHandlers: open_original uses window.open with noopener for selected link", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const sel = makeArticle("op", "https://ex.com/open-me");
    const { result } = renderWith({
      visibleArticles: [sel],
      previewArticleId: "op",
      selectedArticle: sel,
    });

    result.current.shortcutHandlers.open_original?.();
    expect(openSpy).toHaveBeenCalledWith("https://ex.com/open-me", "_blank", "noopener,noreferrer");

    openSpy.mockRestore();
  });

  it("shortcutHandlers: refresh invokes refreshLatest(true) (voided)", () => {
    const { result } = renderWith();
    result.current.shortcutHandlers.refresh?.();
    expect(refreshLatest).toHaveBeenCalledWith(true);
  });

  it("shortcutHandlers: focus_search focuses the provided ref", () => {
    const { result } = renderWith();
    result.current.shortcutHandlers.focus_search?.();
    expect(queryInputRef.current?.focus).toHaveBeenCalledTimes(1);
  });

  it("shortcutHandlers: close_modal clears preview", () => {
    const { result } = renderWith();
    result.current.shortcutHandlers.close_modal?.();
    expect(setPreviewArticleId).toHaveBeenCalledWith(null);
  });

  it("shortcutHandlers: go_* actions use router.push or updateUrl with view + cursor reset", () => {
    const { result } = renderWith();
    const h = result.current.shortcutHandlers;

    h.go_home?.();
    expect(router.push).toHaveBeenCalledWith("/");

    h.go_unread?.();
    expect(updateUrl).toHaveBeenCalledWith({ reader_view: "unread", cursor: null });

    h.go_starred?.();
    expect(updateUrl).toHaveBeenCalledWith({ reader_view: "starred", cursor: null });

    h.go_all?.();
    expect(updateUrl).toHaveBeenCalledWith({ reader_view: null, cursor: null });
  });

  it("search and show_shortcuts delegate to injected callbacks", () => {
    const focus = vi.fn();
    const onShowShortcuts = vi.fn();
    const onCloseShortcuts = vi.fn();
    const queryInputRef = { current: { focus: focus } as unknown as HTMLInputElement };
    const { result } = renderWith({ queryInputRef, onShowShortcuts, onCloseShortcuts });
    const h = result.current.shortcutHandlers;

    h.search?.();
    expect(focus).toHaveBeenCalledTimes(1);

    h.show_shortcuts?.();
    expect(onShowShortcuts).toHaveBeenCalledTimes(1);

    h.close_modal?.();
    expect(onCloseShortcuts).toHaveBeenCalledTimes(1);
    expect(setPreviewArticleId).toHaveBeenCalledWith(null);

    expect(h.toggle_sidebar).toBeUndefined();
  });
});
