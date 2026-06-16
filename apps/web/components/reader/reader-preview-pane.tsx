"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Archive, ArrowUpRight, Bookmark, BookOpenText, Copy, Star, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SourceAvatar } from "@/components/source-avatar";
import { ReaderPill } from "@/components/reader/reader-pill";
import { sanitizeArticlePreviewHtml } from "@/lib/article-preview-html";
import { cn } from "@/lib/cn";
import type { FeedSource } from "@/lib/feeds-filters";
import {
  formatArticleDateTime,
  getArticleTopics,
  type ReaderArticleState,
  type WorkspaceArticle,
} from "@/lib/reader";
import { buildImmersiveReaderHref } from "@/lib/reader/reader-href";

export type ReaderPreviewPaneProps = {
  article: WorkspaceArticle | null;
  source?: FeedSource | null;
  state: ReaderArticleState;
  onToggleState: (partial: Partial<ReaderArticleState>) => void;
  onClose?: () => void;
  variant?: "panel" | "inline";
};

export function ReaderPreviewPane({
  article,
  source,
  state,
  onToggleState,
  onClose,
  variant = "panel",
}: ReaderPreviewPaneProps) {
  const [summaryMarkup, setSummaryMarkup] = useState<string | null>(null);

  useEffect(() => {
    setSummaryMarkup(
      article ? sanitizeArticlePreviewHtml(article.content_html, article.link) : null,
    );
  }, [article]);

  if (!article) {
    return (
      <div className="surface-card border-(--line) bg-(--surface)">
        <p className="metric-label">Inspector</p>
        <EmptyState
          icon={BookOpenText}
          title="Select an article"
          description="Choose a post to read the summary, source context, and quick actions."
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "surface-card border-border bg-card",
        variant === "panel" &&
          "flex h-full max-h-[calc(100vh-3rem)] flex-col overflow-hidden border-primary/20",
      )}
    >
      <div className="space-y-4 border-b border-(--line) pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <SourceAvatar
              source={
                source ?? { title: article.feed_title, url: article.source_url ?? article.link }
              }
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-(--ink)">{article.feed_title}</p>
              <p className="small-note">{formatArticleDateTime(article.published_at)}</p>
            </div>
          </div>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {article.freshness === "live" ? <ReaderPill tone="brand">New</ReaderPill> : null}
          {article.freshness === "cached" ? <ReaderPill tone="info">Cached</ReaderPill> : null}
          {article.verified ? <ReaderPill tone="success">Verified</ReaderPill> : null}
          {state.read ? (
            <ReaderPill tone="success">Read</ReaderPill>
          ) : (
            <ReaderPill tone="warning">Unread</ReaderPill>
          )}
          {state.bookmarked ? <ReaderPill tone="info">Saved</ReaderPill> : null}
          {state.starred ? <ReaderPill tone="warning">Starred</ReaderPill> : null}
        </div>
        <div className="space-y-2">
          <h2 className="break-words text-xl font-semibold leading-snug text-(--ink) [overflow-wrap:anywhere] sm:text-2xl">
            {article.title}
          </h2>
          {article.author ? <p className="small-note">By {article.author}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildImmersiveReaderHref(article)}
            className={cn(buttonVariants({ variant: "default" }))}
          >
            <BookOpenText className="size-4" />
            Immersive read
          </Link>
          <Link
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Read original
            <ArrowUpRight className="size-4" />
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => void navigator.clipboard?.writeText(article.link)}
          >
            <Copy className="size-4" />
            Copy link
          </Button>
          <Button
            type="button"
            variant={state.read ? "secondary" : "outline"}
            onClick={() => onToggleState({ read: !state.read })}
          >
            {state.read ? "Marked read" : "Mark read"}
          </Button>
          <Button
            type="button"
            variant={state.starred ? "secondary" : "outline"}
            onClick={() => onToggleState({ starred: !state.starred })}
          >
            <Star className="size-4" />
            {state.starred ? "Starred" : "Star"}
          </Button>
          <Button
            type="button"
            variant={state.bookmarked ? "secondary" : "outline"}
            onClick={() => onToggleState({ bookmarked: !state.bookmarked })}
          >
            <Bookmark className="size-4" />
            {state.bookmarked ? "Saved" : "Save"}
          </Button>
          <Button
            type="button"
            variant={state.archived ? "secondary" : "outline"}
            onClick={() => onToggleState({ archived: !state.archived })}
          >
            <Archive className="size-4" />
            {state.archived ? "Archived" : "Archive"}
          </Button>
        </div>
      </div>

      <div className={cn("space-y-4", variant === "panel" && "overflow-y-auto pr-1")}>
        {article.summary ? (
          <div className="surface-card-soft border-(--line) p-4 text-sm leading-6 text-(--ink-muted)">
            {article.summary}
          </div>
        ) : null}

        {summaryMarkup ? (
          <article
            className="prose prose-sm max-w-none text-(--ink)"
            dangerouslySetInnerHTML={{ __html: summaryMarkup }}
          />
        ) : null}

        <div className="space-y-2">
          <p className="metric-label">Topics</p>
          <div className="flex flex-wrap gap-2">
            {getArticleTopics(article).map((topic) => (
              <span
                key={`${article.id}-${topic}`}
                className="rounded-md border border-(--line) bg-(--surface) px-2.5 py-1 text-xs font-semibold text-(--ink-muted)"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
