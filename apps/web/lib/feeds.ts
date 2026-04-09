/**
 * Feed data loading utilities
 * Reads feed data from canonical repository data files.
 */

import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { resolveDataPath } from "@/lib/runtime-paths";

export interface FeedSource {
  id?: string;
  url: string;
  title: string;
  feed?: string;
  source_type?: string;
  description?: string;
  notes?: string;
  site?: string;
  website_url?: string;
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

const FEED_CATALOG_CANDIDATES = [
  { filename: "feeds.enriched.yaml", parser: "yaml" as const },
  { filename: "feeds.yaml", parser: "yaml" as const },
  { filename: "feeds.json", parser: "json" as const },
];

type FeedCatalog = {
  sources: FeedSource[];
  metadata?: FeedsData["metadata"];
  sourceFile: string;
};

function extractSources(data: unknown): FeedSource[] {
  if (Array.isArray(data)) {
    return data as FeedSource[];
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const structured = data as { sources?: unknown; feeds?: unknown };
  if (Array.isArray(structured.sources)) {
    return structured.sources as FeedSource[];
  }

  if (Array.isArray(structured.feeds)) {
    return structured.feeds as FeedSource[];
  }

  return [];
}

function extractMetadata(data: unknown): FeedsData["metadata"] | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const structured = data as { metadata?: FeedsData["metadata"] };
  return structured.metadata;
}

export function loadFeedCatalog(): FeedCatalog {
  for (const candidate of FEED_CATALOG_CANDIDATES) {
    const filePath = resolveDataPath(candidate.filename);

    try {
      const content = readFileSync(filePath, "utf-8");
      if (!content.trim()) {
        continue;
      }

      const parsed = candidate.parser === "json" ? JSON.parse(content) : parse(content);
      const sources = extractSources(parsed);
      if (sources.length === 0) {
        continue;
      }

      return {
        sources,
        metadata: extractMetadata(parsed),
        sourceFile: candidate.filename,
      };
    } catch {
      continue;
    }
  }

  throw new Error("Failed to load feeds data from any source");
}

/**
 * Load feeds from JSON/YAML files
 * Tries multiple sources in order: feeds.enriched.yaml, feeds.yaml, feeds.json
 */
export async function loadFeeds(): Promise<FeedsData> {
  const catalog = loadFeedCatalog();
  return {
    sources: catalog.sources,
    metadata: catalog.metadata,
  };
}

/**
 * Filter feeds by source type
 */
export function filterBySourceType(feeds: FeedSource[], sourceType: string | null): FeedSource[] {
  if (!sourceType) return feeds;
  return feeds.filter((feed) => feed.source_type === sourceType);
}

/**
 * Filter feeds by topic
 */
export function filterByTopic(feeds: FeedSource[], topic: string | null): FeedSource[] {
  if (!topic) return feeds;
  return feeds.filter((feed) => feed.topics?.includes(topic));
}

/**
 * Filter feeds by verification status
 */
export function filterByVerified(feeds: FeedSource[], verified: boolean | null): FeedSource[] {
  if (verified === null) return feeds;
  return feeds.filter((feed) => feed.verified === verified);
}

/**
 * Get unique source types from feed list
 */
export function getSourceTypes(feeds: FeedSource[]): string[] {
  const types = new Set<string>();

  for (const feed of feeds) {
    if (feed.source_type) {
      types.add(feed.source_type);
    }
  }

  return Array.from(types).sort();
}

/**
 * Get unique topics from feed list
 */
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

/**
 * Get feed statistics
 */
export function getFeedStats(feeds: FeedSource[]) {
  return {
    total: feeds.length,
    verified: feeds.filter((f) => f.verified).length,
    active: feeds.filter((f) => f.is_active !== false).length,
    byType: getSourceTypes(feeds).reduce(
      (acc, type) => {
        acc[type] = feeds.filter((f) => f.source_type === type).length;
        return acc;
      },
      {} as Record<string, number>,
    ),
    topicCount: getTopics(feeds).length,
  };
}
