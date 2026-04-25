import "server-only";
/**
 * User authentication utilities
 *
 * Public browser flows stay anonymous and device-scoped. The only trusted
 * public identity source is the server-issued binding cookie. Client-provided
 * UUIDs are treated as hints only and must never authorize access by
 * themselves.
 */

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ANON_USER_BINDING_COOKIE, ANON_USER_ID_RESPONSE_HEADER } from "@/lib/anonymous-identity";
import { validateUUID } from "@/lib/backend";
import { getAnonymousBindingSecret } from "@/lib/env";

if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
  throw new Error("lib/user-auth.ts is server-only");
}

export { ANON_USER_BINDING_COOKIE, ANON_USER_ID_RESPONSE_HEADER } from "@/lib/anonymous-identity";
const ANON_BINDING_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const ANON_USER_BINDING_COOKIE = "aiwf_anon_user_id";
export const ANON_USER_ID_RESPONSE_HEADER = "x-aiwf-anon-user-id";

export type UserIdentity = {
  user_id: string;
  source: "session" | "header" | "binding" | "bootstrap" | "client" | "anonymous";
};

export type ResolvedUserIdentity = {
  identity: UserIdentity;
  shouldBindCookie: boolean;
};

function normalizeUserId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return validateUUID(trimmed) ? trimmed : null;
}

export function isValidUserId(value: string | null | undefined): boolean {
  return normalizeUserId(value) !== null;
}

function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${name}=`;
  for (const segment of cookieHeader.split(";")) {
    const value = segment.trim();
    if (value.startsWith(prefix)) {
      return decodeURIComponent(value.slice(prefix.length));
    }
  }

  return null;
}

function hashText(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function constantTimeEqual(left: string, right: string): boolean {
  return timingSafeEqual(hashText(left), hashText(right));
}

function signBindingPayload(payload: string): string {
  return createHmac("sha256", getAnonymousBindingSecret()).update(payload).digest("base64url");
}

function encodeBindingToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      uid: userId,
    }),
    "utf-8",
  ).toString("base64url");

  return `${payload}.${signBindingPayload(payload)}`;
}

function decodeBindingToken(token: string | null | undefined): string | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signBindingPayload(payload);
  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as { uid?: string; v?: number };
    if (parsed.v !== 1) {
      return null;
    }

    return normalizeUserId(parsed.uid) ?? null;
  } catch {
    return null;
  }
}

function getBindingUserIdFromRequest(request: Request): string | null {
  const token = parseCookieValue(request.headers.get("cookie"), ANON_USER_BINDING_COOKIE);
  return decodeBindingToken(token);
}

function getBindingCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANON_BINDING_MAX_AGE_SECONDS,
  };
}

export type ResolvedUserIdentity = {
  identity: UserIdentity;
  bindingCookieValue: string | null;
};

export function resolveUserIdentity(
  request: Request,
  _candidateUserId?: string | null,
  options: { allowTrustedHeader?: boolean } = {},
): ResolvedUserIdentity {
  if (options.allowTrustedHeader) {
    const headerUserId = normalizeUserId(request.headers.get("x-user-id"));
    if (headerUserId) {
      return {
        identity: {
          user_id: headerUserId,
          source: "header",
        },
        bindingCookieValue: null,
      };
    }
  }

  const boundUserId = getBindingUserIdFromRequest(request);
  if (boundUserId) {
    return {
      identity: {
        user_id: boundUserId,
        source: "binding",
      },
      bindingCookieValue: null,
    };
  }

  const bootstrapUserId = randomUUID();
  return {
    identity: {
      user_id: bootstrapUserId,
      source: "bootstrap",
    },
    bindingCookieValue: encodeBindingToken(bootstrapUserId),
  };
}

export function applyUserIdentityBinding(
  response: NextResponse,
  resolvedIdentity: ResolvedUserIdentity,
): void {
  response.headers.set(ANON_USER_ID_RESPONSE_HEADER, resolvedIdentity.identity.user_id);

  if (!resolvedIdentity.bindingCookieValue) {
    return;
  }

  response.cookies.set(
    ANON_USER_BINDING_COOKIE,
    resolvedIdentity.bindingCookieValue,
    getBindingCookieOptions(),
  );
}

/**
 * Get user identity from request
 *
 * Checks multiple sources in priority order:
 * 1. Trusted x-user-id header (only when explicitly enabled for trusted contexts)
 * 2. Signed anonymous binding cookie issued by this server
 * 3. Client-provided UUID hint (not trusted until a binding cookie exists)
 * 4. Falls back to anonymous
 *
 * Anonymous browser features in this app intentionally do not require end-user auth,
 * but they do require a stable UUID to scope user-specific state.
 */
export function getUserIdentity(
  request: Request,
  candidateUserId?: string | null,
  options: { allowTrustedHeader?: boolean } = {},
): UserIdentity {
  if (options.allowTrustedHeader) {
    const headerUserId = normalizeUserId(request.headers.get("x-user-id"));
    if (headerUserId) {
      return {
        user_id: headerUserId,
        source: "header",
      };
    }
  }

  const boundUserId = getBindingUserIdFromRequest(request);
  if (boundUserId) {
    return {
      user_id: boundUserId,
      source: "binding",
    };
  }

  const clientUserId = normalizeUserId(candidateUserId);
  if (clientUserId) {
    return {
      user_id: clientUserId,
      source: "client",
    };
  }

  return {
    user_id: "anonymous",
    source: "anonymous",
  };
}

export function isValidUserId(value: string | null | undefined): boolean {
  return normalizeUserId(value) !== null;
}

export function resolveUserIdentity(
  request: Request,
  candidateUserId?: string | null,
  options: { allowTrustedHeader?: boolean } = {},
): ResolvedUserIdentity {
  const directIdentity = getUserIdentity(request, candidateUserId, options);
  if (directIdentity.source !== "anonymous") {
    return {
      identity: directIdentity,
      shouldBindCookie: false,
    };
  }

  const cookieUserId = normalizeUserId(readBindingCookie(request));
  if (cookieUserId) {
    return {
      identity: {
        user_id: cookieUserId,
        source: "client",
      },
      shouldBindCookie: false,
    };
  }

  return {
    identity: {
      user_id: crypto.randomUUID(),
      source: "client",
    },
    shouldBindCookie: true,
  };
}

/**
 * Validate that client-supplied user_id matches authenticated identity
 *
 * Used in "owned" routes (e.g., /api/search/saved?user_id=X) to prevent
 * accessing other users' data.
 *
 * @param clientSuppliedId - user_id from query param or request body
 * @param actualIdentity - authenticated identity from headers/session
 * @returns true if client-supplied ID matches authenticated identity
 */
export function validateUserOwnership(
  clientSuppliedId: string | null,
  actualIdentity: UserIdentity,
): boolean {
  const normalizedClientId = normalizeUserId(clientSuppliedId);

  if (!normalizedClientId) {
    return false;
  }

  if (actualIdentity.source === "anonymous") {
    return false;
  }

  return normalizedClientId === actualIdentity.user_id;
}

export function validateTrustedUserOwnership(
  clientSuppliedId: string | null,
  actualIdentity: UserIdentity,
): boolean {
  return validateUserOwnership(clientSuppliedId, actualIdentity);
}

export function applyUserIdentityBinding(
  response: Response,
  resolvedIdentity: ResolvedUserIdentity,
): Response {
  response.headers.set(ANON_USER_ID_RESPONSE_HEADER, resolvedIdentity.identity.user_id);

  if (!resolvedIdentity.shouldBindCookie) {
    return response;
  }

  response.headers.append(
    "Set-Cookie",
    `${ANON_USER_BINDING_COOKIE}=${resolvedIdentity.identity.user_id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
  );
  return response;
}

function readBindingCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === ANON_USER_BINDING_COOKIE) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}
