import type { FeedsWorkspaceInitialBrowse, FeedsWorkspaceInitialState } from "@/lib/reader-route";

export type ReaderView = FeedsWorkspaceInitialState["readerView"];
export type ArticleSort = FeedsWorkspaceInitialState["sort"];
export type VerifiedDraftValue = "" | "true" | "false";

export type ReaderArticleState = {
  read: boolean;
  starred: boolean;
  archived: boolean;
  bookmarked: boolean;
};

export type WorkspaceArticle = FeedsWorkspaceInitialBrowse["items"][number] & {
  freshness: "corpus" | "live";
  published_at_ms: number | null;
  source_url?: string | null;
  resolved_feed_url?: string | null;
};

export type ReaderDraftState = {
  query: string;
  sourceType: string;
  topics: string[];
  verified: VerifiedDraftValue;
  readerView: ReaderView;
  sort: ArticleSort;
};

export type LiveStreamEvent =
  | {
      type: "start";
      totalSources: number;
      limit: number;
      perFeedLimit: number;
      fetchedAt: string;
    }
  | {
      type: "feed";
      feedId: string;
      feedTitle: string;
      posts: Array<{
        id: string;
        feedId: string;
        feedTitle: string;
        title: string;
        link: string;
        summary: string | null;
        sourceUrl: string;
        resolvedFeedUrl: string;
        author: string | null;
        rawCategories: string[];
        publishedAt: string | null;
      }>;
      successfulSources: number;
      failedSources: number;
    }
  | {
      type: "feed_error";
      feedId: string;
      feedTitle: string;
      message: string;
      successfulSources: number;
      failedSources: number;
    }
  | {
      type: "done";
      totalSources: number;
      successfulSources: number;
      failedSources: number;
      totalMatchedPosts: number;
      fetchedAt: string;
    }
  | {
      type: "error";
      message: string;
    };

export type LiveStreamProgress = {
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  completed: boolean;
};

export type FeedStats = {
  total: number;
  verified: number;
  active: number;
  hasVerificationMetadata: boolean;
  hasActivityMetadata: boolean;
  sourceTypeCount: number;
  byType: Record<string, number>;
  topicCount: number;
};

export type ReaderHrefState = {
  query: string;
  sourceType: string | null;
  topics: string[];
  verified: boolean | null;
  feedIds: string[];
  sort: ArticleSort;
  readerView: ReaderView;
  cursor: number;
};

export type FeedSliceFilters = {
  feedIds: string[];
  sourceType: string | null;
  topics: string[];
  verified: boolean | null;
};

export type FilterChip = {
  key: string;
  label: string;
  overrides: Record<string, string | string[] | null | undefined>;
};
