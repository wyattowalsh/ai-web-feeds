export type TopicRelationMap = Record<string, string[]>;

export interface TopicRecord {
  id: string;
  label: string;
  facet?: string;
  facet_group?: string;
  description?: string | null;
  aliases?: string[];
  parents?: string[];
  relations?: TopicRelationMap;
  rank_hint?: number;
}

export interface CatalogFeed {
  id?: string;
  url: string;
  feed?: string;
  title?: string | null;
  notes?: string | null;
  description?: string | null;
  topics?: string[] | string;
  tags?: string[] | string;
  source_type?: string;
  verified?: boolean;
}

export interface CombinedCatalogGraphData {
  topics: TopicRecord[];
  feeds: CatalogFeed[];
}

export function normalizeFilterToken(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export function normalizeTopicValues(values?: string[] | string | null): string[] {
  const normalizedValues = (
    Array.isArray(values) ? values : typeof values === "string" ? values.split(",") : []
  )
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const dedupedValues = new Map<string, string>();

  for (const value of normalizedValues) {
    const lookupKey = value.toLowerCase();
    if (!dedupedValues.has(lookupKey)) {
      dedupedValues.set(lookupKey, value);
    }
  }

  return Array.from(dedupedValues.values());
}
