import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, Newspaper } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { loadArticleCorpus } from "@/lib/article-corpus";
import { loadFeedCatalog } from "@/lib/feeds";
import {
  articleExcerpt,
  getArticleBySlug,
  getArticlePath,
  getArticleSlug,
  getSourcePath,
  getSourceTitle,
  getTopicPath,
} from "@/lib/public-content";
import { createPageMetadata, noIndexFollowRobots } from "@/lib/seo";
import { articleJsonLd, breadcrumbsJsonLd } from "@/lib/structured-data";

type ArticlePageProps = {
  params: Promise<{ articleId: string }>;
};

export async function generateStaticParams() {
  const corpus = await loadArticleCorpus();
  if (corpus.metadata.is_empty) {
    return [];
  }

  return corpus.articles.map((article) => ({
    articleId: getArticleSlug(article),
  }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { articleId } = await params;
  const article = await getArticleBySlug(articleId);
  if (!article) {
    notFound();
  }

  return createPageMetadata({
    title: article.title,
    description: articleExcerpt(article),
    path: getArticlePath(article),
    type: "article",
    robots: noIndexFollowRobots,
  });
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { articleId } = await params;
  const article = await getArticleBySlug(articleId);
  if (!article) {
    notFound();
  }

  const source = loadFeedCatalog().sources.find((feed) => feed.id === article.feed_id);
  const sourceName = source ? getSourceTitle(source) : article.feed_title;
  const excerpt = articleExcerpt(article);

  return (
    <div className="page-wrap page-stack">
      <JsonLd
        nonce={nonce}
        data={[
          breadcrumbsJsonLd([
            { name: "Home", url: "/" },
            { name: "Reader", url: "/reader" },
            { name: article.title, url: getArticlePath(article) },
          ]),
          articleJsonLd({
            title: article.title,
            description: excerpt,
            url: getArticlePath(article),
            originalUrl: article.link,
            publishedAt: article.published_at,
            author: article.author,
            sourceName,
          }),
        ]}
      />
      <article className="surface-panel space-y-8">
        <div className="space-y-5">
          <span className="eyebrow">
            <Newspaper className="size-3.5" />
            Article reference
          </span>
          <div className="space-y-4">
            <h1 className="text-title-large max-w-4xl">{article.title}</h1>
            <p className="hero-copy max-w-3xl">{excerpt}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={article.link}
              className={cn(buttonVariants({ variant: "default" }))}
              target="_blank"
              rel="noreferrer"
            >
              Read original
              <ExternalLink className="size-4" />
            </Link>
            {source ? (
              <Link
                href={getSourcePath(source)}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Source page
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="surface-card space-y-2">
            <p className="metric-label">Source</p>
            <p className="text-lg font-semibold text-(--ink)">{sourceName}</p>
          </div>
          <div className="surface-card space-y-2">
            <p className="metric-label">Published</p>
            <p className="text-lg font-semibold text-(--ink)">
              {article.published_at
                ? new Date(article.published_at).toLocaleDateString("en-US")
                : "Unknown"}
            </p>
          </div>
          <div className="surface-card space-y-2">
            <p className="metric-label">Canonical original</p>
            <Link
              href={article.link}
              className="break-all text-sm font-semibold text-(--brand-strong)"
            >
              {article.link}
            </Link>
          </div>
        </div>

        {article.topics.length > 0 ? (
          <div className="surface-card space-y-4">
            <h2 className="text-title-medium">Topics</h2>
            <div className="flex flex-wrap gap-2">
              {article.topics.map((topic) => (
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
      </article>
    </div>
  );
}
