/**
 * TrendingTopics - Display current trending topics
 * 
 * Shows topics with high Z-scores and article counts.
 */

"use client";

import { useState, useEffect } from "react";
import { useWebSocket } from "@/lib/use-websocket";

interface TrendingTopic {
  topic_id: string;
  z_score: number;
  article_count: number;
  timestamp: number;
}

interface TrendingTopicsProps {
  limit?: number;
  className?: string;
}

export function TrendingTopics({ limit = 5, className = "" }: TrendingTopicsProps) {
  const { trendingAlerts } = useWebSocket();
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTrendingTopics();
  }, [limit]);

  useEffect(() => {
    // Update local state with WebSocket alerts
    if (trendingAlerts.length > 0) {
      setTopics((prev) => {
        const newTopics = [...trendingAlerts, ...prev];
        // Deduplicate by topic_id
        const unique = Array.from(
          new Map(newTopics.map((t) => [t.topic_id, t])).values()
        );
        return unique.slice(0, limit);
      });
    }
  }, [trendingAlerts, limit]);

  const fetchTrendingTopics = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/trending?limit=${limit}`);
      
      if (!response.ok) throw new Error("Failed to fetch trending topics");
      
      const data = await response.json();
      // Transform backend format to frontend format
      const transformed = data.trending.map((t: any) => ({
        topic_id: t.topic_id,
        z_score: t.z_score,
        article_count: t.article_count,
        timestamp: new Date(t.created_at).getTime(),
      }));
      setTopics(transformed);
    } catch (err) {
      console.error("Failed to fetch trending topics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mb-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 dark:text-gray-400 ${className}`}>
        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <p className="text-sm">No trending topics yet</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Trending Topics
        </h3>
        <button
          onClick={fetchTrendingTopics}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      <ul className="space-y-3">
        {topics.map((topic, index) => (
          <li
            key={topic.topic_id}
            className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-purple-600 text-white text-xs font-bold rounded-full">
                  {index + 1}
                </span>
                <a
                  href={`/topics/${topic.topic_id}`}
                  className="font-medium text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  {topic.topic_id}
                </a>
              </div>
              <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-purple-600 text-white rounded-full">
                🔥 Hot
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 ml-8">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{topic.article_count} articles</span>
              </div>

              <div className="flex items-center gap-1" title={`Z-score: ${topic.z_score.toFixed(2)}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>Z: {topic.z_score.toFixed(1)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

