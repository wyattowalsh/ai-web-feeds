/**
 * PATCH /api/notifications/[id] - Mark notification as read or dismissed
 *
 * Body:
 * - action: "mark_read" | "dismiss"
 */

import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const notificationId = parseInt(params.id, 10);

  if (isNaN(notificationId)) {
    return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (!action || !["mark_read", "dismiss"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'mark_read' or 'dismiss'" },
        { status: 400 },
      );
    }

    // Call Python backend storage API
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8001";
    const response = await fetch(
      `${backendUrl}/storage/notifications/${notificationId}/${action}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    return NextResponse.json({
      success: true,
      notification_id: notificationId,
      action,
    });
  } catch (error) {
    console.error("Failed to update notification:", error);
    return NextResponse.json(
      {
        error: "Failed to update notification",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
