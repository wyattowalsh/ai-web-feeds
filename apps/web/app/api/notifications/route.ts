/**
 * GET /api/notifications - List user notifications
 *
 * Query params:
 * - unread_only: Filter to unread only (default: false)
 * - limit: Max notifications to return (default: 50)
 *
 * User ID can come from a trusted header or the client's anonymous UUID.
 */

import { NextRequest, NextResponse } from "next/server";
import { clampNumber } from "@/lib/backend";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { userStore } from "@/lib/server/user-store";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { getUserIdentity, validateUserOwnership } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const GETHandler = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const requestedUserId = searchParams.get("user_id");
  const identity = await getUserIdentity(request, requestedUserId);
  const unreadOnly = searchParams.get("unread_only") === "true";
  const limit = clampNumber(parseInt(searchParams.get("limit") || "50", 10), 1, 1000);

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
    const data = await userStore.notifications.list(identity.user_id, {
      unreadOnly,
      limit,
    });

    return NextResponse.json({
      user_id: identity.user_id,
      notifications: data,
      count: data.length,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Notifications are unavailable until DATABASE_URL is configured." },
        { status: 503 },
      );
    }

    throw error;
  }
};

export const GET = withRouteTelemetry("notifications.list", GETHandler);
