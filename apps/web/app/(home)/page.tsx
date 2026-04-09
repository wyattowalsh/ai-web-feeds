import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Binary,
  BookOpenText,
  Bot,
  ChartNoAxesCombined,
  Download,
  Network,
  Newspaper,
  RadioTower,
  Rss,
  Search,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getSiteBaseUrl } from "@/lib/env";

const baseUrl = getSiteBaseUrl();

export const metadata: Metadata = {
  title: "AI Web Feeds - Search, Read, Analyze, and Export AI Sources",
  description:
    "A local-first AI source registry with search, reader, analytics, and exportable OPML for AI practitioners, agents, and feed readers.",
  openGraph: {
    title: "AI Web Feeds - Search, Read, Analyze, and Export AI Sources",
    description:
      "A local-first AI source registry with search, reader, analytics, and exportable OPML for AI practitioners, agents, and feed readers.",
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
    title: "AI Web Feeds - Search, Read, Analyze, and Export AI Sources",
    description:
      "A local-first AI source registry with search, reader, analytics, and exportable OPML for AI practitioners, agents, and feed readers.",
    images: [`${baseUrl}/og-image.png`],
  },
};

const primaryDestinations = [
  {
    title: "Feed catalog",
    description:
      "Start in /feeds to define the slice you care about by source type, topic, verification state, and text search before you export or read it.",
    href: "/feeds",
    icon: RadioTower,
    eyebrow: "Select",
    cta: "Browse feeds",
  },
  {
    title: "Reader",
    description:
      "Open the local-first reader to scan recent posts, filter by feed or topic, and keep device-local reading state once you know which sources matter.",
    href: "/reader",
    icon: Rss,
    eyebrow: "Read",
    cta: "Open reader",
  },
];

const supportingSurfaces = [
  {
    title: "Explorer",
    description: "Inspect topics and feeds as a searchable table or graph.",
    href: "/explorer",
    icon: Network,
    eyebrow: "Discovery",
  },
  {
    title: "Analytics",
    description:
      "Inspect local source counts, freshest sources, topic distribution, and recent publication velocity.",
    href: "/analytics",
    icon: ChartNoAxesCombined,
    eyebrow: "Monitoring",
  },
  {
    title: "Search",
    description: "Switch between source search and recent-article search from one page.",
    href: "/search",
    icon: Search,
    eyebrow: "Findability",
  },
  {
    title: "Feed catalog",
    description: "Browse the source registry, validation posture, and metadata.",
    href: "/feeds",
    icon: RadioTower,
    eyebrow: "Registry",
  },
  {
    title: "Downloads",
    description: "Export flat, foldered, or filtered OPML bundles for feed readers and automation.",
    href: "/downloads",
    icon: Download,
    eyebrow: "Portability",
  },
  {
    title: "Blog",
    description: "Longform writing on AI feeds, agent tooling, and the evolving ecosystem.",
    href: "/blog",
    icon: Newspaper,
    eyebrow: "Editorial",
  },
  {
    title: "Documentation",
    description: "Guides, API reference, and implementation notes.",
    href: "/docs",
    icon: BookOpenText,
    eyebrow: "Reference",
  },
  {
    title: "LLM formats",
    description: "Long-form repository knowledge for AI workflows.",
    href: "/llms-full.txt",
    icon: Bot,
    eyebrow: "Agent ready",
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="page-wrap page-stack">
        {/* Hero */}
        <section className="surface-panel overflow-hidden">
          <div className="grid gap-10 lg:grid-cols-[1.25fr_0.85fr] lg:items-start">
            <div className="space-y-6">
              <span className="eyebrow">
                <Sparkles className="size-3.5" />
                Local-first feed infrastructure for AI workflows
              </span>
              <div className="space-y-5">
                <h1 className="hero-title">Select. Search. Read. Export.</h1>
                <p className="hero-copy">
                  AI Web Feeds aggregates online AI sources into one web app. Start in the feed
                  catalog to define the subset you want, then search it, read recent posts, inspect
                  local analytics, and export portable OPML bundles.
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
                  href="/reader"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  Open reader
                </Link>
                <Link
                  href="/search"
                  className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
                >
                  Search sources
                </Link>
              </div>
            </div>

            <aside className="grid gap-4">
              <div className="surface-card space-y-5">
                <div className="space-y-2">
                  <p className="metric-label">Where to start</p>
                  <h2 className="text-2xl">Start with selection, then move into reading.</h2>
                </div>
                <div className="grid gap-3">
                  {primaryDestinations.map((dest) => {
                    const Icon = dest.icon;
                    return (
                      <Link
                        key={dest.href}
                        href={dest.href}
                        className="flex items-center justify-between rounded-2xl border border-(--line) bg-(--surface) px-4 py-4 text-sm font-medium text-(--ink) transition duration-150 hover:border-(--brand) hover:bg-(--brand-soft)"
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                            <Icon className="size-4.5" />
                          </span>
                          {dest.title}
                        </span>
                        <ArrowRight className="size-4 text-(--ink-muted)" />
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="surface-card-soft space-y-3">
                <p className="metric-label">Open source</p>
                <p className="small-note">
                  The catalog, reader, and tooling are all open source. Fork it, adapt it, or pull
                  structured data for your own agents.
                </p>
                <a
                  href="https://github.com/wyattowalsh/ai-web-feeds"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-strong)"
                >
                  View on GitHub <ArrowRight className="size-3.5" />
                </a>
              </div>
            </aside>
          </div>
        </section>

        {/* Primary destinations */}
        <section className="space-y-5">
          <div className="space-y-3">
            <span className="eyebrow">Primary destinations</span>
            <h2 className="section-heading">
              The catalog defines the slice. The reader consumes it.
            </h2>
            <p className="section-copy">
              The main loop is straightforward: use `/feeds` to narrow the registry into a useful
              subset, then move into search, reader, analytics, or export depending on what you need
              next.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {primaryDestinations.map((dest) => {
              const Icon = dest.icon;
              return (
                <Link
                  key={dest.href}
                  href={dest.href}
                  className="surface-card group flex h-full flex-col gap-6 transition duration-150 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <span className="eyebrow">{dest.eyebrow}</span>
                      <h3 className="text-3xl">{dest.title}</h3>
                    </div>
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong) transition duration-150 group-hover:bg-(--brand) group-hover:text-(--fd-primary-foreground)">
                      <Icon className="size-6" />
                    </span>
                  </div>
                  <p className="small-note flex-1 text-base leading-7">{dest.description}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-strong)">
                    {dest.cta}
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Supporting surfaces */}
        <section className="space-y-5">
          <div className="space-y-3">
            <span className="eyebrow">Supporting surfaces</span>
            <h2 className="section-heading">Everything else the platform offers.</h2>
            <p className="section-copy">
              Deeper discovery, operational visibility, catalog exports, and machine-friendly
              endpoints — each answering a different question about the feed ecosystem.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {supportingSurfaces.map((surface) => {
              const Icon = surface.icon;
              return (
                <Link
                  key={surface.href}
                  href={surface.href}
                  className="surface-card-soft group flex h-full flex-col gap-4 transition duration-150 hover:-translate-y-0.5 hover:border-(--brand)"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <span className="eyebrow">{surface.eyebrow}</span>
                      <h3 className="text-lg font-semibold text-(--ink)">{surface.title}</h3>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                      <Icon className="size-4.5" />
                    </span>
                  </div>
                  <p className="small-note flex-1">{surface.description}</p>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--brand-strong)">
                    Open <ArrowRight className="size-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="surface-card flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="metric-label">Open source and portable</p>
            <h2 className="text-2xl">
              Use the catalog in the browser, through feed formats, or directly from GitHub.
            </h2>
            <p className="small-note max-w-2xl">
              The site remains the human-facing layer, but the same repository supports downstream
              automation, feed reader exports, and machine-friendly long-form docs.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/wyattowalsh/ai-web-feeds"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              View on GitHub
            </a>
            <Link
              href="/llms-full.txt"
              className={cn(buttonVariants({ variant: "default", size: "lg" }))}
            >
              <Binary className="size-4" />
              LLM output
            </Link>
          </div>
        </section>

        <div className="pb-8 text-center">
          <p className="small-note">
            Open source project by{" "}
            <a
              href="https://github.com/wyattowalsh"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-(--brand-strong)"
            >
              Wyatt Walsh
            </a>
            {" · "}
            <a
              href="https://github.com/wyattowalsh/ai-web-feeds"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-(--brand-strong)"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
