import { NextResponse } from "next/server";
import { buildAutocompleteSuggestions } from "@/lib/article-corpus";
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

  const prefix = searchParams.get("prefix");
  const limit = Number.parseInt(searchParams.get("limit") || "8", 10);

  try {
    const payload = await buildAutocompleteSuggestions(prefix ?? "", limit);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Autocomplete error:", error);
    return NextResponse.json({ error: "Autocomplete failed" }, { status: 500 });
  }
};

export const GET = withRouteTelemetry("search.autocomplete", GETHandler);
