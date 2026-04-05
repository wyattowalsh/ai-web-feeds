/**
 * Browser-side anonymous identity helpers.
 *
 * Public flows in this app intentionally do not use end-user auth. The browser
 * keeps a device-scoped UUID in localStorage for convenience, while the server
 * establishes the authoritative anonymous binding via an HttpOnly cookie.
 */

import { ANON_USER_ID_RESPONSE_HEADER } from "@/lib/anonymous-identity";
import { validateUUID } from "@/lib/backend";

const USER_ID_KEY = "aiwebfeeds_user_id";
let identityBootstrapPromise: Promise<string> | null = null;
let hasBootstrappedIdentity = false;

function canUseStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const storage = window.localStorage;
  return (
    typeof storage?.getItem === "function"
    && typeof storage?.setItem === "function"
    && typeof storage?.removeItem === "function"
  );
}

function normalizeUserId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return validateUUID(trimmed) ? trimmed : null;
}

export function getStoredUserId(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  const storedUserId = normalizeUserId(window.localStorage.getItem(USER_ID_KEY));
  if (storedUserId) {
    return storedUserId;
  }

  window.localStorage.removeItem(USER_ID_KEY);
  return null;
}

export function setUserId(userId: string | null | undefined): string | null {
  const normalizedUserId = normalizeUserId(userId);

  if (!canUseStorage()) {
    return normalizedUserId;
  }

  if (normalizedUserId) {
    window.localStorage.setItem(USER_ID_KEY, normalizedUserId);
    return normalizedUserId;
  }

  window.localStorage.removeItem(USER_ID_KEY);
  return null;
}

/**
 * Get or create a browser-local UUID.
 *
 * This helper is safe only for device-local state. Server-scoped requests
 * should use `ensureAnonymousUserId()` so the browser and the signed binding
 * cookie stay aligned.
 *
 * @returns Browser-local UUID or null during SSR.
 */
export function getUserId(): string | null {
  const storedUserId = getStoredUserId();
  if (storedUserId) {
    return storedUserId;
  }

  if (!canUseStorage()) {
    return null;
  }

  return setUserId(crypto.randomUUID());
}

export function syncAnonymousUserIdFromResponse(response: Pick<Response, "headers">): string | null {
  const responseUserId = response.headers.get(ANON_USER_ID_RESPONSE_HEADER);
  if (responseUserId === null) {
    return getStoredUserId();
  }

  return setUserId(responseUserId);
}

export async function fetchWithAnonymousIdentity(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  syncAnonymousUserIdFromResponse(response);
  return response;
}

export async function ensureAnonymousUserId(): Promise<string> {
  if (!canUseStorage()) {
    throw new Error("Anonymous identity is only available in the browser");
  }

  // Search analytics and other first-write flows rely on this shared promise so
  // the browser never races two bootstrap requests against the binding cookie.
  if (identityBootstrapPromise) {
    return identityBootstrapPromise;
  }

  if (hasBootstrappedIdentity) {
    const storedUserId = getStoredUserId();
    if (storedUserId) {
      return storedUserId;
    }
  }

  identityBootstrapPromise = (async () => {
    const response = await fetchWithAnonymousIdentity("/api/identity", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("Failed to establish anonymous identity");
    }

    const payload = (await response.json().catch(() => null)) as {
      user_id?: string;
    } | null;

    const resolvedUserId = getStoredUserId() ?? setUserId(payload?.user_id ?? null);
    if (!resolvedUserId) {
      throw new Error("Anonymous identity response did not include a valid user_id");
    }

    hasBootstrappedIdentity = true;
    return resolvedUserId;
  })().finally(() => {
    identityBootstrapPromise = null;
  });

  return identityBootstrapPromise;
}

/**
 * Clear user ID from localStorage
 *
 * WARNING: This will lose all user data (follows, preferences, history).
 * Only use for testing or explicit user reset.
 */
export function clearUserId(): void {
  if (canUseStorage()) {
    window.localStorage.removeItem(USER_ID_KEY);
  }
  hasBootstrappedIdentity = false;
}

/**
 * Check if user has an ID (i.e., has visited before)
 *
 * @returns True if user ID exists in localStorage
 */
export function hasUserId(): boolean {
  return getStoredUserId() !== null;
}
