"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowUpRight,
  Bookmark,
  BookOpenText,
  CheckCheck,
  Clock3,
  Filter,
  LayoutGrid,
  List,
  Newspaper,
  PanelRight,
  RefreshCcw,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";

import { FeedCatalog } from "./feed-catalog";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { sanitizeArticlePreviewHtml } from "@/lib/article-preview-html";
import { cn } from "@/lib/cn";
import type { FeedSource } from "@/lib/feeds-filters";
import { getTopics } from "@/lib/feeds-filters";
import { CANONICAL_READER_PATH } from "@/lib/reader-routes";
import {
  type FeedsWorkspaceInitialBrowse,
  type FeedsWorkspaceInitialState,
  type FeedsWorkspaceMode,
} from "@/lib/reader-route";
import { useReaderPreferences } from "@/lib/use-reader-preferences";

type FeedStats = {
  total: number;
  verified: number;
  active: number;
  hasVerificationMetadata: boolean;
  hasActivityMetadata: boolean;
  sourceTypeCount: number;
  byType: Record<string, number>;
  topicCount: number;
};

type FeedsWorkspaceClientProps = {
  mode: FeedsWorkspaceMode;
  feeds: FeedSource[];
  stats: FeedStats;
  initialState: FeedsWorkspaceInitialState;
  initialBrowse: FeedsWorkspaceInitialBrowse | null;
};

type ReaderView = FeedsWorkspaceInitialState["readerView"];
type ArticleSort = FeedsWorkspaceInitialState["sort"];
type VerifiedDraftValue = "" | "true" | "false";
type ReaderArticleState = {
  read: boolean;
  starred: boolean;
  archived: boolean;
  bookmarked: boolean;
};

type WorkspaceArticle = FeedsWorkspaceInitialBrowse["items"][number] & {
  freshness: "corpus" | "live";
  published_at_ms: number | null;
};

const ARTICLE_STATE_STORAGE_PREFIX = "aiwebfeeds.reader.article.";
const DEFAULT_ARTICLE_STATE: ReaderArticleState = {
  read: false,
  starred: false,
  archived: false,
  bookmarked: false,
};
const DEFAULT_PAGE_LIMIT = 24;
const LIVE_REFRESH_SAMPLE_FEED_LIMIT = 18;
const LIVE_BOOTSTRAP_POST_LIMIT = 48;
const LIVE_BOOTSTRAP_PER_FEED_LIMIT = 3;

type ReaderDraftState = {
  query: string;
  sourceType: string;
  topics: string[];
  verified: VerifiedDraftValue;
  readerView: ReaderView;
  sort: ArticleSort;
};

function getSourceTypesFromFeeds(feeds: FeedSource[]): string[] {
  return Array.from(
    new Set(
      feeds
        .map((feed) => feed.source_type)
        .filter((sourceType): sourceType is string => typeof sourceType === "string"),
    ),
  ).sort();
}

function normalizeTopicsValue(topics: string[]): string {
  return topics.join(",");
}

function parseTopicsValue(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
    ),
  );
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function toVerifiedDraftValue(value: boolean | null): VerifiedDraftValue {
  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  return "";
}

function normalizeQueryDraft(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function matchesDraftState(drafts: ReaderDraftState, state: FeedsWorkspaceInitialState): boolean {
  return (
    normalizeQueryDraft(drafts.query) === state.query &&
    (drafts.sourceType || null) === state.sourceType &&
    arraysEqual(drafts.topics, state.topics) &&
    toVerifiedDraftValue(state.verified) === drafts.verified &&
    drafts.readerView === state.readerView &&
    drafts.sort === state.sort
  );
}

function getArticleTopics(article: WorkspaceArticle): string[] {
  return article.topics.length > 0 ? article.topics : article.categories;
}

function formatSnapshotTimestamp(value: string | null): string {
  if (!value) {
    return "Snapshot not generated yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toggleTopic(topics: string[], topic: string): string[] {
  if (topics.includes(topic)) {
    return topics.filter((entry) => entry !== topic);
  }

  return [...topics, topic];
}

function buildCurrentFilterChips(
  state: FeedsWorkspaceInitialState,
  feedLookup: Map<string, FeedSource>,
): Array<{
  key: string;
  label: string;
  overrides: Record<string, string | string[] | null | undefined>;
}> {
  const chips: Array<{
    key: string;
    label: string;
    overrides: Record<string, string | string[] | null | undefined>;
  }> = [];

  if (state.query) {
    chips.push({
      key: "query",
      label: `Search: ${state.query}`,
      overrides: { q: null, cursor: null },
    });
  }

  if (state.sourceType) {
    chips.push({
      key: "sourceType",
      label: `Type: ${state.sourceType}`,
      overrides: { source_type: null, cursor: null },
    });
  }

  for (const topic of state.topics) {
    chips.push({
      key: `topic:${topic}`,
      label: `Topic: ${topic}`,
      overrides: {
        topics: normalizeTopicsValue(state.topics.filter((entry) => entry !== topic)) || null,
        cursor: null,
      },
    });
  }

  if (state.verified === true) {
    chips.push({
      key: "verified:true",
      label: "Verified only",
      overrides: { verified: null, cursor: null },
    });
  } else if (state.verified === false) {
    chips.push({
      key: "verified:false",
      label: "Unverified only",
      overrides: { verified: null, cursor: null },
    });
  }

  if (state.readerView !== "latest") {
    const labels: Record<Exclude<ReaderView, "latest">, string> = {
      unread: "Unread",
      starred: "Starred",
      saved: "Saved",
      archived: "Archived",
    };
    chips.push({
      key: "readerView",
      label: `View: ${labels[state.readerView as Exclude<ReaderView, "latest">]}`,
      overrides: { reader_view: null },
    });
  }

  if (state.sort !== "latest") {
    const labels: Record<Exclude<ArticleSort, "latest">, string> = {
      oldest: "Oldest first",
      source: "By source",
    };
    chips.push({
      key: "sort",
      label: `Sort: ${labels[state.sort as Exclude<ArticleSort, "latest">]}`,
      overrides: { sort: null, reader_sort: null, cursor: null },
    });
  }

  for (const feedId of state.feedIds) {
    const feed = feedLookup.get(feedId);
    chips.push({
      key: `feed:${feedId}`,
      label: `Source: ${feed?.title ?? feedId}`,
      overrides: {
        feed: state.feedIds.filter((entry) => entry !== feedId),
        cursor: null,
      },
    });
  }

  return chips;
}

function normalizeArticle(article: FeedsWorkspaceInitialBrowse["items"][number]): WorkspaceArticle {
  return {
    ...article,
    freshness: "corpus",
    published_at_ms: article.published_at ? Date.parse(article.published_at) : null,
  };
}

function normalizeLiveArticle(post: {
  id: string;
  feedId: string;
  feedTitle: string;
  title: string;
  link: string;
  summary: string | null;
  author: string | null;
  categories: string[];
  publishedAt: string | null;
}): WorkspaceArticle {
  return {
    id: `${post.feedId}:${post.id}`,
    feed_id: post.feedId,
    feed_title: post.feedTitle,
    title: post.title,
    link: post.link,
    summary: post.summary,
    content_html: null,
    author: post.author,
    published_at: post.publishedAt,
    categories: post.categories,
    topics: post.categories,
    source_type: "feed",
    verified: false,
    is_active: true,
    freshness: "live",
    published_at_ms: post.publishedAt ? Date.parse(post.publishedAt) : null,
  };
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function articleStateStorageKey(articleId: string): string {
  return `${ARTICLE_STATE_STORAGE_PREFIX}${articleId}`;
}

function readArticleState(articleId: string): ReaderArticleState {
  if (!canUseStorage()) {
    return DEFAULT_ARTICLE_STATE;
  }

  try {
    const stored = window.localStorage.getItem(articleStateStorageKey(articleId));
    if (!stored) {
      return DEFAULT_ARTICLE_STATE;
    }

    const parsed = JSON.parse(stored) as Partial<ReaderArticleState>;
    return {
      read: parsed.read ?? false,
      starred: parsed.starred ?? false,
      archived: parsed.archived ?? false,
      bookmarked: parsed.bookmarked ?? false,
    };
  } catch {
    return DEFAULT_ARTICLE_STATE;
  }
}

function writeArticleState(articleId: string, nextState: ReaderArticleState): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(articleStateStorageKey(articleId), JSON.stringify(nextState));
}

function buildReaderHref(
  state: {
    query: string;
    sourceType: string | null;
    topics: string[];
    verified: boolean | null;
    feedIds: string[];
    sort: ArticleSort;
    readerView: ReaderView;
    cursor: number;
  },
  overrides: Record<string, string | string[] | null | undefined> = {},
): string {
  const params = new URLSearchParams();

  if (state.query) {
    params.set("q", state.query);
  }
  if (state.sourceType) {
    params.set("source_type", state.sourceType);
  }
  if (state.topics.length > 0) {
    params.set("topics", normalizeTopicsValue(state.topics));
  }
  if (typeof state.verified === "boolean") {
    params.set("verified", String(state.verified));
  }
  for (const feedId of state.feedIds) {
    params.append("feed", feedId);
  }
  if (state.sort !== "latest") {
    params.set("sort", state.sort);
    params.set("reader_sort", state.sort);
  }
  if (state.readerView !== "latest") {
    params.set("reader_view", state.readerView);
  }
  if (state.cursor > 0) {
    params.set("cursor", String(state.cursor));
  }

  for (const [key, value] of Object.entries(overrides)) {
    params.delete(key);

    if (value == null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
      continue;
    }

    params.set(key, value);
  }

  const nextQuery = params.toString();
  return nextQuery ? `${CANONICAL_READER_PATH}?${nextQuery}` : CANONICAL_READER_PATH;
}

function matchesFeedSlice(
  feed: FeedSource,
  filters: {
    feedIds: string[];
    sourceType: string | null;
    topics: string[];
    verified: boolean | null;
  },
): boolean {
  const feedId = feed.id ?? "";
  if (filters.feedIds.length > 0 && !filters.feedIds.includes(feedId)) {
    return false;
  }

  if (filters.sourceType && feed.source_type !== filters.sourceType) {
    return false;
  }

  if (typeof filters.verified === "boolean" && feed.verified !== filters.verified) {
    return false;
  }

  if (filters.topics.length > 0) {
    const feedTopics = new Set([...(feed.topics ?? []), ...(feed.tags ?? [])]);
    if (!filters.topics.some((topic) => feedTopics.has(topic))) {
      return false;
    }
  }

  return feed.is_active !== false;
}

function matchesReaderView(view: ReaderView, state: ReaderArticleState): boolean {
  if (view === "unread") {
    return !state.read && !state.archived;
  }

  if (view === "starred") {
    return state.starred && !state.archived;
  }

  if (view === "saved") {
    return state.bookmarked && !state.archived;
  }

  if (view === "archived") {
    return state.archived;
  }

  return !state.archived;
}

function PreviewPane({
  article,
  state,
  onToggleState,
  onClose,
  variant = "panel",
}: {
  article: WorkspaceArticle | null;
  state: ReaderArticleState;
  onToggleState: (partial: Partial<ReaderArticleState>) => void;
  onClose?: () => void;
  variant?: "panel" | "inline";
}) {
  const [summaryMarkup, setSummaryMarkup] = useState<string | null>(null);

  useEffect(() => {
    setSummaryMarkup(
      article ? sanitizeArticlePreviewHtml(article.content_html, article.link) : null,
    );
  }, [article]);

  if (!article) {
    return (
      <div className="surface-card space-y-4">
        <p className="metric-label">Preview</p>
        <EmptyState
          icon={BookOpenText}
          title="Select an article"
          description="Choose a post from the current result page to preview its summary and metadata."
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "surface-card space-y-5",
        variant === "panel" &&
          "flex h-full max-h-[calc(100vh-3rem)] flex-col overflow-hidden border-(--brand)/20 bg-[color-mix(in_oklab,var(--surface)_98%,white)]",
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="metric-label">{article.feed_title}</span>
            {article.freshness === "live" ? (
              <span className="rounded-full bg-(--brand-soft) px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-(--brand-strong)">
                Fresh
              </span>
            ) : null}
            {article.verified ? (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Verified
              </span>
            ) : null}
          </div>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-(--ink)">{article.title}</h2>
          <p className="small-note">
            {article.published_at
              ? new Date(article.published_at).toLocaleString()
              : "Unknown publish date"}
            {article.author ? ` · ${article.author}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            Read original
            <ArrowUpRight className="size-4" />
          </Link>
          <Button
            type="button"
            variant={state.read ? "secondary" : "outline"}
            onClick={() => onToggleState({ read: !state.read })}
          >
            {state.read ? "Marked read" : "Mark read"}
          </Button>
          <Button
            type="button"
            variant={state.starred ? "secondary" : "outline"}
            onClick={() => onToggleState({ starred: !state.starred })}
          >
            <Star className="size-4" />
            {state.starred ? "Starred" : "Star"}
          </Button>
          <Button
            type="button"
            variant={state.bookmarked ? "secondary" : "outline"}
            onClick={() => onToggleState({ bookmarked: !state.bookmarked })}
          >
            <Bookmark className="size-4" />
            {state.bookmarked ? "Saved" : "Save"}
          </Button>
          <Button
            type="button"
            variant={state.archived ? "secondary" : "outline"}
            onClick={() => onToggleState({ archived: !state.archived })}
          >
            <Archive className="size-4" />
            {state.archived ? "Archived" : "Archive"}
          </Button>
        </div>
      </div>

      <div className={cn("space-y-4", variant === "panel" && "overflow-y-auto pr-1")}>
        {article.summary ? (
          <div className="rounded-3xl border border-(--line) bg-(--surface-muted) p-4 text-sm text-(--ink-muted)">
            {article.summary}
          </div>
        ) : null}

        {summaryMarkup ? (
          <article
            className="prose prose-sm max-w-none text-(--ink)"
            dangerouslySetInnerHTML={{ __html: summaryMarkup }}
          />
        ) : null}

        <div className="space-y-2">
          <p className="metric-label">Topic signals</p>
          <div className="flex flex-wrap gap-2">
            {getArticleTopics(article).map((topic) => (
              <span
                key={`${article.id}-${topic}`}
                className="rounded-full border border-(--line) bg-(--surface) px-3 py-1 text-xs font-semibold text-(--ink-muted)"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReaderWorkspace({
  feeds,
  stats,
  initialState,
  initialBrowse,
}: {
  feeds: FeedSource[];
  stats: FeedStats;
  initialState: FeedsWorkspaceInitialState;
  initialBrowse: FeedsWorkspaceInitialBrowse;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { preferences, update } = useReaderPreferences();
  const initialParamsString = useMemo(
    () =>
      buildReaderHref(
        {
          query: initialState.query,
          sourceType: initialState.sourceType,
          topics: initialState.topics,
          verified: initialState.verified,
          feedIds: initialState.feedIds,
          sort: initialState.sort,
          readerView: initialState.readerView,
          cursor: initialState.cursor,
        },
        {},
      ),
    [initialState],
  );

  const [queryDraft, setQueryDraft] = useState(initialState.query);
  const [sourceTypeDraft, setSourceTypeDraft] = useState(initialState.sourceType ?? "");
  const [topicsDraft, setTopicsDraft] = useState(initialState.topics);
  const [verifiedDraft, setVerifiedDraft] = useState<VerifiedDraftValue>(
    toVerifiedDraftValue(initialState.verified),
  );
  const [readerViewDraft, setReaderViewDraft] = useState(initialState.readerView);
  const [sortDraft, setSortDraft] = useState(initialState.sort);
  const [browse, setBrowse] = useState(initialBrowse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [overlayArticles, setOverlayArticles] = useState<WorkspaceArticle[]>([]);
  const [articleStates, setArticleStates] = useState<Record<string, ReaderArticleState>>({});
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const firstLoadRef = useRef(true);
  const liveBootstrapAttemptedKeyRef = useRef<string | null>(null);
  const searchParamsString = searchParams.toString();

  const currentState = useMemo<FeedsWorkspaceInitialState>(() => {
    const query = searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
    const sourceType = searchParams.get("source_type")?.trim() || null;
    const verifiedValue = searchParams.get("verified");
    const verified = verifiedValue === "true" ? true : verifiedValue === "false" ? false : null;
    const cursor = Number.parseInt(searchParams.get("cursor") ?? "0", 10);
    const limit = Number.parseInt(searchParams.get("limit") ?? `${DEFAULT_PAGE_LIMIT}`, 10);
    const sortValue =
      searchParams.get("sort")?.trim().toLowerCase() ??
      searchParams.get("reader_sort")?.trim().toLowerCase() ??
      "";
    const readerView = searchParams.get("reader_view")?.trim().toLowerCase() ?? "";

    return {
      query,
      feedIds: searchParams
        .getAll("feed")
        .map((feedId) => feedId.trim())
        .filter(Boolean),
      sourceType,
      topics: parseTopicsValue(searchParams.get("topics") ?? ""),
      verified,
      sort: sortValue === "oldest" || sortValue === "source" ? sortValue : "latest",
      readerView:
        readerView === "unread" ||
        readerView === "starred" ||
        readerView === "saved" ||
        readerView === "archived"
          ? readerView
          : "latest",
      cursor: Number.isFinite(cursor) && cursor > 0 ? cursor : 0,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : DEFAULT_PAGE_LIMIT,
    };
  }, [searchParams]);

  useEffect(() => {
    setQueryDraft(currentState.query);
    setSourceTypeDraft(currentState.sourceType ?? "");
    setTopicsDraft(currentState.topics);
    setVerifiedDraft(toVerifiedDraftValue(currentState.verified));
    setReaderViewDraft(currentState.readerView);
    setSortDraft(currentState.sort);
  }, [
    currentState.query,
    currentState.readerView,
    currentState.sort,
    currentState.sourceType,
    currentState.topics,
    currentState.verified,
  ]);

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      const initialQuery = initialParamsString.split("?")[1] ?? "";
      if (searchParamsString === initialQuery) {
        return;
      }
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (currentState.query) {
      params.set("q", currentState.query);
    }
    if (currentState.sourceType) {
      params.set("source_type", currentState.sourceType);
    }
    if (currentState.topics.length > 0) {
      params.set("topics", normalizeTopicsValue(currentState.topics));
    }
    if (typeof currentState.verified === "boolean") {
      params.set("verified", String(currentState.verified));
    }
    if (currentState.sort !== "latest") {
      params.set("sort", currentState.sort);
    }
    if (currentState.cursor > 0) {
      params.set("cursor", String(currentState.cursor));
    }
    if (currentState.limit !== DEFAULT_PAGE_LIMIT) {
      params.set("limit", String(currentState.limit));
    }
    for (const feedId of currentState.feedIds) {
      params.append("feed", feedId);
    }

    setOverlayArticles([]);
    setLoading(true);
    setError(null);

    void fetch(`/api/articles?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to load articles");
        }

        return (await response.json()) as FeedsWorkspaceInitialBrowse;
      })
      .then((payload) => {
        setBrowse(payload);
      })
      .catch((nextError) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Failed to load articles");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentState, initialParamsString, searchParamsString]);

  const candidateFeeds = useMemo(
    () =>
      feeds.filter((feed) =>
        matchesFeedSlice(feed, {
          feedIds: currentState.feedIds,
          sourceType: currentState.sourceType,
          topics: currentState.topics,
          verified: currentState.verified,
        }),
      ),
    [
      currentState.feedIds,
      currentState.sourceType,
      currentState.topics,
      currentState.verified,
      feeds,
    ],
  );

  const articleStateMap = useMemo(() => {
    const nextStateMap: Record<string, ReaderArticleState> = {};
    for (const article of [...overlayArticles, ...browse.items].map(normalizeArticle)) {
      nextStateMap[article.id] = articleStates[article.id] ?? readArticleState(article.id);
    }
    return nextStateMap;
  }, [articleStates, browse.items, overlayArticles]);

  useEffect(() => {
    setArticleStates((current) => {
      const nextState = { ...current };
      let changed = false;

      for (const article of [...overlayArticles, ...browse.items].map(normalizeArticle)) {
        if (!nextState[article.id]) {
          nextState[article.id] = readArticleState(article.id);
          changed = true;
        }
      }

      return changed ? nextState : current;
    });
  }, [browse.items, overlayArticles]);

  const mergedArticles = useMemo(() => {
    const seen = new Set<string>();
    const ordered = [...overlayArticles, ...browse.items.map(normalizeArticle)];
    return ordered.filter((article) => {
      const dedupeKey = article.id || `${article.feed_id}:${article.link}`;
      if (seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    });
  }, [browse.items, overlayArticles]);

  const visibleArticles = useMemo(() => {
    return mergedArticles.filter((article) =>
      matchesReaderView(
        currentState.readerView,
        articleStateMap[article.id] ?? DEFAULT_ARTICLE_STATE,
      ),
    );
  }, [articleStateMap, currentState.readerView, mergedArticles]);

  useEffect(() => {
    if (previewArticleId && !visibleArticles.some((article) => article.id === previewArticleId)) {
      setPreviewArticleId(null);
    }
  }, [previewArticleId, visibleArticles]);

  const selectedArticle =
    visibleArticles.find((article) => article.id === previewArticleId) ?? null;

  const selectedArticleState = selectedArticle
    ? articleStateMap[selectedArticle.id] ?? DEFAULT_ARTICLE_STATE
    : DEFAULT_ARTICLE_STATE;

  const updateUrl = useCallback(
    (overrides: Record<string, string | string[] | null | undefined>) => {
      const nextHref = buildReaderHref(currentState, overrides);
      router.replace(nextHref, { scroll: false });
    },
    [currentState, router],
  );

  const updateState = (articleId: string, partial: Partial<ReaderArticleState>) => {
    setArticleStates((current) => {
      const nextArticleState = {
        ...(current[articleId] ?? readArticleState(articleId)),
        ...partial,
      };
      writeArticleState(articleId, nextArticleState);
      return {
        ...current,
        [articleId]: nextArticleState,
      };
    });
  };

  const refreshLatest = useCallback(async () => {
    const shouldFetchAllMatchingSources = browse.corpus.is_empty && browse.items.length === 0;
    const feedIds =
      currentState.feedIds.length > 0
        ? currentState.feedIds
        : candidateFeeds
            .slice(0, shouldFetchAllMatchingSources ? undefined : LIVE_REFRESH_SAMPLE_FEED_LIMIT)
            .map((feed) => feed.id ?? "")
            .filter(Boolean);

    if (feedIds.length === 0) {
      setRefreshError("Choose at least one source to refresh.");
      return;
    }

    setRefreshing(true);
    setRefreshError(null);

    try {
      const response = await fetch("/api/feeds/posts/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          feedIds,
          limit: LIVE_BOOTSTRAP_POST_LIMIT,
          perFeedLimit: LIVE_BOOTSTRAP_PER_FEED_LIMIT,
          refresh: true,
          q: currentState.query || null,
          sort: currentState.sort,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to refresh latest posts");
      }

      const payload = (await response.json()) as {
        posts: Array<{
          id: string;
          feedId: string;
          feedTitle: string;
          title: string;
          link: string;
          summary: string | null;
          author: string | null;
          categories: string[];
          publishedAt: string | null;
        }>;
      };
      const normalizedPosts = payload.posts.map(normalizeLiveArticle);

      if (browse.corpus.is_empty && browse.items.length === 0) {
        setOverlayArticles(normalizedPosts);
        return;
      }

      const existingKeys = new Set(
        mergedArticles.map((article) => article.id || `${article.feed_id}:${article.link}`),
      );
      const nextOverlay = normalizedPosts.filter((article) => {
        const key = article.id || `${article.feed_id}:${article.link}`;
        return !existingKeys.has(key);
      });

      setOverlayArticles(nextOverlay);
    } catch (nextError) {
      setRefreshError(
        nextError instanceof Error ? nextError.message : "Failed to refresh latest posts",
      );
    } finally {
      setRefreshing(false);
    }
  }, [
    browse.corpus.is_empty,
    browse.items.length,
    candidateFeeds,
    currentState.feedIds,
    currentState.query,
    currentState.sort,
    mergedArticles,
  ]);

  const sourceTypes = useMemo(() => getSourceTypesFromFeeds(feeds), [feeds]);
  const topicOptions = useMemo(() => getTopics(feeds), [feeds]);
  const topicCounts = useMemo(
    () =>
      topicOptions
        .map((topic) => ({
          topic,
          count: feeds.filter((feed) =>
            new Set([...(feed.topics ?? []), ...(feed.tags ?? [])]).has(topic),
          ).length,
        }))
        .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic))
        .slice(0, 12),
    [feeds, topicOptions],
  );
  const feedLookup = useMemo(
    () =>
      new Map(
        feeds
          .filter((feed): feed is FeedSource & { id: string } => typeof feed.id === "string")
          .map((feed) => [feed.id, feed]),
      ),
    [feeds],
  );
  const corpusEmpty = browse.corpus.is_empty;
  const canClearArticleFilters =
    Boolean(currentState.query) || currentState.readerView !== "latest" || currentState.cursor > 0;
  const canResetWorkspace =
    canClearArticleFilters ||
    Boolean(currentState.sourceType) ||
    currentState.topics.length > 0 ||
    currentState.feedIds.length > 0 ||
    currentState.verified !== null ||
    currentState.sort !== "latest";
  const clearArticleFiltersHref = buildReaderHref(currentState, {
    q: null,
    reader_view: null,
    cursor: null,
  });
  const resetWorkspaceHref = CANONICAL_READER_PATH;
  const catalogRecoveryHref = buildReaderHref(currentState, {
    mode: "catalog",
    q: null,
    reader_view: null,
    sort: null,
    reader_sort: null,
    cursor: null,
  });
  const filterSummary =
    currentState.feedIds.length > 0
      ? `${currentState.feedIds.length} pinned feed${currentState.feedIds.length === 1 ? "" : "s"}`
      : `${candidateFeeds.length} active source${
          candidateFeeds.length === 1 ? "" : "s"
        } matching these filters`;
  const activeFilterChips = useMemo(
    () => buildCurrentFilterChips(currentState, feedLookup),
    [currentState, feedLookup],
  );
  const liveBootstrapKey = useMemo(
    () =>
      [
        currentState.query,
        currentState.sourceType ?? "",
        currentState.topics.join(","),
        currentState.verified === null ? "" : String(currentState.verified),
        currentState.feedIds.join(","),
        currentState.sort,
      ].join("|"),
    [currentState],
  );
  const draftState: ReaderDraftState = useMemo(
    () => ({
      query: queryDraft,
      sourceType: sourceTypeDraft,
      topics: topicsDraft,
      verified: verifiedDraft,
      readerView: readerViewDraft,
      sort: sortDraft,
    }),
    [queryDraft, readerViewDraft, sortDraft, sourceTypeDraft, topicsDraft, verifiedDraft],
  );
  const hasPendingDraftChanges = !matchesDraftState(draftState, currentState);
  const snapshotTimestamp = browse.corpus.generated_at ?? browse.corpus.latest_published_at ?? null;
  const snapshotCards = [
    {
      label: "Snapshot",
      value: corpusEmpty
        ? "Live mode"
        : snapshotTimestamp
          ? formatSnapshotTimestamp(snapshotTimestamp)
          : "Unavailable",
      note: corpusEmpty
        ? "Recent posts loaded through the web app server"
        : browse.corpus.generated_at
          ? "Precomputed article snapshot loaded at first render"
          : "Reader is waiting for a prepared snapshot",
      icon: Clock3,
    },
    {
      label: "Articles",
      value: String(browse.corpus.article_count),
      note: corpusEmpty
        ? "Generated corpus rows; live posts appear in the stream"
        : "Base snapshot rows ready for reading",
      icon: Newspaper,
    },
    {
      label: "Sources",
      value: String(corpusEmpty ? candidateFeeds.length : stats.active),
      note: corpusEmpty
        ? `${candidateFeeds.length} matching sources checked live`
        : `${stats.verified} verified sources currently tracked`,
      icon: Filter,
    },
    {
      label: "Live overlay",
      value: String(overlayArticles.length),
      note:
        overlayArticles.length > 0
          ? corpusEmpty
            ? "Recent posts fetched from matching feeds"
            : "Newer posts layered on top of the snapshot"
          : "No live refresh applied yet",
      icon: RefreshCcw,
    },
  ];

  useEffect(() => {
    if (!corpusEmpty || overlayArticles.length > 0 || refreshing) {
      return;
    }

    if (liveBootstrapAttemptedKeyRef.current === liveBootstrapKey) {
      return;
    }

    liveBootstrapAttemptedKeyRef.current = liveBootstrapKey;
    void refreshLatest();
  }, [corpusEmpty, liveBootstrapKey, overlayArticles.length, refreshLatest, refreshing]);

  const applyDrafts = useCallback(() => {
    updateUrl({
      q: normalizeQueryDraft(queryDraft) || null,
      source_type: sourceTypeDraft || null,
      topics: topicsDraft.length > 0 ? normalizeTopicsValue(topicsDraft) : null,
      verified: verifiedDraft || null,
      reader_view: readerViewDraft === "latest" ? null : readerViewDraft,
      sort: sortDraft === "latest" ? null : sortDraft,
      reader_sort: sortDraft === "latest" ? null : sortDraft,
      cursor: null,
    });
    setMobileControlsOpen(false);
  }, [
    queryDraft,
    readerViewDraft,
    sortDraft,
    sourceTypeDraft,
    topicsDraft,
    updateUrl,
    verifiedDraft,
  ]);

  const resetDrafts = useCallback(() => {
    setQueryDraft("");
    setSourceTypeDraft("");
    setTopicsDraft([]);
    setVerifiedDraft("");
    setReaderViewDraft("latest");
    setSortDraft("latest");
    updateUrl({
      q: null,
      source_type: null,
      topics: null,
      verified: null,
      reader_view: null,
      sort: null,
      reader_sort: null,
      cursor: null,
    });
    setMobileControlsOpen(false);
  }, [updateUrl]);

  const handleSelectArticle = useCallback((articleId: string) => {
    setPreviewArticleId((current) => (current === articleId ? null : articleId));
  }, []);

  useEffect(() => {
    if (!previewArticleId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewArticleId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewArticleId]);

  if (corpusEmpty && overlayArticles.length === 0) {
    return (
      <div className="space-y-6">
        <div className="surface-card flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="metric-label">AI Web Feeds</p>
            <h1 className="text-3xl font-semibold tracking-tight text-(--ink)">
              {refreshError ? "Live posts unavailable" : "Loading live posts"}
            </h1>
            <p className="small-note max-w-3xl">
              {refreshError
                ? `${refreshError} You can still browse sources or retry the live fetch.`
                : `Checking ${candidateFeeds.length} matching source${
                    candidateFeeds.length === 1 ? "" : "s"
                  } through the web app server so the browser does not have to fetch RSS origins directly.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildReaderHref(currentState, { mode: "catalog" })}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Browse sources
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void refreshLatest()}
              disabled={refreshing}
            >
              Try again
            </Button>
          </div>
        </div>

        <EmptyState
          icon={Newspaper}
          title={refreshError ? "Could not fetch live posts" : "Fetching recent posts"}
          description={
            refreshError
              ? "The reader can still open the source catalog while live feed fetching recovers."
              : "The server is fetching recent RSS and Atom entries across the current source slice."
          }
          tips={[
            "Browsers usually cannot fetch arbitrary RSS feeds directly because feed origins often block cross-origin requests.",
            "The web app fetches through its own API route, then returns normalized posts to the client.",
            "A generated article snapshot is still useful for speed and history, but it is not required for a live first read.",
          ]}
          className="text-left"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface-card flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="metric-label">AI Web Feeds</p>
          <h1 className="text-3xl font-semibold tracking-tight text-(--ink)">
            Latest AI posts from across the open web
          </h1>
          <p className="small-note max-w-3xl">
            Open the reader first, narrow the current source slice when you need focus, and keep
            local reading state in this browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={refreshLatest} disabled={refreshing}>
            <RefreshCcw className={cn("size-4", refreshing && "animate-spin")} />
            {refreshing ? "Checking live posts..." : "Refresh latest"}
          </Button>
          <Link
            href={buildReaderHref(currentState, { mode: "catalog" })}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Sources
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {snapshotCards.map(({ label, value, note, icon: Icon }) => (
          <div key={label} className="surface-card flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="metric-label">{label}</p>
              <p
                className={cn(
                  label === "Snapshot" ? "text-lg font-semibold text-(--ink)" : "metric-value",
                )}
              >
                {value}
              </p>
              <p className="small-note">{note}</p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
              <Icon className="size-5" />
            </span>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]",
          selectedArticle && "2xl:pr-[26rem]",
        )}
      >
        <aside className="hidden xl:block xl:sticky xl:top-24 xl:self-start">
          <div className="surface-card space-y-5">
            <div className="space-y-2">
              <p className="metric-label">Reader controls</p>
              <p className="small-note">
                Refine the current source slice, then apply the exact set of posts you want to read.
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                applyDrafts();
              }}
            >
              <label className="space-y-1.5 text-sm">
                <span className="small-note">Search posts</span>
                <Input
                  aria-label="Search posts"
                  placeholder="Search titles, summaries, authors"
                  value={queryDraft}
                  onChange={(event) => setQueryDraft(event.target.value)}
                />
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="small-note">Source type</span>
                <Select
                  aria-label="Source type"
                  value={sourceTypeDraft}
                  onChange={(event) => setSourceTypeDraft(event.target.value)}
                >
                  <option value="">All source types</option>
                  {sourceTypes.map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {sourceType}
                    </option>
                  ))}
                </Select>
              </label>

              <div className="space-y-3">
                <div className="space-y-1.5 text-sm">
                  <span className="small-note">Topic focus</span>
                  {topicsDraft.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {topicsDraft.map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => setTopicsDraft(toggleTopic(topicsDraft, topic))}
                          className="inline-flex items-center gap-2 rounded-full border border-(--brand) bg-(--brand-soft) px-3 py-1 text-xs font-semibold text-(--brand-strong)"
                        >
                          {topic}
                          <X className="size-3.5" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="small-note">Choose one or more topic slices.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {topicCounts.map(({ topic, count }) => (
                    <button
                      key={topic}
                      type="button"
                      aria-pressed={topicsDraft.includes(topic)}
                      onClick={() => setTopicsDraft(toggleTopic(topicsDraft, topic))}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-150",
                        topicsDraft.includes(topic)
                          ? "border-(--brand) bg-(--brand-soft) text-(--brand-strong)"
                          : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)",
                      )}
                    >
                      {topic}
                      <span className="ml-2 text-[0.68rem] uppercase tracking-[0.12em] opacity-70">
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="space-y-1.5 text-sm">
                <span className="small-note">Verification</span>
                <Select
                  aria-label="Verification"
                  value={verifiedDraft}
                  onChange={(event) => setVerifiedDraft(event.target.value as VerifiedDraftValue)}
                >
                  <option value="">All feeds</option>
                  <option value="true">Verified only</option>
                  <option value="false">Unverified only</option>
                </Select>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="small-note">Reader view</span>
                <Select
                  aria-label="Reader view"
                  value={readerViewDraft}
                  onChange={(event) => setReaderViewDraft(event.target.value as ReaderView)}
                >
                  <option value="latest">Latest</option>
                  <option value="unread">Unread</option>
                  <option value="saved">Saved</option>
                  <option value="starred">Starred</option>
                  <option value="archived">Archived</option>
                </Select>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="small-note">Sort</span>
                <Select
                  aria-label="Sort articles"
                  value={sortDraft}
                  onChange={(event) => setSortDraft(event.target.value as ArticleSort)}
                >
                  <option value="latest">Latest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="source">By source</option>
                </Select>
              </label>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={preferences.layout === "cards" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => update({ layout: "cards" })}
                >
                  <LayoutGrid className="size-4" />
                  Cards
                </Button>
                <Button
                  type="button"
                  variant={preferences.layout === "list" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => update({ layout: "list" })}
                >
                  <List className="size-4" />
                  List
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-(--line) pt-4">
                <Button type="submit" className="flex-1" disabled={!hasPendingDraftChanges}>
                  Apply filters
                </Button>
                <Button type="button" variant="outline" onClick={resetDrafts}>
                  Reset
                </Button>
              </div>
            </form>

            <div className="rounded-3xl border border-(--line) bg-(--surface-muted) p-4">
              <p className="metric-label">Current slice</p>
              <div className="mt-3 space-y-2 text-sm text-(--ink-muted)">
                <p>{filterSummary}</p>
                <p>
                  {browse.total_matched} article match{browse.total_matched === 1 ? "" : "es"} ·{" "}
                  {visibleArticles.length} visible on this page
                </p>
                <p>
                  Snapshot: {browse.corpus.article_count} articles from {browse.corpus.feed_count}{" "}
                  sources
                </p>
                <p>
                  Catalog: {stats.total} tracked sources · {stats.topicCount} topics
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="space-y-5">
          <details
            className="surface-card xl:hidden"
            open={mobileControlsOpen}
            onToggle={(event) =>
              setMobileControlsOpen((event.currentTarget as HTMLDetailsElement).open)
            }
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-(--ink-muted)" />
                <span className="text-sm font-semibold text-(--ink)">Filters and view</span>
              </div>
              <span className="small-note">
                {activeFilterChips.length > 0 ? `${activeFilterChips.length} active` : "All posts"}
              </span>
            </summary>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                applyDrafts();
              }}
            >
              <label className="space-y-1.5 text-sm">
                <span className="small-note">Search posts</span>
                <Input
                  aria-label="Search posts mobile"
                  placeholder="Search titles, summaries, authors"
                  value={queryDraft}
                  onChange={(event) => setQueryDraft(event.target.value)}
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="small-note">Source type</span>
                <Select
                  aria-label="Source type mobile"
                  value={sourceTypeDraft}
                  onChange={(event) => setSourceTypeDraft(event.target.value)}
                >
                  <option value="">All source types</option>
                  {sourceTypes.map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {sourceType}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="space-y-2">
                <span className="small-note">Topic focus</span>
                <div className="flex flex-wrap gap-2">
                  {topicCounts.map(({ topic }) => (
                    <button
                      key={topic}
                      type="button"
                      aria-pressed={topicsDraft.includes(topic)}
                      onClick={() => setTopicsDraft(toggleTopic(topicsDraft, topic))}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-150",
                        topicsDraft.includes(topic)
                          ? "border-(--brand) bg-(--brand-soft) text-(--brand-strong)"
                          : "border-(--line) bg-(--surface) text-(--ink-muted)",
                      )}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="small-note">Verification</span>
                  <Select
                    aria-label="Verification mobile"
                    value={verifiedDraft}
                    onChange={(event) => setVerifiedDraft(event.target.value as VerifiedDraftValue)}
                  >
                    <option value="">All feeds</option>
                    <option value="true">Verified only</option>
                    <option value="false">Unverified only</option>
                  </Select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="small-note">View</span>
                  <Select
                    aria-label="Reader view mobile"
                    value={readerViewDraft}
                    onChange={(event) => setReaderViewDraft(event.target.value as ReaderView)}
                  >
                    <option value="latest">Latest</option>
                    <option value="unread">Unread</option>
                    <option value="saved">Saved</option>
                    <option value="starred">Starred</option>
                    <option value="archived">Archived</option>
                  </Select>
                </label>
              </div>
              <label className="space-y-1.5 text-sm">
                <span className="small-note">Sort</span>
                <Select
                  aria-label="Sort articles mobile"
                  value={sortDraft}
                  onChange={(event) => setSortDraft(event.target.value as ArticleSort)}
                >
                  <option value="latest">Latest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="source">By source</option>
                </Select>
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={preferences.layout === "cards" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => update({ layout: "cards" })}
                >
                  <LayoutGrid className="size-4" />
                  Cards
                </Button>
                <Button
                  type="button"
                  variant={preferences.layout === "list" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => update({ layout: "list" })}
                >
                  <List className="size-4" />
                  List
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="flex-1" disabled={!hasPendingDraftChanges}>
                  Apply filters
                </Button>
                <Button type="button" variant="outline" onClick={resetDrafts}>
                  Reset
                </Button>
              </div>
            </form>
          </details>

          <section id="article-list" className="surface-card space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="metric-label">Article stream</p>
                <h2 className="text-2xl font-semibold tracking-tight text-(--ink)">
                  {currentState.query ? `Results for “${currentState.query}”` : "Latest posts"}
                </h2>
                <p className="small-note">
                  {filterSummary}. Refresh latest checks live feeds{" "}
                  {corpusEmpty ? "for this reader." : "without replacing the base snapshot."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {refreshError ? <p className="text-sm text-amber-700">{refreshError}</p> : null}
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
              </div>
            </div>

            {activeFilterChips.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => updateUrl(chip.overrides)}
                    className="inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--surface-muted) px-3 py-1.5 text-xs font-semibold text-(--ink)"
                  >
                    {chip.label}
                    <X className="size-3.5 text-(--ink-muted)" />
                  </button>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={resetDrafts}>
                  Clear all
                </Button>
              </div>
            ) : null}

            {loading ? (
              <div className="grid gap-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={`loading-${index}`}
                    className="h-28 animate-pulse rounded-3xl border border-(--line) bg-(--surface-muted)"
                  />
                ))}
              </div>
            ) : visibleArticles.length === 0 ? (
              <EmptyState
                icon={Newspaper}
                title="No posts match these filters"
                description="Clear filters, reset the page, or browse sources instead."
              >
                <div className="flex flex-wrap justify-center gap-3">
                  {canClearArticleFilters ? (
                    <Link
                      href={clearArticleFiltersHref}
                      className={cn(buttonVariants({ variant: "default" }))}
                    >
                      Clear article filters
                    </Link>
                  ) : null}
                  {canResetWorkspace ? (
                    <Link
                      href={resetWorkspaceHref}
                      className={cn(buttonVariants({ variant: "outline" }))}
                    >
                      Reset all filters
                    </Link>
                  ) : null}
                  <Link
                    href={catalogRecoveryHref}
                    className={cn(buttonVariants({ variant: "secondary" }))}
                  >
                    Browse sources
                  </Link>
                </div>
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {visibleArticles.map((article) => {
                  const state = articleStateMap[article.id] ?? DEFAULT_ARTICLE_STATE;
                  const isSelected = article.id === selectedArticle?.id;
                  const articleTopics = getArticleTopics(article);

                  return (
                    <article
                      key={article.id}
                      className={cn(
                        "w-full rounded-3xl border p-5 text-left transition duration-150",
                        isSelected
                          ? "border-(--brand) bg-(--brand-soft)"
                          : "border-(--line) bg-(--surface) hover:border-(--brand)",
                        preferences.layout === "list" && "py-4",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectArticle(article.id)}
                        className="w-full text-left"
                        aria-pressed={isSelected}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="metric-label">{article.feed_title}</span>
                              {article.freshness === "live" ? (
                                <span className="rounded-full bg-(--brand) px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-(--fd-primary-foreground)">
                                  New
                                </span>
                              ) : null}
                              {state.read ? (
                                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                  Read
                                </span>
                              ) : null}
                              {state.bookmarked ? (
                                <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-sky-700">
                                  Saved
                                </span>
                              ) : null}
                              {state.starred ? (
                                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-amber-700">
                                  Starred
                                </span>
                              ) : null}
                            </div>
                            <h3 className="text-lg font-semibold text-(--ink)">{article.title}</h3>
                            {preferences.showSummaries && article.summary ? (
                              <p className="small-note max-w-3xl">{article.summary}</p>
                            ) : null}
                          </div>

                          <div className="space-y-2 text-right text-sm text-(--ink-muted)">
                            <div>
                              {article.published_at
                                ? new Date(article.published_at).toLocaleDateString()
                                : "Unknown date"}
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              {state.archived ? (
                                <span className="rounded-full border border-(--line) px-2 py-1 text-[0.7rem]">
                                  Archived
                                </span>
                              ) : null}
                              {article.author ? <span>{article.author}</span> : null}
                            </div>
                          </div>
                        </div>
                      </button>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          {articleTopics.slice(0, 4).map((topic) => (
                            <span
                              key={`${article.id}-${topic}`}
                              className="rounded-full border border-(--line) bg-white/70 px-3 py-1 text-xs font-semibold text-(--ink-muted)"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={isSelected ? "secondary" : "outline"}
                            onClick={() => handleSelectArticle(article.id)}
                          >
                            <PanelRight className="size-4" />
                            {isSelected ? "Hide details" : "Preview"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={state.read ? "secondary" : "ghost"}
                            onClick={() => updateState(article.id, { read: !state.read })}
                          >
                            <CheckCheck className="size-4" />
                            {state.read ? "Marked read" : "Mark read"}
                          </Button>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="mt-4 xl:hidden">
                          <PreviewPane
                            article={article}
                            state={state}
                            variant="inline"
                            onClose={() => setPreviewArticleId(null)}
                            onToggleState={(partial) => updateState(article.id, partial)}
                          />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--line) pt-4">
              <p className="small-note">
                Page offset {browse.cursor} · showing up to {browse.limit} results per page
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={browse.cursor === 0}
                  onClick={() =>
                    updateUrl({
                      cursor:
                        browse.cursor > browse.limit ? String(browse.cursor - browse.limit) : null,
                    })
                  }
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={browse.next_cursor === null}
                  onClick={() =>
                    updateUrl({
                      cursor: browse.next_cursor === null ? null : String(browse.next_cursor),
                    })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </section>
        </section>
      </div>

      {selectedArticle ? (
        <div className="hidden xl:block">
          <aside className="fixed inset-y-6 right-6 z-30 w-[24rem] max-w-[calc(100vw-3rem)]">
            <PreviewPane
              article={selectedArticle}
              state={selectedArticleState}
              variant="panel"
              onClose={() => setPreviewArticleId(null)}
              onToggleState={(partial) => {
                if (!selectedArticle) {
                  return;
                }
                updateState(selectedArticle.id, partial);
              }}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export function FeedsWorkspaceClient({
  mode,
  feeds,
  stats,
  initialState,
  initialBrowse,
}: FeedsWorkspaceClientProps) {
  const sourceTypes = useMemo(() => getSourceTypesFromFeeds(feeds), [feeds]);

  if (mode === "catalog") {
    return (
      <FeedCatalog
        feeds={feeds}
        sourceTypes={sourceTypes}
        initialQuery={initialState.query}
        initialSourceType={initialState.sourceType}
        initialTopic={initialState.topics[0] ?? null}
        initialVerified={initialState.verified}
      />
    );
  }

  return (
    <ReaderWorkspace
      feeds={feeds}
      stats={stats}
      initialState={initialState}
      initialBrowse={
        initialBrowse ?? {
          items: [],
          next_cursor: null,
          total_matched: 0,
          cursor: 0,
          limit: DEFAULT_PAGE_LIMIT,
          applied_query: null,
          applied_sort: "latest",
          corpus: {
            generated_at: null,
            source_db: "data/ai-web-feeds.db",
            article_count: 0,
            feed_count: 0,
            latest_published_at: null,
            is_empty: true,
          },
        }
      }
    />
  );
}
