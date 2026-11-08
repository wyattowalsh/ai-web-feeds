import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCookies } from "better-auth/cookies";

import { buildSocialProviders, getAuth } from "./auth";

const { neonQuery } = vi.hoisted(() => ({
  neonQuery: vi.fn(() => {
    throw new Error("neon queries are out of scope for auth unit tests");
  }),
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => neonQuery,
}));

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

  it("omits a provider when only the client id is set", () => {
    process.env.GOOGLE_CLIENT_ID = "google-id";
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    expect(buildSocialProviders()).toEqual({});
  });

  it("omits a provider when only the client secret is set", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    process.env.GITHUB_CLIENT_SECRET = "github-credential"; // pragma: allowlist secret

    expect(buildSocialProviders()).toEqual({});
  });

  it("omits providers when credentials are blank", () => {
    process.env.GOOGLE_CLIENT_ID = "  ";
    process.env.GOOGLE_CLIENT_SECRET = "  ";
    process.env.GITHUB_CLIENT_ID = "";
    process.env.GITHUB_CLIENT_SECRET = "";

    expect(buildSocialProviders()).toEqual({});
  });

  it("registers github only when both client id and secret are set", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    process.env.GITHUB_CLIENT_ID = "github-id";
    process.env.GITHUB_CLIENT_SECRET = "github-credential"; // pragma: allowlist secret

    expect(buildSocialProviders()).toEqual({
      github: { clientId: "github-id", clientSecret: "github-credential" }, // pragma: allowlist secret
    });
  });
});

describe("auth cookie prefix", () => {
  it("uses aiwf session token cookie names via advanced.cookiePrefix", () => {
    const auth = getAuth();
    const cookies = getCookies(auth.options);
    expect(cookies.sessionToken.name).toBe("aiwf.session_token");
  });
});

type SessionRecord = {
  token: string;
};

type MemoryAuth = {
  options: Parameters<typeof getCookies>[0];
  $context: Promise<{
    secret: string;
    internalAdapter: {
      createUser: (user: {
        email: string;
        name: string;
        emailVerified: boolean;
      }) => Promise<{ id: string }>;
      createSession: (userId: string) => Promise<SessionRecord>;
    };
  }>;
  api: {
    getSession: (input: {
      headers: Headers;
      query?: { disableCookieCache?: boolean };
    }) => Promise<{ user?: { id?: string | null } | null; session?: unknown } | null>;
  };
};

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

async function signSessionCookie(name: string, token: string, secret: string): Promise<string> {
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `${name}=${encodeURIComponent(`${token}.${btoa(binary)}`)}`;
}

describe("session authorization", () => {
  const databaseUrl = process.env.DATABASE_URL;
  const adminEmails = process.env.BETTER_AUTH_ADMIN_EMAILS;

  afterEach(() => {
    restoreEnvVar("DATABASE_URL", databaseUrl);
    restoreEnvVar("BETTER_AUTH_ADMIN_EMAILS", adminEmails);
    neonQuery.mockClear();
    vi.resetModules();
  });

  async function loadMemoryAuth(): Promise<MemoryAuth> {
    // Better Auth falls back to its memory adapter when no database URL is set.
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_ADMIN_EMAILS;
    vi.resetModules();
    const authModule = await import("./auth");
    return authModule.getAuth() as MemoryAuth;
  }

  it("fails closed when the user has no session", async () => {
    const auth = await loadMemoryAuth();
    const context = await auth.$context;
    await context.internalAdapter.createUser({
      email: "reader@example.com",
      name: "Reader",
      emailVerified: false,
    });

    await expect(
      auth.api.getSession({
        headers: new Headers(),
        query: { disableCookieCache: true },
      }),
    ).resolves.toBeNull();
    expect(neonQuery).not.toHaveBeenCalled();
  });

  it("does not treat a session cookie as authorization", async () => {
    const auth = await loadMemoryAuth();
    const cookies = getCookies(auth.options);

    await expect(
      auth.api.getSession({
        headers: new Headers({
          cookie: `${cookies.sessionToken.name}=present-but-not-a-session`,
        }),
        query: { disableCookieCache: true },
      }),
    ).resolves.toBeNull();
    expect(neonQuery).not.toHaveBeenCalled();
  });

  it("fails closed when the signed session is missing", async () => {
    const auth = await loadMemoryAuth();
    const context = await auth.$context;
    const cookies = getCookies(auth.options);
    const cookie = await signSessionCookie(
      cookies.sessionToken.name,
      "missing-session-token",
      context.secret,
    );

    await expect(
      auth.api.getSession({
        headers: new Headers({ cookie }),
        query: { disableCookieCache: true },
      }),
    ).resolves.toBeNull();
    expect(neonQuery).not.toHaveBeenCalled();
  });

  it("fails closed when the session has no user", async () => {
    const auth = await loadMemoryAuth();
    const context = await auth.$context;
    const session = await context.internalAdapter.createSession("missing-user");
    const cookies = getCookies(auth.options);
    const cookie = await signSessionCookie(
      cookies.sessionToken.name,
      session.token,
      context.secret,
    );

    await expect(
      auth.api.getSession({
        headers: new Headers({ cookie }),
        query: { disableCookieCache: true },
      }),
    ).resolves.toBeNull();
    expect(neonQuery).not.toHaveBeenCalled();
  });

  it("returns the user only when both the session and the user exist", async () => {
    const auth = await loadMemoryAuth();
    const context = await auth.$context;
    const user = await context.internalAdapter.createUser({
      email: "reader@example.com",
      name: "Reader",
      emailVerified: false,
    });
    const session = await context.internalAdapter.createSession(user.id);
    const cookies = getCookies(auth.options);
    const cookie = await signSessionCookie(
      cookies.sessionToken.name,
      session.token,
      context.secret,
    );

    await expect(
      auth.api.getSession({
        headers: new Headers({ cookie }),
        query: { disableCookieCache: true },
      }),
    ).resolves.toMatchObject({
      user: { id: user.id },
    });
    expect(neonQuery).not.toHaveBeenCalled();
  });
});
