/**
 * GET /api/notifications - List user notifications
 *
 * Query params:
 * - user_id: User ID (localStorage UUID)
 * - unread_only: Filter to unread only (default: false)
 * - limit: Max notifications to return (default: 50)
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("user_id");
  const unreadOnly = searchParams.get("unread_only") === "true";
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id parameter" }, { status: 400 });
  }

  try {
    // Call Python backend storage API
    // For Phase 3B MVP, we'll use a simple HTTP fetch to Python service
    // In production, this could use direct database access or a proper API gateway

    const backendUrl = process.env.BACKEND_URL || "http://localhost:8001";
    const response = await fetch(
      `${backendUrl}/storage/notifications?user_id=${userId}&unread_only=${unreadOnly}&limit=${limit}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const notifications = await response.json();

    return NextResponse.json({
      user_id: userId,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch notifications",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
