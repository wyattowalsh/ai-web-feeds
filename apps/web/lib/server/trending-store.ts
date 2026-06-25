import "server-only";

import { getSql } from "@/lib/server/db";

export type TrendingTopicRecord = {
  topic: string;
  feed_count: number;
  validation_count: number;
  validation_frequency: number;
  avg_health_score: number;
};

function mapTopicStatsRow(row: Record<string, unknown>): TrendingTopicRecord {
  const feedCount = Number(row.feed_count);
  const validationFrequency = Number(row.validation_frequency);

  return {
    topic: String(row.topic),
    feed_count: feedCount,
    validation_count: Math.round(validationFrequency * feedCount),
    validation_frequency: validationFrequency,
    avg_health_score: Number(row.avg_health_score),
  };
}

/**
 * List trending topics from the latest `topic_stats` snapshot, ordered by
 * validation frequency (Python `get_topic_stats` / analytics parity).
 */
export async function listTrendingTopics(limit: number): Promise<TrendingTopicRecord[]> {
  const sql = getSql();
  if (!sql) {
    return [];
  }

  const latestRows = await sql`
    SELECT snapshot_date
    FROM topic_stats
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;

  const latestSnapshot = latestRows[0]?.snapshot_date;
  if (!latestSnapshot) {
    return [];
  }

  const rows = await sql`
    SELECT
      topic,
      feed_count,
      validation_frequency,
      avg_health_score
    FROM topic_stats
    WHERE snapshot_date = ${String(latestSnapshot)}
    ORDER BY validation_frequency DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => mapTopicStatsRow(row as Record<string, unknown>));
}

export const trendingStore = {
  list: listTrendingTopics,
};
