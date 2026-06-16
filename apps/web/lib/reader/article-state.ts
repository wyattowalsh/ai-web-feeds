import { ARTICLE_STATE_STORAGE_PREFIX, DEFAULT_ARTICLE_STATE } from "./constants";
import type { ReaderArticleState } from "./types";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function articleStateStorageKey(articleId: string): string {
  return `${ARTICLE_STATE_STORAGE_PREFIX}${articleId}`;
}

export function readArticleState(articleId: string): ReaderArticleState {
  if (!canUseStorage()) {
    return DEFAULT_ARTICLE_STATE;
  }

  try {
    const stored = window.localStorage.getItem(articleStateStorageKey(articleId));
    if (!stored) {
      return DEFAULT_ARTICLE_STATE;
    }

    const parsed = JSON.parse(stored) as Partial<ReaderArticleState>;
    return {
      read: parsed.read ?? false,
      starred: parsed.starred ?? false,
      archived: parsed.archived ?? false,
      bookmarked: parsed.bookmarked ?? false,
    };
  } catch {
    return DEFAULT_ARTICLE_STATE;
  }
}

export function writeArticleState(articleId: string, nextState: ReaderArticleState): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(articleStateStorageKey(articleId), JSON.stringify(nextState));
}
