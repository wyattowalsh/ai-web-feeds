import { NextResponse } from "next/server";

import { loadFeedCatalog, type FeedSource } from "@/lib/feeds";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { catalogSeries } from "@/lib/visualization/catalog-series";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id?: string }>;
}

const EMPTY_SERIES = { demo: false, points: [] } as const;

function normalizeId(id: unknown): string {
  return typeof id === "string" ? id.trim() : "";
}

function isCatalogRow(value: unknown): value is FeedSource {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readCatalogSources(): FeedSource[] {
  try {
    const sources = loadFeedCatalog().sources;
    if (!Array.isArray(sources)) {
      return [];
    }

    return sources.filter(isCatalogRow);
  } catch {
    return [];
  }
}

function identityValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rowMatchesId(row: FeedSource, id: string): boolean {
  const identities = [identityValue(row.id), identityValue(row.feed), identityValue(row.url)];
  return identities.some((identity) => identity.length > 0 && identity === id);
}

function seriesForId(id: string) {
  if (!id) {
    return EMPTY_SERIES;
  }

  const points = readCatalogSources().filter((row) => rowMatchesId(row, id));
  if (points.length === 0) {
    return EMPTY_SERIES;
  }

  return catalogSeries(points);
}

const GETHandler = async (_request: Request, context: RouteContext) => {
  let id = "";

  try {
    id = normalizeId((await context.params).id);
  } catch {
    id = "";
  }

  return NextResponse.json(seriesForId(id));
};

export const GET = withRouteTelemetry("visualizations.get", GETHandler);
