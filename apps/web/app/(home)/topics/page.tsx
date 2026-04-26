import type { Metadata } from "next";
import Link from "next/link";
import { Tags } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import {
  getSourcesForTopic,
  getTopicPath,
  loadTopicCatalog,
  truncateDescription,
} from "@/lib/public-content";
import { createPageMetadata } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = createPageMetadata({
  title: "Topics - AI Web Feeds",
  description: "Browse AI Web Feeds topics and the source collections behind each reader filter.",
  path: "/topics",
});

export default function TopicsPage() {
  const topics = loadTopicCatalog();

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        data={collectionPageJsonLd({
          name: "AI Web Feeds Topics",
          description: "Topic collections for the AI Web Feeds source catalog.",
          url: "/topics",
          items: topics.slice(0, 75).map((topic) => ({
            name: topic.label,
            url: getTopicPath(topic.id),
            description: topic.description,
          })),
        })}
      />
      <section className="surface-panel space-y-8">
        <div className="space-y-5">
          <span className="eyebrow">
            <Tags className="size-3.5" />
            Topics
          </span>
          <div className="space-y-3">
            <h1 className="text-title-large max-w-4xl">Browse AI topics</h1>
            <p className="hero-copy max-w-3xl">
              Topic pages group the source catalog into crawlable collections for research areas,
              product surfaces, infrastructure, evaluation, governance, and agent workflows.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic) => {
            const sourceCount = getSourcesForTopic(topic.id).length;

            return (
              <Link
                key={topic.id}
                href={getTopicPath(topic.id)}
                className="surface-card space-y-3 transition hover:border-(--brand)"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-(--ink)">{topic.label}</h2>
                  <span className="rounded-full bg-(--brand-soft) px-2.5 py-1 text-xs font-semibold text-(--brand-strong)">
                    {sourceCount} sources
                  </span>
                </div>
                <p className="line-clamp-3 text-sm leading-6 text-(--ink-muted)">
                  {truncateDescription(
                    topic.description,
                    `Sources and reader filters for ${topic.label}.`,
                  )}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
