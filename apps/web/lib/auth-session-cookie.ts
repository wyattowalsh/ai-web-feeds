/**
 * Edge-safe Better Auth session cookie detection.
 * Mirrors better-auth/cookies getSessionCookie name patterns without importing better-auth.
 */

export const AUTH_COOKIE_PREFIXES = ["aiwf", "better-auth"] as const;
export const SESSION_COOKIE_NAME = "session_token";

const SECURE_PREFIX = "__Secure-";

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const cookieMap = new Map<string, string>();
  for (const segment of cookieHeader.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (name) {
      cookieMap.set(name, value);
    }
  }
  return cookieMap;
}

function hasCookieName(cookieMap: Map<string, string>, name: string): boolean {
  const value = cookieMap.get(name);
  return typeof value === "string" && value.length > 0;
}

function sessionCookieNames(prefix: string): string[] {
  const dotted = `${prefix}.${SESSION_COOKIE_NAME}`;
  const dashed = `${prefix}-${SESSION_COOKIE_NAME}`;
  return [dotted, dashed, `${SECURE_PREFIX}${dotted}`, `${SECURE_PREFIX}${dashed}`];
}

/**
 * Returns true when a Better Auth session token cookie is present.
 * Accepts current (aiwf.*) and one-release migration (better-auth.*) prefixes.
 */
export function hasBetterAuthSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) {
    return false;
  }

  const cookieMap = parseCookieHeader(cookieHeader);
  for (const prefix of AUTH_COOKIE_PREFIXES) {
    for (const name of sessionCookieNames(prefix)) {
      if (hasCookieName(cookieMap, name)) {
        return true;
      }
    }
  }

  return false;
}
