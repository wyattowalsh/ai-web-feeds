import { NextResponse } from "next/server";
import { loadFeedCatalog } from "@/lib/feeds";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { catalogSeries, type CatalogSeriesRow } from "@/lib/visualization/catalog-series";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const RESERVED_KEYS = new Set([
  "catalog",
  "demo",
  "document_meta",
  "feeds",
  "forecast",
  "forecasts",
  "metadata",
  "ml",
  "points",
  "rows",
  "sources",
  "topics",
  "visualizations",
]);

const ID_FIELDS = ["id", "feed", "feed_id", "source_id", "url", "visualization_id"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readCatalogStorage(): unknown {
  try {
    return loadFeedCatalog();
  } catch {
    return undefined;
  }
}

function rowMatchesId(row: CatalogSeriesRow, id: string): boolean {
  for (const field of ID_FIELDS) {
    if (row[field] === id) {
      return true;
    }
  }

  return false;
}

function sliceForId(storage: unknown, id: string): unknown {
  const needle = typeof id === "string" ? id.trim() : "";
  if (!needle) {
    return undefined;
  }

  if (Array.isArray(storage)) {
    return catalogSeries(storage).points.filter((row) => rowMatchesId(row, needle));
  }

  if (!isRecord(storage)) {
    return undefined;
  }

  const visualizations = storage.visualizations;
  if (isRecord(visualizations) && Object.hasOwn(visualizations, needle)) {
    return visualizations[needle];
  }

  if (!RESERVED_KEYS.has(needle) && Object.hasOwn(storage, needle)) {
    return storage[needle];
  }

  return catalogSeries(storage).points.filter((row) => rowMatchesId(row, needle));
}

function pointsForId(storage: unknown, id: string): readonly CatalogSeriesRow[] {
  return catalogSeries(sliceForId(storage, id)).points;
}

const POSTHandler = async (_request: Request, context: RouteContext) => {
  // Request JSON is not catalog storage. Forecasts stay disabled.
  const { id } = await context.params;
  const points = pointsForId(readCatalogStorage(), id);

  if (points.length === 0) {
    return NextResponse.json({ demo: false, points: [] });
  }

  return NextResponse.json({ demo: false, points });
};

export const POST = withRouteTelemetry("visualizations.data", POSTHandler);
