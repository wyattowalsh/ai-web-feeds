import Link from "next/link";
import { Clock3, ExternalLink, BookOpen } from "lucide-react";
import { formatArticleDate } from "@/lib/reader/format";
import { formatReadingTime } from "@/lib/reader/reading-time";
import { cn } from "@/lib/cn";
import type { HubTeaserArticle } from "@/lib/hub/types";

type ArticleTeaserProps = {
  article: HubTeaserArticle;
  className?: string;
  showTopics?: boolean;
  readerHref?: string;
};

export function ArticleTeaser({
  article,
  className,
  showTopics = true,
  readerHref,
}: ArticleTeaserProps) {
  const resolvedReaderHref = readerHref ?? (article as { readerHref?: string }).readerHref;

  return (
    <article className={cn("surface-card space-y-3 transition hover:border-primary/25", className)}>
      <div className="space-y-2">
        <Link href={article.href} className="group block">
          <h2 className="text-lg font-semibold leading-snug text-foreground group-hover:text-primary">
            {article.title}
          </h2>
        </Link>
        {article.summary ? (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{article.summary}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {article.sourceName ? <span className="font-semibold">{article.sourceName}</span> : null}
        {article.publishedAt ? (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" />
            {formatArticleDate(article.publishedAt)}
          </span>
        ) : null}
        <span>{formatReadingTime(article.summary ?? article.title)}</span>
        <Link
          href={article.href}
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          Open
          <ExternalLink className="size-3" />
        </Link>
        {resolvedReaderHref ? (
          <Link
            href={resolvedReaderHref}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Read in reader
            <BookOpen className="size-3" />
          </Link>
        ) : null}
      </div>
      {showTopics && article.topics && article.topics.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {article.topics.slice(0, 4).map((topic) => (
            <span
              key={topic}
              className="rounded-md border border-border bg-muted px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {topic}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
