import { withAdminRouteGuard } from "@/lib/admin-auth";
import { getApiTelemetrySummary, recordAdminAudit } from "@/lib/telemetry";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GETHandler = withAdminRouteGuard(async (request: Request) => {
  const windowHours = Math.min(168, Math.max(1, Number(new URL(request.url).searchParams.get("window_hours") || "24")));
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
});

export const GET = withRouteTelemetry("admin.telemetry.summary", GETHandler);
