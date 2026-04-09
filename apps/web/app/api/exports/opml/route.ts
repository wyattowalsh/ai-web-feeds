import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import {
  filterBySourceType,
  filterByTopic,
  filterByVerified,
  loadFeedCatalog,
  type FeedSource,
} from "@/lib/feeds";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";

/**
 * OPML export API endpoint
 * Returns OPML files for feed reader import
 */
const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "all"; // all, categorized, filtered
  const sourceType = searchParams.get("type");
  const topic = searchParams.get("topic");
  const verified = parseBooleanQuery(searchParams.get("verified"));
  const explicitFeedIds = searchParams
    .getAll("feed")
    .map((feedId) => feedId.trim())
    .filter((feedId) => feedId.length > 0);

  try {
    const dataDir = join(process.cwd(), "../../data");
    let opmlPath: string;
    let filename: string;

    // Determine which OPML file to serve
    if (format === "categorized") {
      opmlPath = join(dataDir, "categorized.opml");
      filename = "ai-ml-feeds-categorized.opml";
    } else if (
      format === "filtered" &&
      (explicitFeedIds.length > 0 || sourceType || topic || verified !== null)
    ) {
      const filteredFeeds = resolveFilteredFeeds({
        explicitFeedIds,
        sourceType,
        topic,
        verified,
      });
      const opmlContent = generateOpml(filteredFeeds, buildFilteredTitle(filteredFeeds.length));

      return new NextResponse(opmlContent, {
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": 'attachment; filename="ai-ml-feeds-filtered.opml"',
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      });
    } else {
      opmlPath = join(dataDir, "all.opml");
      filename = "ai-ml-feeds-all.opml";
    }

    // Read OPML file
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

export const GET = withRouteTelemetry("exports.opml", GETHandler);

function resolveFilteredFeeds({
  explicitFeedIds,
  sourceType,
  topic,
  verified,
}: {
  explicitFeedIds: string[];
  sourceType: string | null;
  topic: string | null;
  verified: boolean | null;
}): FeedSource[] {
  const catalog = loadFeedCatalog().sources;

  if (explicitFeedIds.length > 0) {
    const feedLookup = new Map(catalog.map((feed) => [feed.id, feed] as const));
    const seen = new Set<string>();

    return explicitFeedIds
      .filter((feedId) => {
        if (seen.has(feedId)) {
          return false;
        }
        seen.add(feedId);
        return true;
      })
      .map((feedId) => feedLookup.get(feedId))
      .filter((feed): feed is FeedSource => Boolean(feed));
  }

  let filtered = catalog;
  filtered = filterBySourceType(filtered, sourceType);
  filtered = filterByTopic(filtered, topic);
  filtered = filterByVerified(filtered, verified);

  return filtered;
}

function generateOpml(feeds: FeedSource[], title: string): string {
  const now = new Date().toUTCString();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    `    <title>${escapeXml(title)}</title>`,
    `    <dateCreated>${escapeXml(now)}</dateCreated>`,
    `    <dateModified>${escapeXml(now)}</dateModified>`,
    "    <ownerName>AI Web Feeds</ownerName>",
    "  </head>",
    "  <body>",
  ];

  for (const feed of feeds) {
    const feedTitle = feed.title?.trim() || feed.url;
    const xmlUrl = feed.feed || feed.url;
    const htmlUrl = feed.website_url || feed.url;
    const categories = Array.from(new Set([...(feed.topics ?? []), ...(feed.tags ?? [])]));

    const attributes = [
      `text="${escapeXml(feedTitle)}"`,
      `title="${escapeXml(feedTitle)}"`,
      'type="rss"',
      `xmlUrl="${escapeXml(xmlUrl)}"`,
      `htmlUrl="${escapeXml(htmlUrl)}"`,
    ];

    if (categories.length > 0) {
      attributes.push(`category="${escapeXml(categories.join(","))}"`);
    }

    lines.push(`    <outline ${attributes.join(" ")} />`);
  }

  lines.push("  </body>");
  lines.push("</opml>");
  return lines.join("\n");
}

function buildFilteredTitle(feedCount: number): string {
  return feedCount === 1
    ? "AI Web Feeds - Filtered (1 feed)"
    : `AI Web Feeds - Filtered (${feedCount} feeds)`;
}

function parseBooleanQuery(value: string | null): boolean | null {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&apos;");
}
