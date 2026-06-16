/**
 * Local Search (Client-side)
 *
 * Provides fast, offline-capable search over articles cached in IndexedDB.
 * Searches the articles store (title, content, summary, author, topics, tags).
 *
 * No network calls. Results are deterministic and scoped to what the user
 * has previously cached via the reader or background sync.
 */

import { articles, type Article } from "@/lib/db";

export interface LocalSearchOptions {
  /** Maximum number of results to return (default 50) */
  limit?: number;
  /** Include only unread articles */
  unreadOnly?: boolean;
  /** Include only starred articles */
  starredOnly?: boolean;
  /** Include only bookmarked/saved articles (overlay state; requires isBookmarked) */
  bookmarkedOnly?: boolean;
  /** Overlay predicate used when bookmarkedOnly is true */
  isBookmarked?: (articleId: string) => boolean;
  /** Restrict to specific feed IDs */
  feedIds?: string[];
  /** Restrict to articles with any of these topics (matches topics or sourceTopics) */
  topics?: string[];
}

export interface LocalSearchResult {
  article: Article;
  score: number;
  matchedFields: Array<"title" | "content" | "summary" | "author" | "topics" | "tags">;
}

const DEFAULT_LIMIT = 50;

/**
 * Tokenize a query into normalized, lowercased terms.
 * Supports simple quoted phrases by treating "..." as a single term.
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

/**
 * Score a single article against a set of query terms.
 * Returns { score, matchedFields }.
 */
function scoreArticle(
  article: Article,
  terms: string[],
): { score: number; matchedFields: LocalSearchResult["matchedFields"] } {
  if (terms.length === 0) {
    return { score: 1, matchedFields: [] };
  }

  const title = (article.title || "").toLowerCase();
  const content = (article.content || "").toLowerCase();
  const summary = (article.summary || "").toLowerCase();
  const author = (article.author || "").toLowerCase();
  const topics = [...(article.topics || []), ...(article.sourceTopics || [])]
    .map((t) => String(t || "").toLowerCase())
    .join(" ");
  const tags = (article.tags || []).map((t) => String(t || "").toLowerCase()).join(" ");

  let score = 0;
  const matched = new Set<LocalSearchResult["matchedFields"][number]>();

  for (const term of terms) {
    let termScore = 0;

    if (title.includes(term)) {
      termScore += 8;
      matched.add("title");
    }
    if (summary.includes(term)) {
      termScore += 4;
      matched.add("summary");
    }
    if (content.includes(term)) {
      termScore += 2;
      matched.add("content");
    }
    if (author.includes(term)) {
      termScore += 3;
      matched.add("author");
    }
    if (topics.includes(term)) {
      termScore += 2;
      matched.add("topics");
    }
    if (tags.includes(term)) {
      termScore += 2;
      matched.add("tags");
    }

    // Bonus for exact title match of the whole term
    if (title === term) termScore += 6;

    // If term appears as a whole word in title, extra weight
    const wordRe = new RegExp(`\\b${escapeRegExp(term)}\\b`);
    if (wordRe.test(title)) termScore += 3;

    score += termScore;
  }

  // Slight freshness bonus (newer articles within ~30 days get +1)
  const ageDays = (Date.now() - (article.pubDate || 0)) / (1000 * 60 * 60 * 24);
  if (ageDays >= 0 && ageDays < 30) score += 1;

  return { score, matchedFields: Array.from(matched) };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Perform a client-side search over cached articles in IndexedDB.
 * Combines term matching with optional filters.
 */
export async function searchArticlesLocal(
  query: string,
  options: LocalSearchOptions = {},
): Promise<LocalSearchResult[]> {
  const {
    limit = DEFAULT_LIMIT,
    unreadOnly = false,
    starredOnly = false,
    bookmarkedOnly = false,
    isBookmarked,
    feedIds,
    topics,
  } = options;

  const all = await articles.getAll();

  // Pre-filter by feed/topics/read/starred where possible on the Article shape
  const candidates = all.filter((a) => {
    if (unreadOnly && a.read) return false;
    if (starredOnly && !a.starred) return false;
    if (bookmarkedOnly) {
      if (!isBookmarked) return false;
      if (!isBookmarked(a.id)) return false;
    }
    if (feedIds && feedIds.length > 0 && !feedIds.includes(a.feedId)) return false;
    if (topics && topics.length > 0) {
      const aTopics = new Set([
        ...(a.topics || []),
        ...(a.sourceTopics || []),
        ...(a.rawCategories || []),
      ]);
      const hasAny = topics.some((t) => aTopics.has(t));
      if (!hasAny) return false;
    }
    return true;
  });

  const terms = tokenizeQuery(query);

  // If no query, just return recent-ish matches up to limit (respecting filters)
  if (terms.length === 0) {
    // Sort by pubDate desc as a reasonable default
    candidates.sort((x, y) => (y.pubDate || 0) - (x.pubDate || 0));
    return candidates.slice(0, limit).map((article) => ({
      article,
      score: 1,
      matchedFields: [],
    }));
  }

  const scored: LocalSearchResult[] = [];
  for (const article of candidates) {
    const { score, matchedFields } = scoreArticle(article, terms);
    if (score > 0) {
      scored.push({ article, score, matchedFields });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break by recency
    return (b.article.pubDate || 0) - (a.article.pubDate || 0);
  });

  return scored.slice(0, limit);
}

/**
 * Lightweight helper to search with a simple string and get plain articles.
 */
export async function searchArticlesLocalSimple(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<Article[]> {
  const res = await searchArticlesLocal(query, { limit });
  return res.map((r) => r.article);
}

/**
 * Build a tiny in-memory search index from articles for repeated queries.
 * Useful in components that want to avoid repeated IndexedDB roundtrips.
 */
export async function buildLocalSearchIndex(): Promise<{
  articles: Article[];
  search: (query: string, opts?: LocalSearchOptions) => LocalSearchResult[];
}> {
  const all = await articles.getAll();

  return {
    articles: all,
    search: (query: string, opts: LocalSearchOptions = {}) => {
      const {
        limit = DEFAULT_LIMIT,
        unreadOnly = false,
        starredOnly = false,
        bookmarkedOnly = false,
        isBookmarked,
        feedIds,
        topics,
      } = opts;

      const candidates = all.filter((a) => {
        if (unreadOnly && a.read) return false;
        if (starredOnly && !a.starred) return false;
        if (bookmarkedOnly) {
          if (!isBookmarked) return false;
          if (!isBookmarked(a.id)) return false;
        }
        if (feedIds && feedIds.length > 0 && !feedIds.includes(a.feedId)) return false;
        if (topics && topics.length > 0) {
          const aTopics = new Set([
            ...(a.topics || []),
            ...(a.sourceTopics || []),
            ...(a.rawCategories || []),
          ]);
          if (!topics.some((t) => aTopics.has(t))) return false;
        }
        return true;
      });

      const terms = tokenizeQuery(query);
      if (terms.length === 0) {
        candidates.sort((x, y) => (y.pubDate || 0) - (x.pubDate || 0));
        return candidates.slice(0, limit).map((article) => ({
          article,
          score: 1,
          matchedFields: [] as LocalSearchResult["matchedFields"],
        }));
      }

      const scored: LocalSearchResult[] = [];
      for (const article of candidates) {
        const { score, matchedFields } = scoreArticle(article, terms);
        if (score > 0) scored.push({ article, score, matchedFields });
      }
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.article.pubDate || 0) - (a.article.pubDate || 0);
      });

      return scored.slice(0, limit);
    },
  };
}

export type { Article } from "@/lib/db";
