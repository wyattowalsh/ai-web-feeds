import { describe, expect, it } from "vitest";

import { POST } from "./route";

const DISABLED_BODY = {
  enabled: false,
  reason: "dashboard builder is not enabled",
};

const HANDLERS = { POST } as const;

describe("/api/visualizations/dashboards/[id]/widgets route", () => {
  it.each(Object.entries(HANDLERS))(
    "returns a disabled dashboard builder for %s",
    async (method, handler) => {
      const response = await handler(
        new Request("http://localhost/api/visualizations/dashboards/example/widgets", {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "demo" }),
        }),
      );

      expect(response.status).toBe(501);
      expect(response.status).not.toBe(200);
      await expect(response.json()).resolves.toEqual(DISABLED_BODY);
    },
  );
});
