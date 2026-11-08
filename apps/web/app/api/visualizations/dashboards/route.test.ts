import { describe, expect, it } from "vitest";

import { GET, POST } from "./route";

const DISABLED_BODY = {
  enabled: false,
  reason: "dashboard builder is not enabled",
};

describe("/api/visualizations/dashboards route", () => {
  it("returns a disabled dashboard list for GET", async () => {
    const response = await GET(new Request("http://localhost/api/visualizations/dashboards"));

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual(DISABLED_BODY);
  });

  it("returns a disabled dashboard create for POST", async () => {
    const response = await POST(
      new Request("http://localhost/api/visualizations/dashboards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "demo" }),
      }),
    );

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual(DISABLED_BODY);
  });
});
