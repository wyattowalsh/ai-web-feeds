import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const GETHandler = async () => {
  return NextResponse.json(
    {
      error: "Trending analytics is not wired to a backend service in this deployment.",
      code: "BACKEND_NOT_IMPLEMENTED",
    },
    { status: 501 },
  );
};

export const GET = withRouteTelemetry("analytics.trending", GETHandler, {
  backendTarget: "unimplemented-analytics",
});
