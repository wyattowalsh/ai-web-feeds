import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

const { resolveUserIdentityMock } = vi.hoisted(() => ({
  resolveUserIdentityMock: vi.fn(),
}));

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/user-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-auth")>("@/lib/user-auth");
  return {
    ...actual,
    resolveUserIdentity: resolveUserIdentityMock,
  };
});

import { ANON_USER_ID_RESPONSE_HEADER } from "@/lib/user-auth";
import { GET } from "./route";

describe("GET /api/identity", () => {
  beforeEach(() => {
    resolveUserIdentityMock.mockReset();
  });

  it("returns the resolved user_id", async () => {
    resolveUserIdentityMock.mockResolvedValue({
      identity: {
        user_id: VALID_USER_ID,
        source: "client",
      },
      shouldBindCookie: false,
    });

    const response = await GET(new Request("http://localhost/api/identity"));

    expect(response.status).toBe(200);
    expect(resolveUserIdentityMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ user_id: VALID_USER_ID });
    expect(response.headers.get(ANON_USER_ID_RESPONSE_HEADER)).toBe(VALID_USER_ID);
  });

  it("binds an anonymous cookie when requested", async () => {
    resolveUserIdentityMock.mockResolvedValue({
      identity: {
        user_id: VALID_USER_ID,
        source: "client",
      },
      shouldBindCookie: true,
    });

    const response = await GET(new Request("http://localhost/api/identity"));

    expect(response.headers.get("set-cookie")).toContain(`aiwf_anon_user_id=${VALID_USER_ID}`);
  });
});
