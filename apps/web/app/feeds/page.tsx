import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReaderPageSearchParams } from "@/lib/reader-route";
import { CANONICAL_READER_PATH } from "@/lib/reader-routes";

export const metadata: Metadata = {
  title: "AI Reader - AI Web Feeds",
  description: "Compatibility route for the AI Web Feeds reader. The reader now lives at /.",
  openGraph: {
    title: "AI Reader - AI Web Feeds",
    description: "Compatibility route for the AI Web Feeds reader. The reader now lives at /.",
  },
};

type FeedsPageProps = {
  searchParams: Promise<ReaderPageSearchParams>;
};

export default async function FeedsPage({ searchParams }: FeedsPageProps) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
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
  redirect(query ? `${CANONICAL_READER_PATH}?${query}` : CANONICAL_READER_PATH);
}
