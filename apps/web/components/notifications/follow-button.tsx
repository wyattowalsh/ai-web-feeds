"use client";

import { useCallback, useEffect, useState } from "react";
import { BookmarkPlus, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  ensureAnonymousUserId,
  fetchWithAnonymousIdentity,
  syncAnonymousUserIdFromResponse,
} from "@/lib/user-identity";

type FollowState = "idle" | "loading" | "saving" | "error";

export interface FollowButtonProps {
  feedId: string;
  variant?: "default" | "compact";
  initialFollowing?: boolean;
  onFollowChange?: (following: boolean) => void;
  className?: string;
}

export function FollowButton({
  feedId,
  variant = "default",
  initialFollowing = false,
  onFollowChange,
  className,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [state, setState] = useState<FollowState>("loading");

  useEffect(() => {
    // Check current follow status on mount.
    void (async () => {
      try {
        const userId = getUserId();
        const response = await fetch(`/api/follows?user_id=${userId}`);

        if (!response.ok) throw new Error("Failed to fetch follows");

        const data = await response.json();
        const following = data.follows.includes(feedId);
        setIsFollowing(following);
      } catch (err) {
        console.error("Failed to check follow status:", err);
      }
    })();
  }, [feedId]);

  const handleToggleFollow = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await ensureAnonymousUserId();
      const response = await fetchWithAnonymousIdentity(
        isFollowing ? `/api/follows?feed_id=${encodeURIComponent(feedId)}` : "/api/follows",
        isFollowing
          ? {
              method: "DELETE",
            }
          : {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ feed_id: feedId }),
            },
      );
      syncAnonymousUserIdFromResponse(response);

      if (!response.ok) {
        throw new Error(isFollowing ? "Failed to unfollow feed" : "Failed to follow feed");
      }

      const nextFollowing = !isFollowing;
      setIsFollowing(nextFollowing);
      setState("idle");
      onFollowChange?.(nextFollowing);
    } catch (error) {
      console.error("FollowButton toggle error:", error);
      setState("error");
    }
  };

  const isBusy = state === "loading" || state === "saving";
  const buttonSize = variant === "compact" ? "sm" : "default";
  const buttonVariant = isFollowing ? "secondary" : "default";
  const label = isFollowing ? "Following" : "Follow";

  return (
    <Button
      size={buttonSize}
      variant={buttonVariant}
      className={cn(variant === "compact" ? "gap-1.5" : undefined, className)}
      onClick={() => void handleToggle()}
      disabled={isBusy}
      aria-pressed={isFollowing}
      aria-label={`${label} ${feedId}`}
      title={state === "error" ? "Retry follow sync" : label}
    >
      {isBusy ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : isFollowing ? (
        <Check className="size-4" />
      ) : (
        <BookmarkPlus className="size-4" />
      )}
      <span>{variant === "compact" ? label : `${label} feed`}</span>
    </Button>
  );
}
