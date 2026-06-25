import {
  normalizeSavedReaderFilterPayload,
  type SavedReaderFilterPayload,
} from "@/lib/server/contracts/reader-filter";

import type {
  DeliveryMethod,
  NotificationFrequency,
  NotificationPreferenceRecord,
  NotificationRecord,
  NotificationType,
  SavedReaderFilterRecord,
  SavedSearchRecord,
  UserSourceFollowRecord,
} from "./types";

const DELIVERY_METHODS = new Set<DeliveryMethod>(["websocket", "email", "in_app"]);
const FREQUENCIES = new Set<NotificationFrequency>(["instant", "hourly", "daily", "weekly", "off"]);
const NOTIFICATION_TYPES = new Set<NotificationType>([
  "new_article",
  "trending_topic",
  "feed_updated",
  "system_alert",
]);

export function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return new Date(0).toISOString();
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

export function normalizeDeliveryMethod(value: unknown): DeliveryMethod {
  const normalized = String(value ?? "in_app").toLowerCase() as DeliveryMethod;
  return DELIVERY_METHODS.has(normalized) ? normalized : "in_app";
}

export function normalizeFrequency(value: unknown): NotificationFrequency {
  const normalized = String(value ?? "daily").toLowerCase() as NotificationFrequency;
  return FREQUENCIES.has(normalized) ? normalized : "daily";
}

export function normalizeNotificationType(value: unknown): NotificationType {
  const normalized = String(value ?? "system_alert").toLowerCase() as NotificationType;
  return NOTIFICATION_TYPES.has(normalized) ? normalized : "system_alert";
}

export function toPgEnumLabel(value: string): string {
  return value.toUpperCase();
}

export function mapSavedSearchRow(row: Record<string, unknown>): SavedSearchRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    search_name: String(row.search_name),
    query_text: String(row.query_text),
    filters: parseJsonObject(row.filters),
    created_at: toIsoString(row.created_at),
    last_used_at: toIsoString(row.last_used_at),
    use_count: typeof row.use_count === "number" ? row.use_count : undefined,
    pinned: typeof row.pinned === "boolean" ? row.pinned : undefined,
    is_default: typeof row.is_default === "boolean" ? row.is_default : undefined,
  };
}

export function mapUserSourceFollowRow(row: Record<string, unknown>): UserSourceFollowRecord {
  return {
    id: Number(row.id),
    user_id: String(row.user_id),
    source_id: String(row.source_id),
    followed_at: toIsoString(row.followed_at),
  };
}

export function mapNotificationRow(row: Record<string, unknown>): NotificationRecord {
  return {
    id: Number(row.id),
    user_id: String(row.user_id),
    type: normalizeNotificationType(row.type),
    title: String(row.title),
    message: String(row.message),
    action_url: row.action_url == null ? null : String(row.action_url),
    context_data: parseJsonObject(row.context_data),
    read_at: row.read_at == null ? null : toIsoString(row.read_at),
    dismissed_at: row.dismissed_at == null ? null : toIsoString(row.dismissed_at),
    created_at: toIsoString(row.created_at),
  };
}

export function mapNotificationPreferenceRow(
  row: Record<string, unknown>,
): NotificationPreferenceRecord {
  return {
    id: Number(row.id),
    user_id: String(row.user_id),
    feed_id: row.feed_id == null ? null : String(row.feed_id),
    delivery_method: normalizeDeliveryMethod(row.delivery_method),
    frequency: normalizeFrequency(row.frequency),
    quiet_hours_start: row.quiet_hours_start == null ? null : String(row.quiet_hours_start),
    quiet_hours_end: row.quiet_hours_end == null ? null : String(row.quiet_hours_end),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

export function mapSavedReaderFilterRow(row: Record<string, unknown>): SavedReaderFilterRecord {
  const payload = normalizeSavedReaderFilterPayload(
    parseJsonObject(row.payload) as Partial<SavedReaderFilterPayload>,
  );

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    filter_name: String(row.filter_name),
    payload,
    schema_version: String(row.schema_version ?? "reader-filter-v1"),
    use_count: typeof row.use_count === "number" ? row.use_count : 0,
    pinned: Boolean(row.pinned),
    is_default: Boolean(row.is_default),
    created_at: toIsoString(row.created_at),
    last_used_at: toIsoString(row.last_used_at),
  };
}
