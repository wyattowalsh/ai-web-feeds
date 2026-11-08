import { NextResponse } from "next/server";
import { loadFeedCatalog, type FeedSource } from "@/lib/feeds";
import { getValidationStats, type ValidationStats } from "@/lib/validation-stats";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

function readCatalogRows(): FeedSource[] {
  try {
    const sources = loadFeedCatalog().sources;
    return Array.isArray(sources) ? sources : [];
  } catch {
    return [];
  }
}

function readRecordedSnapshotPoints(snapshot: ValidationStats): unknown[] {
  if (!snapshot.validation_data_available) {
    return [];
  }

  const recorded = (snapshot as { points?: unknown }).points;
  return Array.isArray(recorded) ? recorded : [];
}

async function readValidationSnapshotPoints(): Promise<unknown[]> {
  try {
    return readRecordedSnapshotPoints(await getValidationStats());
  } catch {
    return [];
  }
}

const GETHandler = async () => {
  // Catalog rows win. A recorded validation snapshot may already carry points.
  // Forecasts stay disabled. This handler does not create counts or call ML.
  const catalogRows = readCatalogRows();
  const points = catalogRows.length > 0 ? catalogRows : await readValidationSnapshotPoints();

  if (points.length === 0) {
    return NextResponse.json({ demo: false, points: [] });
  }

  return NextResponse.json({ demo: false, points });
};

export const GET = withRouteTelemetry("analytics.export", GETHandler);
