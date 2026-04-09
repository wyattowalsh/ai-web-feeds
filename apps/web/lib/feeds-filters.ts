import { normalizeFilterToken, normalizeTopicValues, type CatalogFeed } from "@/lib/catalog-types";
import type { FeedSource } from "@/lib/feeds";

export type { FeedSource };

type FilterableFeed = {
  source_type?: FeedSource["source_type"] | CatalogFeed["source_type"] | null;
  topics?: FeedSource["topics"] | CatalogFeed["topics"] | null;
  verified?: FeedSource["verified"] | CatalogFeed["verified"];
};

export function filterBySourceType<T extends FilterableFeed>(
  feeds: T[],
  sourceType: string | null,
): T[] {
  const normalizedSourceType = normalizeFilterToken(sourceType);
  if (!normalizedSourceType) {
    return feeds;
  }

  return feeds.filter(
    (feed) => normalizeFilterToken(feed.source_type ?? null) === normalizedSourceType,
  );
}

export function filterByTopic<T extends FilterableFeed>(feeds: T[], topic: string | null): T[] {
  const normalizedTopic = normalizeFilterToken(topic);
  if (!normalizedTopic) {
    return feeds;
  }

  return feeds.filter((feed) =>
    normalizeTopicValues(feed.topics).some(
      (feedTopic) => normalizeFilterToken(feedTopic) === normalizedTopic,
    ),
  );
}

export function filterByVerified<T extends FilterableFeed>(
  feeds: T[],
  verified: boolean | null,
): T[] {
  if (verified === null) {
    return feeds;
  }

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
