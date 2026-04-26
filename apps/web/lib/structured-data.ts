import { absoluteUrl, SITE_AUTHOR, SITE_AUTHOR_URL, SITE_NAME, SITE_URL } from "@/lib/seo";

export type JsonLdObject = Record<string, unknown>;

export type BreadcrumbItem = {
  name: string;
  url: string;
};

export type ListItem = {
  name: string;
  url: string;
  description?: string | null;
};

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    founder: {
      "@type": "Person",
      name: SITE_AUTHOR,
      url: SITE_AUTHOR_URL,
    },
    sameAs: [SITE_AUTHOR_URL, "https://github.com/wyattowalsh/ai-web-feeds"],
  };
}

export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/reader")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbsJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function itemListJsonLd(items: ListItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(item.url),
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
    })),
  };
}

export function collectionPageJsonLd({
  name,
  description,
  url,
  items,
}: {
  name: string;
  description: string;
  url: string;
  items: ListItem[];
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: absoluteUrl(url),
    mainEntity: itemListJsonLd(items),
  };
}

export function articleJsonLd({
  title,
  description,
  url,
  originalUrl,
  publishedAt,
  author,
  sourceName,
}: {
  title: string;
  description: string;
  url: string;
  originalUrl: string;
  publishedAt: string | null;
  author: string | null;
  sourceName: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: absoluteUrl(url),
    isBasedOn: originalUrl,
    mainEntityOfPage: originalUrl,
    ...(publishedAt ? { datePublished: publishedAt } : {}),
    author: {
      "@type": author ? "Person" : "Organization",
      name: author ?? sourceName,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function dataFeedJsonLd({
  name,
  description,
  url,
  sourceUrl,
}: {
  name: string;
  description: string;
  url: string;
  sourceUrl: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "DataFeed",
    name,
    description,
    url: absoluteUrl(url),
    encodingFormat: "RSS, Atom, JSON Feed",
    isBasedOn: sourceUrl,
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}
