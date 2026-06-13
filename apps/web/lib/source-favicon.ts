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
    return normalizeSecureImageUrl(explicitIcon);
  }

  return null;
}

function normalizeSecureImageUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
