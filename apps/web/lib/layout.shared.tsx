import Image from "next/image";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

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
        <span className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl border border-(--line) bg-(--surface) p-2 shadow-(--surface-shadow-soft)">
            <Image src="/icon.svg" alt="AI Web Feeds" width={24} height={24} priority />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-(--ink-muted)">
              AI Web Feeds
            </span>
            <span className="font-serif text-lg font-semibold text-(--ink)">
              Feed intelligence for agents
            </span>
          </span>
        </span>
      ),
    },
    // see https://fumadocs.dev/docs/ui/navigation/links
    links: [
      {
        text: "Search",
        url: "/search",
      },
      {
        text: "Reader",
        url: "/reader",
      },
      {
        text: "Explorer",
        url: "/explorer",
      },
      {
        text: "Analytics",
        url: "/analytics",
      },
      {
        text: "Downloads",
        url: "/downloads",
      },
      {
        text: "Docs",
        url: "/docs",
      },
      {
        text: "Blog",
        url: "/blog",
      },
      {
        text: "GitHub",
        url: "https://github.com/wyattowalsh/ai-web-feeds",
        external: true,
      },
    ],
  };
}
