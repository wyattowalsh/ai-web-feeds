import { createSavedSearch, deleteSavedSearch, listSavedSearches } from "./saved-searches";
import { followSource, listFollows, unfollowSource } from "./follows";
import { getNotificationPreferences, upsertNotificationPreference } from "./preferences";
import { dismissNotification, listNotifications, markNotificationRead } from "./notifications";
import { listArticleStates, upsertArticleState, upsertArticleStates } from "./article-state";
import { mergeAnonymousUserData } from "./merge";
import { deleteReaderFilter, listReaderFilters, saveReaderFilter } from "./reader-filters";
import type { UserStore } from "./types";

export * from "./types";
export { createSavedSearch, deleteSavedSearch, listSavedSearches } from "./saved-searches";
export { followSource, listFollows, unfollowSource } from "./follows";
export { getNotificationPreferences, upsertNotificationPreference } from "./preferences";
export { dismissNotification, listNotifications, markNotificationRead } from "./notifications";
export {
  deleteReaderFilter,
  ensureSavedReaderFiltersTable,
  listReaderFilters,
  saveReaderFilter,
} from "./reader-filters";
export {
  ensureUserArticleStatesTable,
  listArticleStates,
  mapUserArticleStateRow,
  resetUserArticleStatesTableCacheForTests,
  toClientArticleState,
  upsertArticleState,
  upsertArticleStates,
} from "./article-state";
export { deleteUserData } from "./delete-user-data";
export { mergeAnonymousUserData } from "./merge";

export const userStore: UserStore = {
  savedSearches: {
    list: listSavedSearches,
    create: createSavedSearch,
    delete: deleteSavedSearch,
  },
  follows: {
    list: listFollows,
    follow: followSource,
    unfollow: unfollowSource,
  },
  preferences: {
    get: getNotificationPreferences,
    upsert: upsertNotificationPreference,
  },
  readerFilters: {
    list: listReaderFilters,
    save: saveReaderFilter,
    delete: deleteReaderFilter,
  },
  articleStates: {
    list: listArticleStates,
    upsert: upsertArticleState,
    upsertMany: upsertArticleStates,
  },
  merge: {
    mergeAnonymousData: mergeAnonymousUserData,
  },
  notifications: {
    list: listNotifications,
    markRead: markNotificationRead,
    dismiss: dismissNotification,
  },
};
