/**
 * User identity management using localStorage UUID
 *
 * Phase 3B: Anonymous user tracking with localStorage
 * Phase 3A (Future): Migration to authenticated user accounts
 */

const USER_ID_KEY = "aiwebfeeds_user_id";

/**
 * Get or create user ID from localStorage
 *
 * Generates a UUID v4 on first visit and persists it in localStorage.
 * This ID is used for:
 * - WebSocket authentication
 * - Notification targeting
 * - Feed follows
 * - Digest subscriptions
 *
 * @returns User ID (UUID v4)
 */
export function getUserId(): string {
  if (typeof window === "undefined") {
    // Server-side rendering: return placeholder
    return "ssr-placeholder";
  }

  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    // Generate new UUID v4
    userId = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, userId);
  }

  return userId;
}

/**
 * Clear user ID from localStorage
 *
 * WARNING: This will lose all user data (follows, preferences, history).
 * Only use for testing or explicit user reset.
 */
export function clearUserId(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(USER_ID_KEY);
  }
}

/**
 * Check if user has an ID (i.e., has visited before)
 *
 * @returns True if user ID exists in localStorage
 */
export function hasUserId(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem(USER_ID_KEY) !== null;
}

