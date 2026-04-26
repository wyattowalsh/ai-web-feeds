import type { FeedSource } from "@/lib/feeds";

export function getSourceInitials(value: string): string {
  const initials = value
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "AI";
}

export function deriveSourceFaviconUrl(
  source: Pick<
    FeedSource,
    "favicon_url" | "icon_url" | "icon" | "logo_url" | "website_url" | "site" | "url"
  >,
): string | null {
  const explicitIcon = source.favicon_url || source.icon_url || source.icon || source.logo_url;
  if (explicitIcon) {
    return normalizeUrl(explicitIcon);
  }

  const originUrl = normalizeUrl(source.website_url || source.site || source.url);
  if (!originUrl) {
    return null;
  }

  try {
    return `${new URL(originUrl).origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}
