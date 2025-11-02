import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface AnalyticsSummaryParams {
  date_range?: string;
  topic?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date_range = searchParams.get("date_range") || "30d";
  const topic = searchParams.get("topic") || undefined;

  try {
    // In production, this would call the Python backend API
    // For now, we'll return mock data matching the schema

    const summary = {
      total_feeds: 1250,
      active_feeds: 1180,
      validation_success_rate: 0.94,
      avg_response_time: 285.5,
      health_distribution: {
        healthy: 940,
        moderate: 240,
        unhealthy: 70,
      },
      date_range,
      topic,
      last_updated: new Date().toISOString(),
    };

    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": topic
          ? "public, s-maxage=300, stale-while-revalidate=600" // 5 min for filtered
          : "public, s-maxage=3600, stale-while-revalidate=7200", // 1 hour for unfiltered
      },
    });
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    return NextResponse.json({ error: "Failed to fetch analytics summary" }, { status: 500 });
  }
}
