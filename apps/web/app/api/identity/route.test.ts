import { describe, expect, it, vi } from "vitest";
import { ANON_USER_BINDING_COOKIE, ANON_USER_ID_RESPONSE_HEADER } from "@/lib/user-auth";

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

import { GET } from "./route";

describe("GET /api/identity", () => {
  it("mints an anonymous binding and returns the scoped user id", async () => {
    const response = await GET(new Request("http://localhost/api/identity"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
    expect(response.headers.get(ANON_USER_ID_RESPONSE_HEADER)).toBe(payload.user_id);
    expect(payload).toEqual({
      user_id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      source: "bootstrap",
    });
  });
});
