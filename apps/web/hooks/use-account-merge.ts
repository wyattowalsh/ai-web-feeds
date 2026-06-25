"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { getStoredUserId, setUserId } from "@/lib/user-identity";

export const MERGE_DONE_KEY_PREFIX = "aiwf_merge_done_for:";

export type MergeCounts = {
  reader_filters?: number;
  article_states?: number;
  saved_searches?: number;
  follows?: number;
  notification_preferences?: number;
};

export type MergeResult = {
  success: boolean;
  skipped: boolean;
  reason?: string;
  merged?: MergeCounts;
  error?: string;
};

export function mergeDoneStorageKey(sessionUserId: string): string {
  return `${MERGE_DONE_KEY_PREFIX}${sessionUserId}`;
}

export function isMergeDoneForSession(sessionUserId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(mergeDoneStorageKey(sessionUserId)) === "1";
}

export function markMergeDoneForSession(sessionUserId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(mergeDoneStorageKey(sessionUserId), "1");
}

export async function mergeAnonymousAccount(params: {
  sessionUserId: string;
  anonymousUserId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<MergeResult> {
  const { sessionUserId, anonymousUserId = getStoredUserId(), fetchImpl = fetch } = params;

  if (!sessionUserId?.trim()) {
    return { success: false, skipped: true, reason: "missing_session" };
  }

  if (isMergeDoneForSession(sessionUserId)) {
    return { success: true, skipped: true, reason: "already_merged" };
  }

  const fromUserId = anonymousUserId?.trim();
  if (!fromUserId) {
    return { success: true, skipped: true, reason: "no_anonymous_user" };
  }

  if (fromUserId === sessionUserId) {
    markMergeDoneForSession(sessionUserId);
    return { success: true, skipped: true, reason: "same_user" };
  }

  try {
    const response = await fetchImpl("/api/user/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        from_user_id: fromUserId,
        to_user_id: sessionUserId,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      merged?: MergeCounts;
      error?: string;
    } | null;

    if (!response.ok) {
      return {
        success: false,
        skipped: false,
        error: payload?.error ?? `Merge failed with status ${response.status}`,
      };
    }

    markMergeDoneForSession(sessionUserId);
    setUserId(sessionUserId);

    return {
      success: true,
      skipped: false,
      merged: payload?.merged,
    };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      error: error instanceof Error ? error.message : "Account merge failed",
    };
  }
}

export async function resolveSessionUserId(): Promise<string | null> {
  const session = await authClient.getSession();
  return session.data?.user?.id?.trim() ?? null;
}

export type PostAuthSyncOptions = {
  onSuccess?: (summary: { merge: MergeResult; hydrated: boolean }) => void;
  hydrate?: () => Promise<unknown>;
};

export async function runPostAuthSync(options: PostAuthSyncOptions = {}): Promise<{
  merge: MergeResult;
  hydrated: boolean;
}> {
  const sessionUserId = await resolveSessionUserId();
  if (!sessionUserId) {
    const merge: MergeResult = { success: false, skipped: true, reason: "missing_session" };
    return { merge, hydrated: false };
  }

  const merge = await mergeAnonymousAccount({ sessionUserId });
  let hydrated = false;

  if (options.hydrate) {
    await options.hydrate();
    hydrated = true;
  }

  if (merge.success && !merge.skipped) {
    console.info("[aiwf] Anonymous account merged into session", merge.merged);
  }

  if (merge.success) {
    options.onSuccess?.({ merge, hydrated });
  }

  return { merge, hydrated };
}

export type UseAccountMergeOptions = {
  enabled?: boolean;
  onMerged?: (result: MergeResult) => void | Promise<void>;
};

export type UseAccountMergeResult = {
  merging: boolean;
  lastResult: MergeResult | null;
  error: string | null;
  runMerge: (sessionUserId?: string) => Promise<MergeResult>;
};

export function useAccountMerge(options: UseAccountMergeOptions = {}): UseAccountMergeResult {
  const { enabled = true, onMerged } = options;
  const { data: session, isPending } = authClient.useSession();
  const [merging, setMerging] = useState(false);
  const [lastResult, setLastResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranForSessionRef = useRef<string | null>(null);

  const runMerge = useCallback(
    async (sessionUserId?: string): Promise<MergeResult> => {
      const resolvedSessionUserId = sessionUserId ?? session?.user?.id?.trim();
      if (!resolvedSessionUserId) {
        const missing: MergeResult = { success: false, skipped: true, reason: "missing_session" };
        setLastResult(missing);
        return missing;
      }

      setMerging(true);
      setError(null);

      const result = await mergeAnonymousAccount({ sessionUserId: resolvedSessionUserId });
      setLastResult(result);
      setMerging(false);

      if (!result.success && !result.skipped) {
        setError(result.error ?? "Account merge failed");
      }

      if (result.success) {
        await onMerged?.(result);
      }

      return result;
    },
    [onMerged, session?.user?.id],
  );

  useEffect(() => {
    if (!enabled || isPending) {
      return;
    }

    const sessionUserId = session?.user?.id?.trim();
    if (!sessionUserId) {
      ranForSessionRef.current = null;
      return;
    }

    setUserId(sessionUserId);

    if (ranForSessionRef.current === sessionUserId) {
      return;
    }

    ranForSessionRef.current = sessionUserId;
    void runMerge(sessionUserId);
  }, [enabled, isPending, runMerge, session?.user?.id]);

  return {
    merging,
    lastResult,
    error,
    runMerge,
  };
}
