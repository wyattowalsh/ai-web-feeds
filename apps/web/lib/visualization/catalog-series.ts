/**
 * Series from real catalog rows only.
 * Demo stays off, forecast rows are ignored, and ML is copied only when supplied.
 */

export interface CatalogSeriesRow {
  [key: string]: unknown;
}

export interface CatalogSeriesMl {
  [key: string]: unknown;
}

export interface CatalogSeries {
  demo: false;
  points: readonly CatalogSeriesRow[];
  ml?: CatalogSeriesMl;
}

const CONTAINER_KEYS = ["points", "rows", "feeds", "sources"] as const;
const IDENTITY_KEYS = [
  "id",
  "title",
  "label",
  "name",
  "url",
  "feed",
  "value",
  "count",
  "date",
] as const;
const WRAPPER_KEYS = new Set(["ml", "forecast", "forecasts", "demo"]);

function isRecord(value: unknown): value is CatalogSeriesRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function keepRows(values: readonly unknown[]): CatalogSeriesRow[] {
  const rows: CatalogSeriesRow[] = [];

  for (const value of values) {
    if (isRecord(value)) {
      rows.push(value);
    }
  }

  return rows;
}

function firstObjectRows(
  record: CatalogSeriesRow,
  keys: readonly string[],
): CatalogSeriesRow[] | null {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) {
      continue;
    }

    const rows = keepRows(value);
    if (rows.length > 0) {
      return rows;
    }
  }

  return null;
}

function isFeedLike(record: CatalogSeriesRow): boolean {
  return (
    typeof record.url === "string" ||
    typeof record.feed === "string" ||
    typeof record.title === "string"
  );
}

function isSelfRow(record: CatalogSeriesRow): boolean {
  const keys = Object.keys(record);
  if (keys.length === 0 || keys.every((key) => WRAPPER_KEYS.has(key))) {
    return false;
  }

  return IDENTITY_KEYS.some((key) => {
    const value = record[key];
    return value !== undefined && value !== null && value !== "";
  });
}

function selectPoints(input: unknown): readonly CatalogSeriesRow[] {
  if (Array.isArray(input)) {
    return keepRows(input);
  }

  if (!isRecord(input)) {
    return [];
  }

  const collected = firstObjectRows(input, CONTAINER_KEYS);
  if (collected) {
    return collected;
  }

  if (input.catalog != null) {
    const nested = selectPoints(input.catalog);
    if (nested.length > 0) {
      return nested;
    }
  }

  if (!isFeedLike(input)) {
    const topics = firstObjectRows(input, ["topics"]);
    if (topics) {
      return topics;
    }
  }

  return isSelfRow(input) ? [input] : [];
}

function mlFrom(input: unknown): CatalogSeriesMl | undefined {
  if (!isRecord(input) || !isRecord(input.ml)) {
    return undefined;
  }

  return input.ml;
}

export function catalogSeries(input?: unknown): CatalogSeries {
  const points = selectPoints(input);
  const ml = mlFrom(input);

  if (points.length === 0 && ml === undefined) {
    return { demo: false, points: [] };
  }

  if (ml === undefined) {
    return { demo: false, points };
  }

  return { demo: false, points, ml };
}
