import { browseArticleCorpus } from "@/lib/article-corpus";
import { getFeedStats, loadFeedCatalog } from "@/lib/feeds";

import { parseInitialState, parseMode } from "@/lib/reader-route-parse";

export type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
  FeedsWorkspaceMode,
  ReaderPageSearchParams,
  URLSearchParamsLike,
} from "@/lib/reader-route-types";

export {
  parseCursor,
  parseInitialState,
  parseLimit,
  parseMode,
  parseReaderView,
  parseSort,
} from "@/lib/reader-route-parse";

import type {
  FeedsWorkspaceInitialBrowse,
  FeedsWorkspaceInitialState,
  FeedsWorkspaceMode,
  ReaderPageSearchParams,
} from "@/lib/reader-route-types";

export type ReaderRouteData = {
  mode: FeedsWorkspaceMode;
  feeds: ReturnType<typeof loadFeedCatalog>["sources"];
  stats: ReturnType<typeof getFeedStats>;
  initialState: FeedsWorkspaceInitialState;
  initialBrowse: FeedsWorkspaceInitialBrowse | null;
};

export async function loadReaderRouteData(
  searchParamsPromise: Promise<ReaderPageSearchParams>,
): Promise<ReaderRouteData> {
  const resolvedSearchParams = toURLSearchParams(await searchParamsPromise);
  const mode = parseMode(resolvedSearchParams);
  const feedsData = loadFeedCatalog();
  const stats = getFeedStats(feedsData.sources);
  const initialState = parseInitialState(resolvedSearchParams);
  const initialBrowse =
    mode === "catalog"
      ? null
      : await browseArticleCorpus({
          q: initialState.query,
          feedIds: initialState.feedIds,
          sourceType: initialState.sourceType ?? undefined,
          topics: initialState.topics,
          verified: initialState.verified ?? undefined,
          sort: initialState.sort,
          cursor: initialState.cursor,
          limit: initialState.limit,
        }).catch(() => null);

  return {
    mode,
    feeds: feedsData.sources,
    stats,
    initialState,
    initialBrowse,
  };
}

function toURLSearchParams(searchParams: ReaderPageSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      const normalizedValues = value.filter((entry): entry is string => typeof entry === "string");
      if (normalizedValues.length === 0) {
        continue;
      }

      if (key === "topics") {
        params.set(key, normalizedValues.join(","));
      } else {
        for (const entry of normalizedValues) {
          params.append(key, entry);
        }
      }
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params;
}
