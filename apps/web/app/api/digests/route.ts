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
import { fetchBackend, formatBackendErrorResponse, getBackendErrorStatus } from "@/lib/backend";

export const dynamic = "force-dynamic";

const GETHandler = async (request: NextRequest) => {
  const requestedUserId = request.nextUrl.searchParams.get("user_id");
  const identity = getUserIdentity(request, requestedUserId);

  if (requestedUserId && identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  if (requestedUserId && !validateUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  if (identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  try {
    const data = await fetchBackend("/storage/digests", {
      method: "GET",
      params: {
        user_id: identity.user_id,
      },
    });

    return NextResponse.json({
      user_id: identity.user_id,
      digests: data,
    });
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
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
    const identity = getUserIdentity(request, body.user_id ?? null);
    const { email, schedule_type, schedule_cron, timezone } = body;

    if (body.user_id && identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    if (body.user_id && !validateUserOwnership(body.user_id, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    if (identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

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

    const data = await fetchBackend("/storage/digests", {
      method: "POST",
      body: {
        user_id: identity.user_id,
        email,
        schedule_type,
        schedule_cron,
        timezone: timezone || "UTC",
      },
    });

    return NextResponse.json({
      success: true,
      digest: data,
    });
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

const DELETEHandler = async (request: NextRequest) => {
  const requestedUserId = request.nextUrl.searchParams.get("user_id");
  const identity = getUserIdentity(request, requestedUserId);

  if (requestedUserId && identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  if (requestedUserId && !validateUserOwnership(requestedUserId, identity)) {
    return NextResponse.json({ error: "user_id does not match request identity" }, { status: 403 });
  }

  if (identity.source === "anonymous") {
    return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
  }

  try {
    await fetchBackend("/storage/digests", {
      method: "DELETE",
      params: {
        user_id: identity.user_id,
      },
    });

    return NextResponse.json({
      success: true,
      user_id: identity.user_id,
    });
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

export const GET = withRouteTelemetry("digests.list", GETHandler, {
  backendTarget: "python-backend",
});
export const POST = withRouteTelemetry("digests.create", POSTHandler, {
  backendTarget: "python-backend",
});
export const DELETE = withRouteTelemetry("digests.delete", DELETEHandler, {
  backendTarget: "python-backend",
});
