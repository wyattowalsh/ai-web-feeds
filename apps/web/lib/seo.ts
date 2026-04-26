import type { Metadata } from "next";

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_BASE_URL || process.env.SITE_URL || "https://aiwebfeeds.w4w.dev",
);

export const SITE_NAME = "AI Web Feeds";
export const SITE_AUTHOR = "Wyatt Walsh";
export const SITE_AUTHOR_URL = "https://github.com/wyattowalsh";
export const SITE_TWITTER_HANDLE = "@wyattowalsh";
export const DEFAULT_OG_IMAGE_PATH = "/og-image.png";
export const DEFAULT_DESCRIPTION =
  "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one focused stream.";
export const SITE_TAGLINE = "Read AI writing across the open web";
export const DEFAULT_LAST_MODIFIED = new Date("2026-04-26T00:00:00.000Z");

export const publicSeoRobots = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
} satisfies Metadata["robots"];

export const noIndexRobots = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
} satisfies Metadata["robots"];

export function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");

  return trimmed.length > 0 ? trimmed : "https://aiwebfeeds.w4w.dev";
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${normalizedPath}`;
}

export function getDefaultImageUrl(): string {
  return absoluteUrl(DEFAULT_OG_IMAGE_PATH);
}

export function createPageMetadata({
  title,
  description,
  path,
  type = "website",
  imagePath = DEFAULT_OG_IMAGE_PATH,
  robots = publicSeoRobots,
  canonical,
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  imagePath?: string;
  robots?: Metadata["robots"];
  canonical?: string;
}): Metadata {
  const pageUrl = absoluteUrl(path);
  const imageUrl = absoluteUrl(imagePath);

  return {
    title,
    description,
    authors: [
      {
        name: SITE_AUTHOR,
        url: SITE_AUTHOR_URL,
      },
    ],
    creator: SITE_AUTHOR,
    publisher: SITE_NAME,
    openGraph: {
      type,
      locale: "en_US",
      url: pageUrl,
      title,
      description,
      siteName: SITE_NAME,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: SITE_TWITTER_HANDLE,
      images: [imageUrl],
    },
    robots,
    alternates: {
      canonical: canonical ?? pageUrl,
      types: {
        "application/rss+xml": absoluteUrl("/rss.xml"),
        "application/atom+xml": absoluteUrl("/atom.xml"),
        "application/feed+json": absoluteUrl("/feed.json"),
      },
    },
  };
}

export function getSiteVerification(): Metadata["verification"] | undefined {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const yandex = process.env.YANDEX_VERIFICATION?.trim();
  const other: Record<string, string> = {};
  const bing = process.env.BING_SITE_VERIFICATION?.trim();

  if (bing) {
    other["msvalidate.01"] = bing;
  }

  if (!google && !yandex && Object.keys(other).length === 0) {
    return undefined;
  }

  return {
    ...(google ? { google } : {}),
    ...(yandex ? { yandex } : {}),
    ...(Object.keys(other).length > 0 ? { other } : {}),
  };
}

export function parseDateOrDefault(value: string | null | undefined): Date {
  if (value) {
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return DEFAULT_LAST_MODIFIED;
}
