import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DASHBOARD_BUILDER_DISABLED = {
  enabled: false,
  reason: "dashboard builder is not enabled",
} as const;

function dashboardBuilderDisabled(): NextResponse {
  return NextResponse.json(DASHBOARD_BUILDER_DISABLED, { status: 501 });
}

export function POST(): NextResponse {
  return dashboardBuilderDisabled();
}
