import { describe, expect, it } from "vitest";
import { normalizeUsageEvent, USAGE_EVENT_SCHEMA_VERSION } from "@/lib/server/usage-events";

describe("normalizeUsageEvent", () => {
  it("applies schema version and defaults", () => {
    const event = normalizeUsageEvent({
      eventName: "reader.filter.apply",
      surface: "reader",
      properties: { topic: "llm" },
    });

    expect(event.schemaVersion).toBe(USAGE_EVENT_SCHEMA_VERSION);
    expect(event.userId).toBeNull();
    expect(event.sessionId).toBeNull();
    expect(event.properties).toEqual({ topic: "llm" });
    expect(event.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
