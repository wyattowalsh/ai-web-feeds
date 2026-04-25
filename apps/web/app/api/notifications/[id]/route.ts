/**
 * PATCH /api/notifications/[id] - Mark notification as read or dismissed
 *
 * Body:
 * - action: "mark_read" | "dismiss"
 * - user_id?: UUID used to scope anonymous browser data
 */

import { NextRequest, NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { fetchBackend, formatBackendErrorResponse } from "@/lib/backend";
import {
  applyUserIdentityBinding,
  isValidUserId,
  resolveUserIdentity,
  validateTrustedUserOwnership,
} from "@/lib/user-auth";

const PATCHHandler = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const notificationId = parseInt(id, 10);

  if (isNaN(notificationId)) {
    return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      action?: string;
      user_id?: string;
    };
    const requestedUserId = body.user_id ?? request.nextUrl.searchParams.get("user_id");
    if (requestedUserId && !isValidUserId(requestedUserId)) {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    const resolvedIdentity = resolveUserIdentity(request, requestedUserId);
    const { identity } = resolvedIdentity;
    const { action } = body;

    if (requestedUserId && identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    if (requestedUserId && !validateUserOwnership(requestedUserId, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    if (identity.source === "anonymous") {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }

    if (!action || !["mark_read", "dismiss"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'mark_read' or 'dismiss'" },
        { status: 400 },
      );
    }

    await fetchBackend(`/storage/notifications/${notificationId}/${action}`, {
      method: "PATCH",
      params: {
        user_id: identity.user_id,
      },
    });

    const response = NextResponse.json({
      success: true,
      notification_id: notificationId,
      action,
    });
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
  } catch (error) {
    return NextResponse.json(formatBackendErrorResponse(error), { status: 500 });
  }
};

export const PATCH = withRouteTelemetry("notifications.update", PATCHHandler, {
  backendTarget: "python-backend",
});
