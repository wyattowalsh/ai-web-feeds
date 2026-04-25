import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CANONICAL_READER_PATH } from "@/lib/reader-routes";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aiwebfeeds.vercel.app";

export const metadata: Metadata = {
  title: "AI Web Feeds - Browse AI articles across the open web",
  description:
    "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one focused stream.",
  openGraph: {
    title: "AI Web Feeds - Browse AI articles across the open web",
    description:
      "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one focused stream.",
    url: baseUrl,
    type: "website",
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "AI Web Feeds",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Web Feeds - Browse AI articles across the open web",
    description:
      "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one focused stream.",
    images: [`${baseUrl}/og-image.png`],
  },
};

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildFeedsRedirectHref(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
    }
  }

  const query = params.toString();
  return query ? `${CANONICAL_READER_PATH}?${query}` : CANONICAL_READER_PATH;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  redirect(buildFeedsRedirectHref(await searchParams));
}
