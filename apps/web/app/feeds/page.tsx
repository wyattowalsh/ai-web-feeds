import type { Metadata } from "next";
import { RadioTower, ShieldCheck, Sparkles, Tags } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { loadFeeds, getSourceTypes, getFeedStats } from "@/lib/feeds";
import { normalizeSearchQuery, parseVerifiedSearchFilter } from "@/lib/search";
import { FeedCatalog } from "./feed-catalog";

export const metadata: Metadata = {
  title: "Feed Catalog - AIWebFeeds",
  description:
    "Browse and download curated AI/ML feeds for your RSS reader. High-quality feeds from blogs, podcasts, newsletters, preprints, and more.",
  openGraph: {
    title: "Feed Catalog - AIWebFeeds",
    description: "Browse and download curated AI/ML feeds for your RSS reader.",
  },
};

type FeedsPageSearchParams = Record<string, string | string[] | undefined>;

type FeedsPageProps = {
  searchParams: Promise<FeedsPageSearchParams>;
};

function toURLSearchParams(searchParams: FeedsPageSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      if (value[0]) {
        params.set(key, value[0]);
      }
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params;
}

export default async function FeedsPage({ searchParams }: FeedsPageProps) {
  const resolvedSearchParams = toURLSearchParams(await searchParams);
  const feedsData = await loadFeeds();
  const feeds = feedsData.sources;
  const types = getSourceTypes(feeds);
  const stats = getFeedStats(feeds);
  const initialQuery = normalizeSearchQuery(resolvedSearchParams.get("q")) ?? "";
  const initialSourceType = resolvedSearchParams.get("source_type")?.trim() || null;
  const initialTopic = resolvedSearchParams.get("topic")?.trim() || null;
  const initialVerified = parseVerifiedSearchFilter(resolvedSearchParams.get("verified")) ?? null;

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
        <div className="grid gap-8 md:gap-6 md:grid-cols-[1fr_0.9fr] lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-5">
            <span className="eyebrow">
              <RadioTower className="size-3.5" />
              Feed catalog
            </span>
            <div className="space-y-4">
              <h1 className="hero-title max-w-4xl">
                Choose the feed set you actually want to keep.
              </h1>
              <p className="hero-copy max-w-2xl">
                Filter by source type, topic, and verification state, then move straight into the
                reader, search recent posts, or export the visible set.
              </p>
            </div>
          </div>

          <div className="surface-card-soft space-y-4">
            <p className="metric-label">Catalog summary</p>
            <p className="small-note">
              The catalog is the starting point for the product flow: narrow the source list first,
              then read, search, or export from there.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total feeds"
            value={stats.total}
            detail="Curated sources in the catalog"
            icon={<RadioTower className="size-5" />}
          />
          <MetricCard
            label="Verified"
            value={stats.verified}
            detail={`${Math.round((stats.verified / stats.total) * 100)}% of the catalog`}
            icon={<ShieldCheck className="size-5" />}
          />
          <MetricCard
            label="Active"
            value={stats.active}
            detail={`${Math.round((stats.active / stats.total) * 100)}% currently active`}
            icon={<Sparkles className="size-5" />}
          />
          <MetricCard
            label="Topics"
            value={stats.topicCount}
            detail="Distinct topic labels represented"
            icon={<Tags className="size-5" />}
          />
        </div>
        <FeedCatalog
          feeds={feeds}
          sourceTypes={types}
          initialQuery={initialQuery}
          initialSourceType={initialSourceType}
          initialTopic={initialTopic}
          initialVerified={initialVerified}
        />
      </section>
    </div>
  );
}
