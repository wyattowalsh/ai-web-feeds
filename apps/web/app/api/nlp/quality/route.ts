import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  BackendConfigurationError,
  createFeatureUnavailableResponse,
  fetchBackend,
  formatBackendErrorResponse,
  getBackendErrorStatus,
} from "@/lib/backend";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  try {
    const params: Record<string, string> = {};
    const limit = searchParams.get("limit");
    const minScore = searchParams.get("min_score");
    if (limit) params.limit = limit;
    if (minScore) params.min_score = minScore;

    const data = await fetchBackend("/nlp/quality", { params });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      return NextResponse.json(
        createFeatureUnavailableResponse(
          "NLP",
          "NLP quality scores are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
        ),
        { status: 503 },
      );
    }

    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

export const GET = withRouteTelemetry("nlp.quality.list", GETHandler, {
  backendTarget: "python-backend",
});
