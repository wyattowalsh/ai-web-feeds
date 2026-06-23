import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { SearchToggle } from "fumadocs-ui/components/layout/search-toggle";
import { HubProviders, SiteFooter } from "@/components/hub";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  const shared = baseOptions();

  return (
    <HubProviders>
      <DocsLayout
        tree={source.pageTree}
        {...shared}
        searchToggle={{
          ...shared.searchToggle,
          components: {
            ...shared.searchToggle?.components,
            // Docs mobile subnav is a <header>, not a list — avoid orphan <li> (axe listitem).
            sm: (
              <div className="flex items-center">
                <SearchToggle className="p-2" hideIfDisabled />
              </div>
            ),
          },
        }}
        sidebar={{ enabled: true, collapsible: true }}
      >
        {children}
        <SiteFooter />
      </DocsLayout>
    </HubProviders>
  );
}
