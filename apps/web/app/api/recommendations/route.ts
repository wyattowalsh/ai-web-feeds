import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { fetchBackend, formatBackendErrorResponse, clampNumber } from "@/lib/backend";

export const dynamic = "force-dynamic";

interface RecommendationParams {
  seed_topics?: string[];
  limit?: number;
}

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const seed_topics = searchParams.get("topics")?.split(",").filter(Boolean) || undefined;
  const limit = clampNumber(parseInt(searchParams.get("limit") || "20", 10), 1, 100);

  try {
    const data = await fetchBackend("/recommendations", {
      method: "GET",
      params: {
        limit,
        ...(seed_topics && { topics: seed_topics.join(",") }),
      },
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), { status: 500 });
  }
};

const POSTHandler = async (request: Request) => {
  try {
    const body = await request.json();
    const { feed_id, interaction_type, reason } = body;

    if (!feed_id || !interaction_type) {
      return NextResponse.json(
        { error: "Missing required fields: feed_id, interaction_type" },
        { status: 400 },
      );
    }

    const valid_interactions = ["view", "click", "subscribe", "dismiss"];
    if (!valid_interactions.includes(interaction_type)) {
      return NextResponse.json(
        { error: `Invalid interaction_type. Must be one of: ${valid_interactions.join(", ")}` },
        { status: 400 },
      );
    }

    const data = await fetchBackend("/recommendations/interactions", {
      method: "POST",
      body: {
        feed_id,
        interaction_type,
        reason: reason || null,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), { status: 500 });
  }
};

export const GET = withRouteTelemetry("recommendations.list", GETHandler, {
  backendTarget: "python-backend",
});
export const POST = withRouteTelemetry("recommendations.interaction", POSTHandler, {
  backendTarget: "python-backend",
});
