export type FeedsWorkspaceMode = "catalog" | "reader";

export type ReaderPageSearchParams = Record<string, string | string[] | undefined>;

export type FeedsWorkspaceInitialState = {
  query: string;
  feedIds: string[];
  sourceType: string | null;
  topics: string[];
  verified: boolean | null;
  sort: "latest" | "oldest" | "source";
  readerView: "latest" | "unread" | "starred" | "saved" | "archived";
  cursor: number;
  limit: number;
};

export type FeedsWorkspaceInitialBrowse = {
  items: Array<{
    id: string;
    feed_id: string;
    feed_title: string;
    title: string;
    link: string;
    summary: string | null;
    content_html: string | null;
    author: string | null;
    published_at: string | null;
    topics: string[];
    source_topics: string[];
    raw_categories: string[];
    source_type: string;
    verified: boolean;
    is_active: boolean;
  }>;
  next_cursor: number | null;
  total_matched: number;
  cursor: number;
  limit: number;
  applied_query: string | null;
  applied_sort: "latest" | "oldest" | "source";
  corpus: {
    generated_at: string | null;
    schema_version: string;
    source_db: string;
    article_count: number;
    feed_count: number;
    latest_published_at: string | null;
    freshness_watermark: string | null;
    is_empty: boolean;
  };
};

export type URLSearchParamsLike = Pick<URLSearchParams, "get" | "getAll">;
