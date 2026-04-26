import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, RadioTower } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { SourceAvatar } from "@/components/source-avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-5">
              <span className="eyebrow">
                <RadioTower className="size-3.5" />
                Source
              </span>
              <div className="flex items-start gap-4">
                <SourceAvatar source={source} className="size-14 rounded-lg" />
                <div className="space-y-3">
                  <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    {sourceTitle}
                  </h1>
                  <p className="small-note max-w-3xl">{sourceDescription}</p>
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
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-2">
              <p className="metric-label">Source type</p>
              <Badge variant="outline" className="h-7 rounded-md">
                {source.source_type ?? "feed"}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2">
              <p className="metric-label">Verification</p>
              <Badge variant={source.verified ? "secondary" : "outline"} className="h-7 rounded-md">
                {source.verified ? "Verified" : "Cataloged"}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2">
              <p className="metric-label">Feed</p>
              <Link href={source.url} className="break-all text-sm font-semibold text-primary">
                {source.url}
              </Link>
            </CardContent>
          </Card>
        </div>

        {source.topics && source.topics.length > 0 ? (
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Topics</h2>
              <div className="flex flex-wrap gap-2">
                {source.topics.map((topic) => (
                  <Link
                    key={topic}
                    href={getTopicPath(topic)}
                    className="rounded-lg border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary"
                  >
                    {topic}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
