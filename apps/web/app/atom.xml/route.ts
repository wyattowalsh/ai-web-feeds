import { getSitewideRSS } from "@/lib/rss";

export const revalidate = 3600; // Revalidate every hour

export function GET() {
  const feed = getSitewideRSS();

  return new Response(feed.atom1(), {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
