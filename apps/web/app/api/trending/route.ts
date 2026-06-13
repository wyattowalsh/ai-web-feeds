/**
 * GET /api/trending - Get current trending topics
 *
 * Query params:
 * - limit: Max topics to return (default: 10, max: 100)
 */

import { NextRequest, NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  BackendConfigurationError,
  clampNumber,
  createFeatureUnavailableResponse,
  fetchBackend,
  formatBackendErrorResponse,
  getBackendErrorStatus,
} from "@/lib/backend";

export const dynamic = "force-dynamic";

const GETHandler = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const limit = clampNumber(parseInt(searchParams.get("limit") || "10", 10), 1, 100);

  try {
    const data = await fetchBackend("/storage/trending", {
      method: "GET",
      params: { limit },
    });

    return NextResponse.json({
      trending: data,
      count: Array.isArray(data) ? data.length : 0,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      return NextResponse.json(
        createFeatureUnavailableResponse(
          "Trending",
          "Trending topics are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
        ),
        { status: 503 },
      );
    }

    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

export const GET = withRouteTelemetry("trending.list", GETHandler, {
  backendTarget: "python-backend",
});
