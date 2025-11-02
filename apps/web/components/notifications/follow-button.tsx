/**
 * FollowButton - Toggle feed follow status
 *
 * Allows users to follow/unfollow feeds to receive notifications.
 */

"use client";

import { useState, useEffect } from "react";
import { getUserId } from "@/lib/user-identity";

interface FollowButtonProps {
  feedId: string;
  initialFollowing?: boolean;
  onFollowChange?: (following: boolean) => void;
  variant?: "default" | "compact";
  className?: string;
}

export function FollowButton({
  feedId,
  initialFollowing = false,
  onFollowChange,
  variant = "default",
  className = "",
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check current follow status on mount
    checkFollowStatus();
  }, [feedId]);

  const checkFollowStatus = async () => {
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
  };

  const handleToggleFollow = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const userId = getUserId();

      if (isFollowing) {
        // Unfollow
        const response = await fetch(`/api/follows?user_id=${userId}&feed_id=${feedId}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to unfollow");

        setIsFollowing(false);
        onFollowChange?.(false);
      } else {
        // Follow
        const response = await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, feed_id: feedId }),
        });

        if (!response.ok) throw new Error("Failed to follow");

        setIsFollowing(true);
        onFollowChange?.(true);
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "compact") {
    return (
      <button
        onClick={handleToggleFollow}
        disabled={isLoading}
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
          isFollowing
            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
            : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title={isFollowing ? "Unfollow to stop notifications" : "Follow to get notifications"}
      >
        {isLoading ? (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isFollowing ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path
              fillRule="evenodd"
              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        )}
        {isFollowing ? "Following" : "Follow"}
      </button>
    );
  }

  return (
    <div className={className}>
      <button
        onClick={handleToggleFollow}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          isFollowing
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <>
            <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>{isFollowing ? "Unfollowing..." : "Following..."}</span>
          </>
        ) : isFollowing ? (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>Following</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span>Follow</span>
          </>
        )}
      </button>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
