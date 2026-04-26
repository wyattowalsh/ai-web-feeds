"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { FeedSource } from "@/lib/feeds";
import { deriveSourceFaviconUrl, getSourceInitials } from "@/lib/source-favicon";

type SourceAvatarProps = {
  source:
    | Pick<
        FeedSource,
        "title" | "favicon_url" | "icon_url" | "icon" | "logo_url" | "website_url" | "site" | "url"
      >
    | {
        title: string;
        url?: string;
        website_url?: string | null;
        site?: string | null;
        favicon_url?: string | null;
        icon_url?: string | null;
        logo_url?: string | null;
        icon?: string | null;
      };
  className?: string;
  imageClassName?: string;
};

export function SourceAvatar({ source, className, imageClassName }: SourceAvatarProps) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = deriveSourceFaviconUrl({
    favicon_url: source.favicon_url ?? undefined,
    icon_url: source.icon_url ?? undefined,
    icon: source.icon ?? undefined,
    logo_url: source.logo_url ?? undefined,
    website_url: source.website_url ?? undefined,
    site: source.site ?? undefined,
    url: source.url ?? "",
  });

  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-(--line) bg-(--surface-muted) text-[0.68rem] font-semibold text-(--brand-strong)",
        className,
      )}
      aria-hidden="true"
    >
      {faviconUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={faviconUrl}
          alt=""
          loading="lazy"
          className={cn("size-full object-cover", imageClassName)}
          onError={() => setFailed(true)}
        />
      ) : (
        getSourceInitials(source.title)
      )}
    </span>
  );
}
