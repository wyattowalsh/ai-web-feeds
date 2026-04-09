/**
 * User authentication utilities
 *
 * Derives user identity from request headers or the client-generated anonymous UUID
 * used for user-scoped browser features.
 */

import { validateUUID } from "@/lib/backend";

export const ANON_USER_BINDING_COOKIE = "aiwf_anon_user_id";
export const ANON_USER_ID_RESPONSE_HEADER = "x-aiwf-anon-user-id";

export type UserIdentity = {
  user_id: string;
  source: "session" | "header" | "client" | "anonymous";
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

/**
 * Get user identity from request
 *
 * Checks multiple sources in priority order:
 * 1. Trusted x-user-id header (only when explicitly enabled for trusted contexts)
 * 2. Client-generated UUID used to scope anonymous browser data
 * 3. Falls back to anonymous
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
