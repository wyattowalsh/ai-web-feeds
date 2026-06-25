/**
 * GET /api/trending - Get current trending topics
 *
 * Query params:
 * - limit: Max topics to return (default: 10, max: 100)
 */

import { NextRequest, NextResponse } from "next/server";
import { clampNumber } from "@/lib/backend";
import { trendingStore } from "@/lib/server/trending-store";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const GETHandler = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const limit = clampNumber(parseInt(searchParams.get("limit") || "10", 10), 1, 100);

  const data = await trendingStore.list(limit);

  return NextResponse.json({
    trending: data,
    count: data.length,
    updated_at: new Date().toISOString(),
  });
};

export const GET = withRouteTelemetry("trending.list", GETHandler);
