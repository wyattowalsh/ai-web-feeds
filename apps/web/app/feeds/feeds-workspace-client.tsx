"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Newspaper, RadioTower, Search as SearchIcon, Shapes, Sparkles, Tags } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { MetricCard } from "@/components/ui/metric-card";
import { cn } from "@/lib/cn";

export type FeedsWorkspaceMode = "catalog" | "articles" | "reader";

type WorkspaceStats = {
  total: number;
  sourceTypeCount: number;
  topicCount: number;
  verified: number;
  hasVerificationMetadata: boolean;
};

type FeedsWorkspaceClientProps = {
  mode: FeedsWorkspaceMode;
  stats: WorkspaceStats;
};

const MODE_OPTIONS: Array<{
  value: FeedsWorkspaceMode;
  label: string;
  icon: typeof RadioTower;
}> = [
  { value: "reader", label: "Reader", icon: Newspaper },
  { value: "articles", label: "Articles", icon: SearchIcon },
  { value: "catalog", label: "Catalog", icon: RadioTower },
];

function buildModeHref(searchParams: URLSearchParams, mode: FeedsWorkspaceMode): string {
  const params = new URLSearchParams(searchParams.toString());

  if (mode === "reader") {
    params.delete("mode");
  } else {
    params.set("mode", mode);
  }

  const nextQuery = params.toString();
  return nextQuery ? `/feeds?${nextQuery}` : "/feeds";
}

function getModeCopy(mode: FeedsWorkspaceMode): {
  eyebrow: string;
  title: string;
  description: string;
} {
  if (mode === "articles") {
    return {
      eyebrow: "Unified feeds workspace",
      title: "Search recent posts inside the current feed slice.",
      description:
        "Use the shared feed filters, run local recent-post search, and move directly into reading without bouncing across routes.",
    };
  }

  if (mode === "reader") {
    return {
      eyebrow: "Unified feeds workspace",
      title: "Read the current feed slice without leaving the workspace.",
      description:
        "The reader inherits the same feed scope, keeps local reading state, and can expand into full-stream mode when you want a broader pass.",
    };
  }

  return {
    eyebrow: "Unified feeds workspace",
    title: "Choose the feed set you actually want to keep.",
    description:
      "Filter by source type, topic, and verification state, then move straight into article search, reading, or export from the same route.",
  };
}

export function FeedsWorkspaceClient({ mode, stats }: FeedsWorkspaceClientProps) {
  const searchParams = useSearchParams();
  const modeCopy = getModeCopy(mode);
  const metricCards = useMemo(() => {
    const cards = [
      {
        label: "Total feeds",
        value: stats.total,
        detail: "Curated sources in the catalog",
        icon: <RadioTower className="size-5" />,
      },
      {
        label: "Source types",
        value: stats.sourceTypeCount,
        detail: "Distinct source formats represented",
        icon: <Shapes className="size-5" />,
      },
      {
        label: "Topics",
        value: stats.topicCount,
        detail: "Distinct topic labels represented",
        icon: <Tags className="size-5" />,
      },
    ];

    if (stats.hasVerificationMetadata) {
      cards.push({
        label: "Verified",
        value: stats.verified,
        detail: `${Math.round((stats.verified / stats.total) * 100)}% of the catalog`,
        icon: <Sparkles className="size-5" />,
      });
    }

    return cards;
  }, [stats]);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:gap-6 md:grid-cols-[1fr_0.9fr] lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="space-y-5">
          <span className="eyebrow">{modeCopy.eyebrow}</span>
          <div className="space-y-4">
            <h1 className="hero-title max-w-4xl">{modeCopy.title}</h1>
            <p className="hero-copy max-w-2xl">{modeCopy.description}</p>
          </div>
        </div>

        <div className="surface-card-soft space-y-4">
          <p className="metric-label">Workspace modes</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const href = buildModeHref(searchParams, option.value);

              return (
                <Link
                  key={option.value}
                  href={href}
                  className={cn(
                    "rounded-3xl border p-4 transition duration-150",
                    mode === option.value
                      ? "border-(--brand) bg-(--brand-soft) text-(--brand-strong)"
                      : "border-(--line) bg-(--surface) text-(--ink) hover:border-(--brand)",
                  )}
                >
                  <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-(--surface-muted)">
                    <Icon className="size-4" />
                  </div>
                  <h2 className="text-base font-semibold">{option.label}</h2>
                  <p className="small-note mt-1">
                    {option.value === "catalog"
                      ? "Choose sources and filters."
                      : option.value === "articles"
                        ? "Search recent pulled posts."
                        : "Read the merged timeline."}
                  </p>
                </Link>
              );
            })}
          </div>
          <p className="small-note">
            `/feeds` is the canonical product surface. Downloads and docs stay adjacent, not
            primary.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            detail={card.detail}
            icon={card.icon}
          />
        ))}
      </div>
    </div>
  );
}
