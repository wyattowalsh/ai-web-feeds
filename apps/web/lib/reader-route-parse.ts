import {
  normalizeSearchQuery,
  parseSearchFeedIdsParam,
  parseSearchTopicsParam,
  parseVerifiedSearchFilter,
} from "@/lib/search";

import type {
  FeedsWorkspaceInitialState,
  FeedsWorkspaceMode,
  URLSearchParamsLike,
} from "./reader-route-types";

export type { URLSearchParamsLike } from "./reader-route-types";

export function parseMode(searchParams: URLSearchParamsLike): FeedsWorkspaceMode {
  const rawMode = searchParams.get("mode")?.trim().toLowerCase();
  return rawMode === "catalog" ? "catalog" : "reader";
}

export function parseSort(searchParams: URLSearchParamsLike): FeedsWorkspaceInitialState["sort"] {
  const rawSort = searchParams.get("sort")?.trim().toLowerCase() ?? "";

  if (rawSort === "oldest" || rawSort === "source") {
    return rawSort;
  }

  return "latest";
}

export function parseReaderView(
  searchParams: URLSearchParamsLike,
): FeedsWorkspaceInitialState["readerView"] {
  const rawView = searchParams.get("reader_view")?.trim().toLowerCase() ?? "";
  if (
    rawView === "unread" ||
    rawView === "starred" ||
    rawView === "saved" ||
    rawView === "archived"
  ) {
    return rawView;
  }

  return "latest";
}

export function parseCursor(searchParams: URLSearchParamsLike): number {
  const rawCursor = searchParams.get("cursor");
  if (!rawCursor) {
    return 0;
  }

  const parsed = Number.parseInt(rawCursor, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.trunc(parsed);
}

export function parseLimit(searchParams: URLSearchParamsLike): number {
  const rawLimit = searchParams.get("limit");
  if (!rawLimit) {
    return 24;
  }

  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed)) {
    return 24;
  }

  return Math.max(1, Math.min(100, Math.trunc(parsed)));
}

export function parseInitialState(searchParams: URLSearchParamsLike): FeedsWorkspaceInitialState {
  const normalizedSourceType = searchParams.get("source_type")?.trim();
  const verified = parseVerifiedSearchFilter(searchParams.get("verified"));

  return {
    query: normalizeSearchQuery(searchParams.get("q")) ?? "",
    feedIds: parseSearchFeedIdsParam(searchParams.getAll("feed")),
    sourceType:
      normalizedSourceType && normalizedSourceType.length > 0 ? normalizedSourceType : null,
    topics: parseSearchTopicsParam(searchParams.getAll("topics").join(",")),
    verified: verified ?? null,
    sort: parseSort(searchParams),
    readerView: parseReaderView(searchParams),
    cursor: parseCursor(searchParams),
    limit: parseLimit(searchParams),
  };
}
