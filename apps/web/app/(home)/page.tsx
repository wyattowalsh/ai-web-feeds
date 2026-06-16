import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenText,
  RadioTower,
  Search,
  Sparkles,
  Tags,
} from "lucide-react";
import { OnboardingCoach } from "@/components/utility/onboarding-coach";
import { HUB_ROUTES } from "@/lib/hub/links";
import { Badge } from "@/components/ui/badge";
import { JsonLd } from "@/components/json-ld";
import { getRequestNonce } from "@/lib/nonce";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getFeedStats, loadFeedCatalog } from "@/lib/feeds";
import { createPageMetadata } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = createPageMetadata({
  title: "AI Web Feeds - Read AI writing across the open web",
  description:
    "A focused reader, source catalog, and dashboard for tracking AI writing across blogs, labs, newsletters, organizations, and research feeds.",
  path: "/",
});

export default async function HomePage() {
  const nonce = await getRequestNonce();
  const feedsData = loadFeedCatalog();
  const stats = getFeedStats(feedsData.sources);

  const statsCards = [
    { label: "Sources", value: stats.total, icon: RadioTower },
    { label: "Verified", value: stats.verified, icon: BookOpenText },
    { label: "Topics", value: stats.topicCount, icon: BarChart3 },
  ];

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        nonce={nonce}
        data={collectionPageJsonLd({
          name: "AI Web Feeds",
          description:
            "A focused reader, source catalog, and dashboard for tracking AI writing across the open web.",
          url: "/",
          items: [
            {
              name: "AI Reader",
              url: "/reader",
              description: "Read recent AI writing from tracked open web sources.",
            },
            {
              name: "Sources",
              url: "/sources",
              description: "Browse the tracked source catalog.",
            },
            {
              name: "Dashboard",
              url: "/dashboard",
              description: "Inspect catalog health and coverage.",
            },
          ],
        })}
      />
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Badge className="h-7 rounded-md bg-primary/10 text-primary">AI Web Feeds</Badge>
            <Badge variant="outline" className="h-7 rounded-md">
              Open web reader
            </Badge>
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="max-w-4xl text-4xl font-semibold leading-none text-(--ink) sm:text-5xl">
              Read AI writing across the open web
            </h1>
            <p className="hero-copy">
              A focused reader for posts from labs, researchers, newsletters, engineering blogs, and
              industry sources, with a source catalog and dashboard kept separate.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Primary CTA */}
            <Link href={HUB_ROUTES.reader} className={cn(buttonVariants({ variant: "default" }))}>
              Open reader
              <ArrowRight />
            </Link>

            {/* Secondary pair */}
            <div className="flex flex-wrap gap-2">
              <Link
                href={HUB_ROUTES.search}
                className={cn(buttonVariants({ variant: "secondary" }))}
              >
                <Search className="size-4" />
                Search
              </Link>
              <Link href={HUB_ROUTES.forYou} className={cn(buttonVariants({ variant: "outline" }))}>
                <Sparkles className="size-4" />
                For You
              </Link>
            </div>

            {/* Tertiary links */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-(--ink-muted)">
              <Link
                href={HUB_ROUTES.sources}
                className="underline-offset-4 hover:text-(--ink) hover:underline"
              >
                Browse sources
              </Link>
              <Link
                href={HUB_ROUTES.topics}
                className="underline-offset-4 hover:text-(--ink) hover:underline"
              >
                <span className="inline-flex items-center gap-1">
                  <Tags className="size-3.5" /> Topics
                </span>
              </Link>
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-t border-(--line) pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          {statsCards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex min-h-24 items-center justify-between rounded-lg border border-(--line) bg-(--surface) p-4 shadow-sm"
            >
              <div>
                <p className="metric-label">{label}</p>
                <p className="text-2xl font-semibold tabular-nums text-(--ink)">{value}</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-lg border border-(--line) bg-(--surface) text-(--brand-strong)">
                <Icon className="size-5" />
              </span>
            </div>
          ))}
        </div>
      </section>
      <OnboardingCoach />
    </div>
  );
}
