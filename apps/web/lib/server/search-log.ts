import "server-only";

import { assertDbConfigured } from "@/lib/server/db";

export type SearchQueryLogInput = {
  user_id: string | null;
  query_text: string;
  search_type: string;
  filters_applied: Record<string, unknown>;
  result_count: number;
  clicked_results: string[];
};

export type SearchQueryLogRecord = {
  id: string;
  user_id: string | null;
  query_text: string;
  search_type: string;
  filters_applied: Record<string, unknown>;
  result_count: number;
  clicked_results: string[];
  timestamp: string;
};

function mapSearchQueryRow(row: Record<string, unknown>): SearchQueryLogRecord {
  const filters =
    row.filters_applied &&
    typeof row.filters_applied === "object" &&
    !Array.isArray(row.filters_applied)
      ? (row.filters_applied as Record<string, unknown>)
      : {};

  const clicked =
    Array.isArray(row.clicked_results) &&
    row.clicked_results.every((value) => typeof value === "string")
      ? (row.clicked_results as string[])
      : [];

  return {
    id: String(row.id),
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    query_text: String(row.query_text),
    search_type: String(row.search_type),
    filters_applied: filters,
    result_count: Number(row.result_count),
    clicked_results: clicked,
    timestamp:
      row.timestamp instanceof Date
        ? row.timestamp.toISOString()
        : typeof row.timestamp === "string"
          ? row.timestamp
          : new Date().toISOString(),
  };
}

/** Persist a search interaction row to Neon `search_queries` (Python SearchQuery parity). */
export async function logSearchQuery(input: SearchQueryLogInput): Promise<SearchQueryLogRecord> {
  const sql = assertDbConfigured();
  const filters = input.filters_applied ?? {};
  const clickedResults = input.clicked_results ?? [];

  const rows = await sql`
    INSERT INTO search_queries (
      id,
      user_id,
      query_text,
      search_type,
      filters_applied,
      result_count,
      clicked_results,
      timestamp
    )
    VALUES (
      gen_random_uuid(),
      ${input.user_id},
      ${input.query_text},
      ${input.search_type},
      ${JSON.stringify(filters)}::jsonb,
      ${input.result_count},
      ${JSON.stringify(clickedResults)}::jsonb,
      NOW()
    )
    RETURNING
      id,
      user_id,
      query_text,
      search_type,
      filters_applied,
      result_count,
      clicked_results,
      timestamp
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to log search query");
  }

  return mapSearchQueryRow(row as Record<string, unknown>);
}
