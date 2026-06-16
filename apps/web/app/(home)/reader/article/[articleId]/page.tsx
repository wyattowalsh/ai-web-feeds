import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { HubPage } from "@/components/hub";
import { JsonLd } from "@/components/json-ld";
import { ImmersiveReader } from "@/components/reader/immersive-reader";
import { getRequestNonce } from "@/lib/nonce";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { loadArticleCorpus } from "@/lib/article-corpus";
import { loadFeedCatalog } from "@/lib/feeds";
import {
  articleExcerpt,
  getArticleBySlug,
  getArticleSlug,
  getSourcePath,
  getSourceTitle,
} from "@/lib/public-content";
import { createPageMetadata, noIndexFollowRobots } from "@/lib/seo";
import { articleJsonLd, breadcrumbsJsonLd } from "@/lib/structured-data";
import { loadArticleForReader } from "@/lib/reader/load-article";
import { buildImmersiveReaderHref } from "@/lib/reader/reader-href";
import { CANONICAL_READER_PATH } from "@/lib/reader-routes";

type ImmersiveReaderPageProps = {
  params: Promise<{ articleId: string }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  const corpus = await loadArticleCorpus();
  if (corpus.metadata.is_empty) {
    return [];
  }

  return corpus.articles.map((article) => ({
    articleId: getArticleSlug(article),
  }));
}

export async function generateMetadata({ params }: ImmersiveReaderPageProps): Promise<Metadata> {
  const { articleId } = await params;
  const article = await getArticleBySlug(articleId);
  if (!article) {
    return createPageMetadata({
      title: "Article not found",
      description: "This article reference is not available in the public AI Web Feeds corpus.",
      path: buildImmersiveReaderHref(articleId),
      type: "article",
      robots: noIndexFollowRobots,
    });
  }

  return createPageMetadata({
    title: article.title,
    description: articleExcerpt(article),
    path: buildImmersiveReaderHref(articleId),
    type: "article",
    robots: noIndexFollowRobots,
  });
}

export default async function ImmersiveReaderPage({ params }: ImmersiveReaderPageProps) {
  const { articleId } = await params;

  // Prefer the dedicated reader loader (centralized server helper)
  const article = await loadArticleForReader(articleId);
  if (!article) {
    notFound();
  }

  const nonce = await getRequestNonce();
  const source = loadFeedCatalog().sources.find((feed) => feed.id === article.feed_id);
  const sourceName = source ? getSourceTitle(source) : article.feed_title;
  const excerpt = articleExcerpt(article);
  const immersiveHref = buildImmersiveReaderHref(articleId);

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        nonce={nonce}
        data={[
          breadcrumbsJsonLd([
            { name: "Home", url: "/" },
            { name: "Reader", url: CANONICAL_READER_PATH },
            { name: article.title, url: immersiveHref },
          ]),
          articleJsonLd({
            title: article.title,
            description: excerpt,
            url: immersiveHref,
            originalUrl: article.link,
            publishedAt: article.published_at,
            author: article.author,
            sourceName,
          }),
        ]}
      />

      <HubPage
        variant="immersive"
        eyebrow={
          <Link
            href={CANONICAL_READER_PATH}
            className="inline-flex items-center gap-2 text-sm font-medium text-(--ink-muted) hover:text-(--ink)"
          >
            <ArrowLeft className="size-4" />
            Reader
          </Link>
        }
        title={null}
        description={null}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Read original
              <ExternalLink className="size-4" />
            </Link>
            {source ? (
              <Link
                href={getSourcePath(source)}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Source
              </Link>
            ) : null}
          </div>
        }
      >
        {/* The client immersive reader with toolbar, progress, and reader-prose content */}
        <ImmersiveReader article={article} />
      </HubPage>
    </div>
  );
}
