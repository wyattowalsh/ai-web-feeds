import { getStoredUserId } from "@/lib/user-identity";
import type { EventSurface, UsageEventInput } from "@/lib/server/usage-events";

export const TELEMETRY_SESSION_STORAGE_KEY = "aiwf_telemetry_session_id";
export const TELEMETRY_EVENTS_ENDPOINT = "/api/telemetry/events";

export type TrackEventOptions = {
  surface: EventSurface;
  properties?: Record<string, unknown>;
  userId?: string | null;
  requestId?: string | null;
  occurredAt?: string;
};

function canUseSessionStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.sessionStorage?.getItem === "function" &&
    typeof window.sessionStorage?.setItem === "function"
  );
}

export function getTelemetrySessionId(): string | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  const existing = window.sessionStorage.getItem(TELEMETRY_SESSION_STORAGE_KEY)?.trim();
  if (existing) {
    return existing;
  }

  const sessionId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `session-${Date.now()}`;

  window.sessionStorage.setItem(TELEMETRY_SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

function buildUsageEventPayload(eventName: string, options: TrackEventOptions): UsageEventInput {
  const userId = options.userId ?? getStoredUserId();

  return {
    eventName,
    surface: options.surface,
    userId,
    sessionId: getTelemetrySessionId(),
    requestId: options.requestId ?? null,
    properties: options.properties ?? {},
    occurredAt: options.occurredAt,
  };
}

export async function trackEvent(eventName: string, options: TrackEventOptions): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const payload = {
    events: [buildUsageEventPayload(eventName, options)],
  };

  try {
    await fetch(TELEMETRY_EVENTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Analytics must never break reader/search UX.
  }
}
