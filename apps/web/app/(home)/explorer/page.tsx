import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { GraphVisualizer, getDefaultGraphControls } from "@/components/graph-visualizer";
import { JsonLd } from "@/components/json-ld";
import { getRequestNonce } from "@/lib/nonce";
import { loadTopicCatalog } from "@/lib/public-content";
import { createPageMetadata } from "@/lib/seo";
import { collectionPageJsonLd } from "@/lib/structured-data";
import type { LayoutType } from "@/components/graph-visualizer";
import type { GraphControls } from "@/components/graph-visualizer";
import { ExplorerClient } from "./explorer-client";

export const metadata: Metadata = createPageMetadata({
  title: "Explorer - AI Web Feeds",
  description: "Interactive topic graph explorer for the AI Web Feeds taxonomy.",
  path: "/explorer",
});

export default async function ExplorerPage() {
  const nonce = await getRequestNonce();
  const topics = loadTopicCatalog();

  const jsonLd = collectionPageJsonLd({
    name: "AI Web Feeds Explorer",
    description: "Interactive visualization of the AI topic taxonomy and feed relationships.",
    url: "/explorer",
    items: topics.slice(0, 50).map((topic) => ({
      name: topic.label,
      url: `/topics/${topic.id}`,
      description: topic.description ?? undefined,
    })),
  });

  return (
    <div className="page-wrap page-stack">
      <JsonLd nonce={nonce} data={jsonLd} />
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <span className="eyebrow">
            <Compass className="size-3.5" />
            Explorer
          </span>
          <div className="mt-4 space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Topic graph explorer
            </h1>
            <p className="small-note max-w-3xl">
              Explore the AI topic taxonomy as an interactive network. Drag nodes, zoom, and click
              to inspect relationships. {topics.length} topics loaded from the catalog.
            </p>
          </div>
        </div>

        <ExplorerClient topics={topics} />
      </section>
    </div>
  );
}
