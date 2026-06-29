import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

import { isAdminUser, withBetterAuthAdminGuard } from "./admin-auth-new";

describe("isAdminUser", () => {
  it("returns true only for admin role", () => {
    expect(isAdminUser({ role: "admin" })).toBe(true);
    expect(isAdminUser({ role: "user" })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });
});

describe("withBetterAuthAdminGuard", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it("returns unauthorized when session is missing", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(withBetterAuthAdminGuard(new Request("http://localhost"))).resolves.toEqual({
      status: "unauthorized",
    });
  });

  it("returns forbidden for authenticated non-admin users", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com", role: "user" },
    });

    await expect(withBetterAuthAdminGuard(new Request("http://localhost"))).resolves.toEqual({
      status: "forbidden",
    });
  });

  it("returns ok for admin users", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    });

    await expect(withBetterAuthAdminGuard(new Request("http://localhost"))).resolves.toEqual({
      status: "ok",
      user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    });
  });
});
