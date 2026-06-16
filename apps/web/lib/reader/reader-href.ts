import { CANONICAL_READER_PATH } from "@/lib/reader-routes";
import { normalizeTopicsValue } from "./filters";
import type { ReaderHrefState } from "./types";

export function buildReaderHref(
  state: ReaderHrefState,
  overrides: Record<string, string | string[] | null | undefined> = {},
): string {
  const params = new URLSearchParams();

  if (state.query) {
    params.set("q", state.query);
  }
  if (state.sourceType) {
    params.set("source_type", state.sourceType);
  }
  if (state.topics.length > 0) {
    params.set("topics", normalizeTopicsValue(state.topics));
  }
  if (typeof state.verified === "boolean") {
    params.set("verified", String(state.verified));
  }
  for (const feedId of state.feedIds) {
    params.append("feed", feedId);
  }
  if (state.sort !== "latest") {
    params.set("sort", state.sort);
  }
  if (state.readerView !== "latest") {
    params.set("reader_view", state.readerView);
  }
  if (state.cursor > 0) {
    params.set("cursor", String(state.cursor));
  }

  for (const [key, value] of Object.entries(overrides)) {
    params.delete(key);

    if (value == null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
      continue;
    }

    params.set(key, value);
  }

  const nextQuery = params.toString();
  return nextQuery ? `${CANONICAL_READER_PATH}?${nextQuery}` : CANONICAL_READER_PATH;
}

export function buildImmersiveReaderHref(articleId: string): string {
  return `/reader/article/${encodeURIComponent(articleId)}`;
}
