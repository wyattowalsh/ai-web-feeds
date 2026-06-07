import { headers } from "next/headers";

/**
 * Returns the per-request nonce set by middleware for strict CSP (script-src with nonce).
 * Server Components read it via headers() so they can forward it to <JsonLd nonce={...} />.
 * Returns undefined when absent (graceful for static renders or when middleware did not run).
 */
export async function getRequestNonce(): Promise<string | undefined> {
  return (await headers()).get("x-nonce") ?? undefined;
}
