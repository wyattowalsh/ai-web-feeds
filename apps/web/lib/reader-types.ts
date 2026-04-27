export interface ReaderArticleState {
  read: boolean;
  starred: boolean;
  archived: boolean;
  bookmarked: boolean;
}

export interface NormalizedArticle extends ReaderArticleState {
  id: string;
  feedId: string;
  feedTitle: string;
  sourceUrl: string;
  title: string;
  link: string;
  summary: string | null;
  author: string | null;
  categories: string[];
  publishedAt: string | null;
  publishedAtMs: number | null;
}

export interface ReaderTimelineMeta {
  cacheState: "live" | "cached" | "stale";
  fetchedAt: string;
  expiresAt: string;
  totalSources: number;
  successfulSources: number;
  failedSources: number;
}
