import { assertDbConfigured } from "@/lib/server/db";

import { ensureSavedReaderFiltersTable } from "./reader-filters";
import { ensureUserArticleStatesTable } from "./article-state";

export type DeleteUserDataResult = {
  user_id: string;
  deleted: {
    saved_reader_filters: number;
    saved_searches: number;
    user_source_follows: number;
    notification_preferences: number;
    user_article_states: number;
    notifications: number;
    search_queries: number;
  };
};

export async function deleteUserData(userId: string): Promise<DeleteUserDataResult> {
  const sql = assertDbConfigured();

  await ensureSavedReaderFiltersTable(sql);
  await ensureUserArticleStatesTable(sql);

  const [
    savedReaderFilters,
    savedSearches,
    follows,
    notificationPreferences,
    articleStates,
    notifications,
    searchQueries,
  ] = await Promise.all([
    sql`DELETE FROM saved_reader_filters WHERE user_id = ${userId} RETURNING id`,
    sql`DELETE FROM saved_searches WHERE user_id = ${userId} RETURNING id`,
    sql`DELETE FROM user_source_follows WHERE user_id = ${userId} RETURNING id`,
    sql`DELETE FROM notification_preferences WHERE user_id = ${userId} RETURNING id`,
    sql`DELETE FROM user_article_states WHERE user_id = ${userId} RETURNING id`,
    sql`DELETE FROM notifications WHERE user_id = ${userId} RETURNING id`,
    sql`DELETE FROM search_queries WHERE user_id = ${userId} RETURNING id`,
  ]);

  return {
    user_id: userId,
    deleted: {
      saved_reader_filters: savedReaderFilters.length,
      saved_searches: savedSearches.length,
      user_source_follows: follows.length,
      notification_preferences: notificationPreferences.length,
      user_article_states: articleStates.length,
      notifications: notifications.length,
      search_queries: searchQueries.length,
    },
  };
}
