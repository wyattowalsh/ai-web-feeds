import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const GETHandler = async () => {
  return NextResponse.json(
    {
      error: "Publication velocity analytics is not wired to a backend service in this deployment.",
      code: "BACKEND_NOT_IMPLEMENTED",
    },
    { status: 501 },
  );
};

export const GET = withRouteTelemetry("analytics.velocity", GETHandler, {
  backendTarget: "unimplemented-analytics",
});
