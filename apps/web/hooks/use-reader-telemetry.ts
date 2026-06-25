"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ReaderDraftState } from "@/lib/reader";
import { trackEvent } from "@/lib/track-event";

export const READER_SCROLL_DEBOUNCE_MS = 300;

const READER_SURFACE = "reader" as const;

function fireReaderEvent(eventName: string, properties?: Record<string, unknown>): void {
  void trackEvent(eventName, { surface: READER_SURFACE, properties });
}

export function trackReaderFilterApply(draftState: ReaderDraftState): void {
  fireReaderEvent("reader.filter.apply", {
    query: draftState.query || undefined,
    sourceType: draftState.sourceType || undefined,
    topics: draftState.topics.length > 0 ? draftState.topics : undefined,
    verified: draftState.verified || undefined,
    readerView: draftState.readerView,
    sort: draftState.sort,
  });
}

export function trackReaderArticleOpen(articleId: string): void {
  fireReaderEvent("reader.article.open", { articleId });
}

export function trackReaderArticleStar(articleId: string, starred: boolean): void {
  fireReaderEvent("reader.article.star", { articleId, starred });
}

export function trackReaderScroll(scrollPercent: number): void {
  fireReaderEvent("reader.scroll", { scrollPercent: Math.round(scrollPercent) });
}

function computeDocumentScrollPercent(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollHeight =
    Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) -
    window.innerHeight;

  if (!scrollHeight || scrollHeight <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
}

export type UseReaderTelemetryOptions = {
  enabled?: boolean;
  scrollDebounceMs?: number;
};

export type UseReaderTelemetryResult = {
  trackFilterApply: (draftState: ReaderDraftState) => void;
  trackArticleOpen: (articleId: string) => void;
  trackArticleStar: (articleId: string, starred: boolean) => void;
};

/**
 * Reader product analytics (C-TEL-05): filter apply, article open/star, debounced scroll.
 * All events are fire-and-forget via `trackEvent`.
 */
export function useReaderTelemetry(
  options: UseReaderTelemetryOptions = {},
): UseReaderTelemetryResult {
  const { enabled = true, scrollDebounceMs = READER_SCROLL_DEBOUNCE_MS } = options;
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trackFilterApply = useCallback(
    (draftState: ReaderDraftState) => {
      if (!enabled) {
        return;
      }
      trackReaderFilterApply(draftState);
    },
    [enabled],
  );

  const trackArticleOpen = useCallback(
    (articleId: string) => {
      if (!enabled) {
        return;
      }
      trackReaderArticleOpen(articleId);
    },
    [enabled],
  );

  const trackArticleStar = useCallback(
    (articleId: string, starred: boolean) => {
      if (!enabled) {
        return;
      }
      trackReaderArticleStar(articleId, starred);
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const onScroll = () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }

      scrollTimerRef.current = setTimeout(() => {
        trackReaderScroll(computeDocumentScrollPercent());
      }, scrollDebounceMs);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, [enabled, scrollDebounceMs]);

  return {
    trackFilterApply,
    trackArticleOpen,
    trackArticleStar,
  };
}
