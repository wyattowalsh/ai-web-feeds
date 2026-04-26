import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Tags } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { SourceAvatar } from "@/components/source-avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  getSourcePath,
  getSourceTitle,
  getSourcesForTopic,
  getTopicBySlug,
  getTopicPath,
  loadTopicCatalog,
  slugifyPathSegment,
  truncateDescription,
} from "@/lib/public-content";
import { createPageMetadata } from "@/lib/seo";
import { breadcrumbsJsonLd, collectionPageJsonLd } from "@/lib/structured-data";

type TopicPageProps = {
  params: Promise<{ topicId: string }>;
};

export function generateStaticParams() {
  return loadTopicCatalog().map((topic) => ({
    topicId: slugifyPathSegment(topic.id),
  }));
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { topicId } = await params;
  const topic = getTopicBySlug(topicId);
  if (!topic) {
    notFound();
  }

  return createPageMetadata({
    title: `${topic.label} sources - AI Web Feeds`,
    description: truncateDescription(
      topic.description,
      `Browse AI Web Feeds sources and reader filters for ${topic.label}.`,
    ),
    path: getTopicPath(topic.id),
  });
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { topicId } = await params;
  const topic = getTopicBySlug(topicId);
  if (!topic) {
    notFound();
  }

  const sources = getSourcesForTopic(topic.id);
  const readerHref = `/reader?topics=${encodeURIComponent(topic.id)}`;
  const description = truncateDescription(
    topic.description,
    `Browse source coverage and recent AI writing for ${topic.label}.`,
  );

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        data={[
          breadcrumbsJsonLd([
            { name: "Home", url: "/" },
            { name: "Topics", url: "/topics" },
            { name: topic.label, url: getTopicPath(topic.id) },
          ]),
          collectionPageJsonLd({
            name: `${topic.label} sources`,
            description,
            url: getTopicPath(topic.id),
            items: sources.slice(0, 50).map((source) => ({
              name: getSourceTitle(source),
              url: getSourcePath(source),
              description: source.description,
            })),
          }),
        ]}
      />
      <section className="surface-panel space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-5">
            <span className="eyebrow">
              <Tags className="size-3.5" />
              Topic
            </span>
            <div className="space-y-3">
              <h1 className="text-title-large max-w-4xl">{topic.label}</h1>
              <p className="hero-copy max-w-3xl">{description}</p>
            </div>
          </div>
          <Link href={readerHref} className={cn(buttonVariants({ variant: "default" }))}>
            Read topic
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="surface-card space-y-2">
            <p className="metric-label">Sources</p>
            <p className="text-2xl font-semibold text-(--ink)">{sources.length}</p>
          </div>
          <div className="surface-card space-y-2">
            <p className="metric-label">Facet</p>
            <p className="text-lg font-semibold text-(--ink)">{topic.facet ?? "topic"}</p>
          </div>
          <div className="surface-card space-y-2">
            <p className="metric-label">Parents</p>
            <p className="text-lg font-semibold text-(--ink)">
              {topic.parents.length > 0 ? topic.parents.join(", ") : "Top level"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sources.map((source) => (
            <Link
              key={source.id ?? source.url}
              href={getSourcePath(source)}
              className="surface-card flex items-start gap-4 transition hover:border-(--brand)"
            >
              <SourceAvatar source={source} />
              <div className="min-w-0 space-y-2">
                <h2 className="font-semibold text-(--ink)">{getSourceTitle(source)}</h2>
                <p className="line-clamp-2 text-sm leading-6 text-(--ink-muted)">
                  {source.description ?? source.url}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
