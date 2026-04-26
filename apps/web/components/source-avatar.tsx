"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    <Avatar className={cn("size-9 rounded-lg after:rounded-lg", className)} aria-hidden="true">
      {faviconUrl && !failed ? (
        <AvatarImage
          src={faviconUrl}
          alt=""
          className={cn("rounded-lg object-cover", imageClassName)}
          onError={() => setFailed(true)}
        />
      ) : null}
      <AvatarFallback className="rounded-lg bg-muted text-[0.68rem] font-semibold text-primary">
        {getSourceInitials(source.title)}
      </AvatarFallback>
    </Avatar>
  );
}
