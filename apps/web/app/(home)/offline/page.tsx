import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff, RefreshCw, Home, BookOpenText } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Offline - AI Web Feeds",
  description: "You are currently offline. Some content may be available from cache.",
  path: "/offline",
});

export default function OfflinePage() {
  return (
    <div className="page-wrap page-stack">
      <section className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-full border border-(--line) bg-(--surface)">
          <WifiOff className="size-8 text-(--ink-muted)" aria-hidden />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-(--ink)">You&apos;re offline</h1>
        <p className="mt-3 max-w-md text-[color:var(--ink-muted)]">
          No internet connection detected. You can still browse previously cached articles and
          sources. New content will load automatically when you reconnect.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className={cn(buttonVariants({ variant: "default" }))}
          >
            <RefreshCw className="size-4" />
            Try again
          </button>

          <Link href="/reader" className={cn(buttonVariants({ variant: "secondary" }))}>
            <BookOpenText className="size-4" />
            Open reader
          </Link>

          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            <Home className="size-4" />
            Go home
          </Link>
        </div>

        <div className="mt-10 text-xs text-(--ink-muted)">
          Tip: Articles you&apos;ve previously viewed are available offline via the service worker
          cache and your local IndexedDB.
        </div>
      </section>
    </div>
  );
}
