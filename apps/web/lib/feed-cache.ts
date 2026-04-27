import { sql } from "@/lib/db-client";

export interface CachedFeedPost {
  feed_id: string;
  post_id: string;
  title: string;
  link: string;
  published_at: string | null;
  summary: string | null;
  author: string | null;
  categories: string[];
}

export interface CachedFeedEntry {
  feed_id: string;
  feed_title: string;
  source_url: string;
  resolved_feed_url: string;
  posts: CachedFeedPost[];
  fetched_at: string;
  expires_at: string;
}

const FEED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getCachedFeedPosts(feedId: string): Promise<CachedFeedEntry | null> {
  try {
    const rows = await sql`
      SELECT feed_id, feed_title, source_url, resolved_feed_url, posts, fetched_at, expires_at
      FROM cached_feed_posts
      WHERE feed_id = ${feedId}
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      feed_id: row.feed_id,
      feed_title: row.feed_title,
      source_url: row.source_url,
      resolved_feed_url: row.resolved_feed_url,
      posts: typeof row.posts === "string" ? JSON.parse(row.posts) : row.posts,
      fetched_at: row.fetched_at,
      expires_at: row.expires_at,
    };
  } catch {
    return null;
  }
}

export async function setCachedFeedPosts(entry: CachedFeedEntry): Promise<void> {
  try {
    await sql`
      INSERT INTO cached_feed_posts (feed_id, feed_title, source_url, resolved_feed_url, posts, fetched_at, expires_at)
      VALUES (
        ${entry.feed_id},
        ${entry.feed_title},
        ${entry.source_url},
        ${entry.resolved_feed_url},
        ${JSON.stringify(entry.posts)}::jsonb,
        ${entry.fetched_at},
        ${entry.expires_at}
      )
      ON CONFLICT (feed_id) DO UPDATE SET
        feed_title = EXCLUDED.feed_title,
        source_url = EXCLUDED.source_url,
        resolved_feed_url = EXCLUDED.resolved_feed_url,
        posts = EXCLUDED.posts,
        fetched_at = EXCLUDED.fetched_at,
        expires_at = EXCLUDED.expires_at
    `;
  } catch {
    // Silently fail - cache is best-effort
  }
}

export async function getCachedFeedsByIds(
  feedIds: string[],
): Promise<Map<string, CachedFeedEntry>> {
  const result = new Map<string, CachedFeedEntry>();
  if (feedIds.length === 0) return result;

  try {
    const rows = await sql`
      SELECT feed_id, feed_title, source_url, resolved_feed_url, posts, fetched_at, expires_at
      FROM cached_feed_posts
      WHERE feed_id = ANY(${feedIds}::text[])
        AND expires_at > NOW()
    `;

    for (const row of rows) {
      result.set(row.feed_id, {
        feed_id: row.feed_id,
        feed_title: row.feed_title,
        source_url: row.source_url,
        resolved_feed_url: row.resolved_feed_url,
        posts: typeof row.posts === "string" ? JSON.parse(row.posts) : row.posts,
        fetched_at: row.fetched_at,
        expires_at: row.expires_at,
      });
    }
  } catch {
    // Silently fail
  }

  return result;
}

export function createCacheExpiresAt(): string {
  return new Date(Date.now() + FEED_CACHE_TTL_MS).toISOString();
}
