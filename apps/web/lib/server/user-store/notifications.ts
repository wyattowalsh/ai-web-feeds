import { assertDbConfigured } from "@/lib/server/db";

import { mapNotificationRow } from "./row-mappers";
import type { NotificationRecord } from "./types";

export type ListNotificationsOptions = {
  unreadOnly?: boolean;
  limit?: number;
};

export async function listNotifications(
  userId: string,
  options: ListNotificationsOptions = {},
): Promise<NotificationRecord[]> {
  const sql = assertDbConfigured();
  const unreadOnly = options.unreadOnly ?? false;
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 1000);

  const rows = unreadOnly
    ? await sql`
        SELECT
          id,
          user_id,
          type,
          title,
          message,
          action_url,
          context_data,
          read_at,
          dismissed_at,
          created_at
        FROM notifications
        WHERE user_id = ${userId}
          AND read_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT
          id,
          user_id,
          type,
          title,
          message,
          action_url,
          context_data,
          read_at,
          dismissed_at,
          created_at
        FROM notifications
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

  return rows.map((row) => mapNotificationRow(row as Record<string, unknown>));
}

export async function markNotificationRead(
  userId: string,
  notificationId: number,
): Promise<boolean> {
  const sql = assertDbConfigured();
  const rows = await sql`
    UPDATE notifications
    SET read_at = NOW()
    WHERE id = ${notificationId}
      AND user_id = ${userId}
      AND read_at IS NULL
    RETURNING id
  `;

  return rows.length > 0;
}

export async function dismissNotification(
  userId: string,
  notificationId: number,
): Promise<boolean> {
  const sql = assertDbConfigured();
  const rows = await sql`
    UPDATE notifications
    SET dismissed_at = NOW()
    WHERE id = ${notificationId}
      AND user_id = ${userId}
      AND dismissed_at IS NULL
    RETURNING id
  `;

  return rows.length > 0;
}
