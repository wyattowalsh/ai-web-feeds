"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

export function SwStatusBanner() {
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setDegraded(true);
      return;
    }

    void navigator.serviceWorker.getRegistration().then((registration) => {
      setDegraded(!registration);
    });
  }, []);

  if (!degraded) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-(--ink)"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <p>
        Offline enhancements are limited because the service worker is unavailable. Cached search
        and background sync may not run until you reload on a supported browser.
      </p>
    </div>
  );
}
