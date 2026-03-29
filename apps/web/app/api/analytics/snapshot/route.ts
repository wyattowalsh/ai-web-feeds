import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const POSTHandler = async () => {
  return NextResponse.json(
    {
      error: "Analytics snapshot generation is not wired to a backend service in this deployment.",
      code: "BACKEND_NOT_IMPLEMENTED",
    },
    { status: 501 },
  );
};

const GETHandler = async () => {
  return NextResponse.json(
    {
      error: "Analytics snapshots are not wired to a backend service in this deployment.",
      code: "BACKEND_NOT_IMPLEMENTED",
    },
    { status: 501 },
  );
};

export const POST = withRouteTelemetry("analytics.snapshot.create", POSTHandler, {
  backendTarget: "unimplemented-analytics",
});
export const GET = withRouteTelemetry("analytics.snapshot.latest", GETHandler, {
  backendTarget: "unimplemented-analytics",
});
