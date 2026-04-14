import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpenText, Download, RadioTower, Search, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DESIGN_ASSETS } from "@/lib/design-assets";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aiwebfeeds.vercel.app";

export const metadata: Metadata = {
  title: "AI Web Feeds - Curated AI and ML Feeds",
  description:
    "Browse curated AI and machine learning feeds, read recent posts, explore the catalog, and export the full list in OPML or JSON.",
  openGraph: {
    title: "AI Web Feeds - Curated AI and ML Feeds",
    description:
      "Browse curated AI and machine learning feeds, read recent posts, explore the catalog, and export the full list in OPML or JSON.",
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
    title: "AI Web Feeds - Curated AI and ML Feeds",
    description:
      "Browse curated AI and machine learning feeds, read recent posts, explore the catalog, and export the full list in OPML or JSON.",
    images: [`${baseUrl}/og-image.png`],
  },
};

const coreSteps = [
  {
    eyebrow: "Step 1",
    title: "Open Feeds",
    description: "Read recent posts and search the article library from one place.",
    href: "/feeds",
    cta: "Open Feeds",
    icon: RadioTower,
  },
  {
    eyebrow: "Step 2",
    title: "Browse the catalog",
    description:
      "Filter sources by topic, source type, and verification status when you want to narrow the list.",
    href: "/feeds?mode=catalog",
    cta: "Browse catalog",
    icon: Search,
  },
  {
    eyebrow: "Step 3",
    title: "Export the list",
    description: "Download the full catalog in OPML or JSON when you want to use it elsewhere.",
    href: "/downloads",
    cta: "Export feeds",
    icon: Download,
  },
] as const;

const supportRoutes = [
  {
    title: "Downloads",
    description: "Grab OPML and JSON exports for feed readers, scripts, and backups.",
    href: "/downloads",
    icon: Download,
  },
  {
    title: "Docs",
    description: "Read setup guides, architecture notes, and workflow references.",
    href: "/docs",
    icon: BookOpenText,
  },
  {
    title: "LLM Docs",
    description: "Use the plain-text docs when another tool or agent needs the project reference.",
    href: "/llms-full.txt",
    icon: Sparkles,
  },
] as const;

export default function HomePage() {
  const heroAsset = DESIGN_ASSETS.home.heroWorkflow;
  const primarySurfacesAsset = DESIGN_ASSETS.home.primarySurfaces;
  const supportSurfacesAsset = DESIGN_ASSETS.home.supportSurfaces;

  return (
    <main className="flex flex-1 flex-col">
      <div className="page-wrap page-stack">
        <section className="surface-panel space-y-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div className="space-y-5">
              <span className="eyebrow">
                <Sparkles className="size-3.5" />
                Curated AI feeds
              </span>
              <div className="space-y-4">
                <h1 className="hero-title max-w-4xl">
                  Follow AI and machine learning sources in one place.
                </h1>
                <p className="hero-copy max-w-2xl">
                  AI Web Feeds brings together a curated catalog of AI and ML sources, a searchable
                  article library, and simple export tools so you can read and organize the feed
                  list without juggling multiple apps.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/feeds"
                  className={cn(buttonVariants({ variant: "default", size: "lg" }))}
                >
                  Open Feeds
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/feeds?mode=catalog"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  Browse catalog
                </Link>
                <Link
                  href="/downloads"
                  className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
                >
                  Export feeds
                </Link>
              </div>
            </div>

            <aside className="surface-card-soft space-y-4">
              <div className="overflow-hidden rounded-[1.75rem] border border-(--line) bg-(--surface) p-3 shadow-sm">
                <div
                  className="relative overflow-hidden rounded-[1.25rem] border border-(--line) bg-white/60"
                  style={{ aspectRatio: `${heroAsset.width} / ${heroAsset.height}` }}
                >
                  <Image
                    src={heroAsset.publicPath}
                    alt=""
                    fill
                    priority
                    sizes="(min-width: 1024px) 30rem, 100vw"
                    className="object-contain"
                  />
                </div>
              </div>
              <p className="metric-label">How it works</p>
              <div className="space-y-3 text-sm text-(--ink-muted)">
                <p>
                  <span className="font-semibold text-(--ink)">1.</span> Open{" "}
                  <span className="font-semibold text-(--ink)">Feeds</span> to browse recent posts
                  and search the article library.
                </p>
                <p>
                  <span className="font-semibold text-(--ink)">2.</span> Use{" "}
                  <span className="font-semibold text-(--ink)">Catalog</span> when you want to
                  narrow the list by topic, source type, or verification status.
                </p>
                <p>
                  <span className="font-semibold text-(--ink)">3.</span> Open{" "}
                  <span className="font-semibold text-(--ink)">Downloads</span> when you want the
                  same list in OPML or JSON.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="space-y-5">
          <div className="space-y-3">
            <span className="eyebrow">Main pages</span>
            <h2 className="section-heading">
              Start in Feeds, then use Explorer and Downloads when you need them.
            </h2>
            <p className="section-copy">
              Most people will spend their time in Feeds. Explorer helps you browse topics and
              source relationships, while Downloads gives you portable exports for feed readers,
              scripts, and backups.
            </p>
          </div>

          <div className="surface-card-soft overflow-hidden border border-(--line) bg-linear-to-br from-sky-500/10 via-white to-cyan-500/10 p-4">
            <div
              className="relative overflow-hidden rounded-[1.5rem] border border-(--line) bg-white/65"
              style={{
                aspectRatio: `${primarySurfacesAsset.width} / ${primarySurfacesAsset.height}`,
              }}
            >
              <Image
                src={primarySurfacesAsset.publicPath}
                alt=""
                fill
                sizes="(min-width: 1024px) 72rem, 100vw"
                className="object-contain"
              />
            </div>
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
          <div className="space-y-4 lg:max-w-[38rem]">
            <p className="metric-label">More ways to use it</p>
            <h2 className="text-2xl">Keep docs and exports close by.</h2>
            <p className="small-note max-w-2xl">
              The docs explain how the project is structured and deployed. The plain-text LLM pages
              are there when another tool needs the same reference without the full site chrome.
            </p>
            <div className="overflow-hidden rounded-[1.75rem] border border-(--line) bg-linear-to-br from-white via-sky-500/5 to-cyan-500/10 p-3 shadow-sm">
              <div
                className="relative overflow-hidden rounded-[1.25rem] border border-(--line) bg-white/75"
                style={{
                  aspectRatio: `${supportSurfacesAsset.width} / ${supportSurfacesAsset.height}`,
                }}
              >
                <Image
                  src={supportSurfacesAsset.publicPath}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 38rem, 100vw"
                  className="object-contain"
                />
              </div>
            </div>
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
