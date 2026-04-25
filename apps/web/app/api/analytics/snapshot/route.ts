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

const POSTHandler = async () => {
  try {
    const data = await fetchBackend("/analytics/snapshot", {
      method: "POST",
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      return NextResponse.json(
        createFeatureUnavailableResponse(
          "Analytics",
          "Analytics are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
        ),
        { status: 503 },
      );
    }

    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

const GETHandler = async () => {
  try {
    const data = await fetchBackend("/analytics/snapshot");

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      return NextResponse.json(
        createFeatureUnavailableResponse(
          "Analytics",
          "Analytics are unavailable until BACKEND_URL points to the ai-web-feeds backend.",
        ),
        { status: 503 },
      );
    }

    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

export const POST = withRouteTelemetry("analytics.snapshot.create", POSTHandler, {
  backendTarget: "python-backend",
});
export const GET = withRouteTelemetry("analytics.snapshot.latest", GETHandler, {
  backendTarget: "python-backend",
});
