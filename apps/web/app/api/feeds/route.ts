import { NextResponse } from "next/server";
import type { CatalogFeed } from "@/lib/catalog-types";
import { loadFeedCatalog } from "@/lib/feeds";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-static";

const GETHandler = async () => {
  try {
    const feeds: CatalogFeed[] = loadFeedCatalog().sources;

    return NextResponse.json(feeds, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error loading feeds:", error);
    return NextResponse.json({ error: "Failed to load feeds data" }, { status: 500 });
  }
};

export const GET = withRouteTelemetry("feeds.list", GETHandler);
