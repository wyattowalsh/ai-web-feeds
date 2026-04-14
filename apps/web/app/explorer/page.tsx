"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Activity, Layers3, RadioTower, Search as SearchIcon, Waypoints } from "lucide-react";
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
import { cn } from "@/lib/cn";

type ExplorerTab = "topics" | "feeds" | "combined";

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

function buildFeedsHref(options: { feedId?: string; query?: string; topics?: string[] }): string {
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
    if (layout !== "force") params.set("layout", layout);
    writeGraphControlsToParams(params, graphControls, getDefaultGraphControls(tab));

    const nextQuery = params.toString();
    const nextUrl = nextQuery
      ? `${window.location.pathname}?${nextQuery}`
      : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [graphControls, layout, search, tab]);

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
      setSearch(nodeId);
      setHighlightedNode(nodeId);
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
            topics: normalizeTopicValues(selectedFeed.topics ?? selectedFeed.tags),
          }),
        );
      }
      return;
    }

    if (detailAction.action === "open-topics") {
      router.push(
        buildFeedsHref({
          query: search,
          topics: detailAction.nodeType === "topic" ? [detailAction.nodeId] : [],
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
              ? [detailAction.nodeId]
              : normalizeTopicValues(selectedFeed?.topics ?? selectedFeed?.tags),
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

    result.sort((a, b) => a.label.localeCompare(b.label));

    return result;
  }, [topics, search]);

  const filteredFeeds = useMemo(() => {
    if (!feeds || !Array.isArray(feeds) || feeds.length === 0) return [];
    const searchValue = search.toLowerCase();
    const result = feeds.filter((feed) => {
      const matchesSearch =
        feed.title?.toLowerCase().includes(searchValue) ||
        feed.url?.toLowerCase().includes(searchValue) ||
        feed.notes?.toLowerCase().includes(searchValue);

      if (!matchesSearch) return false;

      return true;
    });

    result.sort((a, b) => String(a.title ?? a.url).localeCompare(String(b.title ?? b.url)));

    return result;
  }, [feeds, search]);

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
              Taxonomy graph
            </span>
            <div className="space-y-4">
              <h1 className="hero-title max-w-4xl">
                Explore topics and feeds as one connected map.
              </h1>
              <p className="hero-copy max-w-2xl">
                Use this route to inspect the AI topic taxonomy and see how cataloged feeds connect
                to it. Open `/feeds` when you want to read recent posts or export a slice.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">How to use this surface</p>
            <p className="small-note">
              Search narrows the current working set, layout controls help with readability, and
              node actions send the current slice into `/feeds`.
            </p>
            <div className="grid gap-2 text-sm text-(--ink)">
              <div className="flex items-center gap-3">
                <Waypoints className="size-4 text-(--brand-strong)" />
                Graph layouts for structural exploration
              </div>
              <div className="flex items-center gap-3">
                <SearchIcon className="size-4 text-(--brand-strong)" />
                Search and feed-to-topic links for narrowing scope
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
                  : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)",
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
                  : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)",
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
                  : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)",
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
        </div>

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
                    Interactive visualization with zoom, pan, and follow-up exploration through node
                    details.
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
