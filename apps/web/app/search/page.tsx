import { Suspense } from "react";
import {
  SearchPageClient,
  type InitialSearchRequestState,
} from "@/components/search/search-page-client";
import { runLocalSearch } from "@/lib/search-local";
import {
  DEFAULT_UNBOUNDED_SEARCH_META,
  normalizeSearchQuery,
  parseSearchStateFromParams,
  type SearchExecutionState,
  type SearchResponseMeta,
  type SearchResult,
} from "@/lib/search";

export const dynamic = "force-dynamic";

type SearchPageSearchParams = Record<string, string | string[] | undefined>;

type SearchPageProps = {
  searchParams: Promise<SearchPageSearchParams>;
};

function toURLSearchParams(searchParams: SearchPageSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }

      if (key === "topics") {
        params.set(key, value.join(","));
      } else {
        params.set(key, value[0] ?? "");
      }
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params;
}

async function getInitialSearchData(
  rawSearchParams: Promise<SearchPageSearchParams>,
): Promise<{
  initialQuery: string;
  initialSearchState: SearchExecutionState;
  initialResults: SearchResult[];
  initialMeta: SearchResponseMeta;
  initialSearchRequestState: InitialSearchRequestState;
  shouldLogInitialSearch: boolean;
}> {
  const searchParams = toURLSearchParams(await rawSearchParams);
  const initialQuery = normalizeSearchQuery(searchParams.get("q")) ?? "";
  const initialSearchState = parseSearchStateFromParams(searchParams);

  if (!initialQuery) {
    return {
      initialQuery,
      initialSearchState,
      initialResults: [],
      initialMeta: DEFAULT_UNBOUNDED_SEARCH_META,
      initialSearchRequestState: "idle",
      shouldLogInitialSearch: false,
    };
  }

  try {
    const payload = await runLocalSearch({
      query: initialQuery,
      scope: initialSearchState.scope,
      limit: 20,
      sourceType: initialSearchState.source_type,
      topics: initialSearchState.topics,
      verified: initialSearchState.verified,
    });

    return {
      initialQuery,
      initialSearchState,
      initialResults: payload.results,
      initialMeta: payload.meta,
      initialSearchRequestState: "success",
      shouldLogInitialSearch: true,
    };
  } catch (error) {
    console.error("Initial search hydration error:", error);
    return {
      initialQuery,
      initialSearchState,
      initialResults: [],
      initialMeta: DEFAULT_UNBOUNDED_SEARCH_META,
      initialSearchRequestState: "failed",
      shouldLogInitialSearch: false,
    };
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const initialData = await getInitialSearchData(searchParams);

  return (
    <Suspense fallback={<div className="page-wrap py-16" />}>
      <SearchPageClient {...initialData} />
    </Suspense>
  );
}
