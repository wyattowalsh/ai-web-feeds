"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, CircleCheck, Newspaper, RefreshCcw, Rss, Star } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { buildReaderRouteHref } from "@/lib/reader-routes";
import { normalizeSearchQuery, parseVerifiedSearchFilter } from "@/lib/search";
import { useReaderTimeline } from "@/lib/use-reader-timeline";
import { useReaderPreferences } from "@/lib/use-reader-preferences";
import { useArticleState } from "@/lib/use-reader-article-state";
import type { NormalizedArticle } from "@/lib/reader-types";

type ReaderFeedOption = {
  id: string;
  title: string;
  sourceType: string;
  topics: string[];
  verified: boolean;
  isActive: boolean;
  url: string;
};

type ReaderView = "latest" | "unread" | "starred" | "saved" | "archived";
type ReaderSort = "latest" | "oldest" | "source";
type ReaderStream = "sample" | "all";

interface ReaderPageClientProps {
  feeds: ReaderFeedOption[];
}

const DEFAULT_FETCH_FEED_LIMIT = 18;
const BROAD_MODE_PER_FEED_LIMIT = 3;
const BROAD_MODE_TOTAL_LIMIT = 48;
const SELECTED_FEED_POST_LIMIT = 8;
const ALL_STREAM_PAGE_LIMIT = 24;
const ALL_STREAM_PER_FEED_LIMIT = 8;

function readFirstParam(params: URLSearchParams, keys: string[]): string | null {
  for (const key of keys) {
    const value = params.get(key);
    if (value && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function readTopicFilters(params: URLSearchParams): string[] {
  return Array.from(
    new Set(
      [...params.getAll("topic"), ...params.getAll("topics"), params.get("topic") ?? ""]
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function parseReaderStream(value: string | null, cursorValue: string | null): ReaderStream {
  if (value === "all") {
    return "all";
  }

  if (value === "sample") {
    return "sample";
  }

  return cursorValue && cursorValue.trim().length > 0 ? "all" : "sample";
}

function parseCursor(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildFeedsWorkspaceHref(
  params: URLSearchParams,
  overrides: Record<string, string | null | undefined> = {},
): string {
  const nextParams = new URLSearchParams(params.toString());

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined || value.length === 0) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
  }

  return buildReaderRouteHref(nextParams);
}

export function ReaderPageClient({ feeds }: ReaderPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [paramState, setParamState] = useState(() => new URLSearchParams(searchParams.toString()));
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setParamState(new URLSearchParams(searchParams.toString()));
  }, [searchParams]);

  const isFeedsEmbed = pathname.startsWith("/feeds");
  const readerViewKey = isFeedsEmbed ? "reader_view" : "view";
  const readerSortKey = isFeedsEmbed ? "reader_sort" : "sort";
  const topicKey = isFeedsEmbed ? "topics" : "topic";

  const explicitFeedIds = useMemo(
    () =>
      Array.from(
        new Set(
          paramState
            .getAll("feed")
            .map((feedId) => feedId.trim())
            .filter((feedId) => feedId.length > 0),
        ),
      ),
    [paramState],
  );
  const selectedFeedId = explicitFeedIds.length === 1 ? explicitFeedIds[0] ?? "" : "";
  const topicFilters = useMemo(() => readTopicFilters(paramState), [paramState]);
  const topic = topicFilters[0] || "";
  const query = normalizeSearchQuery(paramState.get("q")) || "";
  const sourceType = paramState.get("source_type")?.trim() || "";
  const verified = parseVerifiedSearchFilter(paramState.get("verified")) ?? null;
  const stream = parseReaderStream(paramState.get("stream"), paramState.get("cursor"));
  const cursor = parseCursor(paramState.get("cursor"));
  const view = parseView(
    readFirstParam(paramState, [
      readerViewKey,
      readerViewKey === "reader_view" ? "view" : "reader_view",
    ]),
  );
  const sort = parseSort(
    readFirstParam(paramState, [
      readerSortKey,
      readerSortKey === "reader_sort" ? "sort" : "reader_sort",
    ]),
  );
  const [queryDraft, setQueryDraft] = useState(query);
  const catalogHref = buildFeedsWorkspaceHref(paramState, { mode: null });
  const articlesHref = buildFeedsWorkspaceHref(paramState, { mode: "articles" });
  const Root = isFeedsEmbed ? "div" : "main";

  useEffect(() => {
    setQueryDraft(query);
  }, [query]);

  const topicOptions = useMemo(() => {
    return Array.from(
      new Set(feeds.flatMap((candidateFeed) => candidateFeed.topics).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right));
  }, [feeds]);

  const candidateFeeds = useMemo(() => {
    return feeds.filter((candidateFeed) => {
      if (explicitFeedIds.length > 0 && !explicitFeedIds.includes(candidateFeed.id)) {
        return false;
      }

      if (explicitFeedIds.length === 0 && !candidateFeed.isActive) {
        return false;
      }

      if (sourceType && candidateFeed.sourceType !== sourceType) {
        return false;
      }

      if (verified !== null && candidateFeed.verified !== verified) {
        return false;
      }

      if (
        topicFilters.length > 0 &&
        !topicFilters.some((topicFilter) => candidateFeed.topics.includes(topicFilter))
      ) {
        return false;
      }

      return true;
    });
  }, [explicitFeedIds, feeds, sourceType, topicFilters, verified]);

  const feedIdsToFetch = useMemo(() => {
    if (stream === "all" || explicitFeedIds.length > 0) {
      return candidateFeeds.map((candidateFeed) => candidateFeed.id);
    }

    return candidateFeeds
      .slice(0, DEFAULT_FETCH_FEED_LIMIT)
      .map((candidateFeed) => candidateFeed.id);
  }, [candidateFeeds, explicitFeedIds.length, stream]);

  const { articles, meta, loading, loadingMore, error, hasMore, loadMore, refresh } =
    useReaderTimeline(feedIdsToFetch, {
      enabled: feedIdsToFetch.length > 0,
      limit:
        stream === "all"
          ? ALL_STREAM_PAGE_LIMIT
          : selectedFeedId
            ? SELECTED_FEED_POST_LIMIT
            : BROAD_MODE_TOTAL_LIMIT,
      perFeedLimit:
        stream === "all"
          ? ALL_STREAM_PER_FEED_LIMIT
          : selectedFeedId
            ? SELECTED_FEED_POST_LIMIT
            : BROAD_MODE_PER_FEED_LIMIT,
      stream,
      cursor,
    });
  const { preferences, update } = useReaderPreferences();

  useEffect(() => {
    if (stream !== "all" || !hasMore || loading || loadingMore) {
      return;
    }

    const observerTarget = loadMoreRef.current;
    if (!observerTarget || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      {
        rootMargin: "800px 0px",
      },
    );

    observer.observe(observerTarget);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore, loading, loadingMore, stream]);

  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const matchesView = (article: NormalizedArticle) => {
      if (view === "unread") return !article.read;
      if (view === "starred") return article.starred;
      if (view === "saved") return article.bookmarked;
      if (view === "archived") return article.archived;
      return !article.archived;
    };

    const matchesQuery = (article: NormalizedArticle) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        article.title,
        article.feedTitle,
        article.summary || "",
        article.author || "",
        article.categories.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    };

    const nextArticles = articles.filter(
      (article) => matchesView(article) && matchesQuery(article),
    );

    if (sort === "oldest") {
      return [...nextArticles].sort((left, right) => {
        const leftTime = left.publishedAtMs ?? 0;
        const rightTime = right.publishedAtMs ?? 0;
        return leftTime - rightTime;
      });
    }

    if (sort === "source") {
      return [...nextArticles].sort((left, right) => {
        const feedTitleCompare = left.feedTitle.localeCompare(right.feedTitle);
        if (feedTitleCompare !== 0) {
          return feedTitleCompare;
        }

        return (right.publishedAtMs ?? 0) - (left.publishedAtMs ?? 0);
      });
    }

    return nextArticles;
  }, [articles, query, sort, view]);

  const visibleFeedCount = candidateFeeds.length;
  const fetchedFeedCount = feedIdsToFetch.length;

  const setParam = (key: string, value: string | null, options?: { resetCursor?: boolean }) => {
    const params = new URLSearchParams(paramState.toString());
    if (key === "topic" || key === "topics") {
      params.delete("topic");
      params.delete("topics");
    }

    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    if (options?.resetCursor) {
      params.delete("cursor");
    }

    setParamState(params);
    router.replace(buildFeedsWorkspaceHref(params), { scroll: false });
  };

  return (
    <Root className="flex flex-1 flex-col">
      <div className="page-wrap page-stack">
        <section className={cn(isFeedsEmbed ? "space-y-6" : "surface-panel space-y-8")}>
          {isFeedsEmbed ? (
            <div className="surface-card flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="metric-label">Feeds workspace</p>
                <h1 className="text-2xl font-semibold tracking-tight text-(--ink)">
                  Reader stream
                </h1>
                <p className="small-note max-w-3xl">
                  Canonical feed browsing lives under /feeds. Use feed, topic, source type,
                  verification, stream, and reader state filters together while keeping the page
                  shell compact inside the workspace.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={refresh}>
                  <RefreshCcw className="size-4" />
                  Refresh stream
                </Button>
                <Link href={catalogHref} className={cn(buttonVariants({ variant: "secondary" }))}>
                  Catalog
                </Link>
                <Link href={articlesHref} className={cn(buttonVariants({ variant: "ghost" }))}>
                  Articles
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
              <div className="space-y-5">
                <span className="eyebrow">
                  <Rss className="size-3.5" />
                  Reader
                </span>
                <div className="space-y-4">
                  <h1 className="hero-title max-w-4xl">
                    Read the latest posts from the AI source registry.
                  </h1>
                  <p className="hero-copy max-w-2xl">
                    Filter by feed or topic, scan the current article stream, and keep your own
                    reading state on-device. The goal is simple: open a feed set and triage it fast.
                  </p>
                </div>
              </div>

              <div className="surface-card-soft space-y-4">
                <p className="metric-label">Live scope</p>
                <div className="grid gap-3 text-sm text-(--ink)">
                  <div>
                    Showing <span className="font-semibold">{filteredArticles.length}</span> visible
                    article{filteredArticles.length !== 1 ? "s" : ""} from{" "}
                    <span className="font-semibold">{fetchedFeedCount}</span> scanned feed
                    {fetchedFeedCount !== 1 ? "s" : ""}
                  </div>
                  <div>
                    {stream === "all" ? (
                      <>
                        Full stream mode pages through{" "}
                        <span className="font-semibold">{visibleFeedCount}</span> matching feed
                        {visibleFeedCount !== 1 ? "s" : ""} with cursor-aware loading.
                      </>
                    ) : selectedFeedId ? (
                      <>
                        Focused on one feed, up to{" "}
                        <span className="font-semibold">{SELECTED_FEED_POST_LIMIT}</span> recent
                        posts
                      </>
                    ) : explicitFeedIds.length > 1 ? (
                      <>
                        Pinned to <span className="font-semibold">{visibleFeedCount}</span> selected
                        feeds, up to{" "}
                        <span className="font-semibold">{BROAD_MODE_PER_FEED_LIMIT}</span> posts per
                        source
                      </>
                    ) : topic ? (
                      <>
                        Filtered to <span className="font-semibold">{topic}</span>, up to{" "}
                        <span className="font-semibold">{BROAD_MODE_PER_FEED_LIMIT}</span> posts per
                        matching source
                      </>
                    ) : (
                      <>
                        Broad mode samples active feeds across the catalog, up to{" "}
                        <span className="font-semibold">{BROAD_MODE_PER_FEED_LIMIT}</span> posts per
                        source
                      </>
                    )}
                  </div>
                  <div>
                    Cache: <span className="font-semibold">{meta?.cacheState || "loading"}</span>
                  </div>
                  {stream !== "all" && explicitFeedIds.length === 0 ? (
                    <div>
                      {visibleFeedCount > fetchedFeedCount
                        ? `Truncated broad mode: scanning ${fetchedFeedCount} of ${visibleFeedCount} matching feeds, up to ${BROAD_MODE_PER_FEED_LIMIT} posts per source.`
                        : `Scanning all ${visibleFeedCount} matching feeds, up to ${BROAD_MODE_PER_FEED_LIMIT} posts per source.`}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={refresh}>
                    <RefreshCcw className="size-4" />
                    Refresh stream
                  </Button>
                  <Link href={catalogHref} className={cn(buttonVariants({ variant: "secondary" }))}>
                    Catalog
                  </Link>
                  <Link href={articlesHref} className={cn(buttonVariants({ variant: "ghost" }))}>
                    Articles
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
              <div className="surface-card space-y-4">
                <div>
                  <p className="metric-label">Scope</p>
                  <h2 className="text-lg font-semibold">Choose a feed set</h2>
                </div>

                <div>
                  <label className="field-label" htmlFor="reader-feed">
                    Feed
                  </label>
                  <Select
                    id="reader-feed"
                    value={selectedFeedId}
                    onChange={(event) =>
                      setParam("feed", event.target.value || null, { resetCursor: true })
                    }
                  >
                    <option value="">All matching feeds</option>
                    {feeds.map((candidateFeed) => (
                      <option key={candidateFeed.id} value={candidateFeed.id}>
                        {candidateFeed.title}
                      </option>
                    ))}
                  </Select>
                  {explicitFeedIds.length > 1 ? (
                    <p className="small-note mt-2">
                      Pinned to {explicitFeedIds.length} feeds carried over from the current catalog
                      slice.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="field-label" htmlFor="reader-topic">
                    Topic
                  </label>
                  <Select
                    id="reader-topic"
                    value={topic}
                    onChange={(event) =>
                      setParam(topicKey, event.target.value || null, { resetCursor: true })
                    }
                    disabled={Boolean(selectedFeedId)}
                  >
                    <option value="">All topics</option>
                    {topicOptions.map((topicOption) => (
                      <option key={topicOption} value={topicOption}>
                        {topicOption}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="field-label" htmlFor="reader-query">
                    Filter visible articles
                  </label>
                  <Input
                    id="reader-query"
                    value={queryDraft}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setQueryDraft(nextValue);
                      setParam("q", nextValue || null);
                    }}
                    placeholder="Search title, feed, summary, or category"
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="reader-stream">
                    Stream
                  </label>
                  <Select
                    id="reader-stream"
                    value={stream}
                    onChange={(event) =>
                      setParam("stream", event.target.value || null, { resetCursor: true })
                    }
                  >
                    <option value="sample">Sample</option>
                    <option value="all">All posts</option>
                  </Select>
                </div>
              </div>

              <div className="surface-card space-y-4">
                <div>
                  <p className="metric-label">Views</p>
                  <h2 className="text-lg font-semibold">Apply local state filters</h2>
                </div>
                <div className="grid gap-2">
                  {VIEW_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setParam(readerViewKey, option.value === "latest" ? null : option.value)
                      }
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition duration-150",
                        view === option.value
                          ? "border-(--brand) bg-(--brand-soft) text-(--brand-strong)"
                          : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)",
                      )}
                    >
                      <option.icon className="size-4" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="surface-card space-y-4">
                <div>
                  <p className="metric-label">Reading preferences</p>
                  <h2 className="text-lg font-semibold">Adjust the presentation</h2>
                </div>

                <div>
                  <label className="field-label" htmlFor="reader-sort">
                    Sort
                  </label>
                  <Select
                    id="reader-sort"
                    value={sort}
                    onChange={(event) => setParam(readerSortKey, event.target.value || null)}
                  >
                    <option value="latest">Latest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="source">Group by source</option>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={preferences.showSummaries ? "default" : "secondary"}
                    onClick={() => void update({ showSummaries: !preferences.showSummaries })}
                  >
                    Summaries
                  </Button>
                  <Button
                    type="button"
                    variant={preferences.layout === "compact" ? "default" : "secondary"}
                    onClick={() =>
                      void update({
                        layout: preferences.layout === "compact" ? "cards" : "compact",
                      })
                    }
                  >
                    {preferences.layout === "compact" ? "Card layout" : "Compact layout"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {error ? (
                <div className="surface-card border-(--danger-tone)/40">
                  <p className="text-lg font-semibold">Reader failed to load</p>
                  <p className="small-note mt-2">{error.message}</p>
                </div>
              ) : null}

              {loading ? (
                <div className="surface-card">
                  <p className="metric-label">Loading</p>
                  <h2 className="mt-2 text-xl font-semibold">Fetching recent articles…</h2>
                </div>
              ) : null}

              {!loading && filteredArticles.length === 0 ? (
                <div className="surface-card">
                  <p className="metric-label">No articles</p>
                  <h2 className="mt-2 text-xl font-semibold">
                    Nothing matches the current reader scope.
                  </h2>
                  <p className="small-note mt-2">
                    Broaden the feed or topic selection, clear the text filter, or refresh the live
                    fetch to pull a new article set.
                  </p>
                </div>
              ) : null}

              <div
                className={cn(
                  "grid gap-4",
                  preferences.layout === "cards" ? "grid-cols-1 2xl:grid-cols-2" : "grid-cols-1",
                  preferences.readingWidth === "narrow" && "max-w-3xl",
                  preferences.readingWidth === "medium" && "max-w-5xl",
                  preferences.readingWidth === "wide" && "max-w-none",
                )}
              >
                {filteredArticles.map((article) => (
                  <ReaderArticleCard
                    key={article.id}
                    article={article}
                    compact={preferences.layout !== "cards"}
                    showSummary={preferences.showSummaries}
                  />
                ))}
              </div>

              {stream === "all" && hasMore ? (
                <div className="surface-card space-y-3">
                  <div ref={loadMoreRef} aria-hidden="true" className="h-px w-full" />
                  <p className="small-note">
                    Keep scrolling to auto-load more posts, or use the fallback button below.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void loadMore()}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading more…" : "Load more posts"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </Root>
  );
}

function ReaderArticleCard({
  article,
  compact,
  showSummary,
}: {
  article: NormalizedArticle;
  compact: boolean;
  showSummary: boolean;
}) {
  const { state, toggleArchive, toggleBookmark, toggleStar, markRead, markUnread } =
    useArticleState(article.id, article);

  return (
    <article className="surface-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="metric-label">{article.feedTitle}</p>
          <h2 className={cn(compact ? "text-xl" : "text-2xl", "font-semibold text-(--ink)")}>
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {article.title}
            </a>
          </h2>
          <p className="small-note">
            {article.publishedAt
              ? new Date(article.publishedAt).toLocaleString()
              : "No publication date"}
            {article.author ? ` · ${article.author}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={state.read ? "secondary" : "outline"}
            onClick={() => void (state.read ? markUnread() : markRead())}
          >
            <CircleCheck className="size-4" />
            {state.read ? "Read" : "Mark read"}
          </Button>
          <Button
            type="button"
            variant={state.starred ? "default" : "outline"}
            onClick={() => void toggleStar()}
          >
            <Star className="size-4" />
            Star
          </Button>
          <Button
            type="button"
            variant={state.bookmarked ? "default" : "outline"}
            onClick={() => void toggleBookmark()}
          >
            <Bookmark className="size-4" />
            Save
          </Button>
          <Button
            type="button"
            variant={state.archived ? "secondary" : "outline"}
            onClick={() => void toggleArchive()}
          >
            Archive
          </Button>
        </div>
      </div>

      {showSummary && article.summary ? (
        <p className="text-sm leading-7 text-(--ink-muted)">{article.summary}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {article.categories.map((category) => (
          <span
            key={category}
            className="rounded-full bg-(--brand-soft) px-2.5 py-1 text-xs font-semibold text-(--brand-strong)"
          >
            {category}
          </span>
        ))}
      </div>
    </article>
  );
}

const VIEW_OPTIONS = [
  { value: "latest" as const, label: "Latest", icon: Newspaper },
  { value: "unread" as const, label: "Unread", icon: CircleCheck },
  { value: "starred" as const, label: "Starred", icon: Star },
  { value: "saved" as const, label: "Saved", icon: Bookmark },
  { value: "archived" as const, label: "Archived", icon: Rss },
];

function parseView(value: string | null): ReaderView {
  switch (value) {
    case "unread":
    case "starred":
    case "saved":
    case "bookmarked":
    case "archived":
      return value === "bookmarked" ? "saved" : value;
    default:
      return "latest";
  }
}

function parseSort(value: string | null): ReaderSort {
  switch (value) {
    case "oldest":
    case "source":
      return value;
    default:
      return "latest";
  }
}
