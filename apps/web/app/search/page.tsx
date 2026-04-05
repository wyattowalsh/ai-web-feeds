import { Suspense } from "react";
import {
  SearchPageClient,
  type InitialSearchRequestState,
  type SearchResult,
} from "@/components/search/search-page-client";
import { fetchBackend } from "@/lib/backend";
import {
  DEFAULT_SEARCH_THRESHOLD,
  normalizeSearchQuery,
  parseSearchStateFromParams,
  type SearchExecutionState,
} from "@/lib/search";

export const dynamic = "force-dynamic";

type SearchPageSearchParams = Record<string, string | string[] | undefined>;

type SearchPageProps = {
  searchParams: Promise<SearchPageSearchParams>;
};

type SearchResponse = {
  results?: SearchResult[];
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
      initialSearchRequestState: "idle",
      shouldLogInitialSearch: false,
    };
  }

  try {
    const data = (await fetchBackend("/search", {
      method: "GET",
      params: {
        q: initialQuery,
        type: initialSearchState.searchType,
        ...(initialSearchState.source_type && { source_type: initialSearchState.source_type }),
        ...(initialSearchState.topics.length > 0 && { topics: initialSearchState.topics.join(",") }),
        ...(initialSearchState.verified !== undefined && { verified: initialSearchState.verified }),
        ...(initialSearchState.searchType === "semantic"
          && initialSearchState.threshold !== DEFAULT_SEARCH_THRESHOLD && {
            threshold: initialSearchState.threshold,
          }),
      },
    })) as SearchResponse;

    return {
      initialQuery,
      initialSearchState,
      initialResults: Array.isArray(data.results) ? data.results : [],
      initialSearchRequestState: "success",
      shouldLogInitialSearch: true,
    };
  } catch (error) {
    console.error("Initial search hydration error:", error);
    return {
      initialQuery,
      initialSearchState,
      initialResults: [],
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
