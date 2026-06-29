import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSocialProviders } from "./auth";

describe("buildSocialProviders", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("omits providers when credentials are missing", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    expect(buildSocialProviders()).toEqual({});
  });

  it("registers google only when both client id and secret are set", () => {
    process.env.GOOGLE_CLIENT_ID = "google-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-credential"; // pragma: allowlist secret
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    expect(buildSocialProviders()).toEqual({
      google: { clientId: "google-id", clientSecret: "google-credential" }, // pragma: allowlist secret
    });
  });
});
