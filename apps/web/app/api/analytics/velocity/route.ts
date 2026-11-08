import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { NextResponse } from "next/server";

import { loadFeedCatalog } from "@/lib/feeds";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

type DailyCount = {
  date: string;
  count: number;
};

type Granularity = "daily" | "weekly" | "monthly";

const VALIDATION_DAILY_SQL = `SELECT substr(validated_at, 1, 10) AS date, COUNT(*) AS count
FROM validations
WHERE validated_at IS NOT NULL
GROUP BY substr(validated_at, 1, 10)`;

const CACHE_HEADERS = {
  "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
};

function validationDatabaseCandidates(): string[] {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "data", "ai-web-feeds.db"),
    path.resolve(cwd, "..", "data", "ai-web-feeds.db"),
    path.resolve(cwd, "..", "..", "data", "ai-web-feeds.db"),
  ];

  return [...new Set(candidates)];
}

function normalizeCount(value: unknown): number | null {
  if (typeof value === "bigint") {
    if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }

    return Number(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return normalizeCount(Number(value));
  }

  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function toPoint(dateValue: unknown, countValue: unknown): DailyCount | null {
  if (typeof dateValue !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return null;
  }

  const count = normalizeCount(countValue);
  if (count === null) {
    return null;
  }

  return { date: dateValue, count };
}

function mapToPoints(counts: Map<string, number>): DailyCount[] {
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));
}

function datePrefix(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/.exec(value.trim());
  return match?.[1] ?? null;
}

function catalogValidationDate(source: unknown): string | null {
  if (!source || typeof source !== "object") {
    return null;
  }

  const record = source as {
    last_validated?: unknown;
    validated_at?: unknown;
    meta?: unknown;
  };
  const meta =
    record.meta && typeof record.meta === "object"
      ? (record.meta as { last_validated?: unknown; validated_at?: unknown })
      : null;

  return (
    datePrefix(record.last_validated) ??
    datePrefix(record.validated_at) ??
    datePrefix(meta?.last_validated) ??
    datePrefix(meta?.validated_at)
  );
}

function readValidationDailyCounts(databasePath: string): DailyCount[] | null {
  let database: DatabaseSync | null = null;

  try {
    database = new DatabaseSync(databasePath, { readOnly: true });
    const rows = database.prepare(VALIDATION_DAILY_SQL).all();
    const counts = new Map<string, number>();

    for (const row of rows) {
      const point = toPoint(row.date, row.count);
      if (!point) {
        continue;
      }

      counts.set(point.date, (counts.get(point.date) ?? 0) + point.count);
    }

    return mapToPoints(counts);
  } catch (error) {
    console.warn("Validation snapshot unavailable", error);
    return null;
  } finally {
    database?.close();
  }
}

function readValidationSnapshot(): DailyCount[] {
  for (const candidate of validationDatabaseCandidates()) {
    if (!existsSync(candidate)) {
      continue;
    }

    const counts = readValidationDailyCounts(candidate);
    if (counts && counts.length > 0) {
      return counts;
    }
  }

  return [];
}

function readCatalogPoints(): DailyCount[] {
  let sources: unknown[] = [];

  try {
    const catalog = loadFeedCatalog();
    sources = Array.isArray(catalog?.sources) ? catalog.sources : [];
  } catch (error) {
    console.warn("Catalog unavailable for velocity", error);
    return [];
  }

  const counts = new Map<string, number>();

  for (const source of sources) {
    const date = catalogValidationDate(source);
    if (!date) {
      continue;
    }

    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return mapToPoints(counts);
}

function parseRangeDays(dateRange: string | null): number | null {
  if (!dateRange) {
    return null;
  }

  const match = /^(\d+)d$/.exec(dateRange.trim());
  if (!match?.[1]) {
    return null;
  }

  const days = Number(match[1]);
  if (!Number.isSafeInteger(days) || days <= 0) {
    return null;
  }

  return days;
}

function utcDateDaysAgo(days: number): string {
  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  return cutoff.toISOString().slice(0, 10);
}

function filterByRange(points: DailyCount[], days: number | null): DailyCount[] {
  if (days === null) {
    return points;
  }

  const cutoff = utcDateDaysAgo(days);
  return points.filter((point) => point.date >= cutoff);
}

function normalizeGranularity(value: string | null): Granularity {
  if (value === "weekly" || value === "monthly") {
    return value;
  }

  return "daily";
}

function weekBucket(date: string): string {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) {
    return date;
  }

  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const weekYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((utc.getTime() - yearStart.getTime()) / 86400000 / 7 + 1 / 7);

  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function bucketDate(date: string, granularity: Granularity): string {
  if (granularity === "monthly") {
    return date.slice(0, 7);
  }

  if (granularity === "weekly") {
    return weekBucket(date);
  }

  return date;
}

function rollup(points: DailyCount[], granularity: Granularity): DailyCount[] {
  const counts = new Map<string, number>();

  for (const point of points) {
    const bucket = bucketDate(point.date, granularity);
    counts.set(bucket, (counts.get(bucket) ?? 0) + point.count);
  }

  return mapToPoints(counts);
}

function velocityResponse(points: DailyCount[]) {
  // Real stored rows only. Forecasts stay disabled; no modeled series is attached.
  if (points.length === 0) {
    return NextResponse.json(
      {
        demo: false,
        points: [],
      },
      { headers: CACHE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      demo: false,
      points,
    },
    { headers: CACHE_HEADERS },
  );
}

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const snapshot = readValidationSnapshot();
  const daily = snapshot.length > 0 ? snapshot : readCatalogPoints();
  const points = rollup(
    filterByRange(daily, parseRangeDays(searchParams.get("date_range"))),
    normalizeGranularity(searchParams.get("granularity")),
  );

  return velocityResponse(points);
};

export const GET = withRouteTelemetry("analytics.velocity", GETHandler);
