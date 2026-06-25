"use client";

import type { ReactNode } from "react";
import { CommandPalette } from "@/components/hub/command-palette";
import { HubThemeSync } from "@/components/hub/hub-theme-sync";
import { StorageBanner } from "@/components/offline/storage-banner";
import { SwStatusBanner } from "@/components/offline/sw-status-banner";
import { AccountSessionBootstrap } from "@/components/auth/account-session-bootstrap";
import { ToastProvider } from "@/components/utility/toast";
import { IndexedDbProvider } from "@/components/providers/indexeddb-provider";
import { ServiceWorkerRegister } from "@/components/utility/service-worker-register";

type HubProvidersProps = {
  children: ReactNode;
};

export function HubProviders({ children }: HubProvidersProps) {
  return (
    <ToastProvider>
      <AccountSessionBootstrap />
      <IndexedDbProvider>
        <HubThemeSync />
        {children}
        {/* Global storage quota banner (self-hides below 70%). Placed after children
            so it can be easily overridden by page-level banners if needed. */}
        <div className="fixed inset-x-0 bottom-14 z-[55] mx-auto w-full max-w-3xl space-y-2 px-3 sm:bottom-4">
          <SwStatusBanner />
          <StorageBanner className="rounded-lg shadow-lg" />
        </div>
        <CommandPalette />
        <ServiceWorkerRegister />
      </IndexedDbProvider>
    </ToastProvider>
  );
}
