import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff, Home, BookOpenText } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { createPageMetadata } from "@/lib/seo";

import { OfflineCachedSearch } from "./offline-cached-search";
import { OfflineTryAgainButton } from "./offline-actions";

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
          <OfflineTryAgainButton />

          <Link href="/reader" className={cn(buttonVariants({ variant: "secondary" }))}>
            <BookOpenText className="size-4" />
            Open reader
          </Link>

          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            <Home className="size-4" />
            Home
          </Link>
        </div>
      </section>

      <OfflineCachedSearch />
    </div>
  );
}
