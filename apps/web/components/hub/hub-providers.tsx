"use client";

import type { ReactNode } from "react";
import { CommandPalette } from "@/components/hub/command-palette";
import { ToastProvider } from "@/components/utility/toast";
import { ServiceWorkerRegister } from "@/components/utility/service-worker-register";

type HubProvidersProps = {
  children: ReactNode;
};

export function HubProviders({ children }: HubProvidersProps) {
  return (
    <ToastProvider>
      {children}
      <CommandPalette />
      <ServiceWorkerRegister />
    </ToastProvider>
  );
}
