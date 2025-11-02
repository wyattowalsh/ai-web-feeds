/**
 * Email digests API
 *
 * GET /api/digests?user_id=<uuid> - Get user's digest subscription
 * POST /api/digests - Create/update digest subscription
 * DELETE /api/digests?user_id=<uuid> - Unsubscribe from digests
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id parameter" }, { status: 400 });
  }

  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8001";
    const response = await fetch(`${backendUrl}/storage/digests?user_id=${userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const digests = await response.json();

    return NextResponse.json({
      user_id: userId,
      digests,
    });
  } catch (error) {
    console.error("Failed to fetch digests:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch digests",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, email, schedule_type, schedule_cron, timezone } = body;

    // Validate required fields
    if (!user_id || !email || !schedule_type || !schedule_cron) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, email, schedule_type, schedule_cron" },
        { status: 400 },
      );
    }

    // Validate enum values
    const validScheduleTypes = ["daily", "weekly", "custom"];

    if (!validScheduleTypes.includes(schedule_type)) {
      return NextResponse.json(
        { error: `Invalid schedule_type. Must be one of: ${validScheduleTypes.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Call Python backend
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8001";
    const response = await fetch(`${backendUrl}/storage/digests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        email,
        schedule_type,
        schedule_cron,
        timezone: timezone || "UTC",
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const digest = await response.json();

    return NextResponse.json({
      success: true,
      digest,
    });
  } catch (error) {
    console.error("Failed to create digest subscription:", error);
    return NextResponse.json(
      {
        error: "Failed to create digest subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id parameter" }, { status: 400 });
  }

  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8001";
    const response = await fetch(`${backendUrl}/storage/digests?user_id=${userId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
    });
  } catch (error) {
    console.error("Failed to unsubscribe from digests:", error);
    return NextResponse.json(
      {
        error: "Failed to unsubscribe from digests",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
