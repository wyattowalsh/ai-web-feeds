import { NextResponse } from "next/server";
import { loadFeedCatalog } from "@/lib/feeds";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const prefix = searchParams.get("prefix");
  if (!prefix || prefix.length < 2) {
    return NextResponse.json({
      feeds: [],
      topics: [],
    });
  }

  const limit = parseInt(searchParams.get("limit") || "8", 10);

  try {
    const catalog = loadFeedCatalog().sources;
    const lowerPrefix = prefix.toLowerCase();
    const feeds = catalog
      .filter((feed) => feed.title.toLowerCase().includes(lowerPrefix))
      .slice(0, Math.min(limit, 5))
      .map((feed) => ({
        id: feed.id,
        title: feed.title,
        type: "feed" as const,
        url: feed.website_url || feed.url,
      }));
    const topicCounts = new Map<string, number>();
    for (const feed of catalog) {
      for (const topic of feed.topics ?? []) {
        if (!topic.toLowerCase().includes(lowerPrefix)) {
          continue;
        }
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      }
    }
    const topics = Array.from(topicCounts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, Math.min(limit, 3))
      .map(([label, feed_count]) => ({
        label,
        type: "topic" as const,
        feed_count,
      }));

    return NextResponse.json(
      {
        feeds,
        topics,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120", // 1 min cache
        },
      },
    );
  } catch (error) {
    console.error("Autocomplete error:", error);
    return NextResponse.json({ error: "Autocomplete failed" }, { status: 500 });
  }
};

export const GET = withRouteTelemetry("search.autocomplete", GETHandler);
