"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegister
 *
 * Registers the app's service worker (public/sw.js) on mount.
 * Safe to include in any client component tree; it is a no-op on the server
 * and when the browser does not support service workers.
 *
 * Usage:
 *   <ServiceWorkerRegister />
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Optional: listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New content available; could surface a toast in consuming UI
              // For now, log only to keep this utility side-effect free.
              // Consumers can listen to 'controllerchange' or postMessage to SW.
              // console.info("[SW] New content available. Reload to update.");
            }
          });
        });

        // If the page was loaded when there was a waiting worker, allow immediate activation
        if (registration.waiting) {
          // Proactively activate without forcing reload here.
          // Apps can call registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch (err) {
        // Registration failures are non-fatal (e.g., offline, unsupported, or blocked)
        if (process.env.NODE_ENV !== "production") {
          console.warn("[SW] Service worker registration failed:", err);
        }
      }
    };

    // Defer slightly to avoid competing with critical path work
    const id = window.setTimeout(register, 0);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}

export default ServiceWorkerRegister;

/**
 * Request a background sync for offline operations.
 * Safe no-op when unsupported or not registered.
 *
 * Call this after queuing offline changes (read/star/save) to schedule
 * reconciliation via the Service Worker's sync event.
 */
export async function requestOfflineSync(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    // Background Sync API
    if ("sync" in reg) {
      // @ts-expect-error - Background Sync is not in all TS lib targets
      await reg.sync.register("offline-sync");
      return true;
    }
    // Fallback: ask active SW to process immediately if present
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "PROCESS_OFFLINE_SYNC" });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Post a message to the active Service Worker (if any).
 */
export function postToServiceWorker(message: unknown): void {
  if (typeof window === "undefined") return;
  if (!navigator.serviceWorker?.controller) return;
  try {
    navigator.serviceWorker.controller.postMessage(message);
  } catch {
    // ignore
  }
}
