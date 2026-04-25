export const CANONICAL_READER_PATH = "/feeds";
export const CANONICAL_CATALOG_PATH = "/feeds?mode=catalog";

export function buildReaderRouteHref(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${CANONICAL_READER_PATH}?${query}` : CANONICAL_READER_PATH;
}
