"use client";

import React, { useState, useEffect, useMemo } from "react";
import { GraphVisualizer } from "@/components/graph-visualizer";

// Utility to fetch and parse JSON from API routes
async function fetchData(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function useExplorerData() {
  const [topics, setTopics] = useState<any[]>([]);
  const [feeds, setFeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchData("/api/topics"), fetchData("/api/feeds")])
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

export default function ExplorerPage() {
  const { topics, feeds, loading, error } = useExplorerData();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"topics" | "feeds">("topics");
  const [view, setView] = useState<"table" | "graph">("graph");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  // Handler for deep linking between graphs
  const handleNodeClick = (nodeId: string, nodeType: "topic" | "feed") => {
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

  // Extract all unique tags from feeds
  const allTags = useMemo(() => {
    if (!feeds || !Array.isArray(feeds) || feeds.length === 0) return [];
    const tagSet = new Set<string>();
    feeds.forEach((f) => {
      const feedTopics = f.topics || f.tags;
      if (Array.isArray(feedTopics)) {
        feedTopics.forEach((tag: string) => tagSet.add(tag));
      } else if (typeof feedTopics === "string") {
        feedTopics.split(",").forEach((tag: string) => tagSet.add(tag.trim()));
      }
    });
    return Array.from(tagSet).sort();
  }, [feeds]);

  // Filtering and sorting logic
  const filteredTopics = useMemo(() => {
    if (!topics || !Array.isArray(topics) || topics.length === 0) return [];
    let result = topics.filter(
      (t) =>
        t.label?.toLowerCase().includes(search.toLowerCase()) ||
        t.id?.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase()),
    );

    result.sort((a, b) => {
      const sortField = sortBy === "name" ? "label" : sortBy;
      const aVal = a[sortField] || "";
      const bVal = b[sortField] || "";
      const comparison = aVal.localeCompare(bVal);
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [topics, search, sortBy, sortOrder]);

  const filteredFeeds = useMemo(() => {
    if (!feeds || !Array.isArray(feeds) || feeds.length === 0) return [];
    let result = feeds.filter((f) => {
      const matchesSearch =
        f.title?.toLowerCase().includes(search.toLowerCase()) ||
        f.url?.toLowerCase().includes(search.toLowerCase()) ||
        f.notes?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedTags.length > 0) {
        const feedTopics = f.topics || f.tags;
        const topicsArray = Array.isArray(feedTopics)
          ? feedTopics
          : typeof feedTopics === "string"
            ? feedTopics.split(",").map((t: string) => t.trim())
            : [];
        return selectedTags.some((tag) => topicsArray.includes(tag));
      }

      return true;
    });

    result.sort((a, b) => {
      const aVal = a[sortBy] || "";
      const bVal = b[sortBy] || "";
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

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto py-16 px-4">
          <div className="flex flex-col items-center justify-center min-h-[600px]">
            <div className="relative">
              <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-200 dark:border-blue-900"></div>
              <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-blue-600 dark:border-blue-400 absolute top-0"></div>
            </div>
            <div className="mt-6 text-lg font-medium text-gray-700 dark:text-gray-300">
              Loading explorer...
            </div>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Preparing {topics.length + feeds.length}+ items
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto py-16 px-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center text-2xl">
                ⚠️
              </div>
              <div>
                <h2 className="text-red-800 dark:text-red-300 font-bold mb-2 text-2xl">
                  Error Loading Data
                </h2>
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-slate-900 dark:to-gray-900">
      <div className="max-w-[1800px] mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
              🌐
            </div>
            <div>
              <h1 className="text-5xl sm:text-6xl font-extrabold mb-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                AI Web Feeds Explorer
              </h1>
              <p className="text-gray-700 dark:text-gray-300 text-lg max-w-4xl">
                Interactive knowledge graph exploration • Discover connections in AI topics and RSS
                feeds
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border-2 border-blue-200 dark:border-blue-900/50 hover:shadow-2xl hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wide">
                  Total Topics
                </p>
                <p className="text-4xl font-black text-blue-600 dark:text-blue-400 mt-2">
                  {topics.length}
                </p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:rotate-12 transition-transform">
                🏷️
              </div>
            </div>
            <div className="mt-3 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
          </div>

          <div className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border-2 border-purple-200 dark:border-purple-900/50 hover:shadow-2xl hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wide">
                  Total Feeds
                </p>
                <p className="text-4xl font-black text-purple-600 dark:text-purple-400 mt-2">
                  {feeds.length}
                </p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:rotate-12 transition-transform">
                📡
              </div>
            </div>
            <div className="mt-3 h-1 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"></div>
          </div>

          <div className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border-2 border-green-200 dark:border-green-900/50 hover:shadow-2xl hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wide">
                  Unique Tags
                </p>
                <p className="text-4xl font-black text-green-600 dark:text-green-400 mt-2">
                  {allTags.length}
                </p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:rotate-12 transition-transform">
                🔖
              </div>
            </div>
            <div className="mt-3 h-1 bg-gradient-to-r from-green-500 to-green-600 rounded-full"></div>
          </div>

          <div className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border-2 border-orange-200 dark:border-orange-900/50 hover:shadow-2xl hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold uppercase tracking-wide">
                  Viewing
                </p>
                <p className="text-4xl font-black text-orange-600 dark:text-orange-400 mt-2">
                  {tab === "topics" ? filteredTopics.length : filteredFeeds.length}
                </p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:rotate-12 transition-transform">
                �️
              </div>
            </div>
            <div className="mt-3 h-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"></div>
          </div>
        </div>

        {/* Tabs and View Toggle */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          {/* Tabs */}
          <div className="flex gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-2 shadow-xl border-2 border-gray-200 dark:border-gray-700 w-full lg:w-auto">
            <button
              className={`group flex-1 lg:flex-none px-8 py-4 font-bold transition-all rounded-xl relative overflow-hidden ${
                tab === "topics"
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={() => setTab("topics")}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏷️</span>
                <span>Topics</span>
              </div>
              <span
                className={`ml-3 px-3 py-1 rounded-full text-xs font-bold ${
                  tab === "topics"
                    ? "bg-white/20 text-white"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                }`}
              >
                {filteredTopics.length}
              </span>
            </button>
            <button
              className={`group flex-1 lg:flex-none px-8 py-4 font-bold transition-all rounded-xl relative overflow-hidden ${
                tab === "feeds"
                  ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg scale-105"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={() => setTab("feeds")}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📡</span>
                <span>Feeds</span>
              </div>
              <span
                className={`ml-3 px-3 py-1 rounded-full text-xs font-bold ${
                  tab === "feeds"
                    ? "bg-white/20 text-white"
                    : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                }`}
              >
                {filteredFeeds.length}
              </span>
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-2 shadow-xl border-2 border-gray-200 dark:border-gray-700 w-full lg:w-auto">
            <button
              onClick={() => setView("graph")}
              className={`flex-1 lg:flex-none px-6 py-3 rounded-xl font-bold transition-all ${
                view === "graph"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg scale-105"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <span className="mr-2">📊</span>
              Graph View
            </button>
            <button
              onClick={() => setView("table")}
              className={`flex-1 lg:flex-none px-6 py-3 rounded-xl font-bold transition-all ${
                view === "table"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg scale-105"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <span className="mr-2">📋</span>
              Table View
            </button>
          </div>
        </div>

        {/* Search and Controls - Only show for table view */}
        {view === "table" && (
          <div className="mb-8 space-y-6">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border-2 border-gray-200 dark:border-gray-700">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
                    <span className="text-xl">🔍</span>
                  </div>
                  <input
                    type="text"
                    placeholder={`Search ${tab}...`}
                    value={search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    className="w-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-4 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-medium transition-all"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 text-gray-900 dark:text-white font-medium transition-all cursor-pointer"
                >
                  {tab === "topics" ? (
                    <>
                      <option value="name">📝 Sort by Name</option>
                      <option value="id">🔖 Sort by ID</option>
                    </>
                  ) : (
                    <>
                      <option value="title">📝 Sort by Title</option>
                      <option value="url">🔗 Sort by URL</option>
                    </>
                  )}
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-2 border-blue-500 rounded-xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-blue-500/20 font-bold transition-all shadow-lg hover:shadow-xl"
                >
                  {sortOrder === "asc" ? "↑ Ascending" : "↓ Descending"}
                </button>
              </div>
            </div>

            {/* Tag filter for feeds */}
            {tab === "feeds" && allTags.length > 0 && (
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-gray-200 dark:border-gray-700 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <span className="text-2xl">🏷️</span>
                    <span>Filter by Tags</span>
                  </div>
                  {selectedTags.length > 0 && (
                    <button
                      onClick={() => setSelectedTags([])}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-xl font-bold transition-all"
                    >
                      Clear ({selectedTags.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {allTags.slice(0, 30).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg ${
                        selectedTags.includes(tag)
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white scale-110 ring-4 ring-blue-300/50 dark:ring-blue-700/50"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  {allTags.length > 30 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 self-center px-4 font-medium">
                      +{allTags.length - 30} more tags available
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {view === "graph" ? (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-8 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-slate-800 dark:to-gray-800">
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg">
                    🕸️
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white text-2xl">
                      {tab === "topics" ? "Topics Knowledge Graph" : "Feeds Network Graph"}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <span className="font-semibold">Interactive visualization</span> • Pan with
                      drag • Zoom with scroll • Click nodes for deep linking
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-4 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-xl text-sm font-bold border border-blue-300 dark:border-blue-700">
                    🎨 Multiple layouts
                  </span>
                  <span className="px-4 py-2 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-xl text-sm font-bold border border-purple-300 dark:border-purple-700">
                    🔗 Deep linking
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4">
              <GraphVisualizer
                data={tab === "topics" ? filteredTopics : filteredFeeds}
                type={tab}
                width={1500}
                height={800}
                onNodeClick={handleNodeClick}
              />
            </div>
          </div>
        ) : (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
            {tab === "topics" ? (
              <TopicsTable topics={filteredTopics} />
            ) : (
              <FeedsTable feeds={filteredFeeds} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TopicsTable({ topics }: { topics: any[] }) {
  if (topics.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔍</div>
        <div className="text-gray-500 dark:text-gray-400 text-lg font-medium">
          No topics found matching your search criteria
        </div>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
          Try adjusting your search terms or filters
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              ID
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Label
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Facet
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {topics.map((t, idx) => (
            <tr
              key={t.id || idx}
              className="hover:bg-blue-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <td className="px-6 py-4 font-mono text-sm text-gray-600 dark:text-gray-400">
                {t.id}
              </td>
              <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{t.label}</td>
              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                {t.description}
              </td>
              <td className="px-6 py-4">
                {t.facet && (
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
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

function FeedsTable({ feeds }: { feeds: any[] }) {
  if (feeds.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔍</div>
        <div className="text-gray-500 dark:text-gray-400 text-lg font-medium">
          No feeds found matching your search criteria
        </div>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
          Try adjusting your search terms or tag filters
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              URL
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Topics
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {feeds.map((f, idx) => {
            const feedTopics = f.topics || f.tags || [];
            const topicsArray = Array.isArray(feedTopics)
              ? feedTopics
              : typeof feedTopics === "string"
                ? feedTopics.split(",").map((t: string) => t.trim())
                : [];

            return (
              <tr
                key={f.url || idx}
                className="hover:bg-purple-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                  {f.title || "Untitled Feed"}
                </td>
                <td className="px-6 py-4 font-mono text-sm">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                  >
                    {f.url}
                  </a>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {topicsArray.map((tag: string, tagIdx: number) => (
                      <span
                        key={tagIdx}
                        className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium"
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
