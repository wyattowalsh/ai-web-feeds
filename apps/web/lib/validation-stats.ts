import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

export type ValidationStats = {
  total_feeds: number;
  validated_feeds: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  avg_response_time_ms: number;
  healthy_feeds: number;
  avg_health_score: number;
  last_validation_run: string | null;
  top_errors: Array<{ error: string; count: number }>;
};

export function getDefaultValidationStats(): ValidationStats {
  return {
    total_feeds: 0,
    validated_feeds: 0,
    success_count: 0,
    failure_count: 0,
    success_rate: 0,
    avg_response_time_ms: 0,
    healthy_feeds: 0,
    avg_health_score: 0,
    last_validation_run: null,
    top_errors: [],
  };
}

async function getTotalFeeds(): Promise<number> {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const enrichedPath = path.join(repoRoot, "data", "feeds.enriched.yaml");
  const feedsPath = path.join(repoRoot, "data", "feeds.yaml");

  try {
    const enrichedRaw = await fs.readFile(enrichedPath, "utf8");
    const enriched = parse(enrichedRaw);
    const enrichedTotal = enriched?.document_meta?.total_sources;

    if (typeof enrichedTotal === "number") {
      return enrichedTotal;
    }
  } catch (error) {
    console.warn("Failed to read feeds.enriched.yaml for stats", error);
  }

  const feedsRaw = await fs.readFile(feedsPath, "utf8");
  const feeds = parse(feedsRaw);
  const sources = feeds?.sources;
  return Array.isArray(sources) ? sources.length : 0;
}

export async function getValidationStats(): Promise<ValidationStats> {
  const stats = getDefaultValidationStats();

  try {
    stats.total_feeds = await getTotalFeeds();

    // TODO: Add actual validation metrics from database
    // For now, use estimates
    stats.validated_feeds = Math.floor(stats.total_feeds * 0.8);
    stats.success_count = Math.floor(stats.total_feeds * 0.7);
    stats.failure_count = Math.floor(stats.total_feeds * 0.1);
    stats.success_rate = 87.5;
    stats.avg_response_time_ms = 450;
    stats.healthy_feeds = Math.floor(stats.total_feeds * 0.75);
    stats.avg_health_score = 0.82;
  } catch (error) {
    console.warn("Failed to load validation stats, using defaults", error);
  }

  return stats;
}
