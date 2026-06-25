/** Product analytics event contracts (Track C / migration 014). */

export const USAGE_EVENT_SCHEMA_VERSION = "usage-event-v1" as const;

export type EventSurface = "reader" | "search" | "api" | "auth" | "sync" | "admin";

export type UsageEventInput = {
  eventName: string;
  surface: EventSurface;
  userId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  properties?: Record<string, unknown>;
  occurredAt?: string;
};

export type UsageEventRecord = UsageEventInput & {
  schemaVersion: typeof USAGE_EVENT_SCHEMA_VERSION;
};

export function normalizeUsageEvent(input: UsageEventInput): UsageEventRecord {
  return {
    schemaVersion: USAGE_EVENT_SCHEMA_VERSION,
    eventName: input.eventName,
    surface: input.surface,
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    requestId: input.requestId ?? null,
    properties: input.properties ?? {},
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}
