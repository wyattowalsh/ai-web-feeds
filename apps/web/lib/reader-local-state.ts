/**
 * Reader Data Platform — device-local article state (IndexedDB)
 *
 * Manages per-article read / starred / archived / bookmarked state
 * entirely on-device. No authentication required.
 *
 * The canonical store remains IndexedDB, while a versioned localStorage
 * snapshot provides fast recovery when IndexedDB is unavailable or reset.
 */

import { annotations as annotationsDB, articles as articlesDB, syncQueue } from "@/lib/db";
import type { Annotation, Article } from "@/lib/db";
import {
  DEFAULT_LOCAL_STATE,
  DEFAULT_READER_PREFERENCES,
  READER_LOCAL_STATE_VERSION,
  normalizeReaderPreferencesSubset,
} from "@/lib/reader-types";
import type {
  LocalArticleState,
  NormalizedArticle,
  ReaderLocalStateArticleEntry,
  ReaderLocalStateSnapshot,
  ReaderPreferencesBackup,
  ReaderPreferencesSubset,
} from "@/lib/reader-types";

const BOOKMARKED_TAG = "bookmarked";
const CONFLICT_ANNOTATION_PREFIX = "conflict:";
const READER_LOCAL_STATE_EVENT = "aiwebfeeds:reader-local-state";
const CONFLICT_ANNOTATION_COLOR = "#e4bf62";

export const READER_LOCAL_STATE_STORAGE_KEY = "aiwebfeeds.reader.local-state";

let memorySnapshot = createEmptySnapshot();

export interface ReaderLocalStateEventDetail {
  articleId: string;
  state: LocalArticleState;
  lastModified: number;
}

export interface ReaderAnnotationInput {
  id?: string;
  type: Annotation["type"];
  content: string;
  selectionText?: string;
  startOffset?: number;
  endOffset?: number;
  color?: string;
}

export interface ArticleStateConflict {
  articleId: string;
  reason: "missing_remote_article";
  localState: LocalArticleState;
  lastModified: number;
  annotationId: string;
}

// ─── Read helpers ────────────────────────────────────────────────────────────

function createEmptySnapshot(now = 0): ReaderLocalStateSnapshot {
  return {
    version: READER_LOCAL_STATE_VERSION,
    updatedAt: now,
    preferences: {
      ...DEFAULT_READER_PREFERENCES,
      updatedAt: now,
    },
    articles: {},
  };
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function articleToLocalState(article: Article): LocalArticleState {
  return {
    read: article.read,
    starred: article.starred,
    archived: article.archived,
    bookmarked: article.tags.includes(BOOKMARKED_TAG),
  };
}

function articleToSnapshotEntry(article: Article): ReaderLocalStateArticleEntry {
  return {
    ...articleToLocalState(article),
    lastModified: article.lastModified,
  };
}

function snapshotEntryToLocalState(entry: ReaderLocalStateArticleEntry): LocalArticleState {
  return {
    read: entry.read,
    starred: entry.starred,
    archived: entry.archived,
    bookmarked: entry.bookmarked,
  };
}

function normalizeSnapshotEntry(
  value: unknown,
  fallbackTimestamp: number,
): ReaderLocalStateArticleEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    read: typeof value.read === "boolean" ? value.read : DEFAULT_LOCAL_STATE.read,
    starred: typeof value.starred === "boolean" ? value.starred : DEFAULT_LOCAL_STATE.starred,
    archived: typeof value.archived === "boolean" ? value.archived : DEFAULT_LOCAL_STATE.archived,
    bookmarked:
      typeof value.bookmarked === "boolean"
        ? value.bookmarked
        : typeof value.bookmark === "boolean"
          ? value.bookmark
          : DEFAULT_LOCAL_STATE.bookmarked,
    lastModified:
      typeof value.lastModified === "number" && Number.isFinite(value.lastModified)
        ? value.lastModified
        : fallbackTimestamp,
  };
}

function normalizePreferencesBackup(
  value: unknown,
  fallbackTimestamp: number,
): ReaderPreferencesBackup {
  const record = isRecord(value) ? value : null;

  return {
    ...normalizeReaderPreferencesSubset(record as Partial<ReaderPreferencesSubset> | null),
    updatedAt:
      record && typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : fallbackTimestamp,
  };
}

function buildSnapshotEntry(
  state: LocalArticleState,
  lastModified: number,
): ReaderLocalStateArticleEntry {
  return {
    ...state,
    lastModified,
  };
}

function resolveLatestLocalState(
  article: Article | null | undefined,
  snapshotEntry: ReaderLocalStateArticleEntry | undefined,
): ReaderLocalStateArticleEntry | null {
  if (!article && !snapshotEntry) {
    return null;
  }

  if (!article) {
    return snapshotEntry ?? null;
  }

  const articleEntry = articleToSnapshotEntry(article);
  if (!snapshotEntry || articleEntry.lastModified >= snapshotEntry.lastModified) {
    return articleEntry;
  }

  return snapshotEntry;
}

function getConflictAnnotationId(articleId: string): string {
  return `${CONFLICT_ANNOTATION_PREFIX}${articleId}`;
}

function emitReaderLocalStateChange(detail: ReaderLocalStateEventDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ReaderLocalStateEventDetail>(READER_LOCAL_STATE_EVENT, { detail }),
  );
}

export function subscribeToReaderLocalState(
  handler: (detail: ReaderLocalStateEventDetail) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener: EventListener = (event) => {
    const detail = (event as CustomEvent<ReaderLocalStateEventDetail>).detail;
    if (detail) {
      handler(detail);
    }
  };

  window.addEventListener(READER_LOCAL_STATE_EVENT, listener);
  return () => {
    window.removeEventListener(READER_LOCAL_STATE_EVENT, listener);
  };
}

export function serializeReaderLocalStateSnapshot(snapshot: ReaderLocalStateSnapshot): string {
  return JSON.stringify(snapshot);
}

export function migrateReaderLocalStateSnapshot(value: unknown): ReaderLocalStateSnapshot {
  if (!isRecord(value)) {
    return createEmptySnapshot();
  }

  const version = typeof value.version === "number" ? value.version : 1;
  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : 0;
  const articlesSource =
    version >= READER_LOCAL_STATE_VERSION
      ? value.articles
      : value.articleStateById ?? value.articles;
  const articlesRecord = isRecord(articlesSource) ? articlesSource : {};

  const articles = Object.fromEntries(
    Object.entries(articlesRecord).flatMap(([articleId, entryValue]) => {
      const normalized = normalizeSnapshotEntry(entryValue, updatedAt);
      if (articleId.trim().length === 0 || !normalized) {
        return [];
      }

      return [[articleId, normalized] as const];
    }),
  );

  const preferences = normalizePreferencesBackup(value.preferences, updatedAt);
  const maxArticleTimestamp = Object.values(articles).reduce(
    (max, entry) => Math.max(max, entry.lastModified),
    0,
  );

  return {
    version: READER_LOCAL_STATE_VERSION,
    updatedAt: Math.max(updatedAt, preferences.updatedAt, maxArticleTimestamp),
    preferences,
    articles,
  };
}

export function parseReaderLocalStateSnapshot(
  raw: string | null | undefined,
): ReaderLocalStateSnapshot {
  if (!raw) {
    return createEmptySnapshot();
  }

  try {
    return migrateReaderLocalStateSnapshot(JSON.parse(raw));
  } catch {
    return createEmptySnapshot();
  }
}

export function readReaderLocalStateSnapshot(
  storage: Storage | null = getStorage(),
): ReaderLocalStateSnapshot {
  if (!storage) {
    return memorySnapshot;
  }

  try {
    const raw = storage.getItem(READER_LOCAL_STATE_STORAGE_KEY);
    memorySnapshot = parseReaderLocalStateSnapshot(raw);
    return memorySnapshot;
  } catch {
    return memorySnapshot;
  }
}

export function writeReaderLocalStateSnapshot(
  snapshot: ReaderLocalStateSnapshot,
  storage: Storage | null = getStorage(),
): ReaderLocalStateSnapshot {
  const normalized = migrateReaderLocalStateSnapshot(snapshot);
  memorySnapshot = normalized;

  if (!storage) {
    return normalized;
  }

  try {
    storage.setItem(READER_LOCAL_STATE_STORAGE_KEY, serializeReaderLocalStateSnapshot(normalized));
  } catch {
    // Ignore quota and private-browsing failures; memory fallback is already updated.
  }

  return normalized;
}

function updateReaderLocalStateSnapshot(
  mutator: (snapshot: ReaderLocalStateSnapshot) => ReaderLocalStateSnapshot,
): ReaderLocalStateSnapshot {
  const current = readReaderLocalStateSnapshot();
  return writeReaderLocalStateSnapshot(mutator(current));
}

export function getReaderPreferencesBackup(): ReaderPreferencesBackup | null {
  const snapshot = readReaderLocalStateSnapshot();
  return snapshot.preferences.updatedAt > 0 ? snapshot.preferences : null;
}

export function writeReaderPreferencesBackup(
  preferences: ReaderPreferencesSubset,
  updatedAt = Date.now(),
): ReaderPreferencesBackup {
  const nextPreferences = {
    ...normalizeReaderPreferencesSubset(preferences),
    updatedAt,
  };

  updateReaderLocalStateSnapshot((current) => ({
    ...current,
    updatedAt: Math.max(current.updatedAt, updatedAt),
    preferences: nextPreferences,
  }));

  return nextPreferences;
}

export function isDefaultLocalState(state: LocalArticleState): boolean {
  return (
    state.read === DEFAULT_LOCAL_STATE.read &&
    state.starred === DEFAULT_LOCAL_STATE.starred &&
    state.archived === DEFAULT_LOCAL_STATE.archived &&
    state.bookmarked === DEFAULT_LOCAL_STATE.bookmarked
  );
}

async function enqueueSyncItem(
  id: string,
  type: "read" | "star" | "archive" | "tag" | "annotation",
  articleId: string,
  data: Record<string, unknown>,
  timestamp: number,
): Promise<void> {
  await syncQueue.put({
    id,
    type,
    articleId,
    data,
    timestamp,
    synced: false,
  });
}

async function queueArticleStateChanges(
  articleId: string,
  previous: LocalArticleState,
  next: LocalArticleState,
  timestamp: number,
): Promise<void> {
  const work: Promise<void>[] = [];

  if (previous.read !== next.read) {
    work.push(
      enqueueSyncItem(
        `reader:${articleId}:read`,
        "read",
        articleId,
        { value: next.read },
        timestamp,
      ),
    );
  }

  if (previous.starred !== next.starred) {
    work.push(
      enqueueSyncItem(
        `reader:${articleId}:star`,
        "star",
        articleId,
        { value: next.starred },
        timestamp,
      ),
    );
  }

  if (previous.archived !== next.archived) {
    work.push(
      enqueueSyncItem(
        `reader:${articleId}:archive`,
        "archive",
        articleId,
        { value: next.archived },
        timestamp,
      ),
    );
  }

  if (previous.bookmarked !== next.bookmarked) {
    work.push(
      enqueueSyncItem(
        `reader:${articleId}:bookmark`,
        "tag",
        articleId,
        { tag: BOOKMARKED_TAG, value: next.bookmarked },
        timestamp,
      ),
    );
  }

  await Promise.all(work);
}

/**
 * Get the device-local state for a single article.
 * Returns null if the article has never been persisted locally.
 */
export async function getArticleState(articleId: string): Promise<LocalArticleState | null> {
  const [article, snapshot] = await Promise.all([
    articlesDB.get(articleId),
    Promise.resolve(readReaderLocalStateSnapshot()),
  ]);
  const resolved = resolveLatestLocalState(article, snapshot.articles[articleId]);
  if (!resolved) return null;
  return snapshotEntryToLocalState(resolved);
}

/**
 * Get local state, falling back to DEFAULT_LOCAL_STATE when the article
 * has never been written to IndexedDB.
 */
export async function getOrDefaultArticleState(articleId: string): Promise<LocalArticleState> {
  return (await getArticleState(articleId)) ?? { ...DEFAULT_LOCAL_STATE };
}

/**
 * Bulk-fetch local state for multiple article IDs.
 * Missing articles receive the default (all-false) state.
 */
export async function bulkGetLocalState(
  articleIds: string[],
): Promise<Map<string, LocalArticleState>> {
  const unique = Array.from(new Set(articleIds));
  const snapshot = readReaderLocalStateSnapshot();
  const entries = await Promise.all(
    unique.map(async (id) => {
      const article = await articlesDB.get(id);
      const resolved = resolveLatestLocalState(article, snapshot.articles[id]);
      return [
        id,
        resolved ? snapshotEntryToLocalState(resolved) : { ...DEFAULT_LOCAL_STATE },
      ] as const;
    }),
  );
  return new Map(entries);
}

/**
 * Enrich a list of NormalizedArticles with their device-local state.
 * Articles not yet in IndexedDB receive the default (all-false) state.
 */
export async function enrichArticlesWithLocalState(
  articles: NormalizedArticle[],
): Promise<NormalizedArticle[]> {
  const stateMap = await bulkGetLocalState(articles.map((a) => a.id));
  return articles.map((article) => ({
    ...article,
    ...(stateMap.get(article.id) ?? DEFAULT_LOCAL_STATE),
  }));
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/** Build a minimal IDB Article stub from a NormalizedArticle. */
function toIDBArticle(article: NormalizedArticle, now: number): Article {
  const tags = article.bookmarked ? [BOOKMARKED_TAG] : [];

  return {
    id: article.id,
    feedId: article.feedId,
    title: article.title,
    link: article.link,
    content: "",
    summary: article.summary ?? undefined,
    author: article.author ?? undefined,
    pubDate: article.publishedAtMs,
    categories: [...article.categories],
    enclosures: [],
    read: article.read,
    starred: article.starred,
    archived: article.archived,
    tags,
    cachedAt: now,
    lastModified: now,
  };
}

function buildUpdatedArticle(article: Article, state: LocalArticleState, now: number): Article {
  const nextTags = state.bookmarked
    ? Array.from(new Set([...article.tags, BOOKMARKED_TAG]))
    : article.tags.filter((tag) => tag !== BOOKMARKED_TAG);

  return {
    ...article,
    read: state.read,
    starred: state.starred,
    archived: state.archived,
    tags: nextTags,
    lastModified: now,
  };
}

/**
 * Persist state updates for an article.
 *
 * - If the article already exists in IndexedDB it is updated in-place.
 * - If it does not exist and `context` is provided a minimal stub is created.
 * - If neither exists nor context is supplied, the versioned snapshot still
 *   records the local mutation and marks the article as a sync conflict.
 */
export async function setArticleState(
  articleId: string,
  updates: Partial<LocalArticleState>,
  context?: NormalizedArticle,
): Promise<void> {
  const now = Date.now();
  const snapshot = readReaderLocalStateSnapshot();
  const existing = await articlesDB.get(articleId);
  const currentEntry = resolveLatestLocalState(existing, snapshot.articles[articleId]);
  const currentState = currentEntry
    ? snapshotEntryToLocalState(currentEntry)
    : { ...DEFAULT_LOCAL_STATE };
  const nextState: LocalArticleState = {
    ...currentState,
    ...updates,
  };

  const work: Promise<unknown>[] = [];

  if (existing) {
    work.push(articlesDB.put(buildUpdatedArticle(existing, nextState, now)));
  } else if (context) {
    work.push(articlesDB.put(toIDBArticle({ ...context, ...nextState }, now)));
  }

  updateReaderLocalStateSnapshot((currentSnapshot) => {
    const nextArticles = { ...currentSnapshot.articles };

    if (isDefaultLocalState(nextState)) {
      delete nextArticles[articleId];
    } else {
      nextArticles[articleId] = buildSnapshotEntry(nextState, now);
    }

    return {
      ...currentSnapshot,
      updatedAt: Math.max(currentSnapshot.updatedAt, now),
      articles: nextArticles,
    };
  });

  await Promise.all([...work, queueArticleStateChanges(articleId, currentState, nextState, now)]);

  if (existing || context) {
    await clearArticleConflictAnnotation(articleId);
  } else if (!isDefaultLocalState(nextState)) {
    await createArticleConflictAnnotation({
      articleId,
      reason: "missing_remote_article",
      localState: nextState,
      lastModified: now,
      annotationId: getConflictAnnotationId(articleId),
    });
  }

  emitReaderLocalStateChange({
    articleId,
    state: nextState,
    lastModified: now,
  });
}

// ─── Convenience mutators ─────────────────────────────────────────────────────

export async function markRead(articleId: string, context?: NormalizedArticle): Promise<void> {
  await setArticleState(articleId, { read: true }, context);
}

export async function markUnread(articleId: string, context?: NormalizedArticle): Promise<void> {
  await setArticleState(articleId, { read: false }, context);
}

export async function toggleStar(articleId: string, context?: NormalizedArticle): Promise<boolean> {
  const { starred } = await getOrDefaultArticleState(articleId);
  const next = !starred;
  await setArticleState(articleId, { starred: next }, context);
  return next;
}

export async function toggleArchive(
  articleId: string,
  context?: NormalizedArticle,
): Promise<boolean> {
  const { archived } = await getOrDefaultArticleState(articleId);
  const next = !archived;
  await setArticleState(articleId, { archived: next }, context);
  return next;
}

export async function toggleBookmark(
  articleId: string,
  context?: NormalizedArticle,
): Promise<boolean> {
  const { bookmarked } = await getOrDefaultArticleState(articleId);
  const next = !bookmarked;
  await setArticleState(articleId, { bookmarked: next }, context);
  return next;
}

function createAnnotationId(prefix = "annotation"): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}:${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

export async function listArticleAnnotations(articleId: string): Promise<Annotation[]> {
  const annotations = await annotationsDB.getByArticle(articleId);
  return [...annotations].sort(
    (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id),
  );
}

export async function saveArticleAnnotation(
  articleId: string,
  input: ReaderAnnotationInput,
): Promise<Annotation> {
  const content = input.content.trim();
  if (content.length === 0) {
    throw new Error("Annotation content is required");
  }

  const now = Date.now();
  const existing = input.id ? await annotationsDB.get(input.id) : undefined;
  const annotation: Annotation = {
    id: existing?.id ?? input.id ?? createAnnotationId(),
    articleId,
    type: input.type,
    content,
    selectionText: input.selectionText,
    startOffset: input.startOffset,
    endOffset: input.endOffset,
    color: input.color,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await annotationsDB.put(annotation);
  await enqueueSyncItem(
    `annotation:${annotation.id}`,
    "annotation",
    articleId,
    {
      annotationId: annotation.id,
      deleted: false,
      updatedAt: annotation.updatedAt,
    },
    now,
  );

  return annotation;
}

export async function deleteArticleAnnotation(annotationId: string): Promise<void> {
  const annotation = await annotationsDB.get(annotationId);
  if (!annotation) {
    return;
  }

  const now = Date.now();
  await annotationsDB.delete(annotationId);
  await enqueueSyncItem(
    `annotation:${annotationId}`,
    "annotation",
    annotation.articleId,
    {
      annotationId,
      deleted: true,
      updatedAt: now,
    },
    now,
  );
}

export async function detectArticleStateConflict(
  articleId: string,
  remoteArticle: NormalizedArticle | null,
): Promise<ArticleStateConflict | null> {
  if (remoteArticle) {
    return null;
  }

  const snapshot = readReaderLocalStateSnapshot();
  const entry = resolveLatestLocalState(
    await articlesDB.get(articleId),
    snapshot.articles[articleId],
  );
  if (!entry) {
    return null;
  }

  const localState = snapshotEntryToLocalState(entry);
  if (isDefaultLocalState(localState)) {
    return null;
  }

  return {
    articleId,
    reason: "missing_remote_article",
    localState,
    lastModified: entry.lastModified,
    annotationId: getConflictAnnotationId(articleId),
  };
}

export async function createArticleConflictAnnotation(
  conflict: ArticleStateConflict,
): Promise<Annotation> {
  return saveArticleAnnotation(conflict.articleId, {
    id: conflict.annotationId,
    type: "note",
    color: CONFLICT_ANNOTATION_COLOR,
    content: `Sync conflict: kept local changes for ${conflict.articleId} because the remote article is unavailable.`,
  });
}

export async function clearArticleConflictAnnotation(articleId: string): Promise<void> {
  await deleteArticleAnnotation(getConflictAnnotationId(articleId));
}
