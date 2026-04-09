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

  const loadFollowState = useCallback(async () => {
    setState("loading");

    try {
      await ensureAnonymousUserId();
      const response = await fetchWithAnonymousIdentity("/api/follows");
      syncAnonymousUserIdFromResponse(response);

      if (!response.ok) {
        throw new Error("Failed to load follow state");
      }

      const payload = (await response.json().catch(() => null)) as {
        follows?: Array<{ feed_id?: string }>;
      } | null;
      const follows = Array.isArray(payload?.follows) ? payload.follows : [];
      const following = follows.some((follow) => follow.feed_id === feedId);

      setIsFollowing(following);
      setState("idle");
    } catch (error) {
      console.error("FollowButton load error:", error);
      setState("error");
    }
  }, [feedId]);

  useEffect(() => {
    void loadFollowState();
  }, [loadFollowState]);

  const handleToggle = async () => {
    setState("saving");

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
