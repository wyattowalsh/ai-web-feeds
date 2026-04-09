import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics-local";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  try {
    const payload = await getAnalyticsSummary(
      searchParams.get("date_range"),
      searchParams.get("topic"),
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build analytics summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

export const GET = withRouteTelemetry("analytics.summary", GETHandler);
