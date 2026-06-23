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

interface RouteContext {
  params: Promise<{ id: string }>;
}

const POSTHandler = async (request: Request, context: RouteContext) => {
  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const data = await fetchBackend(`/api/v1/visualizations/${id}/data`, {
      method: "POST",
      body,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, s-maxage=30, stale-while-revalidate=120",
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

export const POST = withRouteTelemetry("visualizations.data", POSTHandler, {
  backendTarget: "python-backend",
});
