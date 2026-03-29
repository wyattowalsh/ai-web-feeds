/**
 * 3D Topic Clustering Visualization Page.
 *
 * Implements Phase 4 (US2): Interactive 3D topic graph
 */

"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import type { TopicLink, TopicNode } from "@/components/visualizations/3d/TopicCluster3D";

const TopicCluster3D = dynamic(
  () =>
    import("@/components/visualizations/3d/TopicCluster3D").then((module) => ({
      default: module.TopicCluster3D,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[600px] items-center justify-center bg-white dark:bg-gray-800">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-gray-600 dark:text-gray-400">Loading 3D renderer...</p>
        </div>
      </div>
    ),
  },
);

export default function TopicCluster3DPage() {
  const [topicData, setTopicData] = useState<{
    nodes: TopicNode[];
    links: TopicLink[];
  } | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicNode | null>(null);
  const [hoveredTopic, setHoveredTopic] = useState<TopicNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [colorScheme, setColorScheme] = useState<"category" | "size" | "custom">("category");

  useEffect(() => {
    void loadTopicData();
  }, []);

  const loadTopicData = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const { generateSampleTopicData } = await import("@/components/visualizations/3d/TopicCluster3D");
      const data = generateSampleTopicData();
      setTopicData(data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load topic data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNodeClick = (node: TopicNode) => {
    setSelectedTopic(node);
  };

  const handleNodeHover = (node: TopicNode | null) => {
    setHoveredTopic(node);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading 3D topic graph...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900/60 dark:bg-gray-900">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Unable to load 3D topic graph</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadTopicData()}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            3D Topic Clustering
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Explore topic relationships in an interactive 3D space
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color Scheme
            </label>
            <select
              value={colorScheme}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === "category" || nextValue === "size" || nextValue === "custom") {
                  setColorScheme(nextValue);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="category">By Category</option>
              <option value="size">By Size (Article Count)</option>
              <option value="custom">Custom Colors</option>
            </select>
          </div>

          <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Statistics
            </div>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div>Topics: {topicData?.nodes.length ?? 0}</div>
              <div>Connections: {topicData?.links.length ?? 0}</div>
              <div>Hovered: {hoveredTopic?.label ?? "None"}</div>
            </div>
          </div>
        </div>

        {/* 3D Visualization */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden" style={{ height: "600px" }}>
          {topicData && (
            <TopicCluster3D
              nodes={topicData.nodes}
              links={topicData.links}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              colorScheme={colorScheme}
            />
          )}
        </div>

        {/* Topic details sidebar */}
        {selectedTopic && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Topic Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Name
                </p>
                <p className="text-gray-900 dark:text-gray-100">{selectedTopic.label}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Article Count
                </p>
                <p className="text-gray-900 dark:text-gray-100">{selectedTopic.size}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Category
                </p>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedTopic.category ?? "Uncategorized"}
                </p>
              </div>
            </div>

            {/* Related topics */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Related Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {topicData?.links
                  .filter(
                    (link) =>
                      link.source === selectedTopic.id || link.target === selectedTopic.id
                  )
                  .slice(0, 5)
                  .map((link, index) => {
                    const relatedId =
                      link.source === selectedTopic.id ? link.target : link.source;
                    const relatedNode = topicData.nodes.find((n) => n.id === relatedId);
                    return (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                      >
                        {relatedNode?.label ?? "Unknown"}
                      </span>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Help section */}
        <div className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            How to Use 3D Topic Clustering
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>• <strong>Rotate</strong>: Click and drag with left mouse button</li>
            <li>• <strong>Zoom</strong>: Use scroll wheel</li>
            <li>• <strong>Pan</strong>: Click and drag with right mouse button</li>
            <li>• <strong>Hover</strong>: Move mouse over topics to see details</li>
            <li>• <strong>Click</strong>: Select a topic to view full information</li>
            <li>• <strong>Node size</strong>: Represents article count or relevance</li>
            <li>• <strong>Connections</strong>: Show similarity between topics</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
