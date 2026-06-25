import type { Article } from "@/lib/db";
import type { FeedsWorkspaceInitialBrowse } from "@/lib/reader-route";
import type { ArticleSort, WorkspaceArticle } from "./types";

export type WorkspaceArticleWithStableId = WorkspaceArticle & {
  stable_id: string | null;
};

export type ArticleStableIdInput = {
  feed_id: string;
  guid?: string | null;
  link?: string | null;
};

function normalizeArticleIdentityValue(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function resolveArticleIdentityValue(
  guid: string | null | undefined,
  link: string | null | undefined,
): string {
  const guidNormalized = normalizeArticleIdentityValue(guid);
  if (guidNormalized) {
    return guidNormalized;
  }

  return normalizeArticleIdentityValue(link);
}

function sha256Hex(value: string): string {
  const utf8 = new TextEncoder().encode(value);
  const bitLength = utf8.length * 8;
  const wordCount = (((bitLength + 64) >>> 9) << 4) + 16;
  const words = new Array<number>(wordCount).fill(0);

  for (let i = 0; i < utf8.length; i++) {
    words[i >>> 2] |= utf8[i] << (24 - (i % 4) * 8);
  }

  words[bitLength >>> 5] |= 0x80 << (24 - (bitLength % 32));
  words[wordCount - 1] = bitLength;

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let [h0, h1, h2, h3, h4, h5, h6, h7] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  for (let offset = 0; offset < words.length; offset += 16) {
    const w = words.slice(offset, offset + 16);
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => (word >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

export function computeArticleStableId(input: ArticleStableIdInput): string | null {
  const { feed_id: feedId, guid, link } = input;
  if (!feedId) {
    return null;
  }

  const identity = resolveArticleIdentityValue(guid ?? null, link ?? null);
  if (!identity) {
    return null;
  }

  return `${feedId}:${sha256Hex(identity)}`;
}

export function compareByPublishedDesc(
  left: { published_at_ms: number | null },
  right: { published_at_ms: number | null },
): number {
  return (right.published_at_ms ?? 0) - (left.published_at_ms ?? 0);
}

export function compareByPublishedAsc(
  left: { published_at_ms: number | null },
  right: { published_at_ms: number | null },
): number {
  return (left.published_at_ms ?? 0) - (right.published_at_ms ?? 0);
}

export function getArticleSortComparator(
  sort: ArticleSort,
): (left: { published_at_ms: number | null }, right: { published_at_ms: number | null }) => number {
  if (sort === "oldest") {
    return compareByPublishedAsc;
  }

  return compareByPublishedDesc;
}

export function normalizeArticle(
  article: FeedsWorkspaceInitialBrowse["items"][number],
): WorkspaceArticleWithStableId {
  return {
    ...article,
    stable_id: computeArticleStableId({
      feed_id: article.feed_id,
      guid: article.id,
      link: article.link,
    }),
    freshness: "corpus",
    published_at_ms: article.published_at ? Date.parse(article.published_at) : null,
  };
}

export function normalizeLiveArticle(post: {
  id: string;
  feedId: string;
  feedTitle: string;
  title: string;
  link: string;
  summary: string | null;
  sourceUrl?: string;
  resolvedFeedUrl?: string;
  author: string | null;
  rawCategories: string[];
  publishedAt: string | null;
}): WorkspaceArticleWithStableId {
  const stableId = computeArticleStableId({
    feed_id: post.feedId,
    guid: post.id,
    link: post.link,
  });

  return {
    id: `${post.feedId}:${post.id}`,
    stable_id: stableId,
    feed_id: post.feedId,
    feed_title: post.feedTitle,
    title: post.title,
    link: post.link,
    summary: post.summary,
    content_html: null,
    author: post.author,
    published_at: post.publishedAt,
    topics: [],
    source_topics: [],
    raw_categories: post.rawCategories,
    source_type: "feed",
    verified: false,
    is_active: true,
    freshness: "live",
    published_at_ms: post.publishedAt ? Date.parse(post.publishedAt) : null,
    source_url: post.sourceUrl ?? null,
    resolved_feed_url: post.resolvedFeedUrl ?? null,
  };
}

export function normalizeCachedArticle(
  article: Article,
  feedTitle?: string,
): WorkspaceArticleWithStableId {
  const publishedAt = article.pubDate ? new Date(article.pubDate).toISOString() : null;

  return {
    id: article.id,
    stable_id: computeArticleStableId({
      feed_id: article.feedId,
      guid: article.id,
      link: article.link,
    }),
    feed_id: article.feedId,
    feed_title: feedTitle ?? article.feedId,
    title: article.title,
    link: article.link,
    summary: article.summary ?? null,
    content_html: article.content || null,
    author: article.author ?? null,
    published_at: publishedAt,
    topics: article.topics,
    source_topics: article.sourceTopics,
    raw_categories: article.rawCategories,
    source_type: "feed",
    verified: false,
    is_active: true,
    freshness: "cached",
    published_at_ms: article.pubDate ?? null,
    source_url: null,
  };
}

export function getArticleTopics(article: WorkspaceArticle): string[] {
  return article.topics;
}
