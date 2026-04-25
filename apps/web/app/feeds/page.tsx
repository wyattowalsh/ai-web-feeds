import type { Metadata } from "next";
import { loadReaderRouteData, ReaderPageSearchParams } from "@/lib/reader-route";
import { FeedsWorkspaceClient } from "./feeds-workspace-client";

export const metadata: Metadata = {
  title: "AI Reader - AI Web Feeds",
  description:
    "Read recent AI articles across all tracked feeds, then refine by source when you need to.",
  openGraph: {
    title: "AI Reader - AI Web Feeds",
    description:
      "Read recent AI articles across all tracked feeds, then refine by source when you need to.",
  },
};

type FeedsPageProps = {
  searchParams: Promise<ReaderPageSearchParams>;
};

export default async function FeedsPage({ searchParams }: FeedsPageProps) {
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
