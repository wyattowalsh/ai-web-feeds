import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sqlClient: NeonQueryFunction<false, false> | null = null;

function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    return url;
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }

  return null;
}

/**
 * Shared Neon SQL client for server routes and user-store modules.
 * Returns null during production build or when DATABASE_URL is unset.
 */
export function getSql(): NeonQueryFunction<false, false> | null {
  if (sqlClient) {
    return sqlClient;
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return null;
  }

  sqlClient = neon(databaseUrl);
  return sqlClient;
}

export class DatabaseNotConfiguredError extends Error {
  constructor(message = "DATABASE_URL is not configured") {
    super(message);
    this.name = "DatabaseNotConfiguredError";
  }
}

/** Fail fast for routes that require Neon persistence. */
export function assertDbConfigured(): NeonQueryFunction<false, false> {
  const sql = getSql();
  if (!sql) {
    throw new DatabaseNotConfiguredError();
  }
  return sql;
}
