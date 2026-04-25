import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBackend } from "@/lib/backend";

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/backend", async () => {
  const actual = await vi.importActual<typeof import("@/lib/backend")>("@/lib/backend");

  return {
    ...actual,
    fetchBackend: vi.fn(),
  };
});

import { PATCH } from "./route";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

function createRequest(url: string, body: Record<string, unknown>): NextRequest {
  const request = new Request(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  Object.defineProperty(request, "nextUrl", {
    value: new URL(url),
  });

  return request as NextRequest;
}

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => {
    vi.mocked(fetchBackend).mockReset();
  });

  it("rejects notification updates without a valid user identity", async () => {
    const response = await PATCH(
      createRequest("http://localhost/api/notifications/42", { action: "mark_read" }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid user_id",
    });
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it("forwards the resolved query user identity to the backend mutation", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ success: true });

    const response = await PATCH(
      createRequest(`http://localhost/api/notifications/42?user_id=${VALID_USER_ID}`, {
        action: "dismiss",
      }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(fetchBackend).toHaveBeenCalledWith("/storage/notifications/42/dismiss", {
      method: "PATCH",
      params: {
        user_id: VALID_USER_ID,
      },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      notification_id: 42,
      action: "dismiss",
    });
  });

  it("forwards the resolved body user identity to the backend mutation", async () => {
    vi.mocked(fetchBackend).mockResolvedValue({ success: true });

    await PATCH(
      createRequest("http://localhost/api/notifications/7", {
        action: "mark_read",
        user_id: VALID_USER_ID,
      }),
      { params: Promise.resolve({ id: "7" }) },
    );

    expect(fetchBackend).toHaveBeenCalledWith("/storage/notifications/7/mark_read", {
      method: "PATCH",
      params: {
        user_id: VALID_USER_ID,
      },
    });
  });
});
