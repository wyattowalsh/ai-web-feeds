/**
 * Feed follows API
 *
 * GET /api/follows?user_id=<uuid> - Get feeds followed by user
 * POST /api/follows - Follow a feed
 * DELETE /api/follows?user_id=<uuid>&feed_id=<id> - Unfollow a feed
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
    const response = await fetch(`${backendUrl}/storage/follows?user_id=${userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const follows = await response.json();

    return NextResponse.json({
      user_id: userId,
      follows,
      count: follows.length,
    });
  } catch (error) {
    console.error("Failed to fetch follows:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch follows",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, feed_id } = body;

    if (!user_id || !feed_id) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, feed_id" },
        { status: 400 },
      );
    }

    // Call Python backend
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8001";
    const response = await fetch(`${backendUrl}/storage/follows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, feed_id }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Handle duplicate follow (already following)
      if (response.status === 409) {
        return NextResponse.json({
          success: true,
          already_following: true,
          user_id,
          feed_id,
        });
      }

      throw new Error(errorData.error || `Backend responded with ${response.status}`);
    }

    const follow = await response.json();

    return NextResponse.json({
      success: true,
      follow,
    });
  } catch (error) {
    console.error("Failed to follow feed:", error);
    return NextResponse.json(
      {
        error: "Failed to follow feed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("user_id");
  const feedId = searchParams.get("feed_id");

  if (!userId || !feedId) {
    return NextResponse.json(
      { error: "Missing required parameters: user_id, feed_id" },
      { status: 400 },
    );
  }

  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8001";
    const response = await fetch(
      `${backendUrl}/storage/follows?user_id=${userId}&feed_id=${feedId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      feed_id: feedId,
    });
  } catch (error) {
    console.error("Failed to unfollow feed:", error);
    return NextResponse.json(
      {
        error: "Failed to unfollow feed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
