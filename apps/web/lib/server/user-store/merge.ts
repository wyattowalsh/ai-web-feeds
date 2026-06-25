import { assertDbConfigured } from "@/lib/server/db";

import { ensureSavedReaderFiltersTable } from "./reader-filters";
import { ensureUserArticleStatesTable } from "./article-state";
import type { MergeUserDataInput, MergeUserDataResult } from "./types";

async function mergeReaderFilters(
  sql: ReturnType<typeof assertDbConfigured>,
  fromUserId: string,
  toUserId: string,
): Promise<number> {
  await ensureSavedReaderFiltersTable(sql);

  const rows = await sql`
    WITH moved AS (
      DELETE FROM saved_reader_filters
      WHERE user_id = ${fromUserId}
      RETURNING
        filter_name,
        payload,
        schema_version,
        use_count,
        pinned,
        is_default,
        created_at,
        last_used_at
    )
    INSERT INTO saved_reader_filters (
      user_id,
      filter_name,
      payload,
      schema_version,
      use_count,
      pinned,
      is_default,
      created_at,
      last_used_at
    )
    SELECT
      ${toUserId},
      filter_name,
      payload,
      schema_version,
      use_count,
      pinned,
      is_default,
      created_at,
      last_used_at
    FROM moved
    ON CONFLICT (user_id, filter_name)
    DO UPDATE SET
      payload = CASE
        WHEN EXCLUDED.last_used_at > saved_reader_filters.last_used_at THEN EXCLUDED.payload
        ELSE saved_reader_filters.payload
      END,
      use_count = saved_reader_filters.use_count + EXCLUDED.use_count,
      pinned = saved_reader_filters.pinned OR EXCLUDED.pinned,
      is_default = saved_reader_filters.is_default OR EXCLUDED.is_default,
      last_used_at = GREATEST(saved_reader_filters.last_used_at, EXCLUDED.last_used_at)
    RETURNING id
  `;

  return rows.length;
}

async function mergeArticleStates(
  sql: ReturnType<typeof assertDbConfigured>,
  fromUserId: string,
  toUserId: string,
): Promise<number> {
  await ensureUserArticleStatesTable(sql);

  const rows = await sql`
    WITH moved AS (
      DELETE FROM user_article_states
      WHERE user_id = ${fromUserId}
        AND article_key IS NOT NULL
      RETURNING
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
    )
    INSERT INTO user_article_states (
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
    )
    SELECT
      ${toUserId},
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
    FROM moved
    ON CONFLICT (user_id, article_key)
    WHERE article_key IS NOT NULL
    DO UPDATE SET
      read_at = CASE
        WHEN EXCLUDED.updated_at > user_article_states.updated_at THEN EXCLUDED.read_at
        ELSE COALESCE(user_article_states.read_at, EXCLUDED.read_at)
      END,
      saved_at = CASE
        WHEN EXCLUDED.updated_at > user_article_states.updated_at THEN EXCLUDED.saved_at
        ELSE COALESCE(user_article_states.saved_at, EXCLUDED.saved_at)
      END,
      starred_at = CASE
        WHEN EXCLUDED.updated_at > user_article_states.updated_at THEN EXCLUDED.starred_at
        ELSE COALESCE(user_article_states.starred_at, EXCLUDED.starred_at)
      END,
      archived_at = CASE
        WHEN EXCLUDED.updated_at > user_article_states.updated_at THEN EXCLUDED.archived_at
        ELSE COALESCE(user_article_states.archived_at, EXCLUDED.archived_at)
      END,
      read_duration_ms = COALESCE(EXCLUDED.read_duration_ms, user_article_states.read_duration_ms),
      scroll_depth = COALESCE(EXCLUDED.scroll_depth, user_article_states.scroll_depth),
      opened_from = COALESCE(EXCLUDED.opened_from, user_article_states.opened_from),
      updated_at = GREATEST(user_article_states.updated_at, EXCLUDED.updated_at)
    RETURNING id
  `;

  return rows.length;
}

async function mergeSavedSearches(
  sql: ReturnType<typeof assertDbConfigured>,
  fromUserId: string,
  toUserId: string,
): Promise<number> {
  const rows = await sql`
    WITH moved AS (
      DELETE FROM saved_searches
      WHERE user_id = ${fromUserId}
      RETURNING
        search_name,
        query_text,
        filters,
        created_at,
        last_used_at
    )
    INSERT INTO saved_searches (
      id,
      user_id,
      search_name,
      query_text,
      filters,
      created_at,
      last_used_at
    )
    SELECT
      gen_random_uuid(),
      ${toUserId},
      search_name,
      query_text,
      filters,
      created_at,
      last_used_at
    FROM moved
    ON CONFLICT (user_id, search_name)
    DO UPDATE SET
      query_text = CASE
        WHEN EXCLUDED.last_used_at > saved_searches.last_used_at THEN EXCLUDED.query_text
        ELSE saved_searches.query_text
      END,
      filters = CASE
        WHEN EXCLUDED.last_used_at > saved_searches.last_used_at THEN EXCLUDED.filters
        ELSE saved_searches.filters
      END,
      last_used_at = GREATEST(saved_searches.last_used_at, EXCLUDED.last_used_at)
    RETURNING id
  `;

  return rows.length;
}

async function mergeFollows(
  sql: ReturnType<typeof assertDbConfigured>,
  fromUserId: string,
  toUserId: string,
): Promise<number> {
  const rows = await sql`
    WITH moved AS (
      DELETE FROM user_source_follows
      WHERE user_id = ${fromUserId}
      RETURNING source_id, followed_at
    )
    INSERT INTO user_source_follows (user_id, source_id, followed_at)
    SELECT ${toUserId}, source_id, followed_at
    FROM moved
    ON CONFLICT (user_id, source_id) DO NOTHING
    RETURNING id
  `;

  return rows.length;
}

async function mergeNotificationPreferences(
  sql: ReturnType<typeof assertDbConfigured>,
  fromUserId: string,
  toUserId: string,
): Promise<number> {
  const rows = await sql`
    UPDATE notification_preferences
    SET user_id = ${toUserId},
        updated_at = NOW()
    WHERE user_id = ${fromUserId}
    RETURNING id
  `;

  return rows.length;
}

export async function mergeAnonymousUserData(
  input: MergeUserDataInput,
): Promise<MergeUserDataResult> {
  const sql = assertDbConfigured();

  if (input.from_user_id === input.to_user_id) {
    throw new Error("from_user_id and to_user_id must differ");
  }

  const [readerFilters, articleStates, savedSearches, follows, notificationPreferences] =
    await Promise.all([
      mergeReaderFilters(sql, input.from_user_id, input.to_user_id),
      mergeArticleStates(sql, input.from_user_id, input.to_user_id),
      mergeSavedSearches(sql, input.from_user_id, input.to_user_id),
      mergeFollows(sql, input.from_user_id, input.to_user_id),
      mergeNotificationPreferences(sql, input.from_user_id, input.to_user_id),
    ]);

  return {
    from_user_id: input.from_user_id,
    to_user_id: input.to_user_id,
    merged: {
      reader_filters: readerFilters,
      article_states: articleStates,
      saved_searches: savedSearches,
      follows,
      notification_preferences: notificationPreferences,
    },
  };
}
