import { describe, expect, it, vi, afterEach } from "vitest";
import type { UserIdentity } from "@/lib/user-auth";
import {
  ANON_USER_BINDING_COOKIE,
  ANON_USER_ID_RESPONSE_HEADER,
  applyUserIdentityBinding,
  getUserIdentity,
  resolveUserIdentity,
  validateTrustedUserOwnership,
} from "@/lib/user-auth";
import { NextResponse } from "next/server";

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

function createRequest(cookie?: string): Request {
  return new Request("http://localhost/api/test", {
    headers: cookie ? { cookie } : {},
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("user-auth anonymous binding", () => {
  it("mints a new binding cookie without trusting a client-supplied user_id", () => {
    vi.stubEnv("AIWF_ANON_BINDING_SECRET", "test-anon-binding-secret");

    const resolved = resolveUserIdentity(createRequest(), VALID_USER_ID);

    expect(resolved.identity.source).toBe("bootstrap");
    expect(resolved.identity.user_id).not.toBe(VALID_USER_ID);
    expect(resolved.identity.user_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(resolved.bindingCookieValue).toBeTruthy();
  });

  it("trusts signed binding cookie over client user_id", () => {
    vi.stubEnv("AIWF_ANON_BINDING_SECRET", "test-anon-binding-secret");

    const initial = resolveUserIdentity(createRequest());
    expect(initial.bindingCookieValue).toBeTruthy();
    const cookieHeader = `${ANON_USER_BINDING_COOKIE}=${initial.bindingCookieValue!}`;

    const identity = getUserIdentity(
      createRequest(cookieHeader),
      "22222222-2222-4222-8222-222222222222",
    );

    expect(identity).toEqual({
      user_id: initial.identity.user_id,
      source: "binding",
    });
  });

  it("rejects client-sourced identity for trusted ownership checks", () => {
    const identity: UserIdentity = {
      user_id: VALID_USER_ID,
      source: "client",
    };

    expect(validateTrustedUserOwnership(VALID_USER_ID, identity)).toBe(false);
  });

  it("stamps the resolved anonymous user id on the response headers", () => {
    vi.stubEnv("AIWF_ANON_BINDING_SECRET", "test-anon-binding-secret");

    const resolved = resolveUserIdentity(createRequest());
    const response = NextResponse.json({ ok: true });

    applyUserIdentityBinding(response, resolved);

    expect(response.headers.get(ANON_USER_ID_RESPONSE_HEADER)).toBe(resolved.identity.user_id);
    expect(response.headers.get("set-cookie")).toContain(ANON_USER_BINDING_COOKIE);
  });
});
