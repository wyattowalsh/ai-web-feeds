import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

import { HubPage } from "@/components/hub";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CANONICAL_READER_PATH } from "@/lib/reader-routes";

/**
 * ArticleUnavailable
 *
 * Graceful fallback UI shown when a requested article cannot be found.
 * Provides clear navigation back to the reader and to search.
 */
export function ArticleUnavailable({ articleId }: { articleId?: string }) {
  const title = "Article unavailable";
  const description =
    "This article is not available in the current corpus or may have moved. You can browse the live reader or search for related content.";

  return (
    <div className="page-wrap page-stack">
      <HubPage
        variant="default"
        eyebrow={
          <Link
            href={CANONICAL_READER_PATH}
            className="inline-flex items-center gap-2 text-sm font-medium text-(--ink-muted) hover:text-(--ink)"
          >
            <ArrowLeft className="size-4" />
            Reader
          </Link>
        }
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={CANONICAL_READER_PATH}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              <ArrowLeft className="size-4" />
              Back to reader
            </Link>
            <Link href="/search" className={cn(buttonVariants({ variant: "outline" }))}>
              <Search className="size-4" />
              Search corpus
            </Link>
          </div>
        }
      >
        <div className="surface-card border-(--line) p-6 text-sm text-(--ink-muted)">
          {articleId ? (
            <p>
              Requested reference:{" "}
              <code className="rounded bg-(--surface-muted) px-1 py-0.5">{articleId}</code>
            </p>
          ) : (
            <p>The requested article could not be resolved.</p>
          )}
          <p className="mt-2">
            Try adjusting filters in the reader, or use search to find related posts.
          </p>
        </div>
      </HubPage>
    </div>
  );
}

export default ArticleUnavailable;
