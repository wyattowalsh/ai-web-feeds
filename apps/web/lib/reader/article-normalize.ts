import type { FeedsWorkspaceInitialBrowse } from "@/lib/reader-route";
import type { WorkspaceArticle } from "./types";

export function normalizeArticle(
  article: FeedsWorkspaceInitialBrowse["items"][number],
): WorkspaceArticle {
  return {
    ...article,
    freshness: "corpus",
    published_at_ms: article.published_at ? Date.parse(article.published_at) : null,
  };
}

export function normalizeLiveArticle(post: {
  id: string;
  feedId: string;
  feedTitle: string;
  title: string;
  link: string;
  summary: string | null;
  sourceUrl?: string;
  resolvedFeedUrl?: string;
  author: string | null;
  rawCategories: string[];
  publishedAt: string | null;
}): WorkspaceArticle {
  return {
    id: `${post.feedId}:${post.id}`,
    feed_id: post.feedId,
    feed_title: post.feedTitle,
    title: post.title,
    link: post.link,
    summary: post.summary,
    content_html: null,
    author: post.author,
    published_at: post.publishedAt,
    topics: [],
    source_topics: [],
    raw_categories: post.rawCategories,
    source_type: "feed",
    verified: false,
    is_active: true,
    freshness: "live",
    published_at_ms: post.publishedAt ? Date.parse(post.publishedAt) : null,
    source_url: post.sourceUrl ?? null,
    resolved_feed_url: post.resolvedFeedUrl ?? null,
  };
}

export function getArticleTopics(article: WorkspaceArticle): string[] {
  return article.topics;
}
