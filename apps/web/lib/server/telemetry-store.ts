import "server-only";

import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { ApiTelemetryEvent } from "@/lib/telemetry";
import { assertDbConfigured } from "@/lib/server/db";
import {
  normalizeUsageEvent,
  type UsageEventInput,
  type UsageEventRecord,
} from "@/lib/server/usage-events";

let tablesReady: Promise<void> | null = null;

async function bootstrapTelemetryTables(sql: NeonQueryFunction<false, false>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS usage_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      schema_version TEXT NOT NULL DEFAULT 'usage-event-v1',
      event_name TEXT NOT NULL,
      surface TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT,
      request_id TEXT,
      properties JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_usage_events_event_name
    ON usage_events (event_name)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_usage_events_surface
    ON usage_events (surface)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_usage_events_user_id
    ON usage_events (user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_usage_events_session_id
    ON usage_events (session_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_usage_events_occurred_at
    ON usage_events (occurred_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS api_request_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      route_key TEXT NOT NULL,
      pathname TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      duration_ms DOUBLE PRECISION NOT NULL,
      cache_control TEXT,
      backend_target TEXT,
      error_code TEXT,
      error_message TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      admin_session_present BOOLEAN NOT NULL DEFAULT FALSE,
      query_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
      source TEXT NOT NULL,
      ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_api_request_logs_route_key
    ON api_request_logs (route_key)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_api_request_logs_timestamp
    ON api_request_logs (timestamp)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_api_request_logs_request_id
    ON api_request_logs (request_id)
  `;
}

async function ensureTelemetryTables(sql: NeonQueryFunction<false, false>): Promise<void> {
  if (!tablesReady) {
    tablesReady = bootstrapTelemetryTables(sql);
  }

  await tablesReady;
}

export async function recordUsageEvent(input: UsageEventInput): Promise<UsageEventRecord> {
  const sql = assertDbConfigured();
  await ensureTelemetryTables(sql);

  const record = normalizeUsageEvent(input);

  await sql`
    INSERT INTO usage_events (
      schema_version,
      event_name,
      surface,
      user_id,
      session_id,
      request_id,
      properties,
      occurred_at
    )
    VALUES (
      ${record.schemaVersion},
      ${record.eventName},
      ${record.surface},
      ${record.userId},
      ${record.sessionId},
      ${record.requestId},
      ${JSON.stringify(record.properties)}::jsonb,
      ${record.occurredAt}
    )
  `;

  return record;
}

export async function recordApiRequestLog(event: ApiTelemetryEvent): Promise<void> {
  const sql = assertDbConfigured();
  await ensureTelemetryTables(sql);

  await sql`
    INSERT INTO api_request_logs (
      request_id,
      timestamp,
      route_key,
      pathname,
      method,
      status_code,
      duration_ms,
      cache_control,
      backend_target,
      error_code,
      error_message,
      user_agent,
      ip_hash,
      admin_session_present,
      query_keys,
      source
    )
    VALUES (
      ${event.requestId},
      ${event.timestamp},
      ${event.routeKey},
      ${event.pathname},
      ${event.method},
      ${event.statusCode},
      ${event.durationMs},
      ${event.cacheControl},
      ${event.backendTarget},
      ${event.errorCode},
      ${event.errorMessage},
      ${event.userAgent},
      ${event.ipHash},
      ${event.adminSessionPresent},
      ${JSON.stringify(event.queryKeys)}::jsonb,
      ${event.source}
    )
  `;
}

/** @internal Resets inline bootstrap state between Vitest cases. */
export function resetTelemetryStoreForTests(): void {
  tablesReady = null;
}
