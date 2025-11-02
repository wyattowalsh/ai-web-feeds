/**
 * GET /api/trending - Get current trending topics
 * 
 * Query params:
 * - limit: Max topics to return (default: 10)
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8001";
    const response = await fetch(
      `${backendUrl}/storage/trending?limit=${limit}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const trending = await response.json();

    return NextResponse.json({
      trending,
      count: trending.length,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch trending topics:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch trending topics",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

