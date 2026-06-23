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
    const data = await fetchBackend("/api/v1/visualizations", {
      params: {
        limit: searchParams.get("limit") || "50",
        offset: searchParams.get("offset") || "0",
      },
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      return NextResponse.json(
        createFeatureUnavailableResponse(
          "Visualizations",
          "Visualizations are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
        ),
        { status: 503 },
      );
    }

    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

const POSTHandler = async (request: Request) => {
  try {
    const body = await request.json();
    const data = await fetchBackend("/api/v1/visualizations", {
      method: "POST",
      body,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      return NextResponse.json(
        createFeatureUnavailableResponse(
          "Visualizations",
          "Visualizations are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
        ),
        { status: 503 },
      );
    }

    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

export const GET = withRouteTelemetry("visualizations.list", GETHandler, {
  backendTarget: "python-backend",
});

export const POST = withRouteTelemetry("visualizations.create", POSTHandler, {
  backendTarget: "python-backend",
});
