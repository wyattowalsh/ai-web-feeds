import { readFileSync } from "fs";
import { join } from "path";
import { XMLParser } from "fast-xml-parser";

import type { FeedSource } from "@/lib/feeds";

export interface OpmlPreviewFeed {
  id: string;
  lookupKey: string | null;
  title: string;
  url: string | null;
  websiteUrl: string | null;
  sourceType: string | null;
  description: string | null;
  topics: string[];
  verified: boolean;
  matchedCatalogFeed: boolean;
}

export interface OpmlPreviewGroup {
  id: string;
  title: string;
  feeds: OpmlPreviewFeed[];
}

export interface OpmlPreviewCollection {
  id: "flat" | "categorized";
  title: string;
  description: string;
  totalOutlines: number;
  namedOutlines: number;
  unnamedOutlines: number;
  matchedCatalogFeeds: number;
  groups: OpmlPreviewGroup[];
  rawSample: string;
}

export interface OpmlPreviewData {
  flat: OpmlPreviewCollection;
  categorized: OpmlPreviewCollection;
}

interface OutlineRecord {
  title: string;
}

interface GroupRecord {
  title: string;
  outlines: OutlineRecord[];
}

interface OutlineNode {
  "@_text"?: string;
  "@_title"?: string;
  "@_type"?: string;
  outline?: OutlineNode | OutlineNode[];
  [key: string]: unknown;
}

interface OpmlDocument {
  opml?: {
    body?: {
      outline?: OutlineNode | OutlineNode[];
    };
  };
}

const opmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

export function loadOpmlPreviewData(feeds: FeedSource[]): OpmlPreviewData {
  const dataDir = join(process.cwd(), "../../data");
  const allOpml = readFileSync(join(dataDir, "all.opml"), "utf-8");
  const categorizedOpml = readFileSync(join(dataDir, "categorized.opml"), "utf-8");

  const flatOutlines = parseFlatOutlines(allOpml);
  const categorizedGroups = parseCategorizedGroups(categorizedOpml);
  const feedIndex = buildFeedIndex(feeds);

  return {
    flat: buildCollection({
      id: "flat",
      title: "All Feeds OPML",
      description: "Flat OPML export for RSS readers that prefer a single subscription list.",
      groups: [
        {
          title: "All Feeds",
          outlines: flatOutlines,
        },
      ],
      rawSample: getRawSample(allOpml),
      feedIndex,
    }),
    categorized: buildCollection({
      id: "categorized",
      title: "Categorized OPML",
      description:
        "Foldered OPML export grouped by the repository taxonomy so readers can import topic buckets.",
      groups: categorizedGroups,
      rawSample: getRawSample(categorizedOpml),
      feedIndex,
    }),
  };
}

function buildCollection({
  id,
  title,
  description,
  groups,
  rawSample,
  feedIndex,
}: {
  id: "flat" | "categorized";
  title: string;
  description: string;
  groups: GroupRecord[];
  rawSample: string;
  feedIndex: Map<string, FeedSource>;
}): OpmlPreviewCollection {
  let totalOutlines = 0;
  let namedOutlines = 0;
  let matchedCatalogFeeds = 0;

  const previewGroups = groups
    .map((group) => {
      const previewFeeds = group.outlines
        .map((outline, index) => {
          totalOutlines += 1;
          if (outline.title.length > 0) {
            namedOutlines += 1;
          }

          const catalogFeed = feedIndex.get(normalizeKey(outline.title));
          if (catalogFeed) {
            matchedCatalogFeeds += 1;
          }

          return buildPreviewFeed(outline.title, catalogFeed, `${group.title}-${index}`);
        })
        .filter((feed) => feed.title !== "Untitled OPML entry");

      return {
        id: slugify(group.title),
        title: group.title,
        feeds: previewFeeds,
      };
    })
    .filter((group) => group.feeds.length > 0);

  return {
    id,
    title,
    description,
    totalOutlines,
    namedOutlines,
    unnamedOutlines: totalOutlines - namedOutlines,
    matchedCatalogFeeds,
    groups: previewGroups,
    rawSample,
  };
}

function parseFlatOutlines(opmlContent: string): OutlineRecord[] {
  return collectFeedOutlines(parseOutlineTree(opmlContent));
}

function parseCategorizedGroups(opmlContent: string): GroupRecord[] {
  const rootOutlines = parseOutlineTree(opmlContent);
  const folders = rootOutlines.filter((outline) => !isFeedOutline(outline));

  if (folders.length === 0) {
    const flatFeeds = collectFeedOutlines(rootOutlines);
    if (flatFeeds.length === 0) {
      return [];
    }

    return [
      {
        title: "All Feeds",
        outlines: flatFeeds,
      },
    ];
  }

  return folders
    .map((outline) => {
      const title = readOutlineTitle(outline) || "Untitled Folder";
      const outlines = collectFeedOutlines(normalizeOutlineList(outline.outline));
      return {
        title,
        outlines,
      };
    })
    .filter((group) => group.outlines.length > 0);
}

function buildPreviewFeed(
  outlineTitle: string,
  catalogFeed: FeedSource | undefined,
  fallbackId: string,
): OpmlPreviewFeed {
  const title = outlineTitle.trim() || "Untitled OPML entry";
  const lookupKey = normalizeKey(title);

  return {
    id: catalogFeed?.id || fallbackId,
    lookupKey: catalogFeed?.id || lookupKey || null,
    title,
    url: catalogFeed?.url || null,
    websiteUrl: catalogFeed?.website_url || null,
    sourceType: catalogFeed?.source_type || null,
    description: catalogFeed?.description || null,
    topics: catalogFeed?.topics || [],
    verified: catalogFeed?.verified === true,
    matchedCatalogFeed: Boolean(catalogFeed),
  };
}

function buildFeedIndex(feeds: FeedSource[]): Map<string, FeedSource> {
  const index = new Map<string, FeedSource>();

  for (const feed of feeds) {
    const titleKey = normalizeKey(feed.title || "");
    if (titleKey.length > 0 && !index.has(titleKey)) {
      index.set(titleKey, feed);
    }
  }

  return index;
}

function parseOutlineTree(opmlContent: string): OutlineNode[] {
  const parsed = opmlParser.parse(opmlContent) as OpmlDocument;
  const outlines = normalizeOutlineList(parsed.opml?.body?.outline);

  if (
    outlines.length === 1 &&
    isRootWrapper(outlines[0]) &&
    normalizeKey(readOutlineTitle(outlines[0])) === "aiwebfeeds"
  ) {
    return normalizeOutlineList(outlines[0].outline);
  }

  return outlines;
}

function collectFeedOutlines(outlines: OutlineNode[]): OutlineRecord[] {
  const collected: OutlineRecord[] = [];

  for (const outline of outlines) {
    if (isFeedOutline(outline)) {
      collected.push({ title: readOutlineTitle(outline) });
      continue;
    }

    collected.push(...collectFeedOutlines(normalizeOutlineList(outline.outline)));
  }

  return collected;
}

function normalizeOutlineList(outline: OutlineNode | OutlineNode[] | undefined): OutlineNode[] {
  if (!outline) {
    return [];
  }

  return Array.isArray(outline) ? outline : [outline];
}

function isFeedOutline(outline: OutlineNode): boolean {
  return readAttribute(outline, "type") === "rss";
}

function isRootWrapper(outline: OutlineNode): boolean {
  return normalizeOutlineList(outline.outline).length > 0;
}

function readOutlineTitle(outline: OutlineNode): string {
  return readAttribute(outline, "title") || readAttribute(outline, "text") || "";
}

function readAttribute(outline: OutlineNode, attribute: "title" | "text" | "type"): string {
  const value = outline[`@_${attribute}`];
  if (typeof value !== "string") {
    return "";
  }

  return decodeEntities(value).trim();
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function getRawSample(opmlContent: string): string {
  return opmlContent.split("\n").slice(0, 18).join("\n");
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
