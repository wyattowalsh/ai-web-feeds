"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowUpRight,
  Bookmark,
  BookOpenText,
  LayoutGrid,
  List,
  Newspaper,
  RefreshCcw,
  Search as SearchIcon,
  SlidersHorizontal,
  Star,
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

function buildOpmlExportHref(state: {
  sourceType: string | null;
  topics: string[];
  verified: boolean | null;
  feedIds: string[];
}): string {
  const params = new URLSearchParams();
  params.set("format", "filtered");
  for (const feedId of state.feedIds) {
    params.append("feed", feedId);
  }
  if (state.sourceType) params.set("type", state.sourceType);
  if (state.topics.length > 0) params.set("topic", state.topics[0]);
  if (state.verified !== null) params.set("verified", String(state.verified));

  return `/api/exports/opml?${params.toString()}`;
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
}: {
  article: WorkspaceArticle | null;
  state: ReaderArticleState;
  onToggleState: (partial: Partial<ReaderArticleState>) => void;
}) {
  const summaryMarkup = useMemo(
    () => (article ? sanitizeArticlePreviewHtml(article.content_html, article.link) : null),
    [article],
  );

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
    <div className="surface-card space-y-5">
      <div className="space-y-3">
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

      <div className="space-y-4">
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
            {(article.topics.length > 0 ? article.topics : article.categories).map((topic) => (
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
  const [topicsDraft, setTopicsDraft] = useState(normalizeTopicsValue(initialState.topics));
  const [browse, setBrowse] = useState(initialBrowse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [overlayArticles, setOverlayArticles] = useState<WorkspaceArticle[]>([]);
  const [articleStates, setArticleStates] = useState<Record<string, ReaderArticleState>>({});
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const firstLoadRef = useRef(true);
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
    setTopicsDraft(normalizeTopicsValue(currentState.topics));
  }, [currentState.query, currentState.topics]);

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
    if (visibleArticles.length === 0) {
      setSelectedArticleId(null);
      return;
    }

    if (
      !selectedArticleId ||
      !visibleArticles.some((article) => article.id === selectedArticleId)
    ) {
      setSelectedArticleId(visibleArticles[0]?.id ?? null);
    }
  }, [selectedArticleId, visibleArticles]);

  const selectedArticle =
    visibleArticles.find((article) => article.id === selectedArticleId) ??
    visibleArticles[0] ??
    null;

  const selectedArticleState = selectedArticle
    ? articleStateMap[selectedArticle.id] ?? DEFAULT_ARTICLE_STATE
    : DEFAULT_ARTICLE_STATE;

  const updateUrl = (overrides: Record<string, string | string[] | null | undefined>) => {
    const nextHref = buildReaderHref(currentState, overrides);
    router.replace(nextHref, { scroll: false });
  };

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

  const refreshLatest = async () => {
    const feedIds =
      currentState.feedIds.length > 0
        ? currentState.feedIds
        : candidateFeeds
            .slice(0, LIVE_REFRESH_SAMPLE_FEED_LIMIT)
            .map((feed) => feed.id ?? "")
            .filter(Boolean);

    if (feedIds.length === 0) {
      setRefreshError("No feed slice is selected for refresh.");
      return;
    }

    const params = new URLSearchParams();
    for (const feedId of feedIds) {
      params.append("feed", feedId);
    }
    params.set("stream", "sample");
    params.set("limit", "48");
    params.set("refresh", "true");

    setRefreshing(true);
    setRefreshError(null);

    try {
      const response = await fetch(`/api/feeds/posts/aggregate?${params.toString()}`, {
        cache: "no-store",
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
      const existingKeys = new Set(
        mergedArticles.map((article) => article.id || `${article.feed_id}:${article.link}`),
      );
      const nextOverlay = payload.posts.map(normalizeLiveArticle).filter((article) => {
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
  };

  const sourceTypes = useMemo(() => getSourceTypesFromFeeds(feeds), [feeds]);
  const topicOptions = useMemo(() => getTopics(feeds), [feeds]);
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
      : `${candidateFeeds.length} active feed${candidateFeeds.length === 1 ? "" : "s"} in slice`;

  if (corpusEmpty) {
    return (
      <div className="space-y-6">
        <div className="surface-card flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="metric-label">Feeds workspace</p>
            <h1 className="text-3xl font-semibold tracking-tight text-(--ink)">
              Reader-first feeds workspace
            </h1>
            <p className="small-note max-w-3xl">
              The article corpus has not been built yet. Catalog filtering still works, but the
              reader workspace needs `data/articles.generated.json` before it can browse posts
              across the feed set.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildReaderHref(currentState, { mode: "catalog" })}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Open catalog
            </Link>
            <a
              href={buildOpmlExportHref(currentState)}
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              Export OPML
            </a>
          </div>
        </div>

        <EmptyState
          icon={Newspaper}
          title="Article corpus unavailable"
          description="Run the corpus workflow to export the generated article artifact, then reload this page."
          tips={[
            "Use `uv run ai-web-feeds corpus refresh` to poll active feeds and write the artifact in one step.",
            "Use `uv run ai-web-feeds corpus export` if feed entries are already present in the runtime database.",
            "Catalog mode remains available for source discovery while the article corpus is empty.",
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface-card flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="metric-label">Feeds workspace</p>
          <h1 className="text-3xl font-semibold tracking-tight text-(--ink)">
            Browse posts across the full feed corpus
          </h1>
          <p className="small-note max-w-3xl">
            Search the generated article corpus first, then use the catalog only when you need to
            tighten the source slice. Reader state remains local to this browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={refreshLatest} disabled={refreshing}>
            <RefreshCcw className={cn("size-4", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh latest"}
          </Button>
          <Link
            href={buildReaderHref(currentState, { mode: "catalog" })}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Catalog
          </Link>
          <a
            href={buildOpmlExportHref(currentState)}
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Export OPML
          </a>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
        <aside className="surface-card space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SearchIcon className="size-4 text-(--ink-muted)" />
              <p className="text-sm font-semibold text-(--ink)">Search posts</p>
            </div>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                updateUrl({
                  q: queryDraft || null,
                  cursor: null,
                });
              }}
            >
              <Input
                aria-label="Search posts"
                placeholder="Search titles, summaries, authors"
                value={queryDraft}
                onChange={(event) => setQueryDraft(event.target.value)}
              />
              <Button type="submit" className="w-full">
                Search corpus
              </Button>
            </form>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-(--ink-muted)" />
              <p className="text-sm font-semibold text-(--ink)">Slice filters</p>
            </div>
            <div className="space-y-3">
              <label className="space-y-1.5 text-sm">
                <span className="small-note">Source type</span>
                <Select
                  aria-label="Source type"
                  value={currentState.sourceType ?? ""}
                  onChange={(event) =>
                    updateUrl({
                      source_type: event.target.value || null,
                      cursor: null,
                    })
                  }
                >
                  <option value="">All source types</option>
                  {sourceTypes.map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {sourceType}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="small-note">Topics</span>
                <Input
                  aria-label="Topics"
                  list="feed-topic-options"
                  placeholder="Comma-separated topics"
                  value={topicsDraft}
                  onChange={(event) => setTopicsDraft(event.target.value)}
                  onBlur={() =>
                    updateUrl({
                      topics:
                        parseTopicsValue(topicsDraft).length > 0
                          ? normalizeTopicsValue(parseTopicsValue(topicsDraft))
                          : null,
                      cursor: null,
                    })
                  }
                />
                <datalist id="feed-topic-options">
                  {topicOptions.map((topic) => (
                    <option key={topic} value={topic} />
                  ))}
                </datalist>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="small-note">Verification</span>
                <Select
                  aria-label="Verification"
                  value={
                    typeof currentState.verified === "boolean" ? String(currentState.verified) : ""
                  }
                  onChange={(event) =>
                    updateUrl({
                      verified: event.target.value || null,
                      cursor: null,
                    })
                  }
                >
                  <option value="">All feeds</option>
                  <option value="true">Verified only</option>
                  <option value="false">Unverified only</option>
                </Select>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-(--ink)">Reader state</p>
            <label className="space-y-1.5 text-sm">
              <span className="small-note">View</span>
              <Select
                aria-label="Reader view"
                value={currentState.readerView}
                onChange={(event) =>
                  updateUrl({
                    reader_view: event.target.value === "latest" ? null : event.target.value,
                  })
                }
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
                value={currentState.sort}
                onChange={(event) =>
                  updateUrl({
                    sort: event.target.value === "latest" ? null : event.target.value,
                    reader_sort: event.target.value === "latest" ? null : event.target.value,
                    cursor: null,
                  })
                }
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
          </div>

          <div className="rounded-3xl border border-(--line) bg-(--surface-muted) p-4">
            <p className="metric-label">Current slice</p>
            <div className="mt-3 space-y-2 text-sm text-(--ink-muted)">
              <p>{filterSummary}</p>
              <p>
                {browse.total_matched} corpus match{browse.total_matched === 1 ? "" : "es"} ·{" "}
                {visibleArticles.length} visible on this page
              </p>
              <p>
                Corpus: {browse.corpus.article_count} articles from {browse.corpus.feed_count} feeds
              </p>
              <p>
                Catalog: {stats.total} sources · {stats.topicCount} topics
              </p>
            </div>
          </div>
        </aside>

        <section id="article-list" className="surface-card space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="metric-label">Article list</p>
              <h2 className="text-2xl font-semibold tracking-tight text-(--ink)">
                {currentState.query ? `Results for “${currentState.query}”` : "Latest corpus posts"}
              </h2>
            </div>
            {refreshError ? (
              <p className="text-sm text-amber-700">{refreshError}</p>
            ) : error ? (
              <p className="text-sm text-rose-700">{error}</p>
            ) : null}
          </div>

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
              title="No posts match this slice"
              description="Clear article-specific filters, reset the workspace, or inspect the current source slice in catalog mode."
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
                    Reset workspace
                  </Link>
                ) : null}
                <Link
                  href={catalogRecoveryHref}
                  className={cn(buttonVariants({ variant: "secondary" }))}
                >
                  Open catalog
                </Link>
              </div>
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {visibleArticles.map((article) => {
                const state = articleStateMap[article.id] ?? DEFAULT_ARTICLE_STATE;
                const isSelected = article.id === selectedArticle?.id;
                const articleTopics =
                  article.topics.length > 0 ? article.topics : article.categories;

                return (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => setSelectedArticleId(article.id)}
                    className={cn(
                      "w-full rounded-3xl border p-5 text-left transition duration-150",
                      isSelected
                        ? "border-(--brand) bg-(--brand-soft)"
                        : "border-(--line) bg-(--surface) hover:border-(--brand)",
                      preferences.layout === "list" && "py-4",
                    )}
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
                          {state.starred ? <Star className="size-4 text-amber-500" /> : null}
                          {state.bookmarked ? <Bookmark className="size-4 text-sky-600" /> : null}
                          {state.archived ? (
                            <Archive className="size-4 text-(--ink-muted)" />
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {articleTopics.slice(0, 4).map((topic) => (
                        <span
                          key={`${article.id}-${topic}`}
                          className="rounded-full border border-(--line) bg-white/70 px-3 py-1 text-xs font-semibold text-(--ink-muted)"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </button>
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

        <PreviewPane
          article={selectedArticle}
          state={selectedArticleState}
          onToggleState={(partial) => {
            if (!selectedArticle) {
              return;
            }
            updateState(selectedArticle.id, partial);
          }}
        />
      </div>
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
