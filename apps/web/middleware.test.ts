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
});
