"use client";

import { useCallback, useMemo, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { useRouter } from "next/navigation";

import { type ReaderArticleState, type WorkspaceArticle } from "@/lib/reader";
import { useReaderShortcuts, type ReaderShortcutHandlers } from "@/hooks/use-reader-shortcuts";

/**
 * Hook extracted from feeds-workspace-client.tsx (ReaderShell).
 *
 * Centralizes the `shortcutHandlers` useMemo + `selectAdjacentArticle` + `handleSelectArticle`
 * pattern for keyboard-driven article navigation, preview selection, and triage actions
 * (mark read/star/archive, open, refresh, focus, view switches).
 *
 * Callers supply the current visible list, preview id + setter, derived selected + state,
 * the updateState triage mutator, refresh fn, input ref, router, and updateUrl.
 *
 * This hook:
 * - Returns stable-enough callbacks for onSelectArticle etc in UI tree.
 * - Builds and memos the handler map.
 * - Calls `useReaderShortcuts(shortcutHandlers)` internally (preferred) so callers
 *   (e.g. future ReaderShell) do not need to duplicate the registration, shrinking surface.
 *
 * All behavior / edge cases (no-op when no selection, wrap on adjacent from none, window.open,
 * updateUrl with cursor reset, etc.) are preserved verbatim from the monolith.
 */
export interface UseReaderShortcutHandlersParams {
  visibleArticles: WorkspaceArticle[];
  previewArticleId: string | null;
  setPreviewArticleId: Dispatch<SetStateAction<string | null>>;
  selectedArticle: WorkspaceArticle | null;
  selectedArticleState: ReaderArticleState;
  updateState: (articleId: string, partial: Partial<ReaderArticleState>) => void;
  refreshLatest: (forceRefresh?: boolean) => void | Promise<void>;
  queryInputRef: RefObject<HTMLInputElement | null>;
  router: ReturnType<typeof useRouter>;
  updateUrl: (overrides: Record<string, string | string[] | null | undefined>) => void;
  onShowShortcuts?: () => void;
  onCloseShortcuts?: () => void;
}

export interface UseReaderShortcutHandlersResult {
  shortcutHandlers: ReaderShortcutHandlers;
  handleSelectArticle: (articleId: string) => void;
  selectAdjacentArticle: (delta: number) => void;
}

export function useReaderShortcutHandlers(
  params: UseReaderShortcutHandlersParams,
): UseReaderShortcutHandlersResult {
  const {
    visibleArticles,
    previewArticleId,
    setPreviewArticleId,
    selectedArticle,
    selectedArticleState,
    updateState,
    refreshLatest,
    queryInputRef,
    router,
    updateUrl,
    onShowShortcuts,
    onCloseShortcuts,
  } = params;

  const handleSelectArticle = useCallback(
    (articleId: string) => {
      setPreviewArticleId((current) => (current === articleId ? null : articleId));
    },
    [setPreviewArticleId],
  );

  const selectAdjacentArticle = useCallback(
    (delta: number) => {
      if (visibleArticles.length === 0) {
        return;
      }

      const currentIndex = previewArticleId
        ? visibleArticles.findIndex((article) => article.id === previewArticleId)
        : -1;
      const nextIndex =
        currentIndex < 0
          ? delta > 0
            ? 0
            : visibleArticles.length - 1
          : Math.min(visibleArticles.length - 1, Math.max(0, currentIndex + delta));

      setPreviewArticleId(visibleArticles[nextIndex]?.id ?? null);
    },
    [previewArticleId, visibleArticles, setPreviewArticleId],
  );

  const shortcutHandlers = useMemo<ReaderShortcutHandlers>(
    () => ({
      next_article: () => selectAdjacentArticle(1),
      previous_article: () => selectAdjacentArticle(-1),
      mark_as_read: () => {
        if (!selectedArticle) {
          return;
        }
        updateState(selectedArticle.id, { read: !selectedArticleState.read });
      },
      star: () => {
        if (!selectedArticle) {
          return;
        }
        updateState(selectedArticle.id, { starred: !selectedArticleState.starred });
      },
      archive: () => {
        if (!selectedArticle) {
          return;
        }
        updateState(selectedArticle.id, { archived: !selectedArticleState.archived });
      },
      open_original: () => {
        if (!selectedArticle) {
          return;
        }
        window.open(selectedArticle.link, "_blank", "noopener,noreferrer");
      },
      refresh: () => void refreshLatest(true),
      search: () => queryInputRef.current?.focus(),
      focus_search: () => queryInputRef.current?.focus(),
      show_shortcuts: () => onShowShortcuts?.(),
      close_modal: () => {
        onCloseShortcuts?.();
        setPreviewArticleId(null);
      },
      go_home: () => router.push("/"),
      go_unread: () => updateUrl({ reader_view: "unread", cursor: null }),
      go_starred: () => updateUrl({ reader_view: "starred", cursor: null }),
      go_all: () => updateUrl({ reader_view: null, cursor: null }),
    }),
    [
      refreshLatest,
      router,
      selectAdjacentArticle,
      selectedArticle,
      selectedArticleState.archived,
      selectedArticleState.read,
      selectedArticleState.starred,
      updateUrl,
      updateState,
      setPreviewArticleId,
      queryInputRef,
      onShowShortcuts,
      onCloseShortcuts,
    ],
  );

  // Wire shortcuts internally (preferred for shrinking caller shells like ReaderShell).
  useReaderShortcuts(shortcutHandlers);

  return {
    shortcutHandlers,
    handleSelectArticle,
    selectAdjacentArticle,
  };
}
