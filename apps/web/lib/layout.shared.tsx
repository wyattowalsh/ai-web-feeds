import Image from "next/image";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { SearchToggle } from "fumadocs-ui/components/layout/search-toggle";

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-card p-1.5 shadow-sm">
            <Image src="/icon.svg" alt="AI Web Feeds" width={22} height={22} priority />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              AI Web Feeds
            </span>
            <span className="text-sm font-semibold text-foreground">Open web AI reader</span>
          </span>
        </span>
      ),
    },
    searchToggle: {
      components: {
        sm: (
          <li>
            <SearchToggle className="p-2" hideIfDisabled />
          </li>
        ),
      },
    },
    // see https://fumadocs.dev/docs/ui/navigation/links
    links: [
      {
        text: "Reader",
        url: "/reader",
      },
      {
        text: "Search",
        url: "/search",
      },
      {
        text: "For You",
        url: "/for-you",
      },
      {
        text: "Sources",
        url: "/sources",
      },
      {
        text: "Topics",
        url: "/topics",
      },
      {
        text: "Blog",
        url: "/blog",
      },
      {
        text: "Dashboard",
        url: "/dashboard",
      },
      {
        text: "Docs",
        url: "/docs",
      },
      {
        text: "GitHub",
        url: "https://github.com/wyattowalsh/ai-web-feeds",
        external: true,
      },
    ],
  };
}
