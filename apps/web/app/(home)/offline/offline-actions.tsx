"use client";

import { RefreshCw } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function OfflineTryAgainButton() {
  return (
    <button
      type="button"
      title="Manually refresh the page to retry when back online"
      className={cn(buttonVariants({ variant: "default" }))}
      onClick={() => window.location.reload()}
    >
      <RefreshCw className="size-4" />
      Try again
    </button>
  );
}
