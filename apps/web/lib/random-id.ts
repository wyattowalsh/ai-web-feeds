/** Non-security-critical unique suffix for client-side IDs (queues, logs, folders). */
export function randomSuffix(length = 8): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, length);
  }
  return Date.now().toString(36).slice(-length);
}

export function makeClientId(prefix: string): string {
  return `${prefix}${Date.now()}_${randomSuffix()}`;
}
