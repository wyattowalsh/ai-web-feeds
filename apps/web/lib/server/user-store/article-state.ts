import type { NeonQueryFunction } from "@neondatabase/serverless";

import { assertDbConfigured } from "@/lib/server/db";

import type { UpsertArticleStateInput, UserArticleStateRecord } from "./types";

/** Pending Alembic 015: engagement columns included in bootstrap DDL. */
let tableReady: Promise<void> | null = null;

export function resetUserArticleStatesTableCacheForTests(): void {
  tableReady = null;
}

function toIsoString(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return null;
}

function parseAnnotationIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      return [];
    }
  }

  return [];
}

export function mapUserArticleStateRow(row: Record<string, unknown>): UserArticleStateRecord {
  const articleKey =
    typeof row.article_key === "string" && row.article_key.length > 0
      ? row.article_key
      : row.article_id == null
        ? ""
        : String(row.article_id);

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    article_key: articleKey,
    article_id: row.article_id == null ? null : Number(row.article_id),
    read_at: toIsoString(row.read_at),
    saved_at: toIsoString(row.saved_at),
    starred_at: toIsoString(row.starred_at),
    archived_at: toIsoString(row.archived_at),
    annotation_ids: parseAnnotationIds(row.annotation_ids),
    read_duration_ms: typeof row.read_duration_ms === "number" ? row.read_duration_ms : null,
    scroll_depth: typeof row.scroll_depth === "number" ? row.scroll_depth : null,
    opened_from: row.opened_from == null ? null : String(row.opened_from),
    updated_at: toIsoString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

export function toClientArticleState(record: UserArticleStateRecord): {
  article_key: string;
  read: boolean;
  starred: boolean;
  archived: boolean;
  bookmarked: boolean;
  read_duration_ms: number | null;
  scroll_depth: number | null;
  opened_from: string | null;
  updated_at: string;
} {
  return {
    article_key: record.article_key,
    read: record.read_at != null,
    starred: record.starred_at != null,
    archived: record.archived_at != null,
    bookmarked: record.saved_at != null,
    read_duration_ms: record.read_duration_ms,
    scroll_depth: record.scroll_depth,
    opened_from: record.opened_from,
    updated_at: record.updated_at,
  };
}

export async function ensureUserArticleStatesTable(
  sql: NeonQueryFunction<false, false> = assertDbConfigured(),
): Promise<void> {
  if (!tableReady) {
    tableReady = sql
      .transaction([
        sql`
          CREATE TABLE IF NOT EXISTS user_article_states (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            article_key TEXT,
            article_id INTEGER REFERENCES articles(id),
            read_at TIMESTAMPTZ,
            saved_at TIMESTAMPTZ,
            starred_at TIMESTAMPTZ,
            archived_at TIMESTAMPTZ,
            annotation_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            read_duration_ms INTEGER,
            scroll_depth DOUBLE PRECISION,
            opened_from TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `,
        sql`
          ALTER TABLE user_article_states
            ADD COLUMN IF NOT EXISTS article_key TEXT
        `,
        sql`
          ALTER TABLE user_article_states
            ADD COLUMN IF NOT EXISTS read_duration_ms INTEGER
        `,
        sql`
          ALTER TABLE user_article_states
            ADD COLUMN IF NOT EXISTS scroll_depth DOUBLE PRECISION
        `,
        sql`
          ALTER TABLE user_article_states
            ADD COLUMN IF NOT EXISTS opened_from TEXT
        `,
        sql`
          CREATE INDEX IF NOT EXISTS ix_user_article_states_user_id
            ON user_article_states (user_id)
        `,
        sql`
          CREATE UNIQUE INDEX IF NOT EXISTS uq_user_article_state_key
            ON user_article_states (user_id, article_key)
            WHERE article_key IS NOT NULL
        `,
      ])
      .then(() => undefined);
  }

  await tableReady;
}

export async function listArticleStates(
  userId: string,
  options: { limit?: number; since?: string } = {},
): Promise<UserArticleStateRecord[]> {
  const sql = assertDbConfigured();
  await ensureUserArticleStatesTable(sql);

  const limit = Math.min(Math.max(options.limit ?? 500, 1), 5000);
  const since = options.since?.trim();

  const rows = since
    ? await sql`
        SELECT
          id,
          user_id,
          article_key,
          article_id,
          read_at,
          saved_at,
          starred_at,
          archived_at,
          annotation_ids,
          read_duration_ms,
          scroll_depth,
          opened_from,
          updated_at
        FROM user_article_states
        WHERE user_id = ${userId}
          AND updated_at >= ${since}::timestamptz
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT
          id,
          user_id,
          article_key,
          article_id,
          read_at,
          saved_at,
          starred_at,
          archived_at,
          annotation_ids,
          read_duration_ms,
          scroll_depth,
          opened_from,
          updated_at
        FROM user_article_states
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `;

  return rows.map((row) => mapUserArticleStateRow(row as Record<string, unknown>));
}

function timestampForFlag(flag: boolean | undefined): string | null | undefined {
  if (flag === undefined) {
    return undefined;
  }

  return flag ? new Date().toISOString() : null;
}

function mergeTimestamp(current: string | null, next: string | null | undefined): string | null {
  if (next === undefined) {
    return current;
  }

  return next;
}

export async function upsertArticleState(
  input: UpsertArticleStateInput,
): Promise<UserArticleStateRecord> {
  const sql = assertDbConfigured();
  await ensureUserArticleStatesTable(sql);

  const articleKey = input.article_key.trim();
  if (!articleKey) {
    throw new Error("article_key is required");
  }

  const existingRows = await sql`
    SELECT
      id,
      user_id,
      article_key,
      article_id,
      read_at,
      saved_at,
      starred_at,
      archived_at,
      annotation_ids,
      read_duration_ms,
      scroll_depth,
      opened_from,
      updated_at
    FROM user_article_states
    WHERE user_id = ${input.user_id}
      AND article_key = ${articleKey}
    LIMIT 1
  `;

  const current = existingRows[0]
    ? mapUserArticleStateRow(existingRows[0] as Record<string, unknown>)
    : null;

  const readAt = mergeTimestamp(current?.read_at ?? null, timestampForFlag(input.read));
  const savedAt = mergeTimestamp(current?.saved_at ?? null, timestampForFlag(input.bookmarked));
  const starredAt = mergeTimestamp(current?.starred_at ?? null, timestampForFlag(input.starred));
  const archivedAt = mergeTimestamp(current?.archived_at ?? null, timestampForFlag(input.archived));
  const readDurationMs =
    input.read_duration_ms === undefined
      ? current?.read_duration_ms ?? null
      : input.read_duration_ms;
  const scrollDepth =
    input.scroll_depth === undefined ? current?.scroll_depth ?? null : input.scroll_depth;
  const openedFrom =
    input.opened_from === undefined ? current?.opened_from ?? null : input.opened_from;

  const rows = current
    ? await sql`
        UPDATE user_article_states
        SET
          read_at = ${readAt},
          saved_at = ${savedAt},
          starred_at = ${starredAt},
          archived_at = ${archivedAt},
          read_duration_ms = ${readDurationMs},
          scroll_depth = ${scrollDepth},
          opened_from = ${openedFrom},
          updated_at = NOW()
        WHERE id = ${current.id}::uuid
        RETURNING
          id,
          user_id,
          article_key,
          article_id,
          read_at,
          saved_at,
          starred_at,
          archived_at,
          annotation_ids,
          read_duration_ms,
          scroll_depth,
          opened_from,
          updated_at
      `
    : await sql`
        INSERT INTO user_article_states (
          user_id,
          article_key,
          read_at,
          saved_at,
          starred_at,
          archived_at,
          read_duration_ms,
          scroll_depth,
          opened_from,
          updated_at
        )
        VALUES (
          ${input.user_id},
          ${articleKey},
          ${readAt},
          ${savedAt},
          ${starredAt},
          ${archivedAt},
          ${readDurationMs},
          ${scrollDepth},
          ${openedFrom},
          NOW()
        )
        RETURNING
          id,
          user_id,
          article_key,
          article_id,
          read_at,
          saved_at,
          starred_at,
          archived_at,
          annotation_ids,
          read_duration_ms,
          scroll_depth,
          opened_from,
          updated_at
      `;

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to upsert article state");
  }

  return mapUserArticleStateRow(row as Record<string, unknown>);
}

export async function upsertArticleStates(
  userId: string,
  states: Array<Omit<UpsertArticleStateInput, "user_id">>,
): Promise<{ upserted: number; states: UserArticleStateRecord[] }> {
  const results: UserArticleStateRecord[] = [];

  for (const state of states) {
    const saved = await upsertArticleState({
      user_id: userId,
      ...state,
    });
    results.push(saved);
  }

  return {
    upserted: results.length,
    states: results,
  };
}
