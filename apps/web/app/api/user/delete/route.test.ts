import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteUserDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/telemetry-route", () => ({
  withRouteTelemetry: (_routeKey: string, handler: unknown) => handler,
}));

vi.mock("@/lib/server/user-store/delete-user-data", () => ({
  deleteUserData: deleteUserDataMock,
}));

vi.mock("@/lib/user-auth", () => ({
  getUserIdentity: vi.fn(),
}));

import { getUserIdentity } from "@/lib/user-auth";
import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { DELETE } from "./route";

const SESSION_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("/api/user/delete route", () => {
  beforeEach(() => {
    deleteUserDataMock.mockReset();
    vi.mocked(getUserIdentity).mockReset();
  });

  it("requires a session identity", async () => {
    vi.mocked(getUserIdentity).mockResolvedValue({
      user_id: "anonymous",
      source: "anonymous",
    });

    const response = await DELETE(
      new Request("http://localhost/api/user/delete", { method: "DELETE" }),
    );
    expect(response.status).toBe(401);
  });

  it("deletes synced data for the session user", async () => {
    vi.mocked(getUserIdentity).mockResolvedValue({
      user_id: SESSION_USER_ID,
      source: "session",
    });
    deleteUserDataMock.mockResolvedValue({
      user_id: SESSION_USER_ID,
      deleted: { saved_searches: 2, saved_reader_filters: 1 },
    });

    const response = await DELETE(
      new Request("http://localhost/api/user/delete", { method: "DELETE" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteUserDataMock).toHaveBeenCalledWith(SESSION_USER_ID);
  });

  it("returns 503 when the database is not configured", async () => {
    vi.mocked(getUserIdentity).mockResolvedValue({
      user_id: SESSION_USER_ID,
      source: "session",
    });
    deleteUserDataMock.mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await DELETE(
      new Request("http://localhost/api/user/delete", { method: "DELETE" }),
    );
    expect(response.status).toBe(503);
  });
});
