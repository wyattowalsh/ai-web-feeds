"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Layers3,
  RadioTower,
  Search as SearchIcon,
  TableProperties,
  Waypoints,
  X,
} from "lucide-react";
import {
  getDefaultGraphControls,
  GraphVisualizer,
  type GraphControls,
  type GraphDetailAction,
  type LayoutType,
} from "@/components/graph-visualizer";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type CombinedCatalogGraphData,
  normalizeTopicValues,
  type CatalogFeed,
  type TopicRecord,
} from "@/lib/catalog-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";

type ExplorerTab = "topics" | "feeds" | "combined";
type ExplorerView = "table" | "graph";

// Utility to fetch and parse JSON from API routes
async function fetchData<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<T>;
}

function useExplorerData() {
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [feeds, setFeeds] = useState<CatalogFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchData<TopicRecord[]>("/api/topics"), fetchData<CatalogFeed[]>("/api/feeds")])
      .then(([topicsData, feedsData]) => {
        setTopics(topicsData);
        setFeeds(feedsData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { topics, feeds, loading, error };
}

function buildFeedsHref(options: {
  feedId?: string;
  query?: string;
  topics?: string[];
}): string {
  const params = new URLSearchParams();
  params.set("mode", "catalog");

  if (options.query?.trim()) {
    params.set("q", options.query.trim());
  }

  const topics = Array.from(
    new Set((options.topics ?? []).map((topic) => topic.trim()).filter(Boolean)),
  );
  if (topics.length > 0) {
    params.set("topics", topics.join(","));
  }

  if (options.feedId) {
    params.set("feed", options.feedId);
  }

  return `/feeds?${params.toString()}`;
}

function ExplorerPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { topics, feeds, loading, error } = useExplorerData();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [tab, setTab] = useState<ExplorerTab>(getTabFromSearchParams(searchParams));
  const [view, setView] = useState<ExplorerView>(getViewFromSearchParams(searchParams));
  const [selectedTags, setSelectedTags] = useState<string[]>(getTagsFromSearchParams(searchParams));
  const [sortBy, setSortBy] = useState<string>(searchParams.get("sort") || "name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    searchParams.get("order") === "desc" ? "desc" : "asc",
  );
  const [layout, setLayout] = useState<LayoutType>(getLayoutFromSearchParams(searchParams));
  const [graphControls, setGraphControls] = useState<GraphControls>(() =>
    getGraphControlsFromSearchParams(searchParams, getTabFromSearchParams(searchParams)),
  );
  const [, setHighlightedNode] = useState<string | null>(null);
  const combinedGraphData = useMemo<CombinedCatalogGraphData>(
    () => ({ topics, feeds }),
    [topics, feeds],
  );

  useEffect(() => {
    setGraphControls((current) => {
      const urlControls = getGraphControlsFromSearchParams(searchParams, tab);
      if (areGraphControlsEqual(current, urlControls)) {
        return current;
      }
      return urlControls;
    });
  }, [searchParams, tab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tab !== "combined") params.set("tab", tab);
    if (view !== "graph") params.set("view", view);
    if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
    if (sortBy !== "name") params.set("sort", sortBy);
    if (sortOrder !== "asc") params.set("order", sortOrder);
    if (layout !== "force") params.set("layout", layout);
    writeGraphControlsToParams(params, graphControls, getDefaultGraphControls(tab));

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [graphControls, layout, search, selectedTags, sortBy, sortOrder, tab, view]);

  useEffect(() => {
    setLayout(getLayoutFromSearchParams(searchParams));
  }, [searchParams]);

  // Handler for deep linking between graphs
  const handleNodeClick = (nodeId: string, nodeType: "topic" | "feed") => {
    if (tab === "combined") {
      setHighlightedNode(nodeId);
      return;
    }

    if (nodeType === "topic" && tab === "feeds") {
      // Clicked a topic from feeds graph - switch to topics tab and highlight
      setTab("topics");
      setSearch(nodeId);
      setHighlightedNode(nodeId);
    } else if (nodeType === "feed" && tab === "topics") {
      // If we had feed info in topics graph, switch to feeds
      setTab("feeds");
      setHighlightedNode(nodeId);
    } else if (nodeType === "topic") {
      // Clicked topic in topics graph - filter feeds by this topic
      setSearch(nodeId);
      setHighlightedNode(nodeId);
      // Optionally switch to feeds tab to show related feeds
      // setTab('feeds');
      // setSelectedTags([nodeId]);
    } else {
      setHighlightedNode(nodeId);
    }
  };

  const handleDetailAction = (detailAction: GraphDetailAction) => {
    if (detailAction.action === "copy-id") {
      void navigator.clipboard?.writeText(detailAction.nodeId);
      return;
    }

    if (detailAction.action === "open-url") {
      const selectedFeed = feeds.find(
        (feed, index) => `feed:${feed.id ?? index}` === detailAction.nodeId,
      );
      if (selectedFeed?.id) {
        router.push(
          buildFeedsHref({
            feedId: selectedFeed.id,
            query: search,
            topics:
              selectedTags.length > 0
                ? [...selectedTags, ...normalizeTopicValues(selectedFeed.topics ?? selectedFeed.tags)]
                : normalizeTopicValues(selectedFeed.topics ?? selectedFeed.tags),
          }),
        );
      }
      return;
    }

    if (detailAction.action === "open-topics") {
      router.push(
        buildFeedsHref({
          query: search,
          topics:
            detailAction.nodeType === "topic"
              ? [detailAction.nodeId, ...selectedTags]
              : selectedTags,
        }),
      );
      return;
    }

    if (detailAction.action === "open-feeds") {
      const selectedFeed = feeds.find(
        (feed, index) => `feed:${feed.id ?? index}` === detailAction.nodeId,
      );
      router.push(
        buildFeedsHref({
          query: search,
          feedId: selectedFeed?.id ?? detailAction.nodeId,
          topics:
            detailAction.nodeType === "topic"
              ? [detailAction.nodeId, ...selectedTags]
              : [
                  ...selectedTags,
                  ...normalizeTopicValues(selectedFeed?.topics ?? selectedFeed?.tags),
                ],
        }),
      );
    }
  };

  // Extract all unique tags from feeds
  const allTags = useMemo(() => {
    if (!feeds || !Array.isArray(feeds) || feeds.length === 0) return [];
    const tagSet = new Set<string>();
    feeds.forEach((feed) => {
      normalizeTopicValues(feed.topics ?? feed.tags).forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [feeds]);

  // Filtering and sorting logic
  const filteredTopics = useMemo(() => {
    if (!topics || !Array.isArray(topics) || topics.length === 0) return [];
    const searchValue = search.toLowerCase();
    const result = topics.filter(
      (topic) =>
        topic.label?.toLowerCase().includes(searchValue) ||
        topic.id?.toLowerCase().includes(searchValue) ||
        topic.description?.toLowerCase().includes(searchValue),
    );

    result.sort((a, b) => {
      const sortField: keyof TopicRecord = sortBy === "name" ? "label" : "id";
      const aVal = String(a[sortField] ?? "");
      const bVal = String(b[sortField] ?? "");
      const comparison = aVal.localeCompare(bVal);
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [topics, search, sortBy, sortOrder]);

  const filteredFeeds = useMemo(() => {
    if (!feeds || !Array.isArray(feeds) || feeds.length === 0) return [];
    const searchValue = search.toLowerCase();
    const result = feeds.filter((feed) => {
      const matchesSearch =
        feed.title?.toLowerCase().includes(searchValue) ||
        feed.url?.toLowerCase().includes(searchValue) ||
        feed.notes?.toLowerCase().includes(searchValue);

      if (!matchesSearch) return false;

      if (selectedTags.length > 0) {
        const topicsArray = normalizeTopicValues(feed.topics ?? feed.tags);
        return selectedTags.some((tag) => topicsArray.includes(tag));
      }

      return true;
    });

    result.sort((a, b) => {
      const sortField: keyof CatalogFeed = sortBy === "url" ? "url" : "title";
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [feeds, search, selectedTags, sortBy, sortOrder]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const visibleCount =
    tab === "topics"
      ? filteredTopics.length
      : tab === "feeds"
        ? filteredFeeds.length
        : topics.length + feeds.length;

  if (loading) {
    return (
      <div className="page-wrap page-stack">
        <div className="surface-panel flex min-h-96 flex-col items-center justify-center gap-4 text-center">
          <div className="size-16 animate-pulse rounded-3xl bg-(--brand-soft)" />
          <div className="space-y-2">
            <h1 className="text-3xl">Loading explorer</h1>
            <p className="small-note">Preparing the catalog graph and feed index.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrap page-stack">
        <div className="surface-panel border-(--danger-tone)/40">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="flex size-14 items-center justify-center rounded-3xl bg-[color-mix(in_oklab,var(--danger-tone)_14%,var(--surface))] text-(--danger-tone)">
              <Activity className="size-5" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl">Explorer data failed to load</h2>
              <p className="small-note">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-5">
            <span className="eyebrow">
              <Waypoints className="size-3.5" />
              Supporting catalog explorer
            </span>
            <div className="space-y-4">
              <h1 className="hero-title max-w-4xl">
                Inspect the catalog, then open the current slice in Feeds.
              </h1>
              <p className="hero-copy max-w-2xl">
                Switch between graph and table views when you need structure, then deep-link the
                current topic or feed slice into the reader-first workspace.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">How to use this surface</p>
            <p className="small-note">
              Use graph view for structure and table view for precision. Search narrows the working
              set, and detail actions now send the current slice into /feeds.
            </p>
            <div className="grid gap-2 text-sm text-(--ink)">
              <div className="flex items-center gap-3">
                <Waypoints className="size-4 text-(--brand-strong)" />
                Graph layouts for structural exploration
              </div>
              <div className="flex items-center gap-3">
                <TableProperties className="size-4 text-(--brand-strong)" />
                Table mode for scanning exact metadata
              </div>
              <div className="flex items-center gap-3">
                <SearchIcon className="size-4 text-(--brand-strong)" />
                Search and tag filters for narrowing scope
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="surface-card flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="metric-label">Topics</p>
              <p className="metric-value">{topics.length}</p>
              <p className="small-note">Taxonomy nodes available for browsing</p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
              <Layers3 className="size-5" />
            </span>
          </div>

          <div className="surface-card flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="metric-label">Feeds</p>
              <p className="metric-value">{feeds.length}</p>
              <p className="small-note">Cataloged sources linked to topics</p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
              <RadioTower className="size-5" />
            </span>
          </div>

          <div className="surface-card flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="metric-label">Unique tags</p>
              <p className="metric-value">{allTags.length}</p>
              <p className="small-note">Feed topics available as quick filters</p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
              <SearchIcon className="size-5" />
            </span>
          </div>

          <div className="surface-card flex items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="metric-label">Visible now</p>
              <p className="metric-value">{visibleCount}</p>
              <p className="small-note">Items in the current tab and filter state</p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
              <Activity className="size-5" />
            </span>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-start">
          <div className="surface-card flex flex-col gap-3 lg:flex-row lg:items-center">
            <button
              type="button"
              className={cn(
                "flex flex-1 items-center justify-between rounded-2xl border px-5 py-4 text-sm font-semibold transition duration-150 lg:flex-none lg:min-w-48",
                tab === "topics"
                  ? "border-(--brand) bg-(--brand-soft) text-(--brand-strong)"
                  : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)"
              )}
              onClick={() => setTab("topics")}
              aria-pressed={tab === "topics"}
            >
              <div className="flex items-center gap-3">
                <Layers3 className="size-4.5" />
                <span>Topics</span>
              </div>
              <span className="rounded-full bg-(--surface) px-3 py-1 text-xs font-semibold text-(--ink)">
                {filteredTopics.length}
              </span>
            </button>
            <button
              type="button"
              className={cn(
                "flex flex-1 items-center justify-between rounded-2xl border px-5 py-4 text-sm font-semibold transition duration-150 lg:flex-none lg:min-w-48",
                tab === "feeds"
                  ? "border-(--brand) bg-(--brand-soft) text-(--brand-strong)"
                  : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)"
              )}
              onClick={() => setTab("feeds")}
              aria-pressed={tab === "feeds"}
            >
              <div className="flex items-center gap-3">
                <RadioTower className="size-4.5" />
                <span>Feeds</span>
              </div>
              <span className="rounded-full bg-(--surface) px-3 py-1 text-xs font-semibold text-(--ink)">
                {filteredFeeds.length}
              </span>
            </button>
            <button
              type="button"
              className={cn(
                "flex flex-1 items-center justify-between rounded-2xl border px-5 py-4 text-sm font-semibold transition duration-150 lg:flex-none lg:min-w-48",
                tab === "combined"
                  ? "border-(--brand) bg-(--brand-soft) text-(--brand-strong)"
                  : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)"
              )}
              onClick={() => setTab("combined")}
              aria-pressed={tab === "combined"}
            >
              <div className="flex items-center gap-3">
                <Waypoints className="size-4.5" />
                <span>Combined</span>
              </div>
              <span className="rounded-full bg-(--surface) px-3 py-1 text-xs font-semibold text-(--ink)">
                {topics.length + feeds.length}
              </span>
            </button>
          </div>

          <div className="surface-card flex gap-3 xl:w-auto">
            <button
              type="button"
              onClick={() => setView("graph")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition duration-150 xl:flex-none",
                view === "graph"
                  ? "border-(--brand) bg-(--brand) text-(--fd-primary-foreground)"
                  : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)"
              )}
              aria-pressed={view === "graph"}
            >
              <Waypoints className="size-4" />
              Graph View
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition duration-150 xl:flex-none",
                view === "table"
                  ? "border-(--brand) bg-(--brand) text-(--fd-primary-foreground)"
                  : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)"
              )}
              aria-pressed={view === "table"}
            >
              <TableProperties className="size-4" />
              Table View
            </button>
          </div>
        </div>

        {view === "table" && tab !== "combined" && (
          <div className="space-y-5">
            <div className="surface-card">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
                <div>
                  <label htmlFor="catalog-search" className="field-label">
                    Search {tab}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-(--ink-muted)">
                      <SearchIcon className="size-4" />
                    </span>
                    <Input
                      id="catalog-search"
                      type="text"
                      placeholder={`Search ${tab}...`}
                      value={search}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                      className="pl-11"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="catalog-sort" className="field-label">
                    Sort by
                  </label>
                  <Select
                    id="catalog-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label={`Sort ${tab} results by`}
                  >
                    {tab === "topics" ? (
                      <>
                        <option value="name">Sort by name</option>
                        <option value="id">Sort by ID</option>
                      </>
                    ) : (
                      <>
                        <option value="title">Sort by title</option>
                        <option value="url">Sort by URL</option>
                      </>
                    )}
                  </Select>
                </div>
                <Button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  aria-label={`Toggle sort order, currently ${sortOrder === "asc" ? "ascending" : "descending"}`}
                  className="lg:self-end"
                >
                  {sortOrder === "asc" ? "Ascending" : "Descending"}
                </Button>
              </div>
            </div>

            {tab === "feeds" && allTags.length > 0 && (
              <div className="surface-card space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="metric-label">Tag filter</p>
                    <h2 className="text-xl">Filter feed results by topic tags</h2>
                  </div>
                  {selectedTags.length > 0 && (
                    <Button onClick={() => setSelectedTags([])} variant="ghost">
                      <X className="size-4" />
                      Clear ({selectedTags.length})
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {allTags.slice(0, 30).map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-150",
                        selectedTags.includes(tag)
                          ? "border-(--brand) bg-(--brand) text-(--fd-primary-foreground)"
                          : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)"
                      )}
                      aria-pressed={selectedTags.includes(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                  {allTags.length > 30 && (
                    <span className="self-center px-4 text-sm font-medium text-(--ink-muted)">
                      +{allTags.length - 30} more tags available
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {view === "graph" ? (
          <div className="surface-panel overflow-hidden p-0">
            <div className="border-b border-(--line) px-6 py-6 sm:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex size-14 items-center justify-center rounded-3xl bg-(--brand-soft) text-(--brand-strong)">
                    <Waypoints className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-(--ink)">
                      {tab === "topics"
                        ? "Topics Knowledge Graph"
                        : tab === "feeds"
                          ? "Feeds Network Graph"
                          : "Combined Topic + Feed Graph"}
                    </h3>
                    <p className="small-note mt-1">
                      Interactive visualization with zoom, pan, and follow-up exploration through
                      node details.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="rounded-full border border-(--line) bg-(--surface) px-4 py-2 text-sm font-semibold text-(--ink-muted)">
                    Multiple layouts
                  </span>
                  <span className="rounded-full border border-(--line) bg-(--surface) px-4 py-2 text-sm font-semibold text-(--ink-muted)">
                    Node details
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <GraphVisualizer
                data={
                  tab === "topics"
                    ? filteredTopics
                    : tab === "feeds"
                      ? filteredFeeds
                      : combinedGraphData
                }
                type={tab}
                width={1500}
                height={800}
                layout={layout}
                onLayoutChange={setLayout}
                graphControls={graphControls}
                onGraphControlsChange={setGraphControls}
                onNodeClick={handleNodeClick}
                onDetailAction={handleDetailAction}
              />
            </div>
          </div>
        ) : (
          <div className="surface-panel overflow-hidden p-0">
            {tab === "combined" ? (
              <CombinedGraphTableNotice onSwitchToGraph={() => setView("graph")} />
            ) : tab === "topics" ? (
              <TopicsTable topics={filteredTopics} />
            ) : (
              <FeedsTable feeds={filteredFeeds} />
            )}
          </div>
        )}
        </section>
      </div>
  );
}

export default function ExplorerPage() {
  return (
    <Suspense fallback={<div className="page-wrap py-16" />}>
      <ExplorerPageContent />
    </Suspense>
  );
}

function getTabFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): ExplorerTab {
  const value = searchParams.get("tab");
  return value === "topics" || value === "feeds" || value === "combined" ? value : "combined";
}

function getViewFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): ExplorerView {
  return searchParams.get("view") === "table" ? "table" : "graph";
}

function getTagsFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): string[] {
  return searchParams.get("tags")?.split(",").filter(Boolean) || [];
}

function getLayoutFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): LayoutType {
  const value = searchParams.get("layout");
  return value === "radial" || value === "tree" || value === "circular" || value === "force"
    ? value
    : "force";
}

function getGraphControlsFromSearchParams(
  searchParams: ReturnType<typeof useSearchParams>,
  tab: ExplorerTab,
): GraphControls {
  const defaults = getDefaultGraphControls(tab);

  return {
    chargeStrength: getNumericParam(searchParams.get("charge"), defaults.chargeStrength),
    linkDistance: getNumericParam(searchParams.get("distance"), defaults.linkDistance),
    collisionRadius: getNumericParam(searchParams.get("spacing"), defaults.collisionRadius),
    nodeScale: getNumericParam(searchParams.get("scale"), defaults.nodeScale),
    labelSize: getNumericParam(searchParams.get("labelSize"), defaults.labelSize),
    showLabels: getBooleanParam(searchParams.get("labels"), defaults.showLabels),
  };
}

function getNumericParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getBooleanParam(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function writeGraphControlsToParams(
  params: URLSearchParams,
  current: GraphControls,
  defaults: GraphControls,
) {
  setParamIfChanged(params, "charge", current.chargeStrength, defaults.chargeStrength);
  setParamIfChanged(params, "distance", current.linkDistance, defaults.linkDistance);
  setParamIfChanged(params, "spacing", current.collisionRadius, defaults.collisionRadius);
  setParamIfChanged(params, "scale", current.nodeScale, defaults.nodeScale);
  setParamIfChanged(params, "labelSize", current.labelSize, defaults.labelSize);

  if (current.showLabels !== defaults.showLabels) {
    params.set("labels", String(current.showLabels));
  }
}

function setParamIfChanged(params: URLSearchParams, key: string, value: number, fallback: number) {
  if (value !== fallback) {
    params.set(key, String(value));
  }
}

function areGraphControlsEqual(left: GraphControls, right: GraphControls): boolean {
  return (
    left.chargeStrength === right.chargeStrength &&
    left.linkDistance === right.linkDistance &&
    left.collisionRadius === right.collisionRadius &&
    left.nodeScale === right.nodeScale &&
    left.labelSize === right.labelSize &&
    left.showLabels === right.showLabels
  );
}

function CombinedGraphTableNotice({ onSwitchToGraph }: { onSwitchToGraph: () => void }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mb-4 flex justify-center">
        <span className="flex size-16 items-center justify-center rounded-3xl bg-(--brand-soft) text-(--brand-strong)">
          <Waypoints className="size-6" />
        </span>
      </div>
      <div className="text-xl font-semibold text-(--ink)">
        The combined topic/feed network is available in graph view.
      </div>
      <p className="small-note mx-auto mt-3 max-w-2xl">
        This mode overlays taxonomy relationships with feed-to-topic links, so it works best as a
        single interactive graph rather than a flattened table.
      </p>
      <Button onClick={onSwitchToGraph} className="mt-6">
        Switch To Graph View
      </Button>
    </div>
  );
}

function TopicsTable({ topics }: { topics: TopicRecord[] }) {
  if (topics.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="mb-4 flex justify-center">
          <span className="flex size-16 items-center justify-center rounded-3xl bg-(--brand-soft) text-(--brand-strong)">
            <SearchIcon className="size-6" />
          </span>
        </div>
        <div className="text-lg font-medium text-(--ink)">
          No topics found matching your search criteria
        </div>
        <p className="small-note mt-2">
          Try adjusting your search terms or filters
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-(--line) bg-(--surface-muted)">
            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-(--ink-muted)">
              ID
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-(--ink-muted)">
              Label
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-(--ink-muted)">
              Description
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-(--ink-muted)">
              Facet
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--line)">
          {topics.map((t, idx) => (
            <tr
              key={t.id || idx}
              className="transition-colors hover:bg-(--surface-muted)"
            >
              <td className="px-6 py-4 font-mono text-sm text-(--ink-muted)">
                {t.id}
              </td>
              <td className="px-6 py-4 font-semibold text-(--ink)">{t.label}</td>
              <td className="px-6 py-4 text-sm text-(--ink-muted)">
                {t.description}
              </td>
              <td className="px-6 py-4">
                {t.facet && (
                  <span className="rounded-full bg-(--brand-soft) px-3 py-1 text-xs font-medium text-(--brand-strong)">
                    {t.facet}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeedsTable({ feeds }: { feeds: CatalogFeed[] }) {
  if (feeds.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="mb-4 flex justify-center">
          <span className="flex size-16 items-center justify-center rounded-3xl bg-(--brand-soft) text-(--brand-strong)">
            <SearchIcon className="size-6" />
          </span>
        </div>
        <div className="text-lg font-medium text-(--ink)">
          No feeds found matching your search criteria
        </div>
        <p className="small-note mt-2">
          Try adjusting your search terms or tag filters
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-(--line) bg-(--surface-muted)">
            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-(--ink-muted)">
              Title
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-(--ink-muted)">
              URL
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-(--ink-muted)">
              Topics
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--line)">
          {feeds.map((f, idx) => {
            const topicsArray = normalizeTopicValues(f.topics ?? f.tags);

            return (
              <tr
                key={f.url || idx}
                className="transition-colors hover:bg-(--surface-muted)"
              >
                <td className="px-6 py-4 font-semibold text-(--ink)">
                  {f.title || "Untitled Feed"}
                </td>
                <td className="px-6 py-4 font-mono text-sm">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-(--brand-strong) hover:underline"
                  >
                    {f.url}
                  </a>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {topicsArray.map((tag: string, tagIdx: number) => (
                      <span
                        key={tagIdx}
                        className="rounded-full bg-(--brand-soft) px-2.5 py-1 text-xs font-medium text-(--brand-strong)"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
