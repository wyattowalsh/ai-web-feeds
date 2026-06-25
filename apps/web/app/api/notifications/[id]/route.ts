/**
 * PATCH /api/notifications/[id] - Mark notification as read or dismissed
 *
 * Body:
 * - action: "mark_read" | "dismiss"
 * - user_id?: UUID used to scope anonymous browser data
 */

import { NextRequest, NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { userStore } from "@/lib/server/user-store";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { getUserIdentity, validateUserOwnership } from "@/lib/user-auth";

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
    const identity = await getUserIdentity(request, requestedUserId);
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

    const updated =
      action === "mark_read"
        ? await userStore.notifications.markRead(identity.user_id, notificationId)
        : await userStore.notifications.dismiss(identity.user_id, notificationId);

    if (!updated) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      notification_id: notificationId,
      action,
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

export const PATCH = withRouteTelemetry("notifications.update", PATCHHandler);
