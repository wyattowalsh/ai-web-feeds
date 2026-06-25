import { assertDbConfigured } from "@/lib/server/db";

import { mapUserSourceFollowRow } from "./row-mappers";
import type { UserSourceFollowRecord } from "./types";

export async function listFollows(userId: string): Promise<UserSourceFollowRecord[]> {
  const sql = assertDbConfigured();
  const rows = await sql`
    SELECT id, user_id, source_id, followed_at
    FROM user_source_follows
    WHERE user_id = ${userId}
    ORDER BY followed_at DESC
  `;

  return rows.map((row) => mapUserSourceFollowRow(row as Record<string, unknown>));
}

export async function followSource(
  userId: string,
  sourceId: string,
): Promise<{ follow: UserSourceFollowRecord; created: boolean }> {
  const sql = assertDbConfigured();

  const inserted = await sql`
    INSERT INTO user_source_follows (user_id, source_id, followed_at)
    VALUES (${userId}, ${sourceId}, NOW())
    ON CONFLICT (user_id, source_id) DO NOTHING
    RETURNING id, user_id, source_id, followed_at
  `;

  if (inserted.length > 0) {
    return {
      follow: mapUserSourceFollowRow(inserted[0] as Record<string, unknown>),
      created: true,
    };
  }

  const existing = await sql`
    SELECT id, user_id, source_id, followed_at
    FROM user_source_follows
    WHERE user_id = ${userId}
      AND source_id = ${sourceId}
    LIMIT 1
  `;

  const row = existing[0];
  if (!row) {
    throw new Error("Failed to follow source");
  }

  return {
    follow: mapUserSourceFollowRow(row as Record<string, unknown>),
    created: false,
  };
}

export async function unfollowSource(userId: string, sourceId: string): Promise<boolean> {
  const sql = assertDbConfigured();
  const rows = await sql`
    DELETE FROM user_source_follows
    WHERE user_id = ${userId}
      AND source_id = ${sourceId}
    RETURNING id
  `;

  return rows.length > 0;
}
