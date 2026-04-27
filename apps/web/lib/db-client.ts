import { neon } from "@neondatabase/serverless";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) {
    return url;
  }

  // During static generation/build, we may not have the database URL.
  // Return a placeholder that will fail gracefully if actually used.
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NODE_ENV === "production"
  ) {
    // This will cause actual DB operations to fail, but allows build to complete
    // since the client is only used at runtime for API routes.
    // pragma: allowlist secret - build-time placeholder, never used at runtime
    return "postgresql://user:pass@localhost:5432/placeholder?sslmode=require";
  }

  throw new Error(
    "No database connection string was provided. Set DATABASE_URL in your environment.",
  );
}

export const sql = neon(getDatabaseUrl());
