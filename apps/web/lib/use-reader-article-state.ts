"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NormalizedArticle, ReaderArticleState } from "@/lib/reader-types";

const STORAGE_PREFIX = "aiwebfeeds.reader.article.";

const DEFAULT_STATE: ReaderArticleState = {
  read: false,
  starred: false,
  archived: false,
  bookmarked: false,
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getStorageKey(articleId: string): string {
  return `${STORAGE_PREFIX}${articleId}`;
}

function readStoredState(articleId: string, article?: NormalizedArticle): ReaderArticleState {
  const articleState = article
    ? {
        read: article.read,
        starred: article.starred,
        archived: article.archived,
        bookmarked: article.bookmarked,
      }
    : DEFAULT_STATE;

  if (!canUseStorage()) {
    return articleState;
  }

  try {
    const rawValue = window.localStorage.getItem(getStorageKey(articleId));
    if (!rawValue) {
      return articleState;
    }

    const parsed = JSON.parse(rawValue) as Partial<ReaderArticleState>;
    return {
      read: parsed.read ?? articleState.read,
      starred: parsed.starred ?? articleState.starred,
      archived: parsed.archived ?? articleState.archived,
      bookmarked: parsed.bookmarked ?? articleState.bookmarked,
    };
  } catch {
    return articleState;
  }
}

function writeStoredState(articleId: string, state: ReaderArticleState): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(getStorageKey(articleId), JSON.stringify(state));
}

export function useArticleState(articleId: string, article?: NormalizedArticle) {
  const initialState = useMemo(() => readStoredState(articleId, article), [article, articleId]);
  const [state, setState] = useState<ReaderArticleState>(initialState);
  const [loading] = useState(false);

  useEffect(() => {
    setState(readStoredState(articleId, article));
  }, [article, articleId]);

  const updateState = useCallback(
    async (nextPartialState: Partial<ReaderArticleState>) => {
      setState((current) => {
        const nextState = {
          ...current,
          ...nextPartialState,
        };
        writeStoredState(articleId, nextState);
        return nextState;
      });
    },
    [articleId],
  );

  return {
    state,
    loading,
    markRead: () => updateState({ read: true }),
    markUnread: () => updateState({ read: false }),
    toggleStar: () => updateState({ starred: !state.starred }),
    toggleArchive: () => updateState({ archived: !state.archived }),
    toggleBookmark: () => updateState({ bookmarked: !state.bookmarked }),
  };
}
