"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookmarkPlus, Check, Compass, ExternalLink, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentCardSkeleton } from "@/components/ui/content-card-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import {
  ensureAnonymousUserId,
  fetchWithAnonymousIdentity,
  syncAnonymousUserIdFromResponse,
} from "@/lib/user-identity";

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

export function RecommendationsPageClient() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  // Per-feed follow state: feedId → 'idle' | 'following' | 'followed' | 'error'
  const [followState, setFollowState] = useState<
    Record<string, "idle" | "following" | "followed" | "error">
  >({});
  const userIdRef = useRef("");

  const commonTopics = [
    "llm",
    "agents",
    "training",
    "inference",
    "genai",
    "ml",
    "cv",
    "nlp",
    "rl",
    "data",
    "safety",
    "research",
  ];

  const syncUserId = useCallback((nextUserId: string | null | undefined) => {
    if (!nextUserId || nextUserId === userIdRef.current) {
      return;
    }

    userIdRef.current = nextUserId;
  }, []);

  const loadRecommendations = useCallback(
    async (topics: string[], currentUserId?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        const resolvedUserId = currentUserId ?? (userIdRef.current || undefined);
        if (resolvedUserId) {
          params.set("user_id", resolvedUserId);
        }
        if (topics.length > 0) {
          params.set("topics", topics.join(","));
        }
        params.set("limit", "20");

        const response = await fetchWithAnonymousIdentity(
          `/api/recommendations?${params.toString()}`,
        );
        if (!response.ok) throw new Error("Failed to load recommendations");
        syncUserId(syncAnonymousUserIdFromResponse(response));

        const data = await response.json();
        setRecommendations(data.recommendations || []);
      } catch (error) {
        console.error("Load recommendations error:", error);
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    },
    [syncUserId],
  );

  useEffect(() => {
    void ensureAnonymousUserId()
      .then((resolvedUserId) => {
        syncUserId(resolvedUserId);
        return loadRecommendations([], resolvedUserId);
      })
      .catch((error) => {
        console.error("Anonymous identity bootstrap error:", error);
        void loadRecommendations([]);
      });
  }, [loadRecommendations, syncUserId]);

  const handleTopicToggle = (topic: string) => {
    const newTopics = selectedTopics.includes(topic)
      ? selectedTopics.filter((value) => value !== topic)
      : [...selectedTopics, topic];

    setSelectedTopics(newTopics);
    void loadRecommendations(newTopics);
  };

  const handleInteraction = async (feedId: string, interactionType: string, reason: string) => {
    try {
      const resolvedUserId = userIdRef.current || undefined;
      const response = await fetchWithAnonymousIdentity("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feed_id: feedId,
          interaction_type: interactionType,
          reason,
          ...(resolvedUserId ? { user_id: resolvedUserId } : {}),
        }),
      });
      syncUserId(syncAnonymousUserIdFromResponse(response));
    } catch (error) {
      console.error("Track interaction error:", error);
    }
  };

  const handleFeedClick = (rec: Recommendation) => {
    void handleInteraction(rec.feed.id, "click", rec.reason);
    window.open(rec.feed.url, "_blank", "noopener,noreferrer");
  };

  const handleSubscribe = async (rec: Recommendation) => {
    setFollowState((prev) => ({ ...prev, [rec.feed.id]: "following" }));
    try {
      const resolvedUserId = userIdRef.current || undefined;
      const response = await fetchWithAnonymousIdentity("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feed_id: rec.feed.id,
          ...(resolvedUserId ? { user_id: resolvedUserId } : {}),
        }),
      });
      if (!response.ok) throw new Error("Follow request failed");
      syncUserId(syncAnonymousUserIdFromResponse(response));
      setFollowState((prev) => ({ ...prev, [rec.feed.id]: "followed" }));
      void handleInteraction(rec.feed.id, "subscribe", rec.reason);
    } catch (error) {
      console.error("Subscribe error:", error);
      setFollowState((prev) => ({ ...prev, [rec.feed.id]: "error" }));
    }
  };

  const handleDismiss = (rec: Recommendation) => {
    void handleInteraction(rec.feed.id, "dismiss", rec.reason);
    setRecommendations((current) => current.filter((item) => item.feed.id !== rec.feed.id));
  };

  const reasonLabels: Record<string, { label: string; icon: string }> = {
    similar_topics: { label: "Similar Topics", icon: "Topic match" },
    similar_content: { label: "Similar Content", icon: "Content match" },
    popular: { label: "Popular", icon: "Popular now" },
    discover: { label: "Discover", icon: "Unexpected fit" },
  };

  const reasonCounts = recommendations.reduce(
    (acc, rec) => {
      acc[rec.reason] = (acc[rec.reason] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <div className="grid gap-8 md:gap-6 md:grid-cols-[1fr_0.9fr] lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-5">
            <span className="eyebrow">
              <Sparkles className="size-3.5" />
              Personalized recommendations
            </span>
            <div className="space-y-4">
              <h1 className="hero-title max-w-4xl">
                Discover feeds that fit how you already browse.
              </h1>
              <p className="hero-copy max-w-2xl">
                The recommendation engine combines topic overlap, content similarity, and catalog
                quality signals to surface relevant sources without flattening everything into a
                generic popularity list.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">Scoring model</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-(--line) bg-(--surface) p-4">
                <div className="text-sm font-semibold text-(--ink)">70%</div>
                <p className="small-note mt-1">Topic overlap and semantic proximity</p>
              </div>
              <div className="rounded-3xl border border-(--line) bg-(--surface) p-4">
                <div className="text-sm font-semibold text-(--ink)">20%</div>
                <p className="small-note mt-1">Catalog health, activity, and relevance</p>
              </div>
              <div className="rounded-3xl border border-(--line) bg-(--surface) p-4">
                <div className="text-sm font-semibold text-(--ink)">10%</div>
                <p className="small-note mt-1">Serendipity for high-quality discovery</p>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="metric-label">Topic refinement</p>
              <h2 className="text-2xl font-semibold text-(--ink)">Steer the recommendation mix</h2>
            </div>
            {selectedTopics.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSelectedTopics([]);
                  void loadRecommendations([]);
                }}
              >
                Clear all filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {commonTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => handleTopicToggle(topic)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition duration-150",
                  selectedTopics.includes(topic)
                    ? "border-(--brand) bg-(--brand) text-(--fd-primary-foreground)"
                    : "border-(--line) bg-(--surface) text-(--ink-muted) hover:bg-(--surface-muted)",
                )}
              >
                {topic.toUpperCase()}
              </button>
            ))}
          </div>
          {Object.keys(reasonCounts).length > 0 && (
            <div className="rounded-3xl border border-(--line) bg-(--surface-muted) p-4">
              <div className="mb-3 text-sm font-semibold text-(--ink)">Current mix</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(reasonCounts).map(([reason, count]) => {
                  const info = reasonLabels[reason] || {
                    label: reason,
                    icon: "Other",
                  };
                  return (
                    <span
                      key={reason}
                      className="rounded-full border border-(--line) bg-(--surface) px-3 py-1 text-xs font-semibold text-(--ink-muted)"
                    >
                      {info.label}: {count}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {loading && <ContentCardSkeleton count={5} />}

        {!loading && recommendations.length === 0 && (
          <EmptyState
            icon={Compass}
            title="No recommendations available"
            description="Try selecting different topics or come back after more catalog activity has been observed."
            tips={[
              "Topic filters can get narrow quickly when the catalog slice is highly specific.",
              "Clearing filters lets the engine rebalance toward broader, higher-confidence matches.",
            ]}
          />
        )}

        {!loading && recommendations.length > 0 && (
          <div className="space-y-4">
            {recommendations.map((rec, idx) => {
              const reasonInfo = reasonLabels[rec.reason] || {
                label: rec.reason,
                icon: "Other",
              };

              return (
                <div
                  key={rec.feed.id}
                  className="surface-card transition duration-150 hover:-translate-y-0.5"
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-(--ink-muted)">#{idx + 1}</span>
                        <h3 className="text-xl font-bold text-(--ink)">{rec.feed.title}</h3>
                        {rec.feed.verified && (
                          <span className="rounded-full bg-(--brand-soft) px-2.5 py-1 text-xs font-semibold text-(--brand-strong)">
                            ✓ Verified
                          </span>
                        )}
                        <span className="rounded-full border border-(--line) bg-(--surface) px-2.5 py-1 text-xs font-semibold text-(--ink-muted)">
                          {reasonInfo.label}
                        </span>
                      </div>

                      <div className="rounded-full border border-(--line) bg-(--surface-muted) px-3 py-2 text-sm font-semibold text-(--ink)">
                        {(rec.score * 100).toFixed(0)}% match
                      </div>
                    </div>

                    {rec.feed.description && (
                      <p className="text-sm text-(--ink-muted)">{rec.feed.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-(--line) bg-(--surface) px-2.5 py-1 text-xs font-semibold text-(--ink-muted)">
                        {rec.feed.source_type}
                      </span>
                      {rec.feed.topics.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-full bg-(--brand-soft) px-2.5 py-1 text-xs font-semibold text-(--brand-strong)"
                        >
                          {topic.toUpperCase()}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => handleFeedClick(rec)}
                        variant="secondary"
                      >
                        <ExternalLink className="size-4" />
                        Visit Feed
                      </Button>
                      {followState[rec.feed.id] === "followed" ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-(--brand) bg-(--brand-soft) px-4 py-2 text-sm font-semibold text-(--brand-strong)">
                          <Check className="size-4" />
                          Following
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => void handleSubscribe(rec)}
                          variant="secondary"
                          disabled={followState[rec.feed.id] === "following"}
                        >
                          <BookmarkPlus className="size-4" />
                          {followState[rec.feed.id] === "following" ? "Following…" : "Follow"}
                        </Button>
                      )}
                      {followState[rec.feed.id] === "error" && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Follow failed — try again
                        </p>
                      )}
                      <Button type="button" onClick={() => handleDismiss(rec)} variant="ghost">
                        <Trash2 className="size-4" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
