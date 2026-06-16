import { DEFAULT_PAGE_LIMIT } from "./constants";
import type { FeedsWorkspaceInitialBrowse } from "@/lib/reader-route-types";

export const DEFAULT_EMPTY_BROWSE: FeedsWorkspaceInitialBrowse = {
  items: [],
  next_cursor: null,
  total_matched: 0,
  cursor: 0,
  limit: DEFAULT_PAGE_LIMIT,
  applied_query: null,
  applied_sort: "latest",
  corpus: {
    generated_at: null,
    schema_version: "articles-3.0.0",
    source_db: "data/ai-web-feeds.db",
    article_count: 0,
    feed_count: 0,
    latest_published_at: null,
    freshness_watermark: null,
    is_empty: true,
  },
};
