import { NextResponse } from "next/server";
import { getTrendingTopics } from "@/lib/analytics-local";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get("limit") || "10", 10);

  try {
    const payload = await getTrendingTopics(
      searchParams.get("date_range"),
      searchParams.get("topic"),
      Number.isFinite(limit) ? limit : 10,
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build trending analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

export const GET = withRouteTelemetry("analytics.trending", GETHandler);
