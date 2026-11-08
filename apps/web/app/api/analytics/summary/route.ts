import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { parse as parseYaml } from "yaml";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const CATALOG_FILES = [
  "feeds.enriched.json",
  "feeds.enriched.yaml",
  "feeds.json",
  "feeds.yaml",
] as const;

const VALIDATION_SNAPSHOT_FILES = [
  "validation-snapshot.json",
  "validation-snapshot.yaml",
  "validations.json",
  "validations.yaml",
] as const;

const HEALTHY_SCORE_MIN = 0.8;
const MODERATE_SCORE_MIN = 0.5;
const DAY_MS = 24 * 60 * 60 * 1000;

type HealthDistribution = {
  healthy: number;
  moderate: number;
  unhealthy: number;
};

type CatalogRow = {
  id?: string;
  topics: string[];
  tags: string[];
  verified?: boolean;
  is_active?: boolean;
  curation_status?: string;
  quality_score?: number;
  health_score?: number;
};

type ValidationRow = {
  feed_source_id?: string;
  is_valid?: boolean;
  is_accessible?: boolean;
  format_valid?: boolean;
  response_time_ms: number | null;
  validated_at?: string;
  topics: string[];
};

type AnalyticsSummary = {
  total_feeds: number;
  active_feeds: number;
  verified_feeds: number;
  total_topics: number;
  validation_success_rate: number;
  avg_response_time: number;
  health_distribution: HealthDistribution;
  date_range: string;
  topic: string | null;
  last_updated: string | null;
  demo: false;
  forecast_enabled: false;
  ml: null;
};

function dataDirectory(): string {
  return path.join(process.cwd(), "..", "..", "data");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const text = stringValue(item);
      return text ? [text] : [];
    });
  }

  const text = stringValue(value);
  if (!text) return [];
  return text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function namedArray(payload: unknown, key: string): unknown[] | null {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return Array.isArray(value) ? value : null;
}

function readUpdated(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const meta = isRecord(payload.document_meta)
    ? payload.document_meta
    : isRecord(payload.metadata)
      ? payload.metadata
      : null;
  if (!meta) return null;
  return (
    stringValue(meta.enriched_at) ?? stringValue(meta.updated) ?? stringValue(meta.last_updated)
  );
}

function toCatalogRow(value: unknown): CatalogRow | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const url = stringValue(value.url);
  const feed = stringValue(value.feed);
  const title = stringValue(value.title);
  if (!id && !url && !feed && !title) return null;

  const qualityScore = numberValue(value.quality_score);
  const healthScore = numberValue(value.health_score);
  const curationStatus = stringValue(value.curation_status);

  return {
    ...(id ? { id } : {}),
    topics: stringList(value.topics),
    tags: stringList(value.tags),
    ...(booleanValue(value.verified) !== undefined ? { verified: value.verified === true } : {}),
    ...(booleanValue(value.is_active) !== undefined ? { is_active: value.is_active === true } : {}),
    ...(curationStatus ? { curation_status: curationStatus } : {}),
    ...(qualityScore !== null ? { quality_score: qualityScore } : {}),
    ...(healthScore !== null ? { health_score: healthScore } : {}),
  };
}

function toValidationRow(value: unknown): ValidationRow | null {
  if (!isRecord(value)) return null;
  const feedId = stringValue(value.feed_source_id) ?? stringValue(value.feed_id);
  const isValid = booleanValue(value.is_valid);
  const isAccessible = booleanValue(value.is_accessible);
  const formatValid = booleanValue(value.format_valid);
  const responseTime = numberValue(value.response_time_ms);
  const validatedAt = stringValue(value.validated_at);
  const topics = [...stringList(value.topics), ...stringList(value.topic)];

  if (
    feedId === null &&
    isValid === undefined &&
    isAccessible === undefined &&
    formatValid === undefined &&
    responseTime === null &&
    validatedAt === null &&
    topics.length === 0
  ) {
    return null;
  }

  return {
    ...(feedId ? { feed_source_id: feedId } : {}),
    ...(isValid !== undefined ? { is_valid: isValid } : {}),
    ...(isAccessible !== undefined ? { is_accessible: isAccessible } : {}),
    ...(formatValid !== undefined ? { format_valid: formatValid } : {}),
    response_time_ms: responseTime,
    ...(validatedAt ? { validated_at: validatedAt } : {}),
    topics,
  };
}

function catalogRowsFrom(payload: unknown): CatalogRow[] | null {
  const rawRows = Array.isArray(payload)
    ? payload
    : namedArray(payload, "sources") ?? namedArray(payload, "feeds");
  if (rawRows === null) return null;
  return rawRows.flatMap((row) => {
    const parsed = toCatalogRow(row);
    return parsed ? [parsed] : [];
  });
}

async function readPayload(filename: string): Promise<unknown | null> {
  let raw: string;
  try {
    const fileContents = await fs.readFile(path.join(dataDirectory(), filename), "utf8");
    if (typeof fileContents !== "string") return null;
    raw = fileContents;
  } catch {
    return null;
  }

  const text = raw.trim();
  if (!text) return null;

  try {
    if (filename.endsWith(".yaml") || filename.endsWith(".yml")) {
      return parseYaml(text) as unknown;
    }
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function loadCatalog(): Promise<{ feeds: CatalogRow[] | null; updated: string | null }> {
  for (const filename of CATALOG_FILES) {
    const payload = await readPayload(filename);
    if (payload === null) continue;
    const feeds = catalogRowsFrom(payload);
    if (feeds === null) continue;
    return { feeds, updated: readUpdated(payload) };
  }

  return { feeds: null, updated: null };
}

async function loadValidationSnapshot(catalogMissing: boolean): Promise<{
  rows: ValidationRow[];
  feeds: CatalogRow[] | null;
  updated: string | null;
}> {
  for (const filename of VALIDATION_SNAPSHOT_FILES) {
    const payload = await readPayload(filename);
    if (payload === null) continue;

    // Row arrays are the only counts. Aggregated snapshot totals are ignored.
    const rawRows = Array.isArray(payload)
      ? payload
      : namedArray(payload, "validations") ?? namedArray(payload, "results");
    const rows = (rawRows ?? []).flatMap((row) => {
      const parsed = toValidationRow(row);
      return parsed ? [parsed] : [];
    });
    const feeds = catalogMissing && !Array.isArray(payload) ? catalogRowsFrom(payload) : null;
    return { rows, feeds, updated: readUpdated(payload) };
  }

  return { rows: [], feeds: null, updated: null };
}

function feedTopics(row: CatalogRow): string[] {
  return row.topics.length > 0 ? row.topics : row.tags;
}

function matchesTopic(topics: string[], topic: string | null): boolean {
  if (!topic) return true;
  return topics.includes(topic);
}

function isActive(row: CatalogRow): boolean {
  if (row.is_active === false || row.curation_status === "inactive") return false;
  return true;
}

function healthDistribution(rows: CatalogRow[]): HealthDistribution {
  const distribution: HealthDistribution = { healthy: 0, moderate: 0, unhealthy: 0 };
  for (const row of rows) {
    const score = row.quality_score ?? row.health_score;
    if (typeof score !== "number") continue;
    if (score >= HEALTHY_SCORE_MIN) distribution.healthy += 1;
    else if (score >= MODERATE_SCORE_MIN) distribution.moderate += 1;
    else distribution.unhealthy += 1;
  }
  return distribution;
}

function validationSucceeded(row: ValidationRow): boolean {
  if (row.is_valid === true) return true;
  return row.is_accessible === true && row.format_valid === true;
}

function isWithinRange(validatedAt: string | undefined, cutoffMs: number): boolean {
  if (!validatedAt) return true;
  const parsed = Date.parse(validatedAt);
  if (Number.isNaN(parsed)) return true;
  return parsed >= cutoffMs;
}

function latestTimestamp(rows: ValidationRow[], fallback: string | null): string | null {
  let latest = fallback;
  let latestMs = latest === null ? Number.NaN : Date.parse(latest);

  for (const row of rows) {
    if (!row.validated_at) continue;
    const parsed = Date.parse(row.validated_at);
    if (Number.isNaN(parsed)) continue;
    if (Number.isNaN(latestMs) || parsed > latestMs) {
      latest = row.validated_at;
      latestMs = parsed;
    }
  }

  return latest;
}

function resolveDateRange(raw: string | null): { label: string; days: number } {
  const label = raw?.trim() ? raw.trim() : "30d";
  if (label === "7d") return { label, days: 7 };
  if (label === "90d") return { label, days: 90 };
  return { label: label === "30d" ? label : "30d", days: 30 };
}

function normalizeTopic(raw: string | null): string | null {
  const topic = raw?.trim();
  return topic ? topic : null;
}

function toSummary(
  feeds: CatalogRow[],
  validations: ValidationRow[],
  dateRange: string,
  topic: string | null,
  lastUpdated: string | null,
): AnalyticsSummary {
  const successes = validations.filter(validationSucceeded);
  const timed = successes.filter((row) => typeof row.response_time_ms === "number");
  const topics = new Set<string>();
  for (const feed of feeds) {
    for (const feedTopic of feedTopics(feed)) topics.add(feedTopic);
  }

  return {
    total_feeds: feeds.length,
    active_feeds: feeds.filter(isActive).length,
    verified_feeds: feeds.filter((feed) => feed.verified === true).length,
    total_topics: topics.size,
    validation_success_rate: validations.length === 0 ? 0 : successes.length / validations.length,
    avg_response_time:
      timed.length === 0
        ? 0
        : timed.reduce((total, row) => total + (row.response_time_ms ?? 0), 0) / timed.length,
    health_distribution: healthDistribution(feeds),
    date_range: dateRange,
    topic,
    last_updated: lastUpdated,
    demo: false,
    forecast_enabled: false,
    ml: null,
  };
}

async function buildSummary(
  dateRange: { label: string; days: number },
  topic: string | null,
): Promise<AnalyticsSummary> {
  const catalog = await loadCatalog();
  const snapshot = await loadValidationSnapshot(catalog.feeds === null);
  const feeds = (catalog.feeds ?? snapshot.feeds ?? []).map((row, index) => ({
    row,
    id: row.id ?? `feed-${index + 1}`,
  }));
  const selected = feeds.filter(({ row }) => matchesTopic(feedTopics(row), topic));
  const selectedIds = new Set(selected.map(({ id }) => id));
  const cutoffMs = Date.now() - dateRange.days * DAY_MS;
  const validations = snapshot.rows.filter((row) => {
    if (!isWithinRange(row.validated_at, cutoffMs)) return false;
    if (!topic) return true;
    if (row.topics.includes(topic)) return true;
    return row.feed_source_id !== undefined && selectedIds.has(row.feed_source_id);
  });

  return toSummary(
    selected.map(({ row }) => row),
    validations,
    dateRange.label,
    topic,
    latestTimestamp(validations, catalog.updated ?? snapshot.updated),
  );
}

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const summary = await buildSummary(
    resolveDateRange(searchParams.get("date_range")),
    normalizeTopic(searchParams.get("topic")),
  );

  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
    },
  });
};

export const GET = withRouteTelemetry("analytics.summary", GETHandler);
