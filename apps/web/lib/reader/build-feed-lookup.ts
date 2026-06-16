import type { FeedSource } from "@/lib/feeds-filters";

export function buildFeedLookup(feeds: FeedSource[]): Map<string, FeedSource> {
  return new Map(
    feeds
      .filter((feed): feed is FeedSource & { id: string } => typeof feed.id === "string")
      .map((feed) => [feed.id, feed]),
  );
}
