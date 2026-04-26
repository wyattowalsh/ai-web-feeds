import type { Metadata } from "next";
import { loadReaderRouteData, ReaderPageSearchParams } from "@/lib/reader-route";
import { FeedsWorkspaceClient } from "../../feeds/feeds-workspace-client";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aiwebfeeds.vercel.app";

export const metadata: Metadata = {
  title: "AI Reader - AI Web Feeds",
  description:
    "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one focused stream.",
  alternates: {
    canonical: `${baseUrl}/reader`,
  },
  openGraph: {
    title: "AI Reader - AI Web Feeds",
    description:
      "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one focused stream.",
    url: `${baseUrl}/reader`,
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
    title: "AI Reader - AI Web Feeds",
    description:
      "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one focused stream.",
    images: [`${baseUrl}/og-image.png`],
  },
};

type ReaderPageProps = {
  searchParams: Promise<ReaderPageSearchParams>;
};

export default async function ReaderPage({ searchParams }: ReaderPageProps) {
  const { mode, feeds, stats, initialState, initialBrowse } =
    await loadReaderRouteData(searchParams);

  return (
    <div className="page-wrap page-stack">
      <section className="space-y-8">
        <FeedsWorkspaceClient
          mode={mode}
          feeds={feeds}
          stats={stats}
          initialState={initialState}
          initialBrowse={initialBrowse}
        />
      </section>
    </div>
  );
}
