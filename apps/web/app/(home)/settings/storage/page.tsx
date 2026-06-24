"use client";

import Link from "next/link";

import { StorageBanner } from "@/components/offline/storage-banner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function StorageSettingsPage() {
  return (
    <div className="page-wrap page-stack py-8">
      <h1 className="text-3xl font-semibold text-(--ink)">Storage</h1>
      <p className="mt-2 max-w-2xl text-sm text-(--ink-muted)">
        Monitor IndexedDB usage and clear cached content when you are near quota limits.
      </p>

      <div className="mt-6">
        <StorageBanner pollIntervalMs={15_000} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/offline" className={cn(buttonVariants({ variant: "secondary" }))}>
          Offline hub
        </Link>
        <Link href="/offline/conflicts" className={cn(buttonVariants({ variant: "outline" }))}>
          Sync conflicts
        </Link>
      </div>
    </div>
  );
}
