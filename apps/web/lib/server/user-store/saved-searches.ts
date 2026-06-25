import { assertDbConfigured } from "@/lib/server/db";

import { mapSavedSearchRow } from "./row-mappers";
import type { CreateSavedSearchInput, SavedSearchRecord } from "./types";

export async function listSavedSearches(userId: string): Promise<SavedSearchRecord[]> {
  const sql = assertDbConfigured();
  const rows = await sql`
    SELECT
      id,
      user_id,
      search_name,
      query_text,
      filters,
      created_at,
      last_used_at
    FROM saved_searches
    WHERE user_id = ${userId}
    ORDER BY last_used_at DESC
  `;

  return rows.map((row) => mapSavedSearchRow(row as Record<string, unknown>));
}

export async function createSavedSearch(input: CreateSavedSearchInput): Promise<SavedSearchRecord> {
  const sql = assertDbConfigured();
  const filters = input.filters ?? {};

  const rows = await sql`
    INSERT INTO saved_searches (
      id,
      user_id,
      search_name,
      query_text,
      filters,
      created_at,
      last_used_at
    )
    VALUES (
      gen_random_uuid(),
      ${input.user_id},
      ${input.search_name},
      ${input.query_text},
      ${JSON.stringify(filters)}::jsonb,
      NOW(),
      NOW()
    )
    RETURNING
      id,
      user_id,
      search_name,
      query_text,
      filters,
      created_at,
      last_used_at
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create saved search");
  }

  return mapSavedSearchRow(row as Record<string, unknown>);
}

export async function deleteSavedSearch(userId: string, searchId: string): Promise<boolean> {
  const sql = assertDbConfigured();
  const rows = await sql`
    DELETE FROM saved_searches
    WHERE id = ${searchId}::uuid
      AND user_id = ${userId}
    RETURNING id
  `;

  return rows.length > 0;
}
