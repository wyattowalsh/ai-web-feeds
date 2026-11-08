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

import { DatabaseNotConfiguredError } from "@/lib/server/db";
import { getUserIdentity } from "@/lib/user-auth";
import { DELETE } from "./route";

const SESSION_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLIENT_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UNAUTHENTICATED_ERROR = "Deleting synced data requires an authenticated session";
const DATABASE_UNAVAILABLE_ERROR =
  "User data deletion is unavailable until DATABASE_URL is configured.";

function deleteRequest(cookie?: string): Request {
  return new Request("http://localhost/api/user/delete", {
    method: "DELETE",
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

describe("/api/user/delete route", () => {
  beforeEach(() => {
    deleteUserDataMock.mockReset();
    vi.mocked(getUserIdentity).mockReset();
  });

  it("requires a session identity and does not delete", async () => {
    vi.mocked(getUserIdentity).mockResolvedValue({
      user_id: "anonymous",
      source: "anonymous",
    });

    const response = await DELETE(deleteRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: UNAUTHENTICATED_ERROR });
    expect(deleteUserDataMock).not.toHaveBeenCalled();
  });

  it("does not treat cookie presence as a session", async () => {
    vi.mocked(getUserIdentity).mockResolvedValue({
      user_id: CLIENT_USER_ID,
      source: "client",
    });

    const response = await DELETE(
      deleteRequest(`better-auth.session_token=present; aiwf_anon_user_id=${CLIENT_USER_ID}`),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: UNAUTHENTICATED_ERROR });
    expect(body.success).not.toBe(true);
    expect(deleteUserDataMock).not.toHaveBeenCalled();
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

    const response = await DELETE(deleteRequest("better-auth.session_token=present"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user_id).toBe(SESSION_USER_ID);
    expect(deleteUserDataMock).toHaveBeenCalledTimes(1);
    expect(deleteUserDataMock).toHaveBeenCalledWith(SESSION_USER_ID);
  });

  it("returns 503 when the database is not configured", async () => {
    vi.mocked(getUserIdentity).mockResolvedValue({
      user_id: SESSION_USER_ID,
      source: "session",
    });
    deleteUserDataMock.mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await DELETE(deleteRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: DATABASE_UNAVAILABLE_ERROR });
    expect(body.success).not.toBe(true);
    expect(deleteUserDataMock).toHaveBeenCalledWith(SESSION_USER_ID);
  });
});
