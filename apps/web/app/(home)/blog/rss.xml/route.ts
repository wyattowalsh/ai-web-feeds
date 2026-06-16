import { getBlogRSS } from "@/lib/rss";

export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  const feed = await getBlogRSS();

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
