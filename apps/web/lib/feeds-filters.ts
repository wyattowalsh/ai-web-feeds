import { normalizeFilterToken, normalizeTopicValues, type CatalogFeed } from "@/lib/catalog-types";
import type { FeedSource } from "@/lib/feeds";

export type { FeedSource };

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

export function getTopics<T extends FilterableFeed>(feeds: T[]): string[] {
  const topics = new Map<string, string>();

  for (const feed of feeds) {
    for (const topic of normalizeTopicValues(feed.topics)) {
      const lookupKey = normalizeFilterToken(topic);
      if (lookupKey && !topics.has(lookupKey)) {
        topics.set(lookupKey, topic);
      }
    }
  }

  return Array.from(topics.values()).sort((left, right) => {
    const normalizedLeft = normalizeFilterToken(left) ?? left;
    const normalizedRight = normalizeFilterToken(right) ?? right;
    if (normalizedLeft < normalizedRight) {
      return -1;
    }
    if (normalizedLeft > normalizedRight) {
      return 1;
    }

    return left.localeCompare(right);
  });
}
