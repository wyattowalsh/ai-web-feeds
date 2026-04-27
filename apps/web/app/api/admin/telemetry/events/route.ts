import { NextResponse } from "next/server";
import { withBetterAuthAdminGuard } from "@/lib/admin-auth-new";
import { listAdminAuditEvents, listApiTelemetryEvents, recordAdminAudit } from "@/lib/telemetry";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GETHandler = async (request: Request) => {
  const { user } = await withBetterAuthAdminGuard(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const windowHours = Math.min(168, Math.max(1, Number(searchParams.get("window_hours") || "24")));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "50")));
  const routeKey = searchParams.get("route_key") || undefined;
  const status =
    searchParams.get("status") === "error"
      ? "error"
      : searchParams.get("status") === "success"
        ? "success"
        : undefined;

  const [events, audit] = await Promise.all([
    listApiTelemetryEvents({ limit, routeKey, status, windowHours }),
    listAdminAuditEvents(25),
  ]);

  await recordAdminAudit({
    timestamp: new Date().toISOString(),
    action: "admin.telemetry.events.read",
    outcome: "success",
    ipHash: null,
    detail: `limit=${limit}`,
    requestId: request.headers.get("x-request-id"),
  });

  return Response.json(
    {
      events,
      audit,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
};

export const GET = withRouteTelemetry("admin.telemetry.events", GETHandler);
