"use client";

import { useCallback } from "react";

import { useToast } from "@/components/utility/toast";
import { useAccountMerge, type MergeResult } from "@/hooks/use-account-merge";
import { hydrateFromServer } from "@/hooks/use-server-hydration";
import { authClient } from "@/lib/auth-client";

function formatHydrationDescription(summary: {
  filters: number;
  follows: number;
  savedSearches: number;
  articleStates: number;
}): string {
  const parts: string[] = [];
  if (summary.filters > 0) {
    parts.push(`${summary.filters} filter${summary.filters === 1 ? "" : "s"}`);
  }
  if (summary.follows > 0) {
    parts.push(`${summary.follows} follow${summary.follows === 1 ? "" : "s"}`);
  }
  if (summary.savedSearches > 0) {
    parts.push(`${summary.savedSearches} saved search${summary.savedSearches === 1 ? "" : "es"}`);
  }
  if (summary.articleStates > 0) {
    parts.push(`${summary.articleStates} article state${summary.articleStates === 1 ? "" : "s"}`);
  }

  if (parts.length === 0) {
    return "Your account is linked. Server preferences are up to date.";
  }

  return `Synced ${parts.join(", ")} from your account.`;
}

/**
 * Runs anonymous-to-session merge and server hydration when a Better Auth session is present.
 * Mount once inside a layout that already provides ToastProvider (e.g. HubProviders).
 */
export function AccountSessionBootstrap() {
  const { toast } = useToast();
  const { data: session, isPending } = authClient.useSession();
  const sessionUserId = session?.user?.id?.trim() ?? null;

  const handleSessionSync = useCallback(
    async (mergeResult: MergeResult) => {
      if (!sessionUserId) {
        return;
      }

      const summary = await hydrateFromServer({ sessionUserId });
      console.info("[aiwf] Server hydration complete", summary);

      if (!mergeResult.skipped) {
        toast({
          title: "Workspace synced",
          description: formatHydrationDescription(summary),
          variant: "success",
          duration: 5000,
        });
      }
    },
    [sessionUserId, toast],
  );

  useAccountMerge({
    enabled: !isPending && Boolean(sessionUserId),
    onMerged: handleSessionSync,
  });

  return null;
}
