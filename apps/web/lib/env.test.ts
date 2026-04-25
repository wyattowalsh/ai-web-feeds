import { afterEach, describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";
import {
  getAnonymousBindingSecret,
  getRequiredBackendUrl,
  getSiteBaseUrl,
  getWebSocketServerUrl,
  isPdfExportEnabled,
} from "@/lib/env";
import { getTelemetryDirectory, getTelemetrySalt } from "@/lib/server-env";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("env helpers", () => {
  it("normalizes the public base URL", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", " https://docs.example.com/ ");

    expect(getSiteBaseUrl()).toBe("https://docs.example.com");
  });

  it("fails fast when BACKEND_URL is missing or invalid", () => {
    expect(() => getRequiredBackendUrl()).toThrow(/BACKEND_URL is required/);

    vi.stubEnv("BACKEND_URL", "not-a-url");

    expect(() => getRequiredBackendUrl()).toThrow(/BACKEND_URL must be a valid absolute URL/);
  });

  it("resolves websocket URLs from explicit, local, remote, and SSR contexts", () => {
    vi.stubEnv("NEXT_PUBLIC_WEBSOCKET_URL", " https://ws.example.com/socket/ ");
    expect(getWebSocketServerUrl()).toBe("https://ws.example.com/socket");

    vi.stubEnv("NEXT_PUBLIC_WEBSOCKET_URL", "");
    expect(getWebSocketServerUrl({ hostname: "localhost", origin: "http://localhost:3000" })).toBe(
      "http://localhost:8000",
    );
    expect(
      getWebSocketServerUrl({ hostname: "aiwebfeeds.com", origin: "https://aiwebfeeds.com" }),
    ).toBe("https://aiwebfeeds.com");
    expect(getWebSocketServerUrl(null)).toBe("http://localhost:8000");
  });

  it("supports pdf export flags and anonymous binding secret fallbacks", () => {
    vi.stubEnv("NEXT_PUBLIC_PDF_EXPORT", "true");
    vi.stubEnv("AIWF_ADMIN_SESSION_SECRET", "shared-admin-secret");

    expect(isPdfExportEnabled()).toBe(true);
    expect(getAnonymousBindingSecret()).toBe("shared-admin-secret");
  });

  it("requires an anonymous binding secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getAnonymousBindingSecret()).toThrow(
      /AIWF_ANON_BINDING_SECRET must be configured/,
    );
  });

  it("resolves telemetry defaults and salt authority", () => {
    vi.stubEnv("AIWF_ADMIN_SESSION_SECRET", "admin-secret");

    expect(getTelemetryDirectory()).toBe(resolve(process.cwd(), "../../data/telemetry"));
    expect(getTelemetrySalt()).toBe("admin-secret");

    vi.stubEnv("AIWF_TELEMETRY_DIR", "logs/telemetry");
    vi.stubEnv("AIWF_TELEMETRY_SALT", "explicit-telemetry-salt");

    expect(getTelemetryDirectory()).toBe(resolve(process.cwd(), "logs/telemetry"));
    expect(getTelemetrySalt()).toBe("explicit-telemetry-salt");
  });
});
