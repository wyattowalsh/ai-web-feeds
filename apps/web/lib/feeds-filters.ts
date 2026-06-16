/**
 * Client-safe feed types and pure filter helpers.
 * Do not import Node fs/path modules here — used by client components.
 */

export interface FeedSource {
  id?: string;
  feed?: string;
  site?: string | null;
  url: string;
  title: string;
  source_type?: string;
  description?: string;
  website_url?: string;
  icon_url?: string;
  favicon_url?: string;
  logo_url?: string;
  icon?: string;
  verified?: boolean;
  is_active?: boolean;
  topics?: string[];
  tags?: string[];
  language?: string;
  author?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FeedsData {
  sources: FeedSource[];
  metadata?: {
    total_count: number;
    last_updated: string;
    version: string;
  };
}

export function filterBySourceType(feeds: FeedSource[], sourceType: string | null): FeedSource[] {
  if (!sourceType) return feeds;
  return feeds.filter((feed) => feed.source_type === sourceType);
}

export function filterByTopic(feeds: FeedSource[], topic: string | null): FeedSource[] {
  if (!topic) return feeds;
  return feeds.filter((feed) => feed.topics?.includes(topic));
}

export function filterByVerified(feeds: FeedSource[], verified: boolean | null): FeedSource[] {
  if (verified === null) return feeds;
  return feeds.filter((feed) => feed.verified === verified);
}

export function getSourceTypes(feeds: FeedSource[]): string[] {
  const types = new Set<string>();

  for (const feed of feeds) {
    if (feed.source_type) {
      types.add(feed.source_type);
    }
  }

  return Array.from(types).sort();
}

export function getTopics(feeds: FeedSource[]): string[] {
  const topics = new Set<string>();

  for (const feed of feeds) {
    if (feed.topics) {
      for (const topic of feed.topics) {
        topics.add(topic);
      }
    }
  }

  return Array.from(topics).sort();
}
