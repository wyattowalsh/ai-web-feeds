import { beforeEach, describe, expect, it, vi } from "vitest";

const { hasValidAdminSessionMock, isMarkdownPreferredMock, rewriteLlmMock } = vi.hoisted(() => ({
  hasValidAdminSessionMock: vi.fn(),
  isMarkdownPreferredMock: vi.fn(),
  rewriteLlmMock: vi.fn(),
}));

vi.mock("fumadocs-core/negotiation", () => ({
  isMarkdownPreferred: isMarkdownPreferredMock,
  rewritePath: () => ({
    rewrite: rewriteLlmMock,
  }),
}));

vi.mock("@/lib/admin-auth-edge", () => ({
  hasValidAdminSession: hasValidAdminSessionMock,
}));

import { NextRequest } from "next/server";
import { middleware } from "./middleware";

describe("middleware admin auth", () => {
  beforeEach(() => {
    hasValidAdminSessionMock.mockReset();
    isMarkdownPreferredMock.mockReset();
    rewriteLlmMock.mockReset();
    isMarkdownPreferredMock.mockReturnValue(false);
    rewriteLlmMock.mockReturnValue(null);
  });

  it("redirects unauthenticated /admin requests to login with a next param", async () => {
    hasValidAdminSessionMock.mockResolvedValue(false);

    const response = await middleware(new NextRequest("http://127.0.0.1:3000/admin"));

    expect(response?.status).toBe(307);
    const location = new URL(response?.headers.get("location") ?? "http://localhost");
    expect(location.pathname).toBe("/admin/login");
    expect(location.search).toBe("?next=%2Fadmin");
  });

  it("redirects authenticated /admin/login requests back to /admin", async () => {
    hasValidAdminSessionMock.mockResolvedValue(true);

    const response = await middleware(new NextRequest("http://127.0.0.1:3000/admin/login"));

    expect(response?.status).toBe(307);
    const location = new URL(response?.headers.get("location") ?? "http://localhost");
    expect(location.pathname).toBe("/admin");
    expect(location.search).toBe("");
  });

  it("redirects the legacy feeds route to the root reader and preserves query state", async () => {
    hasValidAdminSessionMock.mockResolvedValue(false);

    const response = await middleware(new NextRequest("http://127.0.0.1:3000/feeds?q=agents"));

    expect(response?.status).toBe(307);
    const location = new URL(response?.headers.get("location") ?? "http://localhost");
    expect(location.pathname).toBe("/");
    expect(location.search).toBe("?q=agents");
  });

  it("redirects retired public UI routes to the two retained surfaces", async () => {
    hasValidAdminSessionMock.mockResolvedValue(false);

    const analyticsResponse = await middleware(
      new NextRequest("http://127.0.0.1:3000/analytics/forecasts"),
    );
    const explorerResponse = await middleware(new NextRequest("http://127.0.0.1:3000/explorer"));
    const recommendationsResponse = await middleware(
      new NextRequest("http://127.0.0.1:3000/recommendations"),
    );

    expect(new URL(analyticsResponse?.headers.get("location") ?? "http://localhost").pathname).toBe(
      "/dashboard",
    );
    expect(new URL(explorerResponse?.headers.get("location") ?? "http://localhost").pathname).toBe(
      "/dashboard",
    );
    expect(
      new URL(recommendationsResponse?.headers.get("location") ?? "http://localhost").pathname,
    ).toBe("/");
  });
});
