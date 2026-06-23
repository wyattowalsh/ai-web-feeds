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

const GETHandler = async (_request: Request, context: RouteContext) => {
  const { id } = await context.params;

  try {
    const data = await fetchBackend(`/api/v1/visualizations/${id}`);
    return NextResponse.json(data);
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

const PUTHandler = async (request: Request, context: RouteContext) => {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const data = await fetchBackend(`/api/v1/visualizations/${id}`, {
      method: "PUT",
      body,
    });
    return NextResponse.json(data);
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

const DELETEHandler = async (_request: Request, context: RouteContext) => {
  const { id } = await context.params;

  try {
    await fetchBackend(`/api/v1/visualizations/${id}`, {
      method: "DELETE",
    });
    return new Response(null, { status: 204 });
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

export const GET = withRouteTelemetry("visualizations.get", GETHandler, {
  backendTarget: "python-backend",
});

export const PUT = withRouteTelemetry("visualizations.update", PUTHandler, {
  backendTarget: "python-backend",
});

export const DELETE = withRouteTelemetry("visualizations.delete", DELETEHandler, {
  backendTarget: "python-backend",
});
