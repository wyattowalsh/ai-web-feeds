import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  BackendConfigurationError,
  buildBackendUrl,
  createFeatureUnavailableResponse,
  formatBackendErrorResponse,
  getBackendErrorStatus,
} from "@/lib/backend";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  try {
    const response = await fetch(
      buildBackendUrl("/analytics/export", {
        date_range: searchParams.get("date_range") || "30d",
      }),
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorBody.message || `Backend returned ${response.status}`,
          code: errorBody.code || `HTTP_${response.status}`,
        },
        { status: response.status },
      );
    }

    return new NextResponse(await response.text(), {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") || "text/csv",
        "Content-Disposition":
          response.headers.get("content-disposition") || 'attachment; filename="analytics.csv"',
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

export const GET = withRouteTelemetry("analytics.export", GETHandler, {
  backendTarget: "python-backend",
});
