/**
 * Feed data loading utilities
 * Reads feed data from canonical repository data files.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

export interface FeedSource {
  id?: string;
  feed?: string;
  site?: string | null;
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

function stableFeedId(feed: FeedSource, index: number): string {
  if (feed.id?.trim()) {
    return feed.id.trim();
  }

  const title = feed.title?.trim().toLowerCase();
  if (title) {
    return title.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  return `feed-${index + 1}`;
}

function normalizeFeedRecord(feed: FeedSource, index: number): FeedSource {
  return {
    ...feed,
    id: stableFeedId(feed, index),
    topics: feed.topics ?? feed.tags ?? [],
    tags: feed.tags ?? feed.topics ?? [],
  };
}

function hasExplicitBooleanValue<Key extends "verified" | "is_active">(
  feeds: FeedSource[],
  key: Key,
): boolean {
  return feeds.some((feed) => typeof feed[key] === "boolean");
}

function normalizeFeedsData(data: unknown): FeedsData {
  const container = data as {
    sources?: FeedSource[];
    feeds?: FeedSource[];
    metadata?: FeedsData["metadata"];
  };
  const sourceRecords = container?.sources || container?.feeds || (Array.isArray(data) ? data : []);

  return {
    sources: sourceRecords.map(normalizeFeedRecord),
    metadata: container?.metadata,
  };
}

function getDataDirectory(): string {
  return join(process.cwd(), "../../data");
}

export function loadFeedCatalog(): FeedsData {
  const dataDir = getDataDirectory();

  try {
    const jsonPath = join(dataDir, "feeds.json");
    const jsonContent = readFileSync(jsonPath, "utf-8");
    return normalizeFeedsData(JSON.parse(jsonContent));
  } catch {
    // Fall through to YAML sources.
  }

  try {
    const yamlPath = join(dataDir, "feeds.enriched.yaml");
    const yamlContent = readFileSync(yamlPath, "utf-8");
    return normalizeFeedsData(parse(yamlContent));
  } catch {
    // Fall through to the baseline catalog.
  }

  try {
    const yamlPath = join(dataDir, "feeds.yaml");
    const yamlContent = readFileSync(yamlPath, "utf-8");
    return normalizeFeedsData(parse(yamlContent));
  } catch {
    throw new Error("Failed to load feeds data from any source");
  }
}

/**
 * Load feeds from JSON/YAML files
 * Tries multiple sources in order: feeds.enriched.yaml, feeds.yaml, feeds.json
 */
export async function loadFeeds(): Promise<FeedsData> {
  return loadFeedCatalog();
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
  const sourceTypes = getSourceTypes(feeds);
  const hasVerificationMetadata = hasExplicitBooleanValue(feeds, "verified");
  const hasActivityMetadata = hasExplicitBooleanValue(feeds, "is_active");

  return {
    total: feeds.length,
    verified: feeds.filter((feed) => feed.verified === true).length,
    active: feeds.filter((feed) => feed.is_active === true).length,
    hasVerificationMetadata,
    hasActivityMetadata,
    sourceTypeCount: sourceTypes.length,
    byType: sourceTypes.reduce(
      (acc, type) => {
        acc[type] = feeds.filter((f) => f.source_type === type).length;
        return acc;
      },
      {} as Record<string, number>,
    ),
    topicCount: getTopics(feeds).length,
  };
}
