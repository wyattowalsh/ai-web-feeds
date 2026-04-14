import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpenText, Download, RadioTower, Search, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DESIGN_ASSETS } from "@/lib/design-assets";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aiwebfeeds.vercel.app";

export const metadata: Metadata = {
  title: "AI Web Feeds - Reader-First AI Feeds",
  description:
    "Start in the reader-first Feeds workspace, narrow source slices, and export clean feed bundles when you are done.",
  openGraph: {
    title: "AI Web Feeds - Reader-First AI Feeds",
    description:
      "Start in the reader-first Feeds workspace, narrow source slices, and export clean feed bundles when you are done.",
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
    title: "AI Web Feeds - Reader-First AI Feeds",
    description:
      "Start in the reader-first Feeds workspace, narrow source slices, and export clean feed bundles when you are done.",
    images: [`${baseUrl}/og-image.png`],
  },
};

const coreSteps = [
  {
    eyebrow: "Step 1",
    title: "Open Feeds",
    description: "Start in the reader-first workspace where the latest posts are already waiting.",
    href: "/feeds",
    cta: "Open Feeds",
    icon: RadioTower,
  },
  {
    eyebrow: "Step 2",
    title: "Narrow the source slice",
    description:
      "Switch to the catalog view when you want to filter by topic, source type, or verification state.",
    href: "/feeds?mode=catalog",
    cta: "Browse catalog",
    icon: Search,
  },
  {
    eyebrow: "Step 3",
    title: "Export what you keep",
    description:
      "Move the chosen set into OPML or JSON exports once the reader queue is in good shape.",
    href: "/downloads",
    cta: "Go to Downloads",
    icon: Download,
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
                AI web feed aggregator
              </span>
              <div className="space-y-4">
                <h1 className="hero-title max-w-4xl">
                  Feeds is the main product. Everything else supports reading, filtering, and
                  export.
                </h1>
                <p className="hero-copy max-w-2xl">
                  Start in `/feeds`, move into the catalog only when you need to refine sources, and
                  keep downloads/docs as support surfaces around that workflow.
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
                  Export bundles
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
              <p className="metric-label">Core workflow</p>
              <div className="space-y-3 text-sm text-(--ink-muted)">
                <p>
                  <span className="font-semibold text-(--ink)">1.</span> Use{" "}
                  <span className="font-semibold text-(--ink)">Feeds</span> to narrow the source
                  list and read the latest posts.
                </p>
                <p>
                  <span className="font-semibold text-(--ink)">2.</span> Use{" "}
                  <span className="font-semibold text-(--ink)">Catalog</span> inside the feeds
                  workspace when you need a tighter source slice.
                </p>
                <p>
                  <span className="font-semibold text-(--ink)">3.</span> Use{" "}
                  <span className="font-semibold text-(--ink)">Downloads</span> when the chosen set
                  is ready to move elsewhere.
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
            <p className="metric-label">Support surfaces</p>
            <h2 className="text-2xl">Keep exports, docs, and machine-facing outputs close by.</h2>
            <p className="small-note max-w-2xl">
              The supporting pages are still useful, but they should sit behind the feed workflow
              instead of trying to define the product.
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
