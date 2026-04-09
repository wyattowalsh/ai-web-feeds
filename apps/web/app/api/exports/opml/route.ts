import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { join } from "node:path";
import { loadFeedCatalog } from "@/lib/feeds";
import { resolveDataDir } from "@/lib/runtime-paths";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "all";

  try {
    if (format === "filtered") {
      const feedIds = Array.from(
        new Set(
          searchParams
            .getAll("feed")
            .map((feedId) => feedId.trim())
            .filter((feedId) => feedId.length > 0),
        ),
      );

      if (feedIds.length === 0) {
        return NextResponse.json(
          { error: 'At least one "feed" query parameter is required for filtered OPML exports.' },
          { status: 400 },
        );
      }

      const catalog = loadFeedCatalog().sources;
      const selectedFeeds = catalog.filter((feed) => feed.id && feedIds.includes(feed.id));

      if (selectedFeeds.length === 0) {
        return NextResponse.json(
          { error: "No matching feeds were found for this export." },
          { status: 404 },
        );
      }

      const opmlContent = renderFilteredOpml(selectedFeeds);
      return new NextResponse(opmlContent, {
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": 'attachment; filename="ai-ml-feeds-filtered.opml"',
          "Cache-Control": "no-store",
        },
      });
    }

    const dataDir = resolveDataDir();
    const opmlPath =
      format === "categorized" ? join(dataDir, "categorized.opml") : join(dataDir, "all.opml");
    const filename =
      format === "categorized" ? "ai-ml-feeds-categorized.opml" : "ai-ml-feeds-all.opml";
    const opmlContent = readFileSync(opmlPath, "utf-8");

    return new NextResponse(opmlContent, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error serving OPML:", error);
    return NextResponse.json({ error: "Failed to generate OPML file" }, { status: 500 });
  }
};

function renderFilteredOpml(
  feeds: Array<{
    title: string;
    feed?: string;
    url: string;
    site?: string;
    website_url?: string;
    description?: string;
  }>,
): string {
  const outlines = feeds
    .map((feed) => {
      const title = escapeXml(feed.title || feed.url);
      const xmlUrl = escapeXml(feed.feed || feed.url);
      const htmlUrl = escapeXml(feed.site || feed.website_url || feed.url);
      const description = feed.description ? ` description="${escapeXml(feed.description)}"` : "";

      return `    <outline type="rss" text="${title}" title="${title}" xmlUrl="${xmlUrl}" htmlUrl="${htmlUrl}"${description} />`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    "    <title>AI Web Feeds Filtered Export</title>",
    `    <dateCreated>${new Date().toUTCString()}</dateCreated>`,
    "  </head>",
    "  <body>",
    outlines,
    "  </body>",
    "</opml>",
  ].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export const GET = withRouteTelemetry("exports.opml", GETHandler);
