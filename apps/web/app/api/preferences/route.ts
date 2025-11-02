/**
 * Notification preferences API
 *
 * GET /api/preferences?user_id=<uuid> - Get user preferences
 * POST /api/preferences - Create/update preference
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
    const response = await fetch(`${backendUrl}/storage/preferences?user_id=${userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const preferences = await response.json();

    return NextResponse.json({
      user_id: userId,
      preferences,
      count: preferences.length,
    });
  } catch (error) {
    console.error("Failed to fetch preferences:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch preferences",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, feed_id, delivery_method, frequency, quiet_hours_start, quiet_hours_end } =
      body;

    // Validate required fields
    if (!user_id || !delivery_method || !frequency) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, delivery_method, frequency" },
        { status: 400 },
      );
    }

    // Validate enum values
    const validDeliveryMethods = ["websocket", "email", "in_app"];
    const validFrequencies = ["instant", "hourly", "daily", "weekly", "off"];

    if (!validDeliveryMethods.includes(delivery_method)) {
      return NextResponse.json(
        { error: `Invalid delivery_method. Must be one of: ${validDeliveryMethods.join(", ")}` },
        { status: 400 },
      );
    }

    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Must be one of: ${validFrequencies.join(", ")}` },
        { status: 400 },
      );
    }

    // Call Python backend
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8001";
    const response = await fetch(`${backendUrl}/storage/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        feed_id: feed_id || null,
        delivery_method,
        frequency,
        quiet_hours_start: quiet_hours_start || null,
        quiet_hours_end: quiet_hours_end || null,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const preference = await response.json();

    return NextResponse.json({
      success: true,
      preference,
    });
  } catch (error) {
    console.error("Failed to save preference:", error);
    return NextResponse.json(
      {
        error: "Failed to save preference",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
