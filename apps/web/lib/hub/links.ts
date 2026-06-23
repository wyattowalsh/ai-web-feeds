import type { LinkItemType } from "fumadocs-ui/layouts/shared";

import { CANONICAL_CATALOG_PATH, CANONICAL_READER_PATH } from "@/lib/reader-routes";
import type { HubNavItem } from "./types";

export const HUB_ROUTES = {
  home: "/",
  reader: CANONICAL_READER_PATH,
  sources: CANONICAL_CATALOG_PATH,
  topics: "/topics",
  explorer: "/explorer",
  dashboard: "/dashboard",
  search: "/search",
  forYou: "/for-you",
  blog: "/blog",
  docs: "/docs",
} as const;

export const EXTERNAL_HUB_LINKS: HubNavItem[] = [
  {
    label: "GitHub",
    href: "https://github.com/wyattowalsh/ai-web-feeds",
    external: true,
    description: "Source repository",
  },
];

export const PRIMARY_HUB_NAV: HubNavItem[] = [
  { label: "Home", href: HUB_ROUTES.home, description: "Hub landing" },
  { label: "Reader", href: HUB_ROUTES.reader, description: "Focused article stream" },
  { label: "Search", href: HUB_ROUTES.search, description: "Search corpus and live posts" },
  { label: "For You", href: HUB_ROUTES.forYou, description: "Recommendations and digests" },
  { label: "Sources", href: HUB_ROUTES.sources, description: "Browse feed catalog" },
  { label: "Topics", href: HUB_ROUTES.topics, description: "Topic taxonomy" },
  { label: "Explorer", href: HUB_ROUTES.explorer, description: "Interactive topic graph" },
  { label: "Blog", href: HUB_ROUTES.blog, description: "Product updates" },
  { label: "Dashboard", href: HUB_ROUTES.dashboard, description: "Corpus health" },
  { label: "Docs", href: HUB_ROUTES.docs, description: "Guides and API" },
];

/** Map nav labels to explicit active modes per FX-01 spec. */
function activeFor(label: string): "url" | "nested-url" | undefined {
  if (label === "Home") return "url";
  // Reader/Docs/Topics/Blog/Sources/Dashboard/Search/For You use nested-url
  return "nested-url";
}

/** FumaDocs header links derived from PRIMARY_HUB_NAV (SSOT for hub nav). */
export function hubLayoutLinks(): LinkItemType[] {
  return PRIMARY_HUB_NAV.map((item) => ({
    text: item.label,
    url: item.href,
    external: item.external,
    active: activeFor(item.label),
  }));
}
