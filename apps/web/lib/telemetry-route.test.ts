import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.hoisted(() =>
  vi.fn((callback: () => Promise<void> | void) => {
    void callback();
  }),
);
const hashClientIpMock = vi.hoisted(() => vi.fn(() => "hashed-ip"));
const recordApiTelemetryMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const redactErrorMessageMock = vi.hoisted(() =>
  vi.fn((error: unknown) => (error instanceof Error ? error.message : String(error))),
);

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: afterMock,
  };
});

vi.mock("@/lib/telemetry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/telemetry")>("@/lib/telemetry");
  return {
    ...actual,
    hashClientIp: hashClientIpMock,
    recordApiTelemetry: recordApiTelemetryMock,
    redactErrorMessage: redactErrorMessageMock,
  };
});

import { withRouteTelemetry } from "@/lib/telemetry-route";

describe("withRouteTelemetry", () => {
  beforeEach(() => {
    afterMock.mockClear();
    hashClientIpMock.mockClear();
    recordApiTelemetryMock.mockClear();
    redactErrorMessageMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records request metadata for successful handlers", async () => {
    const handler = withRouteTelemetry("test.route", async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: {
          "Cache-Control": "private, no-cache",
        },
      });
    });

    const response = await handler(
      new Request("http://localhost/api/test?topic=ai", {
        headers: {
          "user-agent": "vitest",
          "x-request-id": "request-123",
          "x-forwarded-for": "127.0.0.1",
        },
      }),
    );

    expect(response.headers.get("x-request-id")).toBe("request-123");
    await vi.waitFor(() => {
      expect(hashClientIpMock).toHaveBeenCalledWith("127.0.0.1");
      expect(recordApiTelemetryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          routeKey: "test.route",
          statusCode: 201,
          cacheControl: "private, no-cache",
          queryKeys: ["topic"],
          userAgent: "vitest",
          ipHash: "hashed-ip",
        }),
      );
    });
  });

  it("records a redacted failure payload when the handler throws", async () => {
    const handler = withRouteTelemetry("test.route", async () => {
      throw new Error("token=secret");
    });

    const response = await handler(new Request("http://localhost/api/test"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
      request_id: expect.any(String),
    });
    await vi.waitFor(() => {
      expect(redactErrorMessageMock).toHaveBeenCalledWith(expect.any(Error));
      expect(recordApiTelemetryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          routeKey: "test.route",
          statusCode: 500,
          errorMessage: "token=secret",
        }),
      );
    });
  });
});
