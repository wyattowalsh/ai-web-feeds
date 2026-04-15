import type { Metadata } from "next";
import { FeedsWorkspaceClient } from "@/app/feeds/feeds-workspace-client";
import { loadReaderRouteData, type ReaderPageSearchParams } from "@/lib/reader-route";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ai-web-feeds.vercel.app";

export const metadata: Metadata = {
  title: "AI Web Feeds - Browse AI articles across the open web",
  description:
    "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one reader-first stream.",
  openGraph: {
    title: "AI Web Feeds - Browse AI articles across the open web",
    description:
      "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one reader-first stream.",
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
      "Read recent AI writing from blogs, labs, newsletters, organizations, and research sources in one reader-first stream.",
    images: [`${baseUrl}/og-image.png`],
  },
};

type HomePageProps = {
  searchParams: Promise<ReaderPageSearchParams>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { mode, feeds, stats, initialState, initialBrowse } =
    await loadReaderRouteData(searchParams);

  return (
    <div className="page-wrap page-stack">
      <section className="surface-panel space-y-8">
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
