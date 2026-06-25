/**
 * Email digests API
 *
 * GET /api/digests - Get user's digest subscription
 * POST /api/digests - Create/update digest subscription
 * DELETE /api/digests - Unsubscribe from digests
 */

import { NextRequest, NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { getUserIdentity, validateUserOwnership } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const NOT_IMPLEMENTED_BODY = {
  error: "Email digests are not available in this deployment.",
  code: "NOT_IMPLEMENTED",
};

async function rejectUnauthenticated(
  request: NextRequest,
  requestedUserId: string | null,
): Promise<Response | null> {
  const identity = await getUserIdentity(request, requestedUserId);

  if (requestedUserId && identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  if (requestedUserId && !validateUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  if (identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  return null;
}

const GETHandler = async (request: NextRequest) => {
  const requestedUserId = request.nextUrl.searchParams.get("user_id");
  const authError = await rejectUnauthenticated(request, requestedUserId);
  if (authError) {
    return authError;
  }

  return NextResponse.json(NOT_IMPLEMENTED_BODY, { status: 501 });
};

const POSTHandler = async (request: NextRequest) => {
  try {
    const body = (await request.json()) as {
      user_id?: string;
      email?: string;
      schedule_type?: string;
      schedule_cron?: string;
      timezone?: string;
    };
    const authError = await rejectUnauthenticated(request, body.user_id ?? null);
    if (authError) {
      return authError;
    }

    const { email, schedule_type, schedule_cron } = body;
    const validScheduleTypes = ["daily", "weekly", "custom"];

    if (!email || !schedule_type || !schedule_cron) {
      return NextResponse.json(
        { error: "Missing required fields: email, schedule_type, schedule_cron" },
        { status: 400 },
      );
    }

    if (!validScheduleTypes.includes(schedule_type)) {
      return NextResponse.json(
        { error: `Invalid schedule_type. Must be one of: ${validScheduleTypes.join(", ")}` },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    return NextResponse.json(NOT_IMPLEMENTED_BODY, { status: 501 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
};

const DELETEHandler = async (request: NextRequest) => {
  const requestedUserId = request.nextUrl.searchParams.get("user_id");
  const authError = await rejectUnauthenticated(request, requestedUserId);
  if (authError) {
    return authError;
  }

  return NextResponse.json(NOT_IMPLEMENTED_BODY, { status: 501 });
};

export const GET = withRouteTelemetry("digests.list", GETHandler);
export const POST = withRouteTelemetry("digests.create", POSTHandler);
export const DELETE = withRouteTelemetry("digests.delete", DELETEHandler);
