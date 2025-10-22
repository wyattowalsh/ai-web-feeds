'use client';

import { useState, useEffect } from 'react';

interface Recommendation {
  feed: {
    id: string;
    title: string;
    description?: string;
    url: string;
    topics: string[];
    source_type: string;
    verified: boolean;
    is_active: boolean;
  };
  score: number;
  reason: string;
}

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [userId, setUserId] = useState<string>('');

  const commonTopics = [
    'llm', 'agents', 'training', 'inference', 'genai',
    'ml', 'cv', 'nlp', 'rl', 'data', 'safety', 'research',
  ];

  useEffect(() => {
    // Get or create user ID from localStorage
    let id = localStorage.getItem('recommendation_user_id');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('recommendation_user_id', id);
    }
    setUserId(id);
    
    // Load initial recommendations
    loadRecommendations(id, []);
  }, []);

  const loadRecommendations = async (user_id: string, topics: string[]) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('user_id', user_id);
      if (topics.length > 0) {
        params.set('topics', topics.join(','));
      }
      params.set('limit', '20');

      const response = await fetch(`/api/recommendations?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load recommendations');

      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Load recommendations error:', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicToggle = (topic: string) => {
    const newTopics = selectedTopics.includes(topic)
      ? selectedTopics.filter((t) => t !== topic)
      : [...selectedTopics, topic];
    
    setSelectedTopics(newTopics);
    loadRecommendations(userId, newTopics);
  };

  const handleInteraction = async (feedId: string, interactionType: string, reason: string) => {
    try {
      await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          feed_id: feedId,
          interaction_type: interactionType,
          reason,
        }),
      });
    } catch (error) {
      console.error('Track interaction error:', error);
    }
  };

  const handleFeedClick = (rec: Recommendation) => {
    handleInteraction(rec.feed.id, 'click', rec.reason);
    window.open(rec.feed.url, '_blank');
  };

  const handleSubscribe = (rec: Recommendation) => {
    handleInteraction(rec.feed.id, 'subscribe', rec.reason);
    // In production, add to user's subscriptions
    alert(`Subscribed to ${rec.feed.title}!`);
  };

  const handleDismiss = (rec: Recommendation) => {
    handleInteraction(rec.feed.id, 'dismiss', rec.reason);
    setRecommendations(recommendations.filter((r) => r.feed.id !== rec.feed.id));
  };

  const reasonLabels: Record<string, { label: string; color: string; emoji: string }> = {
    similar_topics: { label: 'Similar Topics', color: 'bg-blue-100 text-blue-800', emoji: '🎯' },
    similar_content: { label: 'Similar Content', color: 'bg-purple-100 text-purple-800', emoji: '🔗' },
    popular: { label: 'Popular', color: 'bg-green-100 text-green-800', emoji: '🔥' },
    discover: { label: 'Discover', color: 'bg-yellow-100 text-yellow-800', emoji: '✨' },
  };

  // Calculate recommendation breakdown
  const reasonCounts = recommendations.reduce((acc, rec) => {
    acc[rec.reason] = (acc[rec.reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI-Powered Recommendations
          </h1>
          <p className="text-gray-600">
            Personalized feed suggestions based on your interests and our recommendation engine
          </p>
        </div>

        {/* Topic Filters */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Refine by Topics
          </h2>
          <div className="flex flex-wrap gap-2">
            {commonTopics.map((topic) => (
              <button
                key={topic}
                onClick={() => handleTopicToggle(topic)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedTopics.includes(topic)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {topic.toUpperCase()}
              </button>
            ))}
          </div>
          {selectedTopics.length > 0 && (
            <button
              onClick={() => {
                setSelectedTopics([]);
                loadRecommendations(userId, []);
              }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Algorithm Info */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            🤖 How Recommendations Work
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-900 mb-1">70% Content</div>
              <p className="text-gray-600">Topic overlap and semantic similarity</p>
            </div>
            <div>
              <div className="font-medium text-gray-900 mb-1">20% Popularity</div>
              <p className="text-gray-600">Validation success and frequency</p>
            </div>
            <div>
              <div className="font-medium text-gray-900 mb-1">10% Serendipity</div>
              <p className="text-gray-600">Random high-quality feeds</p>
            </div>
          </div>
          {Object.keys(reasonCounts).length > 0 && (
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="text-sm font-medium text-gray-700 mb-2">Current Mix:</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(reasonCounts).map(([reason, count]) => {
                  const info = reasonLabels[reason] || { label: reason, color: 'bg-gray-100 text-gray-800', emoji: '📌' };
                  return (
                    <span key={reason} className={`px-3 py-1 rounded-full text-xs font-medium ${info.color}`}>
                      {info.emoji} {info.label}: {count}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-lg h-40 animate-pulse" />
            ))}
          </div>
        )}

        {/* Recommendations */}
        {!loading && recommendations.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <p className="text-lg font-semibold text-yellow-900 mb-2">
              No recommendations available
            </p>
            <p className="text-sm text-yellow-800">
              Try selecting different topics or check back later
            </p>
          </div>
        )}

        {!loading && recommendations.length > 0 && (
          <div className="space-y-4">
            {recommendations.map((rec, idx) => {
              const reasonInfo = reasonLabels[rec.reason] || { label: rec.reason, color: 'bg-gray-100 text-gray-800', emoji: '📌' };
              
              return (
                <div
                  key={rec.feed.id}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-gray-500">
                          #{idx + 1}
                        </span>
                        <h3 className="text-xl font-bold text-gray-900">
                          {rec.feed.title}
                        </h3>
                        {rec.feed.verified && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                            ✓ Verified
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${reasonInfo.color}`}>
                          {reasonInfo.emoji} {reasonInfo.label}
                        </span>
                      </div>

                      {rec.feed.description && (
                        <p className="text-gray-600 text-sm mb-3">{rec.feed.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                          {rec.feed.source_type}
                        </span>
                        {rec.feed.topics.map((topic) => (
                          <span
                            key={topic}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded font-medium"
                          >
                            {topic.toUpperCase()}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleFeedClick(rec)}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                        >
                          🔗 Visit Feed
                        </button>
                        <button
                          onClick={() => handleSubscribe(rec)}
                          className="text-sm text-green-600 hover:text-green-800 hover:underline flex items-center gap-1"
                        >
                          ➕ Subscribe
                        </button>
                        <button
                          onClick={() => handleDismiss(rec)}
                          className="text-sm text-gray-600 hover:text-gray-800 hover:underline flex items-center gap-1"
                        >
                          ✕ Dismiss
                        </button>
                      </div>
                    </div>

                    <div className="ml-4 text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {(rec.score * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">match score</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

