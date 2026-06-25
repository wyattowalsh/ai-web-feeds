import type { SavedReaderFilterPayload } from "@/lib/server/contracts/reader-filter";

export type DeliveryMethod = "websocket" | "email" | "in_app";
export type NotificationFrequency = "instant" | "hourly" | "daily" | "weekly" | "off";
export type NotificationType = "new_article" | "trending_topic" | "feed_updated" | "system_alert";

/** Mirrors `Notification` in packages/ai_web_feeds/models.py */
export type NotificationRecord = {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_url: string | null;
  context_data: Record<string, unknown>;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

/** Mirrors `SavedSearch` in packages/ai_web_feeds/models.py */
export type SavedSearchRecord = {
  id: string;
  user_id: string;
  search_name: string;
  query_text: string;
  filters: Record<string, unknown>;
  created_at: string;
  last_used_at: string;
  use_count?: number;
  pinned?: boolean;
  is_default?: boolean;
};

export type CreateSavedSearchInput = {
  user_id: string;
  search_name: string;
  query_text: string;
  filters?: Record<string, unknown>;
};

/** Mirrors `UserSourceFollow` in packages/ai_web_feeds/models.py */
export type UserSourceFollowRecord = {
  id: number;
  user_id: string;
  source_id: string;
  followed_at: string;
};

/** Mirrors `NotificationPreference` in packages/ai_web_feeds/models.py */
export type NotificationPreferenceRecord = {
  id: number;
  user_id: string;
  feed_id: string | null;
  delivery_method: DeliveryMethod;
  frequency: NotificationFrequency;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertNotificationPreferenceInput = {
  user_id: string;
  feed_id?: string | null;
  delivery_method: DeliveryMethod;
  frequency: NotificationFrequency;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
};

/** Mirrors planned `saved_reader_filters` table (Alembic 015 pending). */
export type SavedReaderFilterRecord = {
  id: string;
  user_id: string;
  filter_name: string;
  payload: SavedReaderFilterPayload;
  schema_version: string;
  use_count: number;
  pinned: boolean;
  is_default: boolean;
  created_at: string;
  last_used_at: string;
};

export type SaveReaderFilterInput = {
  user_id: string;
  filter_name: string;
  payload: SavedReaderFilterPayload;
  pinned?: boolean;
  is_default?: boolean;
};

export interface SavedSearchStore {
  list(userId: string): Promise<SavedSearchRecord[]>;
  create(input: CreateSavedSearchInput): Promise<SavedSearchRecord>;
  delete(userId: string, searchId: string): Promise<boolean>;
}

export interface FollowStore {
  list(userId: string): Promise<UserSourceFollowRecord[]>;
  follow(
    userId: string,
    sourceId: string,
  ): Promise<{
    follow: UserSourceFollowRecord;
    created: boolean;
  }>;
  unfollow(userId: string, sourceId: string): Promise<boolean>;
}

export interface PreferenceStore {
  get(userId: string): Promise<NotificationPreferenceRecord[]>;
  upsert(input: UpsertNotificationPreferenceInput): Promise<NotificationPreferenceRecord>;
}

export interface ReaderFilterStore {
  list(userId: string): Promise<SavedReaderFilterRecord[]>;
  save(input: SaveReaderFilterInput): Promise<SavedReaderFilterRecord>;
  delete(userId: string, filterId: string): Promise<boolean>;
}

/** Mirrors `user_article_states` with migration 015 engagement fields. */
export type UserArticleStateRecord = {
  id: string;
  user_id: string;
  article_key: string;
  article_id: number | null;
  read_at: string | null;
  saved_at: string | null;
  starred_at: string | null;
  archived_at: string | null;
  annotation_ids: string[];
  read_duration_ms: number | null;
  scroll_depth: number | null;
  opened_from: string | null;
  updated_at: string;
};

export type UpsertArticleStateInput = {
  user_id: string;
  article_key: string;
  read?: boolean;
  starred?: boolean;
  archived?: boolean;
  bookmarked?: boolean;
  read_duration_ms?: number | null;
  scroll_depth?: number | null;
  opened_from?: string | null;
};

export interface ArticleStateStore {
  list(
    userId: string,
    options?: { limit?: number; since?: string },
  ): Promise<UserArticleStateRecord[]>;
  upsert(input: UpsertArticleStateInput): Promise<UserArticleStateRecord>;
  upsertMany(
    userId: string,
    states: Array<Omit<UpsertArticleStateInput, "user_id">>,
  ): Promise<{ upserted: number; states: UserArticleStateRecord[] }>;
}

export type MergeUserDataInput = {
  from_user_id: string;
  to_user_id: string;
};

export type MergeUserDataResult = {
  from_user_id: string;
  to_user_id: string;
  merged: {
    reader_filters: number;
    article_states: number;
    saved_searches: number;
    follows: number;
    notification_preferences: number;
  };
};

export interface MergeStore {
  mergeAnonymousData(input: MergeUserDataInput): Promise<MergeUserDataResult>;
}

export interface NotificationStore {
  list(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ): Promise<NotificationRecord[]>;
  markRead(userId: string, notificationId: number): Promise<boolean>;
  dismiss(userId: string, notificationId: number): Promise<boolean>;
}

export interface UserStore {
  savedSearches: SavedSearchStore;
  follows: FollowStore;
  preferences: PreferenceStore;
  readerFilters: ReaderFilterStore;
  articleStates: ArticleStateStore;
  merge: MergeStore;
  notifications: NotificationStore;
}
