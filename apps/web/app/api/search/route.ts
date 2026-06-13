import { NextResponse } from "next/server";
import { withRouteTelemetry } from "@/lib/telemetry-route";
import {
  applyUserIdentityBinding,
  isValidUserId,
  resolveUserIdentity,
  validateTrustedUserOwnership,
} from "@/lib/user-auth";
import {
  BackendConfigurationError,
  clampNumber,
  fetchBackend,
  getBackendErrorStatus,
  formatBackendErrorResponse,
} from "@/lib/backend";
import { searchArticlesInCorpus, searchCatalogSources } from "@/lib/article-corpus";
import {
  normalizeSearchFilters,
  normalizeSearchQuery,
  parseSearchFeedIdsParam,
  parseSearchScope,
  parseSearchTopicsParam,
  parseSearchType,
  parseVerifiedSearchFilter,
} from "@/lib/search";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const query = normalizeSearchQuery(searchParams.get("q"));
  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const rawScope = searchParams.get("scope");
  const rawType = searchParams.get("type");
  if (rawScope && !isPublicSearchType(rawScope)) {
    return NextResponse.json({ error: "Invalid search scope" }, { status: 400 });
  }
  if (!rawScope && rawType && !isPublicSearchType(rawType)) {
    return NextResponse.json({ error: "Invalid search type" }, { status: 400 });
  }

  const scope = rawScope
    ? parseSearchScope(rawScope)
    : parseSearchType(rawType) === "articles"
      ? "articles"
      : "sources";
  const limit = clampNumber(parseInt(searchParams.get("limit") || "20", 10), 1, 100);
  const normalizedFilters = normalizeSearchFilters({
    source_type: searchParams.get("source_type"),
    topics: parseSearchTopicsParam(searchParams.getAll("topics").join(",")),
    verified: parseVerifiedSearchFilter(searchParams.get("verified")),
  });
  const feedIds = parseSearchFeedIdsParam(searchParams.getAll("feed"));
  const sourceType = normalizedFilters.source_type;
  const topics = normalizedFilters.topics;
  const verified = normalizedFilters.verified;

  try {
    const payload =
      scope === "articles"
        ? await searchArticlesInCorpus({
            q: query,
            limit,
            feedIds,
            sourceType,
            topics,
            verified,
          })
        : await searchCatalogSources({
            query,
            limit,
            feedIds,
            sourceType,
            topics,
            verified,
          });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};

const POSTHandler = async (request: Request) => {
  let body: {
    query?: string;
    type?: string;
    filters?: Record<string, unknown>;
    clicked_results?: string[];
    result_count?: number;
    user_id?: string;
  } | null = null;
  let resolvedIdentity = resolveUserIdentity(request);

  try {
    body = (await request.json()) as {
      query?: string;
      type?: string;
      filters?: Record<string, unknown>;
      clicked_results?: string[];
      result_count?: number;
      user_id?: string;
    };
    if (body.user_id && !isValidUserId(body.user_id)) {
      return NextResponse.json({ error: "Missing or invalid user_id" }, { status: 400 });
    }
    resolvedIdentity = resolveUserIdentity(request, body.user_id ?? null);
    const identity = resolvedIdentity.identity;
    const query = normalizeSearchQuery(body.query);
    if (body.type && !isPublicSearchType(body.type)) {
      return NextResponse.json({ error: "Invalid search type" }, { status: 400 });
    }
    const searchType = parseSearchType(body.type);
    const filters = normalizeSearchFilters(body.filters);
    const { clicked_results } = body;
    const resultCount =
      typeof body.result_count === "number" && Number.isFinite(body.result_count)
        ? Math.max(0, Math.trunc(body.result_count))
        : 0;

    if (body.user_id && !validateTrustedUserOwnership(body.user_id, identity)) {
      return NextResponse.json(
        { error: "user_id does not match request identity" },
        { status: 403 },
      );
    }

    if (!query) {
      return NextResponse.json({ error: "Missing required field: query" }, { status: 400 });
    }

    const data = await fetchBackend("/search/log", {
      method: "POST",
      body: {
        query,
        type: searchType === "articles" ? "semantic" : "full_text",
        filters,
        clicked_results: clicked_results || [],
        result_count: resultCount,
        user_id: identity.user_id,
      },
    });

    const response = NextResponse.json(data);
    applyUserIdentityBinding(response, resolvedIdentity);
    return response;
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      const response = NextResponse.json(
        {
          success: false,
          skipped: true,
          code: "BACKEND_UNAVAILABLE",
          error: "Search analytics logging is unavailable in this deployment.",
        },
        { status: 202 },
      );
      applyUserIdentityBinding(response, resolvedIdentity);
      return response;
    }

    return NextResponse.json(formatBackendErrorResponse(error), {
      status: getBackendErrorStatus(error),
    });
  }
};

export const GET = withRouteTelemetry("search.query", GETHandler, {
  backendTarget: "local-catalog-search",
});
export const POST = withRouteTelemetry("search.log", POSTHandler, {
  backendTarget: "python-backend",
});

function isPublicSearchType(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "sources" || normalized === "articles";
}
