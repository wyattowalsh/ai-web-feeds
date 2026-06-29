import { NextResponse } from "next/server";
import { withBetterAuthAdminGuard } from "@/lib/admin-auth-new";
import { getApiTelemetrySummary, recordAdminAudit } from "@/lib/telemetry";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GETHandler = async (request: Request) => {
  const guard = await withBetterAuthAdminGuard(request);
  if (guard.status === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (guard.status === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const windowHours = Math.min(
    168,
    Math.max(1, Number(new URL(request.url).searchParams.get("window_hours") || "24")),
  );
  const summary = await getApiTelemetrySummary(windowHours);

  await recordAdminAudit({
    timestamp: new Date().toISOString(),
    action: "admin.telemetry.summary.read",
    outcome: "success",
    ipHash: null,
    detail: `window_hours=${windowHours}`,
    requestId: request.headers.get("x-request-id"),
  });

  return Response.json(summary, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
};

export const GET = withRouteTelemetry("admin.telemetry.summary", GETHandler);
