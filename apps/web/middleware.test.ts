import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { isMarkdownPreferredMock, rewriteLlmMock } = vi.hoisted(() => ({
  isMarkdownPreferredMock: vi.fn(),
  rewriteLlmMock: vi.fn(),
}));

vi.mock("fumadocs-core/negotiation", () => ({
  isMarkdownPreferred: isMarkdownPreferredMock,
  rewritePath: () => ({
    rewrite: rewriteLlmMock,
  }),
}));

import { NextRequest } from "next/server";
import { middleware } from "./middleware";

// Middleware checks session cookie presence only; role enforcement is deferred to
// withBetterAuthAdminGuard in /api/admin/* route handlers.
describe("middleware admin auth", () => {
  beforeEach(() => {
    isMarkdownPreferredMock.mockReset();
    rewriteLlmMock.mockReset();
    isMarkdownPreferredMock.mockReturnValue(false);
    rewriteLlmMock.mockReturnValue(null);
  });

  it("redirects unauthenticated /admin requests to login with a next param", async () => {
    const response = await middleware(new NextRequest("http://127.0.0.1:3000/admin"));

    expect(response?.status).toBe(307);
    const location = new URL(response?.headers.get("location") ?? "http://localhost");
    expect(location.pathname).toBe("/admin/login");
    expect(location.search).toBe("?next=%2Fadmin");
  });

  it("allows /admin/login for unauthenticated users", async () => {
    const response = await middleware(new NextRequest("http://127.0.0.1:3000/admin/login"));

    expect(response?.status).toBe(200);
  });

  it("allows /admin/login when an invalid session cookie is present (no redirect loop)", async () => {
    const response = await middleware(
      new NextRequest("http://127.0.0.1:3000/admin/login", {
        headers: { cookie: "aiwf.session_token=invalid-or-expired" },
      }),
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get("location")).toBeNull();
  });
  it("returns 401 JSON for unauthenticated admin API requests", async () => {
    const response = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/admin/telemetry/summary"),
    );

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("allows admin API requests when the session cookie is present", async () => {
    const response = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/admin/telemetry/summary", {
        headers: {
          cookie: "aiwf.session_token=test-token",
        },
      }),
    );

    expect(response?.status).toBe(200);
  });

  it("returns 401 when only legacy underscore session cookie is present", async () => {
    const response = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/admin/telemetry/summary", {
        headers: { cookie: "aiwf_session_token=test-token" },
      }),
    );

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("redirects unauthenticated /admin/* requests to login with a next param", async () => {
    const response = await middleware(new NextRequest("http://127.0.0.1:3000/admin/telemetry"));

    expect(response?.status).toBe(307);
    const location = new URL(response?.headers.get("location") ?? "http://localhost");
    expect(location.pathname).toBe("/admin/login");
    expect(location.search).toBe("?next=%2Fadmin%2Ftelemetry");
  });

  it("allows /admin pages when a session cookie is present without an admin role", async () => {
    const response = await middleware(
      new NextRequest("http://127.0.0.1:3000/admin/telemetry", {
        headers: {
          cookie: "aiwebfeeds_device_id=device-1; aiwf.session_token=test-token",
        },
      }),
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get("location")).toBeNull();
    expect(response?.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("accepts the production __Secure- session cookie and still does not check role", async () => {
    const response = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/admin/telemetry/summary", {
        headers: { cookie: "__Secure-aiwf.session_token=test-token" },
      }),
    );

    expect(response?.status).toBe(200);
  });

  it("does not treat a device id, device JWT, or role header as a session", async () => {
    const headers = {
      cookie: "aiwebfeeds_device_id=device-1; device_id=device-1; aiwf_session_token=nope",
      authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.device.sig",
      "x-user-role": "admin",
    };

    const apiResponse = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/admin/telemetry/summary", { headers }),
    );
    expect(apiResponse?.status).toBe(401);
    await expect(apiResponse?.json()).resolves.toEqual({ error: "Unauthorized" });

    const pageResponse = await middleware(
      new NextRequest("http://127.0.0.1:3000/admin/telemetry", { headers }),
    );
    expect(pageResponse?.status).toBe(307);
    const location = new URL(pageResponse?.headers.get("location") ?? "http://localhost");
    expect(location.pathname).toBe("/admin/login");
    expect(location.search).toBe("?next=%2Fadmin%2Ftelemetry");
  });

  it("does not let markdown negotiation bypass the admin cookie gate", async () => {
    isMarkdownPreferredMock.mockReturnValue(true);
    rewriteLlmMock.mockReturnValue("/llms.mdx/admin/telemetry");

    const response = await middleware(new NextRequest("http://127.0.0.1:3000/admin/telemetry"));

    expect(response?.status).toBe(307);
    expect(rewriteLlmMock).not.toHaveBeenCalled();
  });

  it("rewrites markdown-preferred doc requests and passes through when there is no rewrite", async () => {
    isMarkdownPreferredMock.mockReturnValue(true);
    rewriteLlmMock.mockReturnValue("/llms.mdx/guides/testing");

    const rewritten = await middleware(
      new NextRequest("http://127.0.0.1:3000/docs/guides/testing"),
    );
    const rewrite = rewritten?.headers.get("x-middleware-rewrite") ?? "";
    expect(rewritten?.status).toBe(200);
    expect(rewrite.endsWith("/llms.mdx/guides/testing")).toBe(true);
    expect(rewriteLlmMock).toHaveBeenCalledWith("/docs/guides/testing");

    rewriteLlmMock.mockReturnValue(null);
    const passthrough = await middleware(
      new NextRequest("http://127.0.0.1:3000/docs/guides/testing"),
    );
    expect(passthrough?.status).toBe(200);
    expect(passthrough?.headers.get("x-middleware-rewrite")).toBeNull();
    expect(passthrough?.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps connect-src same-origin and nonce script-src for production", async () => {
    const response = await middleware(new NextRequest("http://127.0.0.1:3000/docs"));
    const csp = response?.headers.get("Content-Security-Policy") ?? "";
    expect(cspDirective(csp, "connect-src")).toBe("connect-src 'self'");

    // Vitest inlines NODE_ENV, so the production nonce branch is locked from source.
    if (process.env.NODE_ENV === "production") {
      const nonce = response?.headers.get("x-nonce");
      expect(nonce).toEqual(expect.any(String));
      expect(nonce && nonce.length > 0).toBe(true);
      expect(cspDirective(csp, "script-src")).toBe(`script-src 'self' 'nonce-${nonce}'`);
      expect(response?.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    } else {
      expect(cspDirective(csp, "script-src")).toBe(
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      );
      expect(response?.headers.get("x-nonce")).toBeNull();
      expect(response?.headers.get("x-middleware-request-x-nonce")).toBeNull();
    }

    const source = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    expect(source).toContain("\"connect-src 'self'\"");
    expect(source).not.toContain("connect-src 'self' https:");
    expect(source).not.toContain("wss:");
    expect(source).toContain("script-src 'self' 'nonce-${" + "nonce}'");
    expect(source).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("keeps the same-origin connect-src on admin redirects and 401 responses", async () => {
    const denied = await middleware(
      new NextRequest("http://127.0.0.1:3000/api/admin/telemetry/summary"),
    );
    const redirected = await middleware(new NextRequest("http://127.0.0.1:3000/admin"));

    for (const response of [denied, redirected]) {
      const csp = response?.headers.get("Content-Security-Policy") ?? "";
      expect(cspDirective(csp, "connect-src")).toBe("connect-src 'self'");
    }
  });
});

function cspDirective(csp: string, name: string): string | undefined {
  return csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
}
