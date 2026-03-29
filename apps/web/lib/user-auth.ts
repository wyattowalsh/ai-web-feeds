/**
 * User authentication utilities
 *
 * Derives user identity from request headers or the client-generated anonymous UUID
 * used for user-scoped browser features.
 */

import { validateUUID } from "@/lib/backend";

export type UserIdentity = {
  user_id: string;
  source: "session" | "header" | "client" | "anonymous";
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
export function validateUserOwnership(clientSuppliedId: string | null, actualIdentity: UserIdentity): boolean {
  const normalizedClientId = normalizeUserId(clientSuppliedId);

  if (!normalizedClientId) {
    return false;
  }

  if (actualIdentity.source === "anonymous") {
    return false;
  }

  return normalizedClientId === actualIdentity.user_id;
}
