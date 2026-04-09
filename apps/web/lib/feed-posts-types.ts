/**
 * Shared feed-posts API response types.
 *
 * This file is imported by both lib/feed-posts.ts (server) and client
 * components such as the OPMLViewer.  Keep this file free of any runtime
 * imports so it remains safe to use in "use client" modules.
 */

export interface FeedPost {
  id: string;
  title: string;
  link: string;
  publishedAt: string | null;
  summary: string | null;
  author: string | null;
  categories: string[];
}

export interface FeedPostsResponse {
  feedId: string;
  feedTitle: string;
  sourceUrl: string;
  resolvedFeedUrl: string;
  posts: FeedPost[];
  fetchedAt: string;
}

export interface AggregateFeedPost extends FeedPost {
  feedId: string;
  feedTitle: string;
  sourceUrl: string;
  resolvedFeedUrl: string;
}

export interface AggregateFeedPostsResponse {
  posts: AggregateFeedPost[];
  feeds: FeedPostsResponse[];
  fetchedAt: string;
  expiresAt: string;
  cacheState: "live" | "cached";
  totalSources: number;
  successfulSources: number;
  failedSources: number;
}
