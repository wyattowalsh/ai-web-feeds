export const CANONICAL_READER_PATH = "/reader";
export const CANONICAL_SOURCES_PATH = "/sources";
export const CANONICAL_CATALOG_PATH = CANONICAL_SOURCES_PATH;

export function buildReaderRouteHref(params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${CANONICAL_READER_PATH}?${query}` : CANONICAL_READER_PATH;
}
