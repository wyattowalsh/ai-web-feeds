"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CANONICAL_READER_PATH } from "@/lib/reader-routes";
import { DEFAULT_ARTICLE_STATE, readArticleState, writeArticleState } from "@/lib/reader";
import type { ReaderArticleState } from "@/lib/reader/types";
import type { ArticleCorpusArticle } from "@/lib/article-corpus";
import { formatArticleDateTime } from "@/lib/reader/format";
import { formatReadingTime } from "@/lib/reader/reading-time";
import { ReadingProgress } from "./reading-progress";

export type ImmersiveReaderProps = {
  article: ArticleCorpusArticle;
  /** Optional className for the root container */
  className?: string;
};

export function ImmersiveReader({ article, className }: ImmersiveReaderProps) {
  const [state, setState] = useState<ReaderArticleState>(DEFAULT_ARTICLE_STATE);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared">("idle");

  // Load persisted state for this article on mount
  useEffect(() => {
    const initial = readArticleState(article.id);
    setState(initial);
  }, [article.id]);

  const persist = (next: ReaderArticleState) => {
    setState(next);
    writeArticleState(article.id, next);
  };

  const toggle = (key: keyof ReaderArticleState) => {
    const next = { ...state, [key]: !state[key] } as ReaderArticleState;
    persist(next);
  };

  const handleMarkRead = () => toggle("read");
  const handleToggleStar = () => toggle("starred");

  const handleShare = async () => {
    const url = article.canonical_url || article.link;
    const title = article.title;

    // Try native share first (mobile-friendly)
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        setShareStatus("shared");
        window.setTimeout(() => setShareStatus("idle"), 1200);
        return;
      } catch {
        // fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareStatus("copied");
        window.setTimeout(() => setShareStatus("idle"), 1200);
      }
    } catch {
      // no-op; user can copy manually
    }
  };

  const readingTime = useMemo(
    () => formatReadingTime(article.content_html || article.summary || article.title),
    [article.content_html, article.summary, article.title],
  );

  const proseHtml = article.content_html || article.summary || "";

  return (
    <div className={cn("relative", className)}>
      <ReadingProgress />

      {/* Top toolbar */}
      <div className="sticky top-0 z-40 border-b border-(--line) bg-(--paper)/95 backdrop-blur supports-[backdrop-filter]:bg-(--paper)/80">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              href={CANONICAL_READER_PATH}
              className="inline-flex items-center gap-2 rounded-lg border border-(--line) bg-(--surface) px-3 py-1.5 text-sm font-medium text-(--ink) transition hover:bg-(--surface-muted)"
            >
              <ArrowLeft className="size-4" />
              Back to reader
            </Link>
            <span className="hidden text-xs text-(--ink-muted) sm:inline">{readingTime}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={state.read ? "secondary" : "outline"}
              size="sm"
              onClick={handleMarkRead}
              aria-pressed={state.read}
            >
              {state.read ? "Marked read" : "Mark read"}
            </Button>

            <Button
              type="button"
              variant={state.starred ? "secondary" : "outline"}
              size="sm"
              onClick={handleToggleStar}
              aria-pressed={state.starred}
            >
              <Star className={cn("size-4", state.starred && "fill-current")} />
              {state.starred ? "Starred" : "Star"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleShare}
              aria-label="Share article link"
            >
              <Copy className="size-4" />
              {shareStatus === "copied" ? "Copied" : shareStatus === "shared" ? "Shared" : "Share"}
            </Button>

            <Link
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-(--line) bg-(--surface) px-3 py-1.5 text-sm font-medium text-(--ink) transition hover:bg-(--surface-muted)",
              )}
            >
              Original
              <ExternalLink className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Article header */}
      <header className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-8 pt-10">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-(--ink-muted)">
            <span className="font-semibold text-(--ink)">{article.feed_title}</span>
            {article.published_at ? <span aria-hidden="true">·</span> : null}
            {article.published_at ? (
              <span>{formatArticleDateTime(article.published_at)}</span>
            ) : null}
            {article.author ? (
              <>
                <span aria-hidden="true">·</span>
                <span>By {article.author}</span>
              </>
            ) : null}
          </div>
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-(--ink) sm:text-4xl">
            {article.title}
          </h1>
          {article.summary ? (
            <p className="max-w-2xl text-base leading-7 text-(--ink-muted)">{article.summary}</p>
          ) : null}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-(--ink-muted)">
          <span>{readingTime}</span>
          {article.topics.length > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <div className="flex flex-wrap gap-1.5">
                {article.topics.slice(0, 6).map((topic) => (
                  <span
                    key={topic}
                    className="rounded-md border border-(--line) bg-(--surface-muted) px-2 py-0.5 text-xs font-semibold"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </header>

      {/* Reader content */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-16">
        <article
          className="reader-prose reader-paper mx-auto w-full px-6 py-8 sm:px-10 sm:py-10"
          // Render trusted corpus HTML (sanitized at ingest time)
          dangerouslySetInnerHTML={{ __html: proseHtml }}
        />

        {/* Bottom actions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-(--line) pt-6 text-sm">
          <Link
            href={CANONICAL_READER_PATH}
            className="inline-flex items-center gap-2 font-medium text-(--brand-strong) hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to reader
          </Link>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={state.starred ? "secondary" : "outline"}
              size="sm"
              onClick={handleToggleStar}
            >
              <Star className={cn("size-4", state.starred && "fill-current")} />
              {state.starred ? "Starred" : "Star"}
            </Button>
            <Link
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-(--line) bg-(--surface) px-3 py-1.5 font-medium text-(--ink) transition hover:bg-(--surface-muted)"
            >
              Read original
              <ExternalLink className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImmersiveReader;
