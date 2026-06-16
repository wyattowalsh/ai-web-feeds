import type { ReaderArticleState } from "./types";

export const ARTICLE_STATE_STORAGE_PREFIX = "aiwebfeeds.reader.article.";

export const DEFAULT_ARTICLE_STATE: ReaderArticleState = {
  read: false,
  starred: false,
  archived: false,
  bookmarked: false,
};

export const DEFAULT_PAGE_LIMIT = 24;
export const LIVE_REFRESH_SAMPLE_FEED_LIMIT = 18;
export const LIVE_BOOTSTRAP_POST_LIMIT = 48;
export const LIVE_BOOTSTRAP_PER_FEED_LIMIT = 3;
