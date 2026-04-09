"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

export interface SearchArtworkSpec {
  src: string;
  alt: string;
  width: number;
  height: number;
  pendingDescription: string;
}

export const SEARCH_ARTWORKS = {
  modesComparison: {
    src: "/search/illustrations/search-modes-comparison.webp",
    alt: "Editorial illustration comparing source-catalog lookup with recent-article discovery across AI feed search.",
    width: 1440,
    height: 960,
    pendingDescription: "The search-modes comparison artwork is still rendering.",
  },
  startHereOnboarding: {
    src: "/search/illustrations/search-start-here-onboarding.webp",
    alt: "Editorial onboarding illustration of a search moving from broad discovery into a saved shortlist.",
    width: 1600,
    height: 1000,
    pendingDescription: "The start-here onboarding artwork is still rendering.",
  },
  savedSearchesEmpty: {
    src: "/search/illustrations/saved-searches-empty.webp",
    alt: "Editorial illustration of reserved slots for saved searches waiting to be filled.",
    width: 1200,
    height: 900,
    pendingDescription: "The saved-searches empty-state artwork is still rendering.",
  },
  noResults: {
    src: "/search/illustrations/search-no-results.webp",
    alt: "Editorial illustration of an empty results tray beside tuned search controls.",
    width: 1200,
    height: 900,
    pendingDescription: "The no-results artwork is still rendering.",
  },
  semanticThresholdMicrographic: {
    src: "/search/illustrations/semantic-threshold-micrographic.webp",
    alt: "Minimal micrographic showing the contrast between source metadata lookup and recent article scanning.",
    width: 1200,
    height: 720,
    pendingDescription: "The source-versus-articles micrographic is still rendering.",
  },
} satisfies Record<string, SearchArtworkSpec>;

interface SearchArtworkSlotProps extends SearchArtworkSpec {
  sizes: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  pendingTitle?: string;
}

export function SearchArtworkSlot({
  src,
  alt,
  width,
  height,
  pendingDescription,
  sizes,
  className,
  imageClassName,
  priority = false,
  pendingTitle = "Illustration pending",
}: SearchArtworkSlotProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={cn("rounded-[2rem] border border-(--line) bg-(--surface) p-3", className)}>
      <div
        className="relative overflow-hidden rounded-[1.5rem] bg-(--surface-muted)"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {imageFailed ? (
          <div role="img" aria-label={alt} className="flex h-full w-full items-end p-4 sm:p-5">
            <div className="w-full rounded-[1.25rem] border border-dashed border-(--line) bg-(--surface) px-4 py-3 text-left">
              <p className="metric-label">{pendingTitle}</p>
              <p className="small-note mt-2 max-w-[28ch]">{pendingDescription}</p>
            </div>
          </div>
        ) : (
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            sizes={sizes}
            priority={priority}
            onError={() => setImageFailed(true)}
            className={cn("h-full w-full object-contain", imageClassName)}
          />
        )}
      </div>
    </div>
  );
}
