import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import {
  filterBySourceType,
  filterByVerified,
  loadFeedCatalog,
  type FeedSource,
} from "@/lib/feeds";
import { withRouteTelemetry } from "@/lib/telemetry-route";

export const dynamic = "force-dynamic";
const OPML_ROOT_FOLDER = "aiwebfeeds";

/**
 * OPML export API endpoint
 * Returns OPML files for feed reader import
 */
const GETHandler = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "all"; // all, categorized, filtered
  const sourceType = searchParams.get("type");
  const topics = parseTopicFilters(searchParams);
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
      opmlPath = join(dataDir, "feeds.categorized.opml");
      filename = "ai-ml-feeds-categorized.opml";
    } else if (
      format === "filtered" &&
      (explicitFeedIds.length > 0 || sourceType || topics.length > 0 || verified !== null)
    ) {
      const filteredFeeds = resolveFilteredFeeds({
        explicitFeedIds,
        sourceType,
        topics,
        verified,
      });
      const opmlContent = wrapOpmlDocument(
        generateOpml(filteredFeeds, buildFilteredTitle(filteredFeeds.length)),
      );

      return new NextResponse(opmlContent, {
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": 'attachment; filename="ai-ml-feeds-filtered.opml"',
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      });
    } else {
      opmlPath = join(dataDir, "feeds.opml");
      filename = "ai-ml-feeds-all.opml";
    }

    // Read OPML file
    const opmlContent = wrapOpmlDocument(readFileSync(opmlPath, "utf-8"));

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
  topics,
  verified,
}: {
  explicitFeedIds: string[];
  sourceType: string | null;
  topics: string[];
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
  filtered = filterByTopics(filtered, topics);
  filtered = filterByVerified(filtered, verified);

  return filtered;
}

function parseTopicFilters(searchParams: URLSearchParams): string[] {
  const topics = new Set<string>();
  for (const value of searchParams.getAll("topics")) {
    for (const topic of value.split(",")) {
      const normalized = topic.trim().toLowerCase();
      if (normalized) {
        topics.add(normalized);
      }
    }
  }

  return Array.from(topics);
}

function filterByTopics(feeds: FeedSource[], topics: string[]): FeedSource[] {
  if (topics.length === 0) {
    return feeds;
  }

  return feeds.filter((feed) => {
    const feedTopics = new Set(
      [...(feed.topics ?? []), ...(feed.tags ?? [])].map((topic) => topic.toLowerCase()),
    );
    return topics.every((topic) => feedTopics.has(topic));
  });
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
    `    <outline text="${OPML_ROOT_FOLDER}" title="${OPML_ROOT_FOLDER}">`,
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

    lines.push(`      <outline ${attributes.join(" ")} />`);
  }

  lines.push("    </outline>");
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

function wrapOpmlDocument(opmlContent: string): string {
  const lines = opmlContent.split("\n");
  const bodyStartIndex = lines.findIndex((line) => line.trim() === "<body>");
  const bodyEndIndex = lines.findIndex((line) => line.trim() === "</body>");

  if (bodyStartIndex === -1 || bodyEndIndex === -1 || bodyEndIndex <= bodyStartIndex) {
    return opmlContent;
  }

  const innerLines = lines.slice(bodyStartIndex + 1, bodyEndIndex);
  const firstMeaningfulLine = innerLines.find((line) => line.trim().length > 0);

  if (
    firstMeaningfulLine?.includes(`text="${OPML_ROOT_FOLDER}"`) &&
    firstMeaningfulLine?.includes(`title="${OPML_ROOT_FOLDER}"`)
  ) {
    return opmlContent;
  }

  const bodyIndent = lines[bodyStartIndex].match(/^\s*/)?.[0] ?? "";
  const wrappedInnerLines = innerLines.map((line) => (line.length > 0 ? `  ${line}` : line));

  return [
    ...lines.slice(0, bodyStartIndex + 1),
    `${bodyIndent}  <outline text="${OPML_ROOT_FOLDER}" title="${OPML_ROOT_FOLDER}">`,
    ...wrappedInnerLines,
    `${bodyIndent}  </outline>`,
    ...lines.slice(bodyEndIndex),
  ].join("\n");
}
