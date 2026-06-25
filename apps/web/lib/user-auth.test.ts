import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANON_USER_BINDING_COOKIE,
  getSessionUser,
  getUserIdentity,
  resolveUserIdentity,
  validateUserOwnership,
} from "@/lib/user-auth";

const ANON_USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_USER_ID = "ba_session_user_01";

const mockGetSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

function createRequest(options: { cookie?: string; headerUserId?: string } = {}): Request {
  const headers = new Headers();
  if (options.cookie) {
    headers.set("cookie", options.cookie);
  }
  if (options.headerUserId) {
    headers.set("x-user-id", options.headerUserId);
  }

  return new Request("http://localhost/api/test", { headers });
}

describe("getSessionUser", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the session user when Better Auth has an active session", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: SESSION_USER_ID,
        email: "reader@example.com",
        name: "Reader",
      },
    });

    const user = await getSessionUser(createRequest());

    expect(user).toEqual({
      id: SESSION_USER_ID,
      email: "reader@example.com",
      name: "Reader",
    });
  });

  it("returns null when no session is present", async () => {
    mockGetSession.mockResolvedValue(null);

    expect(await getSessionUser(createRequest())).toBeNull();
  });
});

describe("getUserIdentity session precedence", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prefers session user id over anonymous client UUID", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: SESSION_USER_ID, email: "reader@example.com" },
    });

    const identity = await getUserIdentity(createRequest(), ANON_USER_ID);

    expect(identity).toEqual({
      user_id: SESSION_USER_ID,
      source: "session",
    });
  });

  it("prefers session user id over trusted header and client UUID", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: SESSION_USER_ID, email: "reader@example.com" },
    });

    const identity = await getUserIdentity(
      createRequest({ headerUserId: ANON_USER_ID }),
      ANON_USER_ID,
      {
        allowTrustedHeader: true,
      },
    );

    expect(identity.source).toBe("session");
    expect(identity.user_id).toBe(SESSION_USER_ID);
  });

  it("falls back to client UUID when session is absent", async () => {
    mockGetSession.mockResolvedValue(null);

    const identity = await getUserIdentity(createRequest(), ANON_USER_ID);

    expect(identity).toEqual({
      user_id: ANON_USER_ID,
      source: "client",
    });
  });

  it("falls back to anonymous when session and client UUID are absent", async () => {
    mockGetSession.mockResolvedValue(null);

    const identity = await getUserIdentity(createRequest());

    expect(identity).toEqual({
      user_id: "anonymous",
      source: "anonymous",
    });
  });
});

describe("resolveUserIdentity session precedence", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses session identity without binding an anonymous cookie", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: SESSION_USER_ID, email: "reader@example.com" },
    });

    const resolved = await resolveUserIdentity(
      createRequest({
        cookie: `${ANON_USER_BINDING_COOKIE}=${ANON_USER_ID}`,
      }),
      ANON_USER_ID,
    );

    expect(resolved).toEqual({
      identity: {
        user_id: SESSION_USER_ID,
        source: "session",
      },
      shouldBindCookie: false,
    });
  });

  it("keeps anonymous cookie fallback when session is absent", async () => {
    mockGetSession.mockResolvedValue(null);

    const resolved = await resolveUserIdentity(
      createRequest({
        cookie: `${ANON_USER_BINDING_COOKIE}=${ANON_USER_ID}`,
      }),
    );

    expect(resolved).toEqual({
      identity: {
        user_id: ANON_USER_ID,
        source: "client",
      },
      shouldBindCookie: false,
    });
  });
});

describe("validateUserOwnership", () => {
  it("accepts Better Auth session ids that are not UUIDs", () => {
    expect(
      validateUserOwnership(SESSION_USER_ID, {
        user_id: SESSION_USER_ID,
        source: "session",
      }),
    ).toBe(true);
  });
});
