/** Versioned reader filter payload (Track C / migration 015). */

export const READER_FILTER_SCHEMA_VERSION = "reader-filter-v1" as const;

export type SavedReaderFilterPayload = {
  query: string;
  feedIds: string[];
  sourceType: string | null;
  topics: string[];
  verified: boolean | null;
  sort: "latest" | "oldest" | "source";
  readerView: "latest" | "unread" | "starred" | "saved" | "archived";
};

export function normalizeSavedReaderFilterPayload(
  payload: Partial<SavedReaderFilterPayload> | null | undefined,
): SavedReaderFilterPayload {
  return {
    query: typeof payload?.query === "string" ? payload.query : "",
    feedIds: Array.isArray(payload?.feedIds)
      ? payload.feedIds.filter((id): id is string => typeof id === "string")
      : [],
    sourceType: typeof payload?.sourceType === "string" ? payload.sourceType : null,
    topics: Array.isArray(payload?.topics)
      ? payload.topics.filter((topic): topic is string => typeof topic === "string")
      : [],
    verified: typeof payload?.verified === "boolean" ? payload.verified : null,
    sort:
      payload?.sort === "oldest" || payload?.sort === "source" || payload?.sort === "latest"
        ? payload.sort
        : "latest",
    readerView:
      payload?.readerView === "unread" ||
      payload?.readerView === "starred" ||
      payload?.readerView === "saved" ||
      payload?.readerView === "archived" ||
      payload?.readerView === "latest"
        ? payload.readerView
        : "latest",
  };
}
