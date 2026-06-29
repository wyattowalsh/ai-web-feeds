import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { recordUsageEvent } from "@/lib/server/telemetry-store";
import { type EventSurface, type UsageEventInput } from "@/lib/server/usage-events";
import { checkRateLimit, getClientRateLimitKey } from "@/lib/server/rate-limit";
import { resolveUserIdentity } from "@/lib/user-auth";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BATCH_SIZE = 25;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

const VALID_SURFACES = new Set<EventSurface>(["reader", "search", "api", "auth", "sync", "admin"]);

function parseUsageEventInput(raw: unknown): UsageEventInput | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const eventName = typeof candidate.eventName === "string" ? candidate.eventName.trim() : "";
  const surface = typeof candidate.surface === "string" ? candidate.surface.trim() : "";

  if (!eventName || !VALID_SURFACES.has(surface as EventSurface)) {
    return null;
  }

  return {
    eventName,
    surface: surface as EventSurface,
    userId: typeof candidate.userId === "string" ? candidate.userId : undefined,
    sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined,
    requestId: typeof candidate.requestId === "string" ? candidate.requestId : undefined,
    properties:
      candidate.properties &&
      typeof candidate.properties === "object" &&
      !Array.isArray(candidate.properties)
        ? (candidate.properties as Record<string, unknown>)
        : undefined,
    occurredAt: typeof candidate.occurredAt === "string" ? candidate.occurredAt : undefined,
  };
}

const POSTHandler = async (request: Request) => {
  const rateLimit = checkRateLimit(
    `telemetry.events:${getClientRateLimitKey(request)}`,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Telemetry ingest rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
        },
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const rawEvents = (body as { events?: unknown }).events;
  if (!Array.isArray(rawEvents)) {
    return NextResponse.json({ error: 'Body must include an "events" array' }, { status: 400 });
  }

  if (rawEvents.length === 0) {
    return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
  }

  if (rawEvents.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Batch size exceeds limit of ${MAX_BATCH_SIZE}` },
      { status: 400 },
    );
  }

  const parsedEvents: UsageEventInput[] = [];
  for (const rawEvent of rawEvents) {
    const parsed = parseUsageEventInput(rawEvent);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
    }
    parsedEvents.push(parsed);
  }

  const resolvedIdentity = await resolveUserIdentity(request);
  const boundUserId =
    resolvedIdentity.identity.source === "anonymous" ? null : resolvedIdentity.identity.user_id;

  try {
    const records = await Promise.all(
      parsedEvents.map((event) =>
        recordUsageEvent({
          ...event,
          userId: boundUserId,
        }),
      ),
    );

    return NextResponse.json(
      {
        accepted: records.length,
      },
      {
        status: 202,
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return NextResponse.json(
        { error: "Telemetry persistence is not configured" },
        { status: 503 },
      );
    }

    throw error;
  }
};

export const POST = withRouteTelemetry("telemetry.events.ingest", POSTHandler);
