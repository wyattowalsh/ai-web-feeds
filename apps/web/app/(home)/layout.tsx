import type { ReactNode } from "react";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { HubProviders, SiteFooter } from "@/components/hub";
import { baseOptions } from "@/lib/layout.shared";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HubProviders>
      <HomeLayout {...baseOptions()}>
        {children}
        <SiteFooter />
      </HomeLayout>
    </HubProviders>
  );
}
