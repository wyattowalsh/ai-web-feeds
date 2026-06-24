/**
 * Query tokenization for client-side search (worker + main thread).
 */

export function tokenizeQuery(query: string): string[] {
  const q = (query || "").trim();
  if (!q) return [];

  const terms: string[] = [];
  const re = /"([^"]+)"|'([^']+)'|(\S+)/g;
  for (const m of q.matchAll(re)) {
    const t = (m[1] || m[2] || m[3] || "").trim().toLowerCase();
    if (t) terms.push(t);
  }
  return terms;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
