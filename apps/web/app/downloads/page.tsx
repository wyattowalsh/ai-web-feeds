import type { Metadata } from "next";
import { loadFeeds, getFeedStats } from "@/lib/feeds";
import { loadOpmlPreviewData } from "@/lib/opml-preview";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { AdvancedPreviewSection } from "./advanced-preview-section";

export const metadata: Metadata = {
  title: "Downloads - AIWebFeeds",
  description: "Download the full AI Web Feeds catalog as OPML or JSON.",
  openGraph: {
    title: "Downloads - AIWebFeeds",
    description: "Download the full AI Web Feeds catalog as OPML or JSON.",
  },
};

export default async function DownloadsPage() {
  const feedsData = await loadFeeds();
  const feeds = feedsData.sources;
  const stats = getFeedStats(feeds);
  const opmlPreview = loadOpmlPreviewData(feeds);
  const downloads = [
    {
      title: "Flat OPML",
      description: `A single OPML file with all ${stats.total} feeds for a quick import.`,
      href: "/api/exports/opml?format=all",
      fileName: "ai-ml-feeds-all.opml",
      buttonLabel: "Download Flat OPML",
      tone: "from-sky-500/10 via-background to-sky-500/5",
    },
    {
      title: "Topic Folders OPML",
      description: "The same feed set grouped into folders so readers import a cleaner structure.",
      href: "/api/exports/opml?format=categorized",
      fileName: "ai-ml-feeds-categorized.opml",
      buttonLabel: "Download Foldered OPML",
      tone: "from-emerald-500/10 via-background to-emerald-500/5",
    },
    {
      title: "JSON Feed Data",
      description: "Structured feed metadata for scripts, apps, and custom readers.",
      href: "/api/feeds",
      fileName: "ai-ml-feeds.json",
      buttonLabel: "Download JSON",
      tone: "from-amber-500/10 via-background to-amber-500/5",
    },
  ] as const;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <section className="mb-8 overflow-hidden rounded-3xl border bg-linear-to-br from-sky-500/10 via-background to-teal-500/10 p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex items-center rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Catalog export
            </p>
            <h1 className="mb-3 text-4xl font-bold tracking-tight">Download the feed catalog</h1>
            <p className="text-lg text-muted-foreground">
              Download the full AI Web Feeds catalog in OPML or JSON. If you want to review the
              sources first, open Feeds or Explorer and come back here when you are ready to export.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
            <StatPill label="Feeds" value={String(stats.total)} />
            <StatPill label="Types" value={String(stats.sourceTypeCount)} />
            <StatPill label="Topics" value={String(stats.topicCount)} />
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Quick Downloads</h2>
            <p className="text-sm text-muted-foreground">
              These cards export the full catalog. Use{" "}
              <Link
                href="/feeds"
                className="font-medium text-blue-700 underline-offset-4 hover:underline"
              >
                /feeds
              </Link>{" "}
              when you want to browse the sources before exporting.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            OPML works with Feedly, Inoreader, NewsBlur, and similar readers.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {downloads.map((download) => (
            <div
              key={download.title}
              className={`rounded-2xl border bg-linear-to-br ${download.tone} p-5 shadow-sm`}
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{download.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{download.description}</p>
              </div>

              <a
                href={download.href}
                download={download.fileName}
                className={`${buttonVariants({})} h-auto w-full justify-center gap-2 px-4 py-2.5`}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {download.buttonLabel}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border bg-card p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
          <div>
            <div className="mb-2 inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              Want to review sources first?
            </div>
            <h2 className="text-2xl font-semibold">Browse in Feeds, then download here</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Use Feeds to filter by topic, source type, verification state, and search text. Come
              back here when you want export files or a quick OPML preview.
            </p>
            <div className="mt-4">
              <Link href="/feeds" className={`${buttonVariants({ variant: "outline" })} gap-2`}>
                Open Feeds
              </Link>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Use this page when you need:</p>
            <ul className="mt-2 space-y-2">
              <li>One-click full-catalog OPML or JSON exports</li>
              <li>A quick preview of folders before import</li>
              <li>A spot check of recent posts for visible previewable feeds</li>
            </ul>
          </div>
        </div>
      </section>

      <AdvancedPreviewSection preview={opmlPreview} />

      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">How to Import</h2>
        <div className="space-y-3 text-sm">
          <div>
            <strong>Feedly:</strong> Settings → Import OPML → Upload file
          </div>
          <div>
            <strong>Inoreader:</strong> Settings → Import/Export → Import from OPML
          </div>
          <div>
            <strong>NewsBlur:</strong> Settings → Import → Choose OPML file
          </div>
          <div>
            <strong>The Old Reader:</strong> Settings → Subscription → Import → Upload OPML
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href="/feeds"
              className="text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Browse Feeds before exporting →
            </Link>
            <Link
              href="/docs/guides/opml-viewer"
              className="text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Read the OPML viewer guide →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border bg-background/80 px-3 py-2 text-sm shadow-sm">
      <span className="font-semibold text-foreground">{value}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
