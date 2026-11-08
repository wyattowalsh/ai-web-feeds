import { NextResponse } from "next/server";
import { clampNumber } from "@/lib/backend";
import { loadFeedCatalog, type FeedSource } from "@/lib/feeds";
import { trendingStore, type TrendingTopicRecord } from "@/lib/server/trending-store";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

type TrendingPoint = {
  topic: string;
  count: number;
  feed_count: number;
  validation_frequency?: number;
  avg_health_score?: number;
};

const PRIVATE_CACHE = {
  "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
};

function readLimit(request: Request): number {
  const parsed = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "10", 10);
  return clampNumber(Number.isFinite(parsed) ? parsed : 10, 1, 100);
}

function finiteNumber(value: number): value is number {
  return Number.isFinite(value);
}

function pointsFromSnapshot(rows: TrendingTopicRecord[]): TrendingPoint[] {
  const points: TrendingPoint[] = [];

  for (const row of rows) {
    const topic = row.topic.trim();
    if (!topic || !finiteNumber(row.feed_count)) {
      continue;
    }

    const point: TrendingPoint = {
      topic,
      count: row.feed_count,
      feed_count: row.feed_count,
    };

    if (finiteNumber(row.validation_frequency)) {
      point.validation_frequency = row.validation_frequency;
    }
    if (finiteNumber(row.avg_health_score)) {
      point.avg_health_score = row.avg_health_score;
    }

    points.push(point);
  }

  return points;
}

function pointsFromCatalog(sources: FeedSource[], limit: number): TrendingPoint[] {
  const feedCounts = new Map<string, number>();

  for (const source of sources) {
    const labels = Array.isArray(source.topics)
      ? source.topics
      : Array.isArray(source.tags)
        ? source.tags
        : [];
    const topics = new Set<string>();

    for (const label of labels) {
      const topic = label.trim();
      if (topic) {
        topics.add(topic);
      }
    }

    for (const topic of topics) {
      feedCounts.set(topic, (feedCounts.get(topic) ?? 0) + 1);
    }
  }

  return [...feedCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([topic, count]) => ({
      topic,
      count,
      feed_count: count,
    }));
}

async function readTrendingPoints(limit: number): Promise<TrendingPoint[]> {
  try {
    const snapshot = await trendingStore.list(limit);
    const snapshotPoints = pointsFromSnapshot(snapshot);
    if (snapshotPoints.length > 0) {
      return snapshotPoints.slice(0, limit);
    }
  } catch {
    // Validation snapshot storage is optional. Catalog rows remain the source.
  }

  try {
    const sources = loadFeedCatalog().sources ?? [];
    return pointsFromCatalog(sources, limit);
  } catch {
    return [];
  }
}

function trendingJson(points: TrendingPoint[]) {
  if (points.length === 0) {
    return NextResponse.json(
      {
        demo: false,
        points: [],
      },
      { headers: PRIVATE_CACHE },
    );
  }

  return NextResponse.json(
    {
      demo: false,
      points,
    },
    { headers: PRIVATE_CACHE },
  );
}

const GETHandler = async (request: Request) => {
  const points = await readTrendingPoints(readLimit(request));
  return trendingJson(points);
};

export const GET = withRouteTelemetry("analytics.trending", GETHandler);
