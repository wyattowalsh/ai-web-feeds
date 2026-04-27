import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Set it in your environment.");
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("Initializing Neon database cache table...");

  await sql`
    CREATE TABLE IF NOT EXISTS cached_feed_posts (
      feed_id TEXT PRIMARY KEY,
      feed_title TEXT NOT NULL,
      source_url TEXT NOT NULL,
      resolved_feed_url TEXT NOT NULL,
      posts JSONB NOT NULL DEFAULT '[]',
      fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_cached_feed_posts_expires
    ON cached_feed_posts(expires_at)
  `;

  console.log("Cache table initialized successfully.");
}

main().catch((error) => {
  console.error("Failed to initialize cache table:", error);
  process.exit(1);
});
