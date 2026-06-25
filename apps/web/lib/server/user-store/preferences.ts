import { assertDbConfigured } from "@/lib/server/db";

import {
  mapNotificationPreferenceRow,
  normalizeDeliveryMethod,
  normalizeFrequency,
  toPgEnumLabel,
} from "./row-mappers";
import type { NotificationPreferenceRecord, UpsertNotificationPreferenceInput } from "./types";

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferenceRecord[]> {
  const sql = assertDbConfigured();
  const rows = await sql`
    SELECT
      id,
      user_id,
      feed_id,
      delivery_method,
      frequency,
      quiet_hours_start,
      quiet_hours_end,
      created_at,
      updated_at
    FROM notification_preferences
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;

  return rows.map((row) => mapNotificationPreferenceRow(row as Record<string, unknown>));
}

export async function upsertNotificationPreference(
  input: UpsertNotificationPreferenceInput,
): Promise<NotificationPreferenceRecord> {
  const sql = assertDbConfigured();
  const feedId = input.feed_id ?? null;
  const deliveryMethod = normalizeDeliveryMethod(input.delivery_method);
  const frequency = normalizeFrequency(input.frequency);
  const quietHoursStart = input.quiet_hours_start ?? null;
  const quietHoursEnd = input.quiet_hours_end ?? null;

  const existing = await sql`
    SELECT id
    FROM notification_preferences
    WHERE user_id = ${input.user_id}
      AND feed_id IS NOT DISTINCT FROM ${feedId}
      AND LOWER(delivery_method::text) = ${deliveryMethod}
    LIMIT 1
  `;

  const existingId = existing[0]?.id;
  if (existingId != null) {
    const rows = await sql`
      UPDATE notification_preferences
      SET
        frequency = ${toPgEnumLabel(frequency)}::notificationfrequency,
        quiet_hours_start = ${quietHoursStart},
        quiet_hours_end = ${quietHoursEnd},
        updated_at = NOW()
      WHERE id = ${existingId}
      RETURNING
        id,
        user_id,
        feed_id,
        delivery_method,
        frequency,
        quiet_hours_start,
        quiet_hours_end,
        created_at,
        updated_at
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to update notification preference");
    }

    return mapNotificationPreferenceRow(row as Record<string, unknown>);
  }

  const rows = await sql`
    INSERT INTO notification_preferences (
      user_id,
      feed_id,
      delivery_method,
      frequency,
      quiet_hours_start,
      quiet_hours_end,
      created_at,
      updated_at
    )
    VALUES (
      ${input.user_id},
      ${feedId},
      ${toPgEnumLabel(deliveryMethod)}::deliverymethod,
      ${toPgEnumLabel(frequency)}::notificationfrequency,
      ${quietHoursStart},
      ${quietHoursEnd},
      NOW(),
      NOW()
    )
    RETURNING
      id,
      user_id,
      feed_id,
      delivery_method,
      frequency,
      quiet_hours_start,
      quiet_hours_end,
      created_at,
      updated_at
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create notification preference");
  }

  return mapNotificationPreferenceRow(row as Record<string, unknown>);
}
