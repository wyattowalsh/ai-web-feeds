import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

const { sqlMock, resolveUserIdentityMock } = vi.hoisted(() => ({
  sqlMock: vi.fn().mockResolvedValue([]),
  resolveUserIdentityMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/server/db", () => ({
  assertDbConfigured: vi.fn(() => sqlMock),
  DatabaseNotConfiguredError: class DatabaseNotConfiguredError extends Error {
    name = "DatabaseNotConfiguredError";
  },
}));

vi.mock("@/lib/user-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-auth")>("@/lib/user-auth");
  return {
    ...actual,
    resolveUserIdentity: resolveUserIdentityMock,
  };
});

import { assertDbConfigured, DatabaseNotConfiguredError } from "@/lib/server/db";
import { resetRateLimitForTests } from "@/lib/server/rate-limit";
import { resetTelemetryStoreForTests } from "@/lib/server/telemetry-store";
import { USAGE_EVENT_SCHEMA_VERSION } from "@/lib/server/usage-events";
import { POST } from "./route";

function createPostRequest(body: unknown): Request {
  return new Request("http://localhost/api/telemetry/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function usageEventsInsertCall(): unknown[] | undefined {
  return sqlMock.mock.calls.find(([strings]) =>
    (strings as TemplateStringsArray).join(" ").includes("INSERT INTO usage_events"),
  );
}

describe("POST /api/telemetry/events", () => {
  beforeEach(() => {
    sqlMock.mockClear();
    resolveUserIdentityMock.mockReset();
    resetTelemetryStoreForTests();
    resetRateLimitForTests();
    resolveUserIdentityMock.mockResolvedValue({
      identity: {
        user_id: VALID_USER_ID,
        source: "client",
      },
      shouldBindCookie: false,
    });
  });

  it("accepts a client event batch and persists rows via Neon sql", async () => {
    const response = await POST(
      createPostRequest({
        events: [
          {
            eventName: "reader.filter.apply",
            surface: "reader",
            sessionId: "session-telemetry-1",
            properties: { topic: "llm" },
            occurredAt: "2026-06-25T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ accepted: 1 });
    expect(resolveUserIdentityMock).toHaveBeenCalledTimes(1);

    const insertCall = usageEventsInsertCall();
    expect(insertCall).toBeDefined();

    const [, schemaVersion, eventName, surface, userId, sessionId, , propertiesJson, occurredAt] =
      insertCall as [
        TemplateStringsArray,
        string,
        string,
        string,
        string,
        string,
        string | null,
        string,
        string,
      ];

    expect(schemaVersion).toBe(USAGE_EVENT_SCHEMA_VERSION);
    expect(eventName).toBe("reader.filter.apply");
    expect(surface).toBe("reader");
    expect(userId).toBe(VALID_USER_ID);
    expect(sessionId).toBe("session-telemetry-1");
    expect(JSON.parse(propertiesJson)).toEqual({ topic: "llm" });
    expect(occurredAt).toBe("2026-06-25T12:00:00.000Z");
  });

  it("does not bind anonymous identity as user_id", async () => {
    resolveUserIdentityMock.mockResolvedValue({
      identity: {
        user_id: "anon-user",
        source: "anonymous",
      },
      shouldBindCookie: false,
    });

    await POST(
      createPostRequest({
        events: [
          {
            eventName: "search.query.submit",
            surface: "search",
            sessionId: "anon-session",
          },
        ],
      }),
    );

    const insertCall = usageEventsInsertCall();
    expect(insertCall).toBeDefined();
    const userId = (insertCall as unknown[])[4];
    expect(userId).toBeNull();
  });

  it("ignores spoofed userId for session-bound identity", async () => {
    resolveUserIdentityMock.mockResolvedValue({
      identity: {
        user_id: VALID_USER_ID,
        source: "session",
      },
      shouldBindCookie: false,
    });

    await POST(
      createPostRequest({
        events: [
          {
            eventName: "reader.filter.apply",
            surface: "reader",
            userId: "99999999-9999-4999-8999-999999999999",
          },
        ],
      }),
    );

    const insertCall = usageEventsInsertCall();
    expect(insertCall).toBeDefined();
    const userId = (insertCall as unknown[])[4];
    expect(userId).toBe(VALID_USER_ID);
  });

  it("does not persist client-supplied userId for anonymous identity", async () => {
    resolveUserIdentityMock.mockResolvedValue({
      identity: {
        user_id: "anon-user",
        source: "anonymous",
      },
      shouldBindCookie: false,
    });

    await POST(
      createPostRequest({
        events: [
          {
            eventName: "search.query.submit",
            surface: "search",
            userId: VALID_USER_ID,
          },
        ],
      }),
    );

    const insertCall = usageEventsInsertCall();
    expect(insertCall).toBeDefined();
    const userId = (insertCall as unknown[])[4];
    expect(userId).toBeNull();
  });

  it("returns 400 for invalid payloads", async () => {
    const response = await POST(
      createPostRequest({
        events: [{ eventName: "bad.event", surface: "not-a-surface" }],
      }),
    );

    expect(response.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("returns 429 when ingest rate limit is exceeded", async () => {
    for (let index = 0; index < 60; index += 1) {
      const response = await POST(
        createPostRequest({
          events: [{ eventName: "reader.filter.apply", surface: "reader" }],
        }),
      );
      expect(response.status).toBe(202);
    }

    const limited = await POST(
      createPostRequest({
        events: [{ eventName: "reader.filter.apply", surface: "reader" }],
      }),
    );

    expect(limited.status).toBe(429);
  });

  it("returns 503 when DATABASE_URL is not configured", async () => {
    vi.mocked(assertDbConfigured).mockImplementationOnce(() => {
      throw new DatabaseNotConfiguredError();
    });

    const response = await POST(
      createPostRequest({
        events: [
          {
            eventName: "reader.article.open",
            surface: "reader",
          },
        ],
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Telemetry persistence is not configured",
    });
  });
});
