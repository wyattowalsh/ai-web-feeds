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

export function normalizeTopicValues(values?: string[] | string | null): string[] {
  if (Array.isArray(values)) {
    return values.filter((value) => value.trim().length > 0);
  }

  if (typeof values === "string") {
    return values
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return [];
}