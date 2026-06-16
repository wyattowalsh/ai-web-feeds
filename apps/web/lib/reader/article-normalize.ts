import type { Article } from "@/lib/db";
import type { FeedsWorkspaceInitialBrowse } from "@/lib/reader-route";
import type { WorkspaceArticle } from "./types";

export function compareByPublishedDesc(
  left: { published_at_ms: number | null },
  right: { published_at_ms: number | null },
): number {
  return (right.published_at_ms ?? 0) - (left.published_at_ms ?? 0);
}

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

export function normalizeCachedArticle(article: Article, feedTitle?: string): WorkspaceArticle {
  const publishedAt = article.pubDate ? new Date(article.pubDate).toISOString() : null;

  return {
    id: article.id,
    feed_id: article.feedId,
    feed_title: feedTitle ?? article.feedId,
    title: article.title,
    link: article.link,
    summary: article.summary ?? null,
    content_html: article.content || null,
    author: article.author ?? null,
    published_at: publishedAt,
    topics: article.topics,
    source_topics: article.sourceTopics,
    raw_categories: article.rawCategories,
    source_type: "feed",
    verified: false,
    is_active: true,
    freshness: "cached",
    published_at_ms: article.pubDate ?? null,
    source_url: null,
  };
}

export function getArticleTopics(article: WorkspaceArticle): string[] {
  return article.topics;
}
