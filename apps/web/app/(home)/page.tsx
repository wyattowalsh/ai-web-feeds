import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, BookOpenText, RadioTower } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getFeedStats, loadFeedCatalog } from "@/lib/feeds";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aiwebfeeds.vercel.app";

export const metadata: Metadata = {
  title: "AI Web Feeds - Read AI writing across the open web",
  description:
    "A focused reader, source catalog, and dashboard for tracking AI writing across blogs, labs, newsletters, organizations, and research feeds.",
  openGraph: {
    title: "AI Web Feeds - Read AI writing across the open web",
    description: "Open the reader, browse sources, and track AI writing across the open web.",
    url: baseUrl,
    type: "website",
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "AI Web Feeds",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Web Feeds - Read AI writing across the open web",
    description: "Open the reader, browse sources, and track AI writing across the open web.",
    images: [`${baseUrl}/og-image.png`],
  },
};

export default function HomePage() {
  const feedsData = loadFeedCatalog();
  const stats = getFeedStats(feedsData.sources);

  const statsCards = [
    { label: "Sources", value: stats.total, icon: RadioTower },
    { label: "Verified", value: stats.verified, icon: BookOpenText },
    { label: "Topics", value: stats.topicCount, icon: BarChart3 },
  ];

  return (
    <div className="page-wrap page-stack">
      <section className="grid gap-8 rounded-xl border border-(--line) bg-(--surface) p-6 shadow-(--surface-shadow-soft) lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:p-8">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className="eyebrow">AI Web Feeds</span>
            <span className="eyebrow bg-(--surface-muted) text-(--ink-muted)">Open web reader</span>
          </div>
          <div className="space-y-3">
            <h1 className="max-w-4xl text-4xl font-semibold leading-none text-(--ink) sm:text-5xl">
              Read AI writing across the open web
            </h1>
            <p className="hero-copy">
              A focused reader for posts from labs, researchers, newsletters, engineering blogs, and
              industry sources, with a source catalog and dashboard kept separate.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/reader" className={cn(buttonVariants({ variant: "default" }))}>
              Open reader
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/sources" className={cn(buttonVariants({ variant: "secondary" }))}>
              Browse sources
            </Link>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              View dashboard
            </Link>
          </div>
        </div>
        <div className="grid gap-3">
          {statsCards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg border border-(--line) bg-(--surface-muted) p-4"
            >
              <div>
                <p className="metric-label">{label}</p>
                <p className="text-2xl font-semibold text-(--ink)">{value}</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-lg border border-(--line) bg-(--surface) text-(--brand-strong)">
                <Icon className="size-5" />
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
