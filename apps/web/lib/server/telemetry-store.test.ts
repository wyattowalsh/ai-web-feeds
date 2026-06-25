import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiTelemetryEvent } from "@/lib/telemetry";
import { USAGE_EVENT_SCHEMA_VERSION } from "@/lib/server/usage-events";

const sqlMock = vi.fn().mockResolvedValue([]);

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/db", () => ({
  assertDbConfigured: vi.fn(() => sqlMock),
  DatabaseNotConfiguredError: class DatabaseNotConfiguredError extends Error {
    name = "DatabaseNotConfiguredError";
  },
}));

import {
  recordApiRequestLog,
  recordUsageEvent,
  resetTelemetryStoreForTests,
} from "@/lib/server/telemetry-store";

function usageEventsInsertCall(): unknown[] | undefined {
  return sqlMock.mock.calls.find(([strings]) =>
    (strings as TemplateStringsArray).join(" ").includes("INSERT INTO usage_events"),
  );
}

const sampleApiEvent: ApiTelemetryEvent = {
  requestId: "req-1",
  timestamp: "2026-06-25T12:00:00.000Z",
  routeKey: "search.query",
  pathname: "/api/search",
  method: "GET",
  statusCode: 200,
  durationMs: 12.5,
  cacheControl: "private, no-store",
  backendTarget: null,
  errorCode: null,
  errorMessage: null,
  userAgent: "vitest",
  ipHash: "abc123",
  adminSessionPresent: false,
  queryKeys: ["q", "scope"],
  source: "next-route-handler",
};

describe("telemetry-store", () => {
  beforeEach(() => {
    sqlMock.mockClear();
    resetTelemetryStoreForTests();
  });

  it("bootstraps tables and inserts a normalized usage event", async () => {
    const record = await recordUsageEvent({
      eventName: "reader.filter.apply",
      surface: "reader",
      sessionId: "session-1",
      properties: { topic: "llm" },
      occurredAt: "2026-06-25T12:00:00.000Z",
    });

    expect(record.schemaVersion).toBe(USAGE_EVENT_SCHEMA_VERSION);
    expect(record.eventName).toBe("reader.filter.apply");
    expect(sqlMock).toHaveBeenCalled();

    const sqlCalls = sqlMock.mock.calls.map(([strings]) => strings.join(" "));
    expect(
      sqlCalls.some((query) => query.includes("CREATE TABLE IF NOT EXISTS usage_events")),
    ).toBe(true);
    expect(sqlCalls.some((query) => query.includes("INSERT INTO usage_events"))).toBe(true);
  });

  it("passes normalized usage event fields to the Neon INSERT template", async () => {
    await recordUsageEvent({
      eventName: "reader.filter.apply",
      surface: "reader",
      userId: "user-telemetry-1",
      sessionId: "session-1",
      requestId: "req-telemetry-1",
      properties: { topic: "llm" },
      occurredAt: "2026-06-25T12:00:00.000Z",
    });

    const insertCall = usageEventsInsertCall();
    expect(insertCall).toBeDefined();

    const [
      ,
      schemaVersion,
      eventName,
      surface,
      userId,
      sessionId,
      requestId,
      propertiesJson,
      occurredAt,
    ] = insertCall as [
      TemplateStringsArray,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];

    expect(schemaVersion).toBe(USAGE_EVENT_SCHEMA_VERSION);
    expect(eventName).toBe("reader.filter.apply");
    expect(surface).toBe("reader");
    expect(userId).toBe("user-telemetry-1");
    expect(sessionId).toBe("session-1");
    expect(requestId).toBe("req-telemetry-1");
    expect(JSON.parse(propertiesJson)).toEqual({ topic: "llm" });
    expect(occurredAt).toBe("2026-06-25T12:00:00.000Z");
  });

  it("bootstraps api_request_logs and inserts route telemetry", async () => {
    await recordApiRequestLog(sampleApiEvent);

    const sqlCalls = sqlMock.mock.calls.map(([strings]) => strings.join(" "));
    expect(
      sqlCalls.some((query) => query.includes("CREATE TABLE IF NOT EXISTS api_request_logs")),
    ).toBe(true);
    expect(sqlCalls.some((query) => query.includes("INSERT INTO api_request_logs"))).toBe(true);
  });

  it("reuses bootstrap work across writers", async () => {
    await recordUsageEvent({
      eventName: "reader.article.open",
      surface: "reader",
    });
    await recordApiRequestLog(sampleApiEvent);

    const createTableCalls = sqlMock.mock.calls
      .map(([strings]) => strings.join(" "))
      .filter((query) => query.includes("CREATE TABLE IF NOT EXISTS"));

    expect(createTableCalls).toHaveLength(2);
  });
});
