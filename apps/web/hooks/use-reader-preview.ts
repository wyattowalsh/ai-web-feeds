"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import {
  DEFAULT_ARTICLE_STATE,
  type ReaderArticleState,
  type WorkspaceArticle,
} from "@/lib/reader";

export interface UseReaderPreviewParams {
  visibleArticles: WorkspaceArticle[];
  articleStateMap: Record<string, ReaderArticleState>;
}

export interface UseReaderPreviewResult {
  previewArticleId: string | null;
  setPreviewArticleId: Dispatch<SetStateAction<string | null>>;
  selectedArticle: WorkspaceArticle | null;
  selectedArticleState: ReaderArticleState;
  clearPreview: () => void;
}

/**
 * Hook extracted (wave 9 reader polish): desktop preview selection + escape + auto-clear.
 */
export function useReaderPreview({
  visibleArticles,
  articleStateMap,
}: UseReaderPreviewParams): UseReaderPreviewResult {
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);

  useEffect(() => {
    if (previewArticleId && !visibleArticles.some((article) => article.id === previewArticleId)) {
      setPreviewArticleId(null);
    }
  }, [previewArticleId, visibleArticles]);

  useEffect(() => {
    if (!previewArticleId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPreviewArticleId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewArticleId]);

  const selectedArticle =
    visibleArticles.find((article) => article.id === previewArticleId) ?? null;

  const selectedArticleState = selectedArticle
    ? articleStateMap[selectedArticle.id] ?? DEFAULT_ARTICLE_STATE
    : DEFAULT_ARTICLE_STATE;

  const clearPreview = useCallback(() => {
    setPreviewArticleId(null);
  }, []);

  return {
    previewArticleId,
    setPreviewArticleId,
    selectedArticle,
    selectedArticleState,
    clearPreview,
  };
}
