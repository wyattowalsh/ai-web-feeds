import { NextResponse } from "next/server";
import { getAnalyticsSnapshot } from "@/lib/analytics-local";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  try {
    const payload = await getAnalyticsSnapshot(
      searchParams.get("date_range"),
      searchParams.get("topic"),
      searchParams.get("granularity"),
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build analytics snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

const POSTHandler = async (request: Request) => {
  return GETHandler(request);
};

export const POST = withRouteTelemetry("analytics.snapshot.create", POSTHandler);
export const GET = withRouteTelemetry("analytics.snapshot.latest", GETHandler);
