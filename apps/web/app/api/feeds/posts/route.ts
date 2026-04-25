import { NextResponse } from "next/server";

import { loadFeedPostsById } from "@/lib/feed-posts";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get("feedId");
  const limit = Number(searchParams.get("limit") || "6");

  if (!feedId) {
    return NextResponse.json({ error: "feedId is required" }, { status: 400 });
  }

  try {
    const payload = await loadFeedPostsById(
      feedId,
      Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 12) : 6,
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load feed posts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
};

export const GET = withRouteTelemetry("feeds.posts.list", GETHandler);
