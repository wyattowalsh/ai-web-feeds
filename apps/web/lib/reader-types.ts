/**
 * Reader Data Platform — shared normalized types
 *
 * Bridges the server-side FeedPost / AggregateFeedPost types in feed-posts.ts
 * with the client-side Article / IndexedDB types in lib/db/.
 * These are the canonical types consumed by the /reader and /downloads/blog lanes.
 */

// ─── Normalized article ──────────────────────────────────────────────────────

/** A fully-normalized article usable in any reader view */
export interface NormalizedArticle {
  id: string;
  feedId: string;
  feedTitle: string;
  sourceUrl: string;
  title: string;
  link: string;
  summary: string | null;
  author: string | null;
  categories: string[];
  /** ISO-8601 publication date; null when the feed omits it */
  publishedAt: string | null;
  /** Unix-ms timestamp for sorting; null when publishedAt is missing/invalid */
  publishedAtMs: number | null;
  // ── device-local state (persisted in IndexedDB) ───────────────────────────
  read: boolean;
  starred: boolean;
  archived: boolean;
  bookmarked: boolean;
}

/** The mutable, locally-persisted subset of a NormalizedArticle */
export type LocalArticleState = Pick<
  NormalizedArticle,
  "read" | "starred" | "archived" | "bookmarked"
>;

export const DEFAULT_LOCAL_STATE: Readonly<LocalArticleState> = {
  read: false,
  starred: false,
  archived: false,
  bookmarked: false,
};

// ─── Timeline ────────────────────────────────────────────────────────────────

export interface TimelineFetchOptions {
  feedIds: string[];
  /** Total article cap across all feeds; default 24 */
  limit?: number;
  /** Max articles per feed source; default 2 */
  perFeedLimit?: number;
  /** Skip the server-side cache and re-fetch; default false */
  forceRefresh?: boolean;
}

export interface TimelineResult {
  articles: NormalizedArticle[];
  fetchedAt: string;
  expiresAt: string;
  cacheState: "live" | "cached";
  totalSources: number;
  successfulSources: number;
  failedSources: number;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export interface SubscriptionEntry {
  feedId: string;
  followedAt: string | null;
}

export interface FollowsResult {
  userId: string;
  follows: SubscriptionEntry[];
}

// ─── Reader preferences subset ───────────────────────────────────────────────

/** Reader-relevant fields from the full IDB Preferences record */
export interface ReaderPreferencesSubset {
  layout: "list" | "cards" | "compact";
  theme: "light" | "dark" | "system";
  fontSize: number;
  fontFamily: string;
  readingWidth: "narrow" | "medium" | "wide";
  showImages: boolean;
  showSummaries: boolean;
  markAsReadOnScroll: boolean;
}

export const DEFAULT_READER_PREFERENCES: Readonly<ReaderPreferencesSubset> = {
  layout: "cards",
  theme: "system",
  fontSize: 16,
  fontFamily: "system-ui",
  readingWidth: "medium",
  showImages: true,
  showSummaries: true,
  markAsReadOnScroll: false,
};

const VALID_LAYOUTS = new Set<ReaderPreferencesSubset["layout"]>(["list", "cards", "compact"]);
const VALID_THEMES = new Set<ReaderPreferencesSubset["theme"]>(["light", "dark", "system"]);
const VALID_READING_WIDTHS = new Set<ReaderPreferencesSubset["readingWidth"]>([
  "narrow",
  "medium",
  "wide",
]);

export function normalizeReaderPreferencesSubset(
  value?: Partial<ReaderPreferencesSubset> | null,
): ReaderPreferencesSubset {
  const layout = value?.layout;
  const theme = value?.theme;
  const readingWidth = value?.readingWidth;

  return {
    layout: VALID_LAYOUTS.has(layout as ReaderPreferencesSubset["layout"])
      ? (layout as ReaderPreferencesSubset["layout"])
      : DEFAULT_READER_PREFERENCES.layout,
    theme: VALID_THEMES.has(theme as ReaderPreferencesSubset["theme"])
      ? (theme as ReaderPreferencesSubset["theme"])
      : DEFAULT_READER_PREFERENCES.theme,
    fontSize:
      typeof value?.fontSize === "number" && Number.isFinite(value.fontSize) && value.fontSize > 0
        ? value.fontSize
        : DEFAULT_READER_PREFERENCES.fontSize,
    fontFamily:
      typeof value?.fontFamily === "string" && value.fontFamily.trim().length > 0
        ? value.fontFamily.trim()
        : DEFAULT_READER_PREFERENCES.fontFamily,
    readingWidth: VALID_READING_WIDTHS.has(readingWidth as ReaderPreferencesSubset["readingWidth"])
      ? (readingWidth as ReaderPreferencesSubset["readingWidth"])
      : DEFAULT_READER_PREFERENCES.readingWidth,
    showImages:
      typeof value?.showImages === "boolean"
        ? value.showImages
        : DEFAULT_READER_PREFERENCES.showImages,
    showSummaries:
      typeof value?.showSummaries === "boolean"
        ? value.showSummaries
        : DEFAULT_READER_PREFERENCES.showSummaries,
    markAsReadOnScroll:
      typeof value?.markAsReadOnScroll === "boolean"
        ? value.markAsReadOnScroll
        : DEFAULT_READER_PREFERENCES.markAsReadOnScroll,
  };
}

export const READER_LOCAL_STATE_VERSION = 2;

export interface ReaderPreferencesBackup extends ReaderPreferencesSubset {
  updatedAt: number;
}

export interface ReaderLocalStateArticleEntry extends LocalArticleState {
  lastModified: number;
}

export interface ReaderLocalStateSnapshot {
  version: typeof READER_LOCAL_STATE_VERSION;
  updatedAt: number;
  preferences: ReaderPreferencesBackup;
  articles: Record<string, ReaderLocalStateArticleEntry>;
}
