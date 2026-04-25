import "server-only";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getTelemetryDirectory, getTelemetrySalt } from "@/lib/server-env";

if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
  throw new Error("lib/telemetry.ts is server-only");
}

export type ApiTelemetryEvent = {
  requestId: string;
  timestamp: string;
  routeKey: string;
  pathname: string;
  method: string;
  statusCode: number;
  durationMs: number;
  cacheControl: string | null;
  backendTarget: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  userAgent: string | null;
  ipHash: string | null;
  adminSessionPresent: boolean;
  queryKeys: string[];
  source: "next-route-handler";
};

export type AdminAuditEvent = {
  timestamp: string;
  action: string;
  outcome: "success" | "failure";
  ipHash: string | null;
  detail: string | null;
  requestId: string | null;
};

export type TelemetryRouteSummary = {
  routeKey: string;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  averageDurationMs: number;
  p95DurationMs: number;
  lastSeenAt: string;
};

export type TelemetrySummary = {
  windowHours: number;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  averageDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  routeCount: number;
  lastIngestedAt: string | null;
  statusCounts: Record<string, number>;
  routeBreakdown: TelemetryRouteSummary[];
  recentErrors: ApiTelemetryEvent[];
  auditEvents: AdminAuditEvent[];
};

export type TelemetryStore = {
  recordApiTelemetry(event: ApiTelemetryEvent): Promise<void>;
  recordAdminAudit(event: AdminAuditEvent): Promise<void>;
  listApiTelemetryEvents(options?: {
    limit?: number;
    routeKey?: string;
    status?: "error" | "success";
    windowHours?: number;
  }): Promise<ApiTelemetryEvent[]>;
  listAdminAuditEvents(limit?: number): Promise<AdminAuditEvent[]>;
  getApiTelemetrySummary(windowHours?: number): Promise<TelemetrySummary>;
};

const API_EVENTS_FILE = "api-events.ndjson";
const ADMIN_AUDIT_FILE = "admin-audit.ndjson";

function resolveTelemetryDir(): string {
  return getTelemetryDirectory();
}

function getApiEventsFile(): string {
  return resolveTelemetryDir() + `/${API_EVENTS_FILE}`;
}

function getAdminAuditFile(): string {
  return resolveTelemetryDir() + `/${ADMIN_AUDIT_FILE}`;
}

async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function appendJsonLine<T>(filePath: string, value: T): Promise<void> {
  await ensureParentDir(filePath);
  await appendFile(filePath, `${JSON.stringify(value)}\n`, "utf-8");
}

async function readJsonLines<T>(filePath: string): Promise<T[]> {
  try {
    const content = await readFile(filePath, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

function toMilliseconds(windowHours: number): number {
  return windowHours * 60 * 60 * 1000;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

export function redactErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(password|token|secret)=([^\s&]+)/gi, "$1=[redacted]")
    .replace(/authorization:\s*bearer\s+[^\s]+/gi, "authorization: bearer [redacted]")
    .slice(0, 240);
}

export function extractClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip");
}

export function hashClientIp(ipAddress: string | null): string | null {
  if (!ipAddress) {
    return null;
  }

  const salt =
    process.env.AIWF_TELEMETRY_SALT?.trim() ||
    process.env.AIWF_ADMIN_SESSION_SECRET?.trim() ||
    "aiwf-dev-salt";

  return createHash("sha256").update(`${salt}:${ipAddress}`).digest("hex").slice(0, 16);
}

export async function recordApiTelemetry(event: ApiTelemetryEvent): Promise<void> {
  await appendJsonLine(getApiEventsFile(), event);
}

export async function recordAdminAudit(event: AdminAuditEvent): Promise<void> {
  await appendJsonLine(getAdminAuditFile(), event);
}

export async function listApiTelemetryEvents(options?: {
  limit?: number;
  routeKey?: string;
  status?: "error" | "success";
  windowHours?: number;
}): Promise<ApiTelemetryEvent[]> {
  const windowHours = options?.windowHours ?? 24;
  const cutoff = Date.now() - toMilliseconds(windowHours);
  const limit = options?.limit ?? 50;
  const events = await readJsonLines<ApiTelemetryEvent>(getApiEventsFile());

  return events
    .filter((event) => {
      if (Date.parse(event.timestamp) < cutoff) {
        return false;
      }

      if (options?.routeKey && event.routeKey !== options.routeKey) {
        return false;
      }

      if (options?.status === "error") {
        return event.statusCode >= 500;
      }

      if (options?.status === "success") {
        return event.statusCode < 500;
      }

      return true;
    })
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, limit);
}

export async function listAdminAuditEvents(limit = 25): Promise<AdminAuditEvent[]> {
  const events = await readJsonLines<AdminAuditEvent>(getAdminAuditFile());
  return events
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, limit);
}

export async function getApiTelemetrySummary(windowHours = 24): Promise<TelemetrySummary> {
  const events = await listApiTelemetryEvents({ limit: Number.MAX_SAFE_INTEGER, windowHours });
  const durations = events.map((event) => event.durationMs);
  const errorEvents = events.filter((event) => event.statusCode >= 500);
  const routeMap = new Map<string, ApiTelemetryEvent[]>();
  const statusCounts = events.reduce<Record<string, number>>((accumulator, event) => {
    const key = String(event.statusCode);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  for (const event of events) {
    const group = routeMap.get(event.routeKey) ?? [];
    group.push(event);
    routeMap.set(event.routeKey, group);
  }

  const routeBreakdown = [...routeMap.entries()]
    .map(([routeKey, routeEvents]) => {
      const routeDurations = routeEvents.map((event) => event.durationMs);
      const routeErrors = routeEvents.filter((event) => event.statusCode >= 500).length;
      const sortedByTime = [...routeEvents].sort(
        (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
      );

      return {
        routeKey,
        requestCount: routeEvents.length,
        errorCount: routeErrors,
        errorRate: routeEvents.length > 0 ? routeErrors / routeEvents.length : 0,
        averageDurationMs:
          routeDurations.length > 0
            ? routeDurations.reduce((sum, value) => sum + value, 0) / routeDurations.length
            : 0,
        p95DurationMs: percentile(routeDurations, 0.95),
        lastSeenAt: sortedByTime[0]?.timestamp ?? new Date(0).toISOString(),
      } satisfies TelemetryRouteSummary;
    })
    .sort((left, right) => right.requestCount - left.requestCount)
    .slice(0, 12);

  const auditEvents = await listAdminAuditEvents(10);

  return {
    windowHours,
    requestCount: events.length,
    errorCount: errorEvents.length,
    errorRate: events.length > 0 ? errorEvents.length / events.length : 0,
    averageDurationMs:
      durations.length > 0
        ? durations.reduce((sum, value) => sum + value, 0) / durations.length
        : 0,
    p50DurationMs: percentile(durations, 0.5),
    p95DurationMs: percentile(durations, 0.95),
    routeCount: routeMap.size,
    lastIngestedAt: events[0]?.timestamp ?? null,
    statusCounts,
    routeBreakdown,
    recentErrors: errorEvents.slice(0, 12),
    auditEvents,
  };
}
