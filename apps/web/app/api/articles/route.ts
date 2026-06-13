import { NextResponse } from "next/server";

import { browseArticleCorpus } from "@/lib/article-corpus";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  normalizeSearchFilters,
  parseSearchFeedIdsParam,
  parseSearchTopicsParam,
  parseVerifiedSearchFilter,
} from "@/lib/search";

export const dynamic = "force-dynamic";

type ArticleSort = "latest" | "oldest" | "source";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const limit = clampNumber(searchParams.get("limit"), 1, 100, 24);
  const cursor = clampNumber(searchParams.get("cursor"), 0, Number.MAX_SAFE_INTEGER, 0);
  const sort = parseArticleSort(searchParams.get("sort"));
  const query = normalizeQuery(searchParams.get("q"));
  const feedIds = parseSearchFeedIdsParam(searchParams.getAll("feed"));
  const normalizedFilters = normalizeSearchFilters({
    source_type: searchParams.get("source_type"),
    topics: parseSearchTopicsParam(searchParams.getAll("topics").join(",")),
    verified: parseVerifiedSearchFilter(searchParams.get("verified")),
  });

  try {
    const payload = await browseArticleCorpus({
      q: query,
      limit,
      cursor,
      sort,
      feedIds,
      sourceType: normalizedFilters.source_type,
      topics: normalizedFilters.topics,
      verified: normalizedFilters.verified,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load article corpus";
    return NextResponse.json({ error: message }, { status: 502 });
  }
};

function normalizeQuery(value: string | null): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized.length > 0 ? normalized : null;
}

function parseArticleSort(value: string | null): ArticleSort {
  switch (value) {
    case "oldest":
    case "source":
      return value;
    default:
      return "latest";
  }
}

function clampNumber(value: string | null, min: number, max: number, defaultValue: number): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export const GET = withRouteTelemetry("articles.list", GETHandler);
