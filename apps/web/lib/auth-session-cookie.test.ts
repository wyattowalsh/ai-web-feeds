import { describe, expect, it } from "vitest";

import { hasBetterAuthSessionCookie } from "./auth-session-cookie";

describe("hasBetterAuthSessionCookie", () => {
  it.each([
    ["aiwf.session_token=signed", true],
    ["aiwf-session_token=signed", true],
    ["__Secure-aiwf.session_token=signed", true],
    ["__Secure-aiwf-session_token=signed", true],
    ["better-auth.session_token=legacy", true],
    ["better-auth-session_token=legacy", true],
    ["__Secure-better-auth.session_token=legacy", true],
    ["aiwf_session_token=wrong", false],
    ["session_token=plain", false],
    ["", false],
  ])("cookie %j -> %s", (cookie, expected) => {
    expect(hasBetterAuthSessionCookie(cookie || null)).toBe(expected);
  });

  it("returns false for null cookie header", () => {
    expect(hasBetterAuthSessionCookie(null)).toBe(false);
  });
});
