"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { CANONICAL_READER_PATH } from "@/lib/reader-routes";

export default function FeedsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel">
        <EmptyState
          icon={RefreshCw}
          title="Feeds workspace failed to load"
          description={
            error.message || "The reader snapshot or source catalog could not be prepared."
          }
          tips={[
            "Try loading the workspace again.",
            "If the issue persists, rebuild the article corpus and verify the feed data files.",
          ]}
        >
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={reset}>
              Try again
            </Button>
            <Link
              href={CANONICAL_READER_PATH}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Open feeds
            </Link>
          </div>
        </EmptyState>
      </section>
    </div>
  );
}
