import type { FeedSource } from "@/lib/feeds";

export type { FeedSource };

export function filterBySourceType(
  feeds: FeedSource[],
  sourceType: string | null
): FeedSource[] {
  if (!sourceType) return feeds;
  return feeds.filter((feed) => feed.source_type === sourceType);
}

export function filterByTopic(
  feeds: FeedSource[],
  topic: string | null
): FeedSource[] {
  if (!topic) return feeds;
  return feeds.filter((feed) => feed.topics?.includes(topic));
}

export function filterByVerified(
  feeds: FeedSource[],
  verified: boolean | null
): FeedSource[] {
  if (verified === null) return feeds;
  return feeds.filter((feed) => feed.verified === verified);
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
