import type { Metadata } from "next";

import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Downloads",
  description:
    "Download the AI Web Feeds catalog as OPML for a feed reader, or fetch the same collection as JSON.",
  path: "/downloads",
});

const CATALOG_DOWNLOADS = [
  {
    href: "/api/exports/opml",
    label: "All feeds (OPML)",
    description: "Flat OPML for the full catalog, served from data/feeds.opml.",
  },
  {
    href: "/api/exports/opml?format=categorized",
    label: "Categorized feeds (OPML)",
    description: "Topic-grouped OPML, served from data/feeds.categorized.opml.",
  },
  {
    href: "/api/feeds",
    label: "Feed catalog (JSON)",
    description: "Catalog JSON from the existing feeds export (data/feeds.json).",
  },
] as const;

export default function DownloadsPage() {
  return (
    <div className="page-wrap page-stack py-8">
      <h1 className="text-3xl font-semibold text-(--ink)">Downloads</h1>
      <p className="mt-2 max-w-2xl text-sm text-(--ink-muted)">
        OPML and JSON already written for the catalog. These links open the existing export route
        and catalog endpoint. They do not build another copy of the collection.
      </p>
      <ul className="mt-6 divide-y divide-(--line) rounded-lg border border-(--line) bg-(--surface)">
        {CATALOG_DOWNLOADS.map((artifact) => (
          <li key={artifact.href} className="flex flex-col gap-1 px-4 py-3">
            <a
              href={artifact.href}
              className="font-medium text-(--ink) underline-offset-4 hover:underline"
            >
              {artifact.label}
            </a>
            <p className="text-xs text-(--ink-muted)">{artifact.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
