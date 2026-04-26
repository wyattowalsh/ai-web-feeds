import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, RadioTower } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { SourceAvatar } from "@/components/source-avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { loadFeedCatalog } from "@/lib/feeds";
import {
  getSourceBySlug,
  getSourcePath,
  getSourceSlug,
  getSourceTitle,
  getTopicPath,
  truncateDescription,
} from "@/lib/public-content";
import { createPageMetadata } from "@/lib/seo";
import { breadcrumbsJsonLd, dataFeedJsonLd } from "@/lib/structured-data";

type SourcePageProps = {
  params: Promise<{ sourceId: string }>;
};

export function generateStaticParams() {
  return loadFeedCatalog().sources.map((source) => ({
    sourceId: getSourceSlug(source),
  }));
}

export async function generateMetadata({ params }: SourcePageProps): Promise<Metadata> {
  const { sourceId } = await params;
  const source = getSourceBySlug(sourceId);
  if (!source) {
    notFound();
  }

  const sourceTitle = getSourceTitle(source);
  const description = truncateDescription(
    source.description,
    `Read ${sourceTitle} in AI Web Feeds and browse its AI writing, topics, and source metadata.`,
  );

  return createPageMetadata({
    title: `${sourceTitle} - AI source`,
    description,
    path: getSourcePath(source),
  });
}

export default async function SourcePage({ params }: SourcePageProps) {
  const { sourceId } = await params;
  const source = getSourceBySlug(sourceId);
  if (!source) {
    notFound();
  }

  const sourceTitle = getSourceTitle(source);
  const sourceDescription = truncateDescription(
    source.description,
    `${sourceTitle} is part of the AI Web Feeds source catalog.`,
  );
  const readerHref = `/reader?feed=${encodeURIComponent(source.id ?? sourceTitle)}`;
  const sourceUrl = source.website_url || source.site || source.url;

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        data={[
          breadcrumbsJsonLd([
            { name: "Home", url: "/" },
            { name: "Sources", url: "/sources" },
            { name: sourceTitle, url: getSourcePath(source) },
          ]),
          dataFeedJsonLd({
            name: sourceTitle,
            description: sourceDescription,
            url: getSourcePath(source),
            sourceUrl,
          }),
        ]}
      />
      <section className="surface-panel space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-5">
            <span className="eyebrow">
              <RadioTower className="size-3.5" />
              Source
            </span>
            <div className="flex items-start gap-4">
              <SourceAvatar source={source} className="size-14 rounded-xl" />
              <div className="space-y-3">
                <h1 className="text-title-large max-w-4xl">{sourceTitle}</h1>
                <p className="hero-copy max-w-3xl">{sourceDescription}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={readerHref} className={cn(buttonVariants({ variant: "default" }))}>
              Read source
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href={sourceUrl}
              className={cn(buttonVariants({ variant: "outline" }))}
              target="_blank"
              rel="noreferrer"
            >
              Original site
              <ExternalLink className="size-4" />
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="surface-card space-y-2">
            <p className="metric-label">Source type</p>
            <p className="text-lg font-semibold text-(--ink)">{source.source_type ?? "feed"}</p>
          </div>
          <div className="surface-card space-y-2">
            <p className="metric-label">Verification</p>
            <p className="text-lg font-semibold text-(--ink)">
              {source.verified ? "Verified" : "Cataloged"}
            </p>
          </div>
          <div className="surface-card space-y-2">
            <p className="metric-label">Feed</p>
            <Link
              href={source.url}
              className="break-all text-sm font-semibold text-(--brand-strong)"
            >
              {source.url}
            </Link>
          </div>
        </div>

        {source.topics && source.topics.length > 0 ? (
          <div className="surface-card space-y-4">
            <h2 className="text-title-medium">Topics</h2>
            <div className="flex flex-wrap gap-2">
              {source.topics.map((topic) => (
                <Link
                  key={topic}
                  href={getTopicPath(topic)}
                  className="rounded-lg border border-(--line) bg-(--surface-muted) px-3 py-2 text-sm font-semibold text-(--ink) transition hover:bg-(--brand-soft) hover:text-(--brand-strong)"
                >
                  {topic}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
