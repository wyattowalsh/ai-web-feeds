import "server-only";

import { assertDbConfigured } from "@/lib/server/db";

export type SyncEventInput = {
  user_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload?: Record<string, unknown>;
  client_updated_at?: string | null;
};

export type SyncEventRecord = {
  id: string;
  user_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  client_updated_at: string | null;
  server_received_at: string;
  applied_at: string | null;
};

function mapSyncEventRow(row: Record<string, unknown>): SyncEventRecord {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    event_type: String(row.event_type),
    entity_type: String(row.entity_type),
    entity_id: String(row.entity_id),
    payload,
    client_updated_at:
      row.client_updated_at instanceof Date
        ? row.client_updated_at.toISOString()
        : typeof row.client_updated_at === "string"
          ? row.client_updated_at
          : null,
    server_received_at:
      row.server_received_at instanceof Date
        ? row.server_received_at.toISOString()
        : typeof row.server_received_at === "string"
          ? row.server_received_at
          : new Date().toISOString(),
    applied_at:
      row.applied_at instanceof Date
        ? row.applied_at.toISOString()
        : typeof row.applied_at === "string"
          ? row.applied_at
          : null,
  };
}

export async function recordSyncEvent(input: SyncEventInput): Promise<SyncEventRecord> {
  const sql = assertDbConfigured();
  const payload = input.payload ?? {};

  const rows = await sql`
    INSERT INTO sync_events (
      id,
      user_id,
      event_type,
      entity_type,
      entity_id,
      payload,
      client_updated_at,
      server_received_at,
      applied_at
    )
    VALUES (
      gen_random_uuid(),
      ${input.user_id},
      ${input.event_type},
      ${input.entity_type},
      ${input.entity_id},
      ${JSON.stringify(payload)}::jsonb,
      ${input.client_updated_at ?? null},
      NOW(),
      NOW()
    )
    RETURNING
      id,
      user_id,
      event_type,
      entity_type,
      entity_id,
      payload,
      client_updated_at,
      server_received_at,
      applied_at
  `;

  return mapSyncEventRow(rows[0] as Record<string, unknown>);
}
