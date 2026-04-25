import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BackendConfigurationError,
  BackendError,
  buildBackendUrl,
  clampNumber,
  formatBackendErrorResponse,
  getBackendUrl,
  validateUUID,
} from "@/lib/backend";

describe("backend helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads and trims the configured backend URL", () => {
    vi.stubEnv("BACKEND_URL", " https://backend.example.com/ ");

    expect(getBackendUrl()).toBe("https://backend.example.com");
  });

  it("builds backend URLs with query params", () => {
    vi.stubEnv("BACKEND_URL", "https://backend.example.com/");

    expect(buildBackendUrl("/search", { q: "agents", limit: 10, verified: false })).toBe(
      "https://backend.example.com/search?q=agents&limit=10&verified=false",
    );
  });

  it("formats backend errors without dropping the error code", () => {
    expect(
      formatBackendErrorResponse(
        new BackendError(422, "UNPROCESSABLE_ENTITY", "Threshold is invalid"),
      ),
    ).toEqual({
      error: "Threshold is invalid",
      code: "UNPROCESSABLE_ENTITY",
    });
  });

  it("throws a configuration error when the backend URL is missing", () => {
    expect(() => getBackendUrl()).toThrow(BackendConfigurationError);
  });

  it("keeps UUID validation and numeric clamping honest", () => {
    expect(validateUUID("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(validateUUID("not-a-uuid")).toBe(false);
    expect(clampNumber(42, 1, 10)).toBe(10);
    expect(clampNumber(-5, 1, 10)).toBe(1);
  });
});
