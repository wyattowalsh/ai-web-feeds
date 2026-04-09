import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import { clampNumber } from "@/lib/backend";
import { loadFeeds } from "@/lib/feeds";
import { normalizeSearchQuery, normalizeSearchTopics } from "@/lib/search";

export const dynamic = "force-dynamic";

interface AutocompleteFeedSuggestion {
  id: string;
  title: string;
  type: "feed";
  url: string;
}

interface AutocompleteTopicSuggestion {
  label: string;
  type: "topic";
  feed_count: number;
}

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const prefix = normalizeSearchQuery(searchParams.get("prefix"));
  if (!prefix || prefix.length < 2) {
    return NextResponse.json({
      feeds: [],
      topics: [],
    });
  }

  const limit = clampNumber(parseInt(searchParams.get("limit") || "8", 10), 1, 20);

  try {
    const feedsData = await loadFeeds();
    const lowerPrefix = prefix.toLowerCase();
    const maxFeedSuggestions = Math.min(5, limit);

    const feeds: AutocompleteFeedSuggestion[] = feedsData.sources
      .filter((feed) => typeof feed.title === "string" && feed.title.trim().length > 0)
      .filter((feed) =>
        feed.title
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.startsWith(lowerPrefix)),
      )
      .slice(0, maxFeedSuggestions)
      .map((feed, index) => ({
        id: feed.id || `${feed.url}-${index}`,
        title: feed.title,
        type: "feed",
        url: feed.url,
      }));
    const maxTopicSuggestions = Math.max(0, limit - feeds.length);

    const topicCounts = new Map<string, number>();
    for (const feed of feedsData.sources) {
      for (const normalizedTopic of normalizeSearchTopics(feed.topics ?? [])) {
        topicCounts.set(normalizedTopic, (topicCounts.get(normalizedTopic) ?? 0) + 1);
      }
    }

    const topics: AutocompleteTopicSuggestion[] = Array.from(topicCounts.entries())
      .map(([label, feedCount]) => ({
        label,
        type: "topic" as const,
        feed_count: feedCount,
      }))
      .filter((topic) => topic.label.startsWith(lowerPrefix))
      .sort((left, right) => right.feed_count - left.feed_count)
      .slice(0, maxTopicSuggestions);

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
  } catch {
    return NextResponse.json({ error: "Autocomplete failed" }, { status: 500 });
  }
};

export const GET = withRouteTelemetry("search.autocomplete", GETHandler);
