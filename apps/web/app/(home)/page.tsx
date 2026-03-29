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
  RadioTower,
  Search,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ai-web-feeds.vercel.app";

export const metadata: Metadata = {
  title: "AI Web Feeds - RSS/Atom Feeds for AI Agents & LLMs",
  description:
    "Curated RSS/Atom feeds optimized for AI agents and large language models. Features PDF export, LLM-friendly endpoints, and comprehensive feed support for seamless AI integration.",
  openGraph: {
    title: "AI Web Feeds - RSS/Atom Feeds for AI Agents",
    description: "Curated RSS/Atom feeds optimized for AI agents and large language models",
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
    title: "AI Web Feeds - RSS/Atom Feeds for AI Agents",
    description: "Curated RSS/Atom feeds optimized for AI agents and large language models",
    images: [`${baseUrl}/og-image.png`],
  },
};

export default function HomePage() {
  const highlights = [
    {
      label: "Curated feeds",
      value: "Human-reviewed catalog",
      description: "A cleaner layer over raw RSS, Atom, and JSON feed discovery for AI-heavy workflows.",
    },
    {
      label: "Machine-friendly outputs",
      value: "Docs, feeds, and LLM formats",
      description: "Move from browsing to ingestion quickly with endpoints that fit both humans and agents.",
    },
    {
      label: "Operational visibility",
      value: "Analytics and explorer surfaces",
      description: "Understand topic coverage, feed health, and relationships instead of guessing what the catalog contains.",
    },
  ];

  const features = [
    {
      title: "Documentation",
      description:
        "Browse guides, API reference, and implementation notes in a format that reads cleanly for both maintainers and agents.",
      href: "/docs",
      icon: BookOpenText,
      eyebrow: "Reference",
    },
    {
      title: "Explorer",
      description:
        "Inspect topics and feeds as a searchable table or graph so relationships and gaps become legible fast.",
      href: "/explorer",
      icon: Network,
      eyebrow: "Discovery",
    },
    {
      title: "Analytics",
      description:
        "Track health, validation velocity, and trending topics through a calmer dashboard tuned for signal over clutter.",
      href: "/analytics",
      icon: ChartNoAxesCombined,
      eyebrow: "Monitoring",
    },
    {
      title: "Search",
      description:
        "Find relevant sources quickly with full-text and semantic discovery surfaces built around the catalog.",
      href: "/search",
      icon: Search,
      eyebrow: "Findability",
    },
    {
      title: "Feed catalog",
      description:
        "Browse the source registry, validation posture, and structured metadata without diving into raw files.",
      href: "/feeds",
      icon: RadioTower,
      eyebrow: "Registry",
    },
    {
      title: "Downloads",
      description:
        "Export the catalog in portable formats for feed readers, downstream processing, or local experimentation.",
      href: "/downloads",
      icon: Download,
      eyebrow: "Portability",
    },
    {
      title: "LLM formats",
      description:
        "Serve long-form repository knowledge in formats that are easier to consume inside AI workflows and tools.",
      href: "/llms-full.txt",
      icon: Bot,
      eyebrow: "Agent ready",
    },
  ];

  const routes = [
    { label: "Docs", href: "/docs", icon: BookOpenText },
    { label: "Explorer", href: "/explorer", icon: Network },
    { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
    { label: "LLM output", href: "/llms-full.txt", icon: Binary },
  ];

  return (
    <main className="flex flex-1 flex-col">
      <div className="page-wrap page-stack">
        <section className="surface-panel overflow-hidden">
          <div className="grid gap-10 lg:grid-cols-[1.25fr_0.85fr] lg:items-start">
            <div className="space-y-6">
              <span className="eyebrow">
                <Sparkles className="size-3.5" />
                Editorial feed infrastructure for AI workflows
              </span>
              <div className="space-y-5">
                <h1 className="hero-title">Readable by humans. Structured for agents.</h1>
                <p className="hero-copy">
                  AI Web Feeds turns a raw ecosystem of feeds, topics, and documentation into a
                  browsable knowledge surface with machine-friendly outputs, clearer navigation, and
                  operational visibility built in.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/docs"
                  className={cn(buttonVariants({ variant: "default", size: "lg" }))}
                >
                  Read the docs
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/explorer"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  Explore the catalog
                </Link>
                <Link
                  href="/analytics"
                  className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
                >
                  Review analytics
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {highlights.map((item) => (
                  <div key={item.label} className="surface-card-soft space-y-3">
                    <p className="metric-label">{item.label}</p>
                    <p className="text-xl font-semibold text-(--ink)">{item.value}</p>
                    <p className="small-note">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="grid gap-4">
              <div className="surface-card space-y-5">
                <div className="space-y-2">
                  <p className="metric-label">Primary surfaces</p>
                  <h2 className="text-2xl">Move between docs, discovery, analytics, and exports.</h2>
                </div>
                <div className="grid gap-3">
                  {routes.map((route) => {
                    const Icon = route.icon;
                    return (
                      <Link
                        key={route.href}
                        href={route.href}
                        className="flex items-center justify-between rounded-2xl border border-(--line) bg-(--surface) px-4 py-4 text-sm font-medium text-(--ink) transition duration-150 hover:border-(--brand) hover:bg-(--brand-soft)"
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex size-10 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong)">
                            <Icon className="size-4.5" />
                          </span>
                          {route.label}
                        </span>
                        <ArrowRight className="size-4 text-(--ink-muted)" />
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="surface-card-soft space-y-3">
                <p className="metric-label">What this app is doing better now</p>
                <p className="small-note">
                  Cleaner hierarchy, stronger typography, calmer surfaces, and shared UI primitives
                  that make the app feel like one product instead of a set of separate route
                  experiments.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="space-y-5">
          <div className="space-y-3">
            <span className="eyebrow">Core capabilities</span>
            <h2 className="section-heading">A better front door into the repository’s feed intelligence.</h2>
            <p className="section-copy">
              The main product surfaces are now framed as clear entry points rather than a single
              undifferentiated card wall. Each one answers a different question: how to use the
              system, what it contains, how it is performing, and how to export it.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link
                  key={feature.href}
                  href={feature.href}
                  className="surface-card group flex h-full flex-col gap-5 transition duration-150 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <span className="eyebrow">{feature.eyebrow}</span>
                      <h3 className="text-2xl">{feature.title}</h3>
                    </div>
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-(--brand-soft) text-(--brand-strong) transition duration-150 group-hover:bg-(--brand) group-hover:text-(--fd-primary-foreground)">
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <p className="small-note flex-1">{feature.description}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-(--brand-strong)">
                    Open surface
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="surface-card flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="metric-label">Open source and portable</p>
            <h2 className="text-2xl">Use the catalog in the browser, through feed formats, or directly from GitHub.</h2>
            <p className="small-note max-w-2xl">
              The site remains the human-facing layer, but the same repository still supports
              downstream automation, feed reader exports, and machine-friendly long-form docs.
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
              Open LLM output
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
