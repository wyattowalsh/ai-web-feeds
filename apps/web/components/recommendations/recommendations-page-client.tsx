"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookmarkPlus, Compass, ExternalLink, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { ContentCardSkeleton } from "@/components/ui/content-card-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { ensureAnonymousUserId, fetchWithAnonymousIdentity } from "@/lib/user-identity";
import { CANONICAL_CATALOG_PATH, CANONICAL_READER_PATH } from "@/lib/reader-routes";

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

function buildReaderHref(feedId: string): string {
  const params = new URLSearchParams();
  params.set("feed", feedId);
  return `${CANONICAL_READER_PATH}?${params.toString()}`;
}

function buildCatalogHref(rec: Recommendation, selectedTopics: string[]): string {
  const params = new URLSearchParams();
  params.set("feed", rec.feed.id);
  if (selectedTopics.length > 0) {
    params.set("topics", selectedTopics.join(","));
  }
  if (rec.feed.title) {
    params.set("q", rec.feed.title);
  }

  const query = params.toString();
  return query ? `${CANONICAL_CATALOG_PATH}?${query}` : CANONICAL_CATALOG_PATH;
}

export function RecommendationsPageClient({
  backendConfigured = true,
}: {
  backendConfigured?: boolean;
}) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [busyFeedId, setBusyFeedId] = useState<string | null>(null);
  const [interactionMessage, setInteractionMessage] = useState<string | null>(null);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(
    backendConfigured ? null : "Recommendations require the optional ai-web-feeds backend service.",
  );

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

  const loadRecommendations = useCallback(
    async (user_id: string, topics: string[]) => {
      if (!backendConfigured) {
        setLoading(false);
        setRecommendations([]);
        setUnavailableMessage("Recommendations require the optional ai-web-feeds backend service.");
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("user_id", user_id);
        if (topics.length > 0) {
          params.set("topics", topics.join(","));
        }
        params.set("limit", "20");

        const response = await fetchWithAnonymousIdentity(
          `/api/recommendations?${params.toString()}`,
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
            code?: string;
          } | null;

          if (response.status === 503 || payload?.code === "FEATURE_UNAVAILABLE") {
            setUnavailableMessage(
              payload?.error ||
                "Recommendations require the optional ai-web-feeds backend service.",
            );
            setRecommendations([]);
            return;
          }

          throw new Error(payload?.error || "Failed to load recommendations");
        }

        const data = await response.json();
        setUnavailableMessage(null);
        setRecommendations(data.recommendations || []);
      } catch (error) {
        console.error("Load recommendations error:", error);
        setUnavailableMessage(null);
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    },
    [backendConfigured],
  );

  useEffect(() => {
    let cancelled = false;

    void ensureAnonymousUserId()
      .then((id) => {
        if (cancelled) {
          return;
        }

        setUserId(id);

        if (!backendConfigured) {
          setLoading(false);
          return;
        }

        void loadRecommendations(id, []);
      })
      .catch((error) => {
        console.error("Anonymous identity bootstrap error:", error);
        if (!cancelled) {
          setLoading(false);
          setUnavailableMessage("Could not establish a local reader identity for recommendations.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [backendConfigured, loadRecommendations]);

  const handleTopicToggle = (topic: string) => {
    const newTopics = selectedTopics.includes(topic)
      ? selectedTopics.filter((value) => value !== topic)
      : [...selectedTopics, topic];

    setSelectedTopics(newTopics);
    if (userId) {
      void loadRecommendations(userId, newTopics);
    }
  };

  const handleInteraction = async (feedId: string, interactionType: string, reason: string) => {
    if (!userId) {
      return;
    }

    try {
      await fetchWithAnonymousIdentity("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          feed_id: feedId,
          interaction_type: interactionType,
          reason,
        }),
      });
    } catch (error) {
      console.error("Track interaction error:", error);
    }
  };

  const handleFeedClick = (rec: Recommendation) => {
    void handleInteraction(rec.feed.id, "click", rec.reason);
    router.push(buildCatalogHref(rec, selectedTopics));
  };

  const handleSubscribe = async (rec: Recommendation) => {
    if (!userId) {
      setInteractionMessage("Local reader identity is still loading.");
      return;
    }

    setBusyFeedId(rec.feed.id);
    setInteractionMessage(null);

    try {
      const response = await fetchWithAnonymousIdentity("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          feed_id: rec.feed.id,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        code?: string;
      } | null;

      if (!response.ok) {
        setInteractionMessage(
          response.status === 503 || payload?.code === "FEATURE_UNAVAILABLE"
            ? "Following needs the optional backend service in this deployment."
            : payload?.error || "Could not follow this source.",
        );
        return;
      }

      await handleInteraction(rec.feed.id, "subscribe", rec.reason);
      setInteractionMessage(`Following ${rec.feed.title}.`);
    } catch (error) {
      console.error("Follow recommendation error:", error);
      setInteractionMessage("Could not follow this source.");
    } finally {
      setBusyFeedId(null);
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
                Optional recommendations layered on top of the reader workflow.
              </h1>
              <p className="hero-copy max-w-2xl">
                Use this route when the backend recommender is available. Otherwise, the core
                product remains the reader on `/reader` and the source catalog on `/sources`.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">How suggestions are ranked</p>
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
          {unavailableMessage ? (
            <EmptyState
              icon={Compass}
              title="Recommendations backend unavailable"
              description={unavailableMessage}
              tips={[
                "The reader and catalog stay primary when personalization is offline.",
                "Enable the optional recommender only when you need this route.",
              ]}
            >
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href={CANONICAL_CATALOG_PATH}
                  className={cn(buttonVariants({ variant: "secondary" }))}
                >
                  Open catalog
                </Link>
                <Link
                  href="/docs/guides/deployment"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Deployment setup
                </Link>
              </div>
            </EmptyState>
          ) : null}

          {!unavailableMessage ? (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="metric-label">Topic refinement</p>
                  <h2 className="text-2xl font-semibold text-(--ink)">
                    Steer the recommendation mix
                  </h2>
                </div>
                {selectedTopics.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setSelectedTopics([]);
                      void loadRecommendations(userId, []);
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
              {interactionMessage ? (
                <p className="rounded-lg border border-(--line) bg-(--surface-muted) px-3 py-2 text-sm text-(--ink-muted)">
                  {interactionMessage}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {loading && !unavailableMessage && <ContentCardSkeleton count={5} />}

        {!loading && !unavailableMessage && recommendations.length === 0 && (
          <EmptyState
            icon={Compass}
            title="No recommendations available"
            description="Try selecting different topics or come back after more catalog activity has been observed."
            tips={[
              "Topic filters can get narrow quickly when the current catalog filters are highly specific.",
              "Clearing filters lets the engine rebalance toward broader, higher-confidence matches.",
            ]}
          />
        )}

        {!loading && !unavailableMessage && recommendations.length > 0 && (
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
                      <Link
                        href={buildReaderHref(rec.feed.id)}
                        className={cn(buttonVariants({ variant: "default" }))}
                      >
                        Read in reader
                      </Link>
                      <Button
                        type="button"
                        onClick={() => handleFeedClick(rec)}
                        variant="secondary"
                      >
                        <ExternalLink className="size-4" />
                        Open in catalog
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleSubscribe(rec)}
                        variant="secondary"
                        disabled={busyFeedId === rec.feed.id}
                      >
                        <BookmarkPlus className="size-4" />
                        {busyFeedId === rec.feed.id ? "Following..." : "Follow source"}
                      </Button>
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
