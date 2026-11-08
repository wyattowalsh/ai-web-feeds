import { NextResponse } from "next/server";

import { loadFeedCatalog } from "@/lib/feeds";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { catalogSeries, type CatalogSeries } from "@/lib/visualization/catalog-series";

export const dynamic = "force-dynamic";

const SERIES_HEADERS = {
  "Cache-Control": "private, s-maxage=60, stale-while-revalidate=300",
} as const;

function readStoredCatalog(): unknown {
  try {
    return loadFeedCatalog();
  } catch {
    return undefined;
  }
}

async function readSeriesInput(request: Request): Promise<unknown> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return readStoredCatalog();
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return undefined;
  }

  if (raw.trim().length === 0) {
    return readStoredCatalog();
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function seriesBody(input: unknown): CatalogSeries {
  // Stored or caller catalog rows only. Forecasts stay disabled. ML is copied only when supplied.
  const series = catalogSeries(input);

  if (series.ml === undefined) {
    return { demo: false, points: series.points };
  }

  return { demo: false, points: series.points, ml: series.ml };
}

function seriesResponse(input: unknown): NextResponse {
  return NextResponse.json(seriesBody(input), { headers: SERIES_HEADERS });
}

const GETHandler = async (request: Request) => {
  return seriesResponse(await readSeriesInput(request));
};

const POSTHandler = async (request: Request) => {
  return seriesResponse(await readSeriesInput(request));
};

export const GET = withRouteTelemetry("visualizations.list", GETHandler);
export const POST = withRouteTelemetry("visualizations.create", POSTHandler);
