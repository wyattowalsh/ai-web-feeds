import type { Metadata } from "next";
import Link from "next/link";
import { Network, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonLd } from "@/components/json-ld";
import { getRequestNonce } from "@/lib/nonce";
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

export default async function TopicsPage() {
  const nonce = await getRequestNonce();
  const topics = loadTopicCatalog();

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        nonce={nonce}
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
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <span className="eyebrow">
            <Tags className="size-3.5" />
            Topics
          </span>
          <div className="mt-4 space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Discover collections
            </h1>
            <p className="small-note max-w-3xl">
              Topic pages group AI sources into useful reading lanes for research, products,
              infrastructure, evaluation, governance, and agent workflows.
            </p>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <Network className="size-4" />
              Open interactive graph explorer
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic) => {
            const sourceCount = getSourcesForTopic(topic.id).length;
            const readerHref = `/reader?topics=${encodeURIComponent(topic.id)}`;
            const topicHref = getTopicPath(topic.id);

            return (
              <Card
                key={topic.id}
                className="flex flex-col transition hover:border-primary/45 hover:bg-muted/25"
              >
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-3">
                    <Link href={topicHref} className="min-w-0 break-words hover:underline">
                      {topic.label}
                    </Link>
                    <Badge variant="secondary" className="h-6 shrink-0 rounded-md">
                      {sourceCount}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-3">
                  <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {truncateDescription(
                      topic.description,
                      `Sources and reader filters for ${topic.label}.`,
                    )}
                  </p>
                  <Link
                    href={readerHref}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Open in reader
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
