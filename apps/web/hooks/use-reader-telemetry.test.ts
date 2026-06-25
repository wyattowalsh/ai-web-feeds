import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import {
  READER_SCROLL_DEBOUNCE_MS,
  trackReaderArticleOpen,
  trackReaderArticleStar,
  trackReaderFilterApply,
  trackReaderScroll,
  useReaderTelemetry,
} from "./use-reader-telemetry";
import { TELEMETRY_EVENTS_ENDPOINT } from "@/lib/track-event";

const { trackEventMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/track-event", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/track-event")>();
  return {
    ...actual,
    trackEvent: trackEventMock,
  };
});

describe("use-reader-telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("track helpers", () => {
    it("posts reader.filter.apply with draft properties", () => {
      trackReaderFilterApply({
        query: "transformers",
        sourceType: "blog",
        topics: ["llm"],
        verified: "true",
        readerView: "unread",
        sort: "oldest",
      });

      expect(trackEventMock).toHaveBeenCalledWith("reader.filter.apply", {
        surface: "reader",
        properties: {
          query: "transformers",
          sourceType: "blog",
          topics: ["llm"],
          verified: "true",
          readerView: "unread",
          sort: "oldest",
        },
      });
    });

    it("posts reader.article.open with articleId", () => {
      trackReaderArticleOpen("article-42");

      expect(trackEventMock).toHaveBeenCalledWith("reader.article.open", {
        surface: "reader",
        properties: { articleId: "article-42" },
      });
    });

    it("posts reader.article.star with starred flag", () => {
      trackReaderArticleStar("article-42", true);

      expect(trackEventMock).toHaveBeenCalledWith("reader.article.star", {
        surface: "reader",
        properties: { articleId: "article-42", starred: true },
      });
    });

    it("posts reader.scroll with rounded scrollPercent", () => {
      trackReaderScroll(42.7);

      expect(trackEventMock).toHaveBeenCalledWith("reader.scroll", {
        surface: "reader",
        properties: { scrollPercent: 43 },
      });
    });
  });

  describe("useReaderTelemetry", () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let scrollHandlers: Array<() => void>;

    beforeEach(() => {
      scrollHandlers = [];
      Object.defineProperty(document.documentElement, "scrollHeight", {
        configurable: true,
        value: 2000,
      });
      Object.defineProperty(document.body, "scrollHeight", {
        configurable: true,
        value: 2000,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        value: 500,
        writable: true,
      });

      addEventListenerSpy = vi
        .spyOn(window, "addEventListener")
        .mockImplementation((type, listener) => {
          if (type === "scroll" && typeof listener === "function") {
            scrollHandlers.push(listener as () => void);
          }
        });
      removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    });

    it("exposes track callbacks that delegate to trackEvent", () => {
      const { result } = renderHook(() => useReaderTelemetry());

      act(() => {
        result.current.trackFilterApply({
          query: "",
          sourceType: "",
          topics: [],
          verified: "",
          readerView: "latest",
          sort: "latest",
        });
        result.current.trackArticleOpen("a-1");
        result.current.trackArticleStar("a-1", false);
      });

      expect(trackEventMock).toHaveBeenCalledTimes(3);
      expect(trackEventMock).toHaveBeenNthCalledWith(1, "reader.filter.apply", {
        surface: "reader",
        properties: { readerView: "latest", sort: "latest" },
      });
      expect(trackEventMock).toHaveBeenNthCalledWith(2, "reader.article.open", {
        surface: "reader",
        properties: { articleId: "a-1" },
      });
      expect(trackEventMock).toHaveBeenNthCalledWith(3, "reader.article.star", {
        surface: "reader",
        properties: { articleId: "a-1", starred: false },
      });
    });

    it("debounces reader.scroll on window scroll", () => {
      renderHook(() => useReaderTelemetry({ scrollDebounceMs: READER_SCROLL_DEBOUNCE_MS }));

      expect(addEventListenerSpy).toHaveBeenCalledWith("scroll", expect.any(Function), {
        passive: true,
      });
      expect(scrollHandlers).toHaveLength(1);

      act(() => {
        scrollHandlers[0]?.();
        scrollHandlers[0]?.();
      });

      expect(trackEventMock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(READER_SCROLL_DEBOUNCE_MS);
      });

      expect(trackEventMock).toHaveBeenCalledTimes(1);
      expect(trackEventMock).toHaveBeenCalledWith("reader.scroll", {
        surface: "reader",
        properties: { scrollPercent: 50 },
      });
    });

    it("removes scroll listener on unmount", () => {
      const { unmount } = renderHook(() => useReaderTelemetry());

      const scrollListener = scrollHandlers[0];
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("scroll", scrollListener);
    });

    it("does not track when disabled", () => {
      const { result } = renderHook(() => useReaderTelemetry({ enabled: false }));

      act(() => {
        result.current.trackArticleOpen("a-1");
      });

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(addEventListenerSpy).not.toHaveBeenCalled();
    });

    it("uses fire-and-forget trackEvent (no await required)", () => {
      trackEventMock.mockImplementation(() => fetch(TELEMETRY_EVENTS_ENDPOINT, { method: "POST" }));

      expect(() => trackReaderArticleOpen("fire-and-forget")).not.toThrow();
      expect(trackEventMock).toHaveBeenCalled();
    });
  });
});
