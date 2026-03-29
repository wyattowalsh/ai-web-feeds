import { readFileSync } from 'fs';
import { join } from 'path';

import type { FeedSource } from '@/lib/feeds';

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
  id: 'flat' | 'categorized';
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

export function loadOpmlPreviewData(feeds: FeedSource[]): OpmlPreviewData {
  const dataDir = join(process.cwd(), '../../data');
  const allOpml = readFileSync(join(dataDir, 'all.opml'), 'utf-8');
  const categorizedOpml = readFileSync(join(dataDir, 'categorized.opml'), 'utf-8');

  const flatOutlines = parseFlatOutlines(allOpml);
  const categorizedGroups = parseCategorizedGroups(categorizedOpml);
  const feedIndex = buildFeedIndex(feeds);

  return {
    flat: buildCollection({
      id: 'flat',
      title: 'All Feeds OPML',
      description: 'Flat OPML export for RSS readers that prefer a single subscription list.',
      groups: [
        {
          title: 'All Feeds',
          outlines: flatOutlines,
        },
      ],
      rawSample: getRawSample(allOpml),
      feedIndex,
    }),
    categorized: buildCollection({
      id: 'categorized',
      title: 'Categorized OPML',
      description: 'Foldered OPML export grouped by the repository taxonomy so readers can import topic buckets.',
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
  id: 'flat' | 'categorized';
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
      const previewFeeds = group.outlines.map((outline, index) => {
        totalOutlines += 1;
        if (outline.title.length > 0) {
          namedOutlines += 1;
        }

        const catalogFeed = feedIndex.get(normalizeKey(outline.title));
        if (catalogFeed) {
          matchedCatalogFeeds += 1;
        }

        return buildPreviewFeed(outline.title, catalogFeed, `${group.title}-${index}`);
      }).filter((feed) => feed.title !== 'Untitled OPML entry');

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

function buildPreviewFeed(
  outlineTitle: string,
  catalogFeed: FeedSource | undefined,
  fallbackId: string,
): OpmlPreviewFeed {
  const title = outlineTitle.trim() || 'Untitled OPML entry';
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
    const titleKey = normalizeKey(feed.title || '');
    if (titleKey.length > 0 && !index.has(titleKey)) {
      index.set(titleKey, feed);
    }
  }

  return index;
}

function parseFlatOutlines(opmlContent: string): OutlineRecord[] {
  return opmlContent
    .split('\n')
    .filter((line) => line.includes('<outline') && line.includes('type="rss"'))
    .map((line) => ({ title: readOutlineTitle(line) }));
}

function parseCategorizedGroups(opmlContent: string): GroupRecord[] {
  const groups: GroupRecord[] = [];
  let currentGroup: GroupRecord | null = null;

  for (const line of opmlContent.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('<outline') && !trimmed.includes('type="rss"') && !trimmed.endsWith('/>')) {
      const title = readAttribute(trimmed, 'title') || readAttribute(trimmed, 'text') || 'Untitled Folder';
      currentGroup = { title, outlines: [] };
      continue;
    }

    if (trimmed.startsWith('<outline') && trimmed.includes('type="rss"')) {
      const title = readOutlineTitle(trimmed);
      if (currentGroup) {
        currentGroup.outlines.push({ title });
      }
      continue;
    }

    if (trimmed === '</outline>' && currentGroup) {
      groups.push(currentGroup);
      currentGroup = null;
    }
  }

  return groups;
}

function readOutlineTitle(line: string): string {
  return readAttribute(line, 'title') || readAttribute(line, 'text') || '';
}

function readAttribute(line: string, attribute: string): string {
  const match = line.match(new RegExp(`${attribute}="([^"]*)"`));
  return decodeEntities(match?.[1] || '').trim();
}

function decodeEntities(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function getRawSample(opmlContent: string): string {
  return opmlContent.split('\n').slice(0, 18).join('\n');
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}