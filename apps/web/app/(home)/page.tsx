import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpenText,
  Download,
  Newspaper,
  RadioTower,
  Search,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ai-web-feeds.vercel.app";

export const metadata: Metadata = {
  title: "AI Web Feeds - AI Source Discovery, Search, and Reading",
  description:
    "Find strong AI sources, search recent posts, and export clean feed bundles for your own reader, agent, or workflow.",
  openGraph: {
    title: "AI Web Feeds - AI Source Discovery, Search, and Reading",
    description:
      "Find strong AI sources, search recent posts, and export clean feed bundles for your own reader, agent, or workflow.",
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
    title: "AI Web Feeds - AI Source Discovery, Search, and Reading",
    description:
      "Find strong AI sources, search recent posts, and export clean feed bundles for your own reader, agent, or workflow.",
    images: [`${baseUrl}/og-image.png`],
  },
};

const coreSteps = [
  {
    eyebrow: "Step 1",
    title: "Browse feeds",
    description:
      "Start from the curated source catalog and narrow by topic, source type, or verification state.",
    href: "/feeds",
    cta: "Open catalog",
    icon: RadioTower,
  },
  {
    eyebrow: "Step 2",
    title: "Search what is new",
    description:
      "Run local recent-article search from the same workspace after you narrow the current feed slice.",
    href: "/feeds?mode=articles",
    cta: "Search recent posts",
    icon: Search,
  },
  {
    eyebrow: "Step 3",
    title: "Read and triage",
    description:
      "Open the live reader inside the unified workspace, keep local read-state, and widen into full-stream mode when needed.",
    href: "/feeds?mode=reader",
    cta: "Open reader mode",
    icon: Newspaper,
  },
] as const;

const supportRoutes = [
  {
    title: "Downloads",
    description: "Export OPML and other portable outputs once you have the right set of feeds.",
    href: "/downloads",
    icon: Download,
  },
  {
    title: "Docs",
    description: "Reference the project docs when you need implementation details or API context.",
    href: "/docs",
    icon: BookOpenText,
  },
  {
    title: "LLM Output",
    description: "Use machine-friendly long-form docs when the consumer is another tool or agent.",
    href: "/llms-full.txt",
    icon: Sparkles,
  },
] as const;

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="page-wrap page-stack">
        <section className="surface-panel space-y-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div className="space-y-5">
              <span className="eyebrow">
                <Sparkles className="size-3.5" />
                AI web feed aggregator
              </span>
              <div className="space-y-4">
                <h1 className="hero-title max-w-4xl">
                  Find strong AI sources, search recent posts, and keep a cleaner reading queue.
                </h1>
                <p className="hero-copy max-w-2xl">
                  The product should do three jobs well: help you pick feeds, inspect what is new,
                  and export the set you want to keep using. Everything else should stay secondary.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/feeds"
                  className={cn(buttonVariants({ variant: "default", size: "lg" }))}
                >
                  Browse feeds
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/feeds?mode=articles"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  Search recent posts
                </Link>
                <Link
                  href="/feeds?mode=reader"
                  className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
                >
                  Open reader
                </Link>
              </div>
            </div>

            <aside className="surface-card-soft space-y-4">
              <p className="metric-label">Core workflow</p>
              <div className="space-y-3 text-sm text-(--ink-muted)">
                <p>
                  <span className="font-semibold text-(--ink)">1.</span> Use{" "}
                  <span className="font-semibold text-(--ink)">Feeds</span> to narrow the source
                  list.
                </p>
                <p>
                  <span className="font-semibold text-(--ink)">2.</span> Use{" "}
                  <span className="font-semibold text-(--ink)">Articles</span> inside the feeds
                  workspace when you need the right recent post.
                </p>
                <p>
                  <span className="font-semibold text-(--ink)">3.</span> Use{" "}
                  <span className="font-semibold text-(--ink)">Reader</span> inside that same
                  workspace to skim, save, star, and archive what matters.
                </p>
                <p>
                  <span className="font-semibold text-(--ink)">4.</span> Use{" "}
                  <span className="font-semibold text-(--ink)">Downloads</span> once you are ready
                  to move the chosen feeds into another system.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="space-y-5">
          <div className="space-y-3">
            <span className="eyebrow">Primary surfaces</span>
            <h2 className="section-heading">The product is the workflow, not the sitemap.</h2>
            <p className="section-copy">
              The product flow now stays inside one canonical route: choose sources, search recent
              activity, then read the latest stream. Docs and exports still exist, but they support
              the core flow instead of defining it.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {coreSteps.map((step) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.href}
                  href={step.href}
                  className="surface-card group flex h-full flex-col gap-5 transition duration-150 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <span className="eyebrow">{step.eyebrow}</span>
                      <h3 className="text-2xl">{step.title}</h3>
                    </div>
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong) transition duration-150 group-hover:bg-(--brand) group-hover:text-(--fd-primary-foreground)">
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <p className="small-note flex-1">{step.description}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-strong)">
                    {step.cta}
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="surface-card flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="metric-label">Support surfaces</p>
            <h2 className="text-2xl">Keep exports, docs, and machine-facing outputs close by.</h2>
            <p className="small-note max-w-2xl">
              The supporting pages are still useful, but they should sit behind the feed workflow
              instead of trying to define the product.
            </p>
          </div>

          <div className="grid gap-3 sm:min-w-[24rem]">
            {supportRoutes.map((route) => {
              const Icon = route.icon;
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className="flex items-start gap-3 rounded-2xl border border-(--line) bg-(--surface) px-4 py-4 transition duration-150 hover:border-(--brand) hover:bg-(--brand-soft)"
                >
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                    <Icon className="size-4.5" />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-sm font-semibold text-(--ink)">{route.title}</span>
                    <span className="small-note block">{route.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
