"use client";

import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import type { OpmlPreviewCollection, OpmlPreviewData } from "@/lib/opml-preview";

type FeedSortOption = "opml" | "title-asc" | "title-desc" | "latest-post-desc" | "latest-post-asc";
type PostSortOption = "newest" | "oldest" | "title-asc" | "title-desc";

interface FeedPost {
  id: string;
  title: string;
  link: string;
  publishedAt: string | null;
  summary: string | null;
  author: string | null;
  categories: string[];
}

interface FeedPostsResponse {
  feedId: string;
  feedTitle: string;
  sourceUrl: string;
  resolvedFeedUrl: string;
  posts: FeedPost[];
  fetchedAt: string;
}

interface AggregateFeedPost extends FeedPost {
  feedId: string;
  feedTitle: string;
  sourceUrl: string;
  resolvedFeedUrl: string;
}

interface AggregateFeedPostsResponse {
  posts: AggregateFeedPost[];
  feeds: FeedPostsResponse[];
  fetchedAt: string;
  expiresAt: string;
  cacheState: "live" | "cached";
  totalSources: number;
  successfulSources: number;
  failedSources: number;
}

type PostsPanelState =
  | { kind: "idle" }
  | { kind: "single-loading"; feedId: string; title: string }
  | { kind: "single-ready"; feedId: string; title: string }
  | { kind: "aggregate-loading"; title: string }
  | { kind: "aggregate-ready"; title: string; result: AggregateFeedPostsResponse }
  | { kind: "error"; title: string | null; message: string };

type FeedActivity = Record<
  string,
  {
    latestPostTimestamp: number | null;
    fetchedAt: string;
  }
>;

const fieldClassName =
  "w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500";
const subtleLinkClassName =
  "text-blue-700 underline-offset-4 transition-colors hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

export function OPMLViewer({ preview }: { preview: OpmlPreviewData }) {
  const [activeCollectionId, setActiveCollectionId] = useState<"flat" | "categorized">("flat");
  const [search, setSearch] = useState("");
  const [feedSort, setFeedSort] = useState<FeedSortOption>("opml");
  const [postSort, setPostSort] = useState<PostSortOption>("newest");
  const [aggregateLimit, setAggregateLimit] = useState(24);
  const [aggregatePerSource, setAggregatePerSource] = useState(2);
  const [panelState, setPanelState] = useState<PostsPanelState>({ kind: "idle" });
  const [feedPosts, setFeedPosts] = useState<Record<string, FeedPostsResponse>>({});
  const [feedActivity, setFeedActivity] = useState<FeedActivity>({});
  const singleRequestControllerRef = useRef<AbortController | null>(null);
  const aggregateRequestControllerRef = useRef<AbortController | null>(null);
  const requestTokenRef = useRef(0);

  const activeCollection = activeCollectionId === "flat" ? preview.flat : preview.categorized;
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return activeCollection.groups;

    return activeCollection.groups
      .map((group) => {
        const groupMatches = group.title.toLowerCase().includes(query);
        if (groupMatches) return group;

        return {
          ...group,
          feeds: group.feeds.filter((feed) => {
            return (
              feed.title.toLowerCase().includes(query) ||
              feed.sourceType?.toLowerCase().includes(query) ||
              feed.topics.some((topic) => topic.toLowerCase().includes(query))
            );
          }),
        };
      })
      .filter((group) => group.feeds.length > 0);
  }, [activeCollection.groups, search]);

  const sortedGroups = useMemo(
    () =>
      filteredGroups.map((group) => ({
        ...group,
        feeds: [...group.feeds].sort((left, right) =>
          compareFeeds(left, right, feedActivity, feedSort),
        ),
      })),
    [feedActivity, feedSort, filteredGroups],
  );

  const visibleFeedCount = sortedGroups.reduce((count, group) => count + group.feeds.length, 0);
  const visibleAggregatableFeeds = useMemo(() => {
    const seen = new Set<string>();

    return sortedGroups
      .flatMap((group) => group.feeds)
      .filter((feed) => {
        if (!feed.matchedCatalogFeed || !feed.lookupKey) {
          return false;
        }

        if (seen.has(feed.lookupKey)) {
          return false;
        }

        seen.add(feed.lookupKey);
        return true;
      });
  }, [sortedGroups]);
  const previewIdsByLookupKey = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const group of sortedGroups) {
      for (const feed of group.feeds) {
        if (!feed.lookupKey) {
          continue;
        }

        const existing = map.get(feed.lookupKey) || [];
        existing.push(feed.id);
        map.set(feed.lookupKey, existing);
      }
    }

    return map;
  }, [sortedGroups]);

  const selectedFeedPosts =
    panelState.kind === "single-loading" || panelState.kind === "single-ready"
      ? feedPosts[panelState.feedId] || null
      : null;
  const sortedSelectedPosts = useMemo(() => {
    const displayedPosts =
      panelState.kind === "aggregate-ready"
        ? panelState.result.posts
        : selectedFeedPosts?.posts || [];

    return sortPosts(displayedPosts, postSort);
  }, [panelState, selectedFeedPosts, postSort]);
  const visibleLiveFeedCount = visibleAggregatableFeeds.length;
  const visibleExportFeedIds = useMemo(() => {
    const seen = new Set<string>();

    return sortedGroups
      .flatMap((group) => group.feeds)
      .filter((feed) => feed.matchedCatalogFeed)
      .map((feed) => feed.id)
      .filter((feedId) => {
        if (!feedId || seen.has(feedId)) {
          return false;
        }

        seen.add(feedId);
        return true;
      });
  }, [sortedGroups]);
  const filteredOpmlHref = useMemo(
    () => buildFilteredOpmlHref(visibleExportFeedIds),
    [visibleExportFeedIds],
  );

  function cancelRequests(scope: "single" | "aggregate" | "all") {
    if (scope === "single" || scope === "all") {
      singleRequestControllerRef.current?.abort();
      singleRequestControllerRef.current = null;
    }

    if (scope === "aggregate" || scope === "all") {
      aggregateRequestControllerRef.current?.abort();
      aggregateRequestControllerRef.current = null;
    }
  }

  function updateFeedActivity(nextFeedIds: string[], response: FeedPostsResponse) {
    const latestPostTimestamp = getLatestFeedTimestamp(response);

    setFeedActivity((current) => {
      const next = { ...current };
      for (const feedId of nextFeedIds) {
        next[feedId] = {
          latestPostTimestamp,
          fetchedAt: response.fetchedAt,
        };
      }
      return next;
    });
  }

  async function handleLoadPosts(feed: {
    id: string;
    lookupKey: string | null;
    title: string;
    matchedCatalogFeed: boolean;
  }) {
    if (!feed.matchedCatalogFeed || !feed.lookupKey) {
      setPanelState({
        kind: "error",
        title: feed.title,
        message:
          "This source only appears in the export, so live post previews are not available here.",
      });
      return;
    }

    cancelRequests("all");

    if (feedPosts[feed.id]) {
      setPanelState({ kind: "single-ready", feedId: feed.id, title: feed.title });
      return;
    }

    const controller = new AbortController();
    singleRequestControllerRef.current = controller;
    const requestToken = ++requestTokenRef.current;
    setPanelState({ kind: "single-loading", feedId: feed.id, title: feed.title });

    try {
      const response = await fetch(
        `/api/feeds/posts?feedId=${encodeURIComponent(feed.lookupKey)}&limit=6`,
        {
          cache: "no-store",
          signal: controller.signal,
        },
      );

      const payload = (await response.json()) as FeedPostsResponse | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to load posts");
      }

      if (requestToken !== requestTokenRef.current) {
        return;
      }

      setFeedPosts((current) => ({ ...current, [feed.id]: payload }));
      updateFeedActivity([feed.id], payload);
      setPanelState({ kind: "single-ready", feedId: feed.id, title: feed.title });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setPanelState({
        kind: "error",
        title: feed.title,
        message: error instanceof Error ? error.message : "Failed to load posts",
      });
    } finally {
      if (singleRequestControllerRef.current === controller) {
        singleRequestControllerRef.current = null;
      }
    }
  }

  async function handleLoadAggregatePosts(refresh = false) {
    const lookupKeys = visibleAggregatableFeeds
      .map((feed) => feed.lookupKey)
      .filter((value): value is string => Boolean(value));

    if (lookupKeys.length === 0) {
      setPanelState({
        kind: "error",
        title: null,
        message: "No visible feeds with live post previews are available for a merged timeline.",
      });
      return;
    }

    cancelRequests("all");

    const controller = new AbortController();
    aggregateRequestControllerRef.current = controller;
    const requestToken = ++requestTokenRef.current;
    const title = `Recent posts across ${lookupKeys.length} visible ${
      lookupKeys.length === 1 ? "feed" : "feeds"
    }`;
    setPanelState({ kind: "aggregate-loading", title });

    try {
      const response = await fetch("/api/feeds/posts/aggregate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feedIds: lookupKeys,
          limit: aggregateLimit,
          perFeedLimit: aggregatePerSource,
          refresh,
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      const payload = (await response.json()) as AggregateFeedPostsResponse | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to load aggregated posts");
      }

      if (requestToken !== requestTokenRef.current) {
        return;
      }

      for (const feed of payload.feeds) {
        const previewIds = previewIdsByLookupKey.get(feed.feedId) || [];
        if (previewIds.length > 0) {
          updateFeedActivity(previewIds, feed);
        }
      }

      setPanelState({ kind: "aggregate-ready", title, result: payload });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setPanelState({
        kind: "error",
        title,
        message: error instanceof Error ? error.message : "Failed to load aggregated posts",
      });
    } finally {
      if (aggregateRequestControllerRef.current === controller) {
        aggregateRequestControllerRef.current = null;
      }
    }
  }

  const aggregateSummary =
    visibleLiveFeedCount > 0
      ? `${visibleLiveFeedCount} visible ${
          visibleLiveFeedCount === 1 ? "feed has" : "feeds have"
        } live post previews available.`
      : "Filter down to at least one live-preview feed to build a merged timeline.";

  function handleDownloadVisibleSubset() {
    if (!filteredOpmlHref) {
      return;
    }

    window.location.assign(filteredOpmlHref);
  }

  return (
    <section className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Feed preview
          </div>
          <h2 className="mb-2 text-2xl font-semibold">Preview the Export</h2>
          <p className="text-sm text-muted-foreground">
            Search the export, switch between flat and foldered views, and pull recent posts from
            feeds we can match back to the catalog.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <CollectionToggle
            label="Flat OPML"
            active={activeCollectionId === "flat"}
            onClick={() => setActiveCollectionId("flat")}
          />
          <CollectionToggle
            label="Categorized OPML"
            active={activeCollectionId === "categorized"}
            onClick={() => setActiveCollectionId("categorized")}
          />
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Feeds in this export" value={String(activeCollection.totalOutlines)} />
        <StatCard label="Folder groups" value={String(filteredGroups.length)} />
        <StatCard label="Live preview ready" value={String(activeCollection.matchedCatalogFeeds)} />
      </div>

      <div className="mb-6 rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold">{activeCollection.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{activeCollection.description}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {visibleFeedCount} feed{visibleFeedCount === 1 ? "" : "s"} across{" "}
            {filteredGroups.length} section{filteredGroups.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <label htmlFor="opml-viewer-search" className="block text-sm font-medium mb-2">
            Search this export
          </label>
          <input
            id="opml-viewer-search"
            name="opml-search"
            type="text"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by feed title, topic, or source type…"
            className={fieldClassName}
          />
        </div>

        <div>
          <label htmlFor="opml-viewer-feed-sort" className="block text-sm font-medium mb-2">
            Feed order
          </label>
          <select
            id="opml-viewer-feed-sort"
            value={feedSort}
            onChange={(event) => setFeedSort(event.target.value as FeedSortOption)}
            className={fieldClassName}
          >
            <option value="opml">OPML order</option>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
            <option value="latest-post-desc">Newest loaded post</option>
            <option value="latest-post-asc">Oldest loaded post</option>
          </select>
          {(feedSort === "latest-post-desc" || feedSort === "latest-post-asc") && (
            <p className="mt-2 text-xs text-muted-foreground">
              Feeds with no loaded post data stay after feeds with known publish dates.
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-xl border bg-background p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="font-semibold">Merged timeline</h3>
            <p className="mt-1 text-sm text-muted-foreground">{aggregateSummary}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => void handleLoadAggregatePosts(false)}
              disabled={panelState.kind === "aggregate-loading" || visibleLiveFeedCount === 0}
              className="h-auto gap-2 px-4 py-2.5"
            >
              {panelState.kind === "aggregate-loading" ? "Loading…" : "Load Merged Timeline"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleLoadAggregatePosts(true)}
              disabled={panelState.kind === "aggregate-loading" || visibleLiveFeedCount === 0}
              className="h-auto gap-2 px-4 py-2.5"
            >
              Refresh live
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownloadVisibleSubset}
              disabled={!filteredOpmlHref}
              className="h-auto gap-2 px-4 py-2.5"
            >
              Download Visible OPML
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Filtered exports include the currently visible catalog-backed feeds and resolve to
          explicit repeated <code className="rounded bg-muted px-1.5 py-0.5">feed=</code> ids.
        </p>

        <details className="mt-4 rounded-lg border bg-muted/20 p-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
            Timeline options
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="opml-viewer-aggregate-limit"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Timeline size
              </label>
              <select
                id="opml-viewer-aggregate-limit"
                value={aggregateLimit}
                onChange={(event) => setAggregateLimit(Number(event.target.value))}
                className={fieldClassName}
              >
                <option value={12}>12 posts</option>
                <option value={24}>24 posts</option>
                <option value={30}>30 posts</option>
                <option value={48}>48 posts</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="opml-viewer-aggregate-per-source"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Posts per feed
              </label>
              <select
                id="opml-viewer-aggregate-per-source"
                value={aggregatePerSource}
                onChange={(event) => setAggregatePerSource(Number(event.target.value))}
                className={fieldClassName}
              >
                <option value={1}>1 post</option>
                <option value={2}>2 posts</option>
                <option value={3}>3 posts</option>
              </select>
            </div>
          </div>
        </details>
      </div>

      <FeedPostsPanel
        panelState={panelState}
        selectedFeedPosts={selectedFeedPosts}
        sortedPosts={sortedSelectedPosts}
        postSort={postSort}
        onPostSortChange={setPostSort}
      />

      <div className="space-y-4">
        {sortedGroups.map((group) => (
          <details
            key={`${activeCollection.id}-${group.id}`}
            className="group rounded-lg border bg-background"
            open={activeCollection.id === "flat" || sortedGroups.length <= 3}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
              <div className="min-w-0">
                <div className="font-semibold">{group.title}</div>
                <div className="text-sm text-muted-foreground">
                  {group.feeds.length} feed{group.feeds.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Browse</span>
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-150 group-open:rotate-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="m9 6 6 6-6 6"
                  />
                </svg>
              </div>
            </summary>

            <div className="border-t divide-y">
              {group.feeds.map((feed, feedIndex) => (
                <div key={`${group.id}-${feedIndex}-${feed.id}`} className="px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h4 className="font-medium">{feed.title}</h4>
                        {feed.verified && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                            Verified
                          </span>
                        )}
                        {!feed.matchedCatalogFeed && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-900 rounded-full font-medium">
                            Export only
                          </span>
                        )}
                        {feed.sourceType && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full font-medium capitalize">
                            {feed.sourceType}
                          </span>
                        )}
                      </div>

                      {feed.description && (
                        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
                          {feed.description}
                        </p>
                      )}

                      {feed.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {feed.topics.slice(0, 3).map((topic, topicIndex) => (
                            <span
                              key={`${feed.id}-${feedIndex}-${topicIndex}-${topic}`}
                              className="px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground"
                            >
                              {topic}
                            </span>
                          ))}
                          {feed.topics.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{feed.topics.length - 3} more topics
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-52 flex-col gap-2 text-sm lg:items-end lg:text-right">
                      <Button
                        onClick={() => void handleLoadPosts(feed)}
                        disabled={
                          !feed.matchedCatalogFeed ||
                          (panelState.kind === "single-loading" && panelState.feedId === feed.id)
                        }
                        className="h-auto justify-center px-3 py-2"
                      >
                        {panelState.kind === "single-loading" && panelState.feedId === feed.id
                          ? "Loading…"
                          : "View Recent Posts"}
                      </Button>
                      {(feed.websiteUrl || feed.url) && (
                        <a
                          href={feed.websiteUrl || feed.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={subtleLinkClassName}
                        >
                          Open Source Site
                        </a>
                      )}
                      {!feed.matchedCatalogFeed && (
                        <span className="text-xs text-muted-foreground">
                          Live post preview is not available for this export-only source.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      {sortedGroups.length === 0 && (
        <div className="mt-6 text-sm text-muted-foreground border rounded-lg p-6 bg-background">
          No OPML entries matched this filter.
        </div>
      )}

      <details className="mt-6 border rounded-lg bg-background">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          Raw OPML sample
        </summary>
        <pre className="overflow-x-auto border-t p-4 text-xs leading-6 text-muted-foreground">
          <code>{activeCollection.rawSample}</code>
        </pre>
      </details>
    </section>
  );
}

function FeedPostsPanel({
  panelState,
  selectedFeedPosts,
  sortedPosts,
  postSort,
  onPostSortChange,
}: {
  panelState: PostsPanelState;
  selectedFeedPosts: FeedPostsResponse | null;
  sortedPosts: Array<FeedPost | AggregateFeedPost>;
  postSort: PostSortOption;
  onPostSortChange: (value: PostSortOption) => void;
}) {
  const isIdle = panelState.kind === "idle";
  const isLoading = panelState.kind === "single-loading" || panelState.kind === "aggregate-loading";
  const isError = panelState.kind === "error";
  const isAggregateView = panelState.kind === "aggregate-ready";
  const aggregatePosts = panelState.kind === "aggregate-ready" ? panelState.result : null;
  const panelTitle =
    panelState.kind === "single-loading" || panelState.kind === "single-ready"
      ? panelState.title
      : panelState.kind === "aggregate-loading" || panelState.kind === "aggregate-ready"
        ? panelState.title
        : panelState.kind === "error"
          ? panelState.title
          : null;
  const liveAnnouncement = isLoading
    ? "Loading latest posts."
    : isError
      ? panelState.message
      : panelState.kind === "aggregate-ready"
        ? `Loaded posts for ${panelState.result.successfulSources} sources.`
        : panelState.kind === "single-ready"
          ? `Loaded recent posts for ${panelState.title}.`
          : "";

  if (isIdle) {
    return (
      <div className="mb-6 border rounded-lg p-5 bg-background">
        <h3 className="font-semibold mb-1">Recent posts</h3>
        <p className="text-sm text-muted-foreground">
          Pick a feed below to preview recent posts, or load one merged timeline across the visible
          feeds with live data.
        </p>
      </div>
    );
  }

  const sourceSummary = isAggregateView
    ? aggregatePosts
      ? `${aggregatePosts.successfulSources} of ${aggregatePosts.totalSources} sources loaded`
      : null
    : selectedFeedPosts
      ? `${selectedFeedPosts.posts.length} posts loaded`
      : null;

  return (
    <div className="mb-6 border rounded-lg p-5 bg-background space-y-4" aria-busy={isLoading}>
      <div className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </div>

      <div>
        <h3 className="font-semibold text-lg">Recent posts</h3>
        {panelTitle && <p className="text-sm text-muted-foreground mt-1">{panelTitle}</p>}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Fetching the latest entries…</p>}

      {isError && (
        <div
          aria-live="polite"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          {panelState.message}
        </div>
      )}

      {(selectedFeedPosts || aggregatePosts) && !isLoading && !isError && (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {sourceSummary && <span>{sourceSummary}</span>}
              {isAggregateView && aggregatePosts && (
                <span>
                  {aggregatePosts.cacheState === "cached" ? "Reused snapshot" : "Updated live"}{" "}
                  {formatDate(aggregatePosts.fetchedAt)}
                </span>
              )}
              {isAggregateView && aggregatePosts && (
                <span>Fresh until {formatDate(aggregatePosts.expiresAt)}</span>
              )}
              {!isAggregateView && selectedFeedPosts && (
                <a
                  href={selectedFeedPosts.resolvedFeedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={subtleLinkClassName}
                >
                  Open feed source
                </a>
              )}
              {isAggregateView && aggregatePosts && aggregatePosts.failedSources > 0 && (
                <span>{aggregatePosts.failedSources} sources skipped</span>
              )}
            </div>

            <div className="w-full lg:w-56">
              <label htmlFor="opml-viewer-post-sort" className="block text-sm font-medium mb-2">
                Sort posts
              </label>
              <select
                id="opml-viewer-post-sort"
                value={postSort}
                onChange={(event) => onPostSortChange(event.target.value as PostSortOption)}
                className={fieldClassName}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title-asc">Title A-Z</option>
                <option value="title-desc">Title Z-A</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {sortedPosts.map((post) => (
              <article
                key={isAggregatePost(post) ? `${post.feedId}-${post.id}` : post.id}
                className="border rounded-lg p-4"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    {isAggregatePost(post) && (
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                        <a
                          href={post.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                          {post.feedTitle}
                        </a>
                        <a
                          href={post.resolvedFeedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={subtleLinkClassName}
                        >
                          Feed source
                        </a>
                      </div>
                    )}

                    <a
                      href={post.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                      {post.title}
                    </a>

                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
                      {post.author && <span>{post.author}</span>}
                    </div>

                    {post.summary && (
                      <p className="mt-2 text-sm text-muted-foreground">{post.summary}</p>
                    )}

                    {post.categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {post.categories.slice(0, 5).map((category) => (
                          <span
                            key={`${post.id}-${category}`}
                            className="px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CollectionToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      aria-pressed={active}
      variant={active ? "primary" : "outline"}
      className={`h-auto px-3 py-2 text-sm ${active ? "border-fd-primary" : "bg-background"}`}
    >
      {label}
    </Button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-4 bg-background">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function sortPosts<T extends { title: string; publishedAt: string | null }>(
  posts: T[],
  postSort: PostSortOption,
): T[] {
  return [...posts].sort((left, right) => {
    if (postSort === "title-asc") {
      return compareText(left.title, right.title);
    }

    if (postSort === "title-desc") {
      return compareText(right.title, left.title);
    }

    const leftTime = getPostTimestamp(left.publishedAt);
    const rightTime = getPostTimestamp(right.publishedAt);

    if (leftTime === null && rightTime === null) {
      return compareText(left.title, right.title);
    }

    if (leftTime === null) return 1;
    if (rightTime === null) return -1;

    if (postSort === "oldest") {
      return leftTime - rightTime;
    }

    return rightTime - leftTime;
  });
}

function compareFeeds(
  left: OpmlPreviewCollection["groups"][number]["feeds"][number],
  right: OpmlPreviewCollection["groups"][number]["feeds"][number],
  feedActivity: FeedActivity,
  feedSort: FeedSortOption,
): number {
  if (feedSort === "title-asc") {
    return compareText(left.title, right.title);
  }

  if (feedSort === "title-desc") {
    return compareText(right.title, left.title);
  }

  if (feedSort === "latest-post-desc" || feedSort === "latest-post-asc") {
    const leftTime = feedActivity[left.id]?.latestPostTimestamp ?? null;
    const rightTime = feedActivity[right.id]?.latestPostTimestamp ?? null;

    if (leftTime === null && rightTime === null) {
      return compareText(left.title, right.title);
    }

    if (leftTime === null) return 1;
    if (rightTime === null) return -1;

    if (feedSort === "latest-post-asc") {
      return leftTime - rightTime;
    }

    return rightTime - leftTime;
  }

  return 0;
}

function getLatestFeedTimestamp(feedResponse: FeedPostsResponse | undefined): number | null {
  if (!feedResponse) {
    return null;
  }

  let latestTime: number | null = null;

  for (const post of feedResponse.posts) {
    const timestamp = getPostTimestamp(post.publishedAt);
    if (timestamp === null) {
      continue;
    }

    if (latestTime === null || timestamp > latestTime) {
      latestTime = timestamp;
    }
  }

  return latestTime;
}

function buildFilteredOpmlHref(feedIds: string[]): string | null {
  if (feedIds.length === 0) {
    return null;
  }

  const searchParams = new URLSearchParams();
  searchParams.set("format", "filtered");
  for (const feedId of feedIds) {
    searchParams.append("feed", feedId);
  }

  return `/api/exports/opml?${searchParams.toString()}`;
}

function getPostTimestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function isAggregatePost(post: FeedPost | AggregateFeedPost): post is AggregateFeedPost {
  return "feedTitle" in post;
}
