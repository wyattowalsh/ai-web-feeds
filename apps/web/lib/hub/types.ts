export type HubPageVariant = "default" | "compact" | "immersive";

export type HubNavItem = {
  id?: string;
  label: string;
  href: string;
  external?: boolean;
  description?: string;
};

export type HubTeaserArticle = {
  id: string;
  title: string;
  href: string;
  summary?: string | null;
  sourceName?: string;
  publishedAt?: string | null;
  topics?: string[];
  readerHref?: string;
};

export type HubSourceSummary = {
  id: string;
  title: string;
  href: string;
  sourceType?: string;
  verified?: boolean;
  topicCount?: number;
  description?: string | null;
};

export type HubTopicSummary = {
  id: string;
  label: string;
  href: string;
  articleCount?: number;
  description?: string | null;
};
