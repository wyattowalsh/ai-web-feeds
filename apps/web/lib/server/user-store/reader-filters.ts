import type { NeonQueryFunction } from "@neondatabase/serverless";

import { READER_FILTER_SCHEMA_VERSION } from "@/lib/server/contracts/reader-filter";
import { assertDbConfigured } from "@/lib/server/db";

import { mapSavedReaderFilterRow } from "./row-mappers";
import type { SaveReaderFilterInput, SavedReaderFilterRecord } from "./types";

/** Pending Alembic 015: engagement columns already included in bootstrap DDL. */
let tableReady: Promise<void> | null = null;

export function resetSavedReaderFiltersTableCacheForTests(): void {
  tableReady = null;
}

export async function ensureSavedReaderFiltersTable(
  sql: NeonQueryFunction<false, false> = assertDbConfigured(),
): Promise<void> {
  if (!tableReady) {
    tableReady = sql
      .transaction([
        sql`
          CREATE TABLE IF NOT EXISTS saved_reader_filters (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            filter_name TEXT NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            schema_version TEXT NOT NULL DEFAULT 'reader-filter-v1',
            use_count INTEGER NOT NULL DEFAULT 0,
            pinned BOOLEAN NOT NULL DEFAULT false,
            is_default BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_saved_reader_filter_user_name UNIQUE (user_id, filter_name)
          )
        `,
        sql`
          CREATE INDEX IF NOT EXISTS ix_saved_reader_filters_user_id
            ON saved_reader_filters (user_id)
        `,
      ])
      .then(() => undefined);
  }

  await tableReady;
}

export async function listReaderFilters(userId: string): Promise<SavedReaderFilterRecord[]> {
  const sql = assertDbConfigured();
  await ensureSavedReaderFiltersTable(sql);

  const rows = await sql`
    SELECT
      id,
      user_id,
      filter_name,
      payload,
      schema_version,
      use_count,
      pinned,
      is_default,
      created_at,
      last_used_at
    FROM saved_reader_filters
    WHERE user_id = ${userId}
    ORDER BY pinned DESC, last_used_at DESC
  `;

  return rows.map((row) => mapSavedReaderFilterRow(row as Record<string, unknown>));
}

export async function saveReaderFilter(
  input: SaveReaderFilterInput,
): Promise<SavedReaderFilterRecord> {
  const sql = assertDbConfigured();
  await ensureSavedReaderFiltersTable(sql);

  const pinned = input.pinned ?? false;
  const isDefault = input.is_default ?? false;

  const rows = await sql`
    INSERT INTO saved_reader_filters (
      user_id,
      filter_name,
      payload,
      schema_version,
      pinned,
      is_default,
      created_at,
      last_used_at
    )
    VALUES (
      ${input.user_id},
      ${input.filter_name},
      ${JSON.stringify(input.payload)}::jsonb,
      ${READER_FILTER_SCHEMA_VERSION},
      ${pinned},
      ${isDefault},
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id, filter_name)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      schema_version = EXCLUDED.schema_version,
      pinned = EXCLUDED.pinned,
      is_default = EXCLUDED.is_default,
      last_used_at = NOW()
    RETURNING
      id,
      user_id,
      filter_name,
      payload,
      schema_version,
      use_count,
      pinned,
      is_default,
      created_at,
      last_used_at
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to save reader filter");
  }

  return mapSavedReaderFilterRow(row as Record<string, unknown>);
}

export async function deleteReaderFilter(userId: string, filterId: string): Promise<boolean> {
  const sql = assertDbConfigured();
  await ensureSavedReaderFiltersTable(sql);

  const rows = await sql`
    DELETE FROM saved_reader_filters
    WHERE id = ${filterId}::uuid
      AND user_id = ${userId}
    RETURNING id
  `;

  return rows.length > 0;
}
