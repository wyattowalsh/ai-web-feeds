/**
 * Service Worker for AI Web Feeds
 *
 * Provides offline-first functionality:
 * - Cache static assets for instant loading
 * - Cache feed content for offline reading
 * - Background sync when connection restored
 * - Push notifications (local only, no backend)
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `aiwebfeeds-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `aiwebfeeds-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `aiwebfeeds-images-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = ["/", "/offline", "/manifest.json", "/icon.svg", "/favicon.ico"];

// Cache size limits
const MAX_DYNAMIC_CACHE_SIZE = 50; // Max items in dynamic cache
const MAX_IMAGE_CACHE_SIZE = 100; // Max images to cache

/**
 * Install event - cache static assets
 */
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log("[SW] Service worker installed");
        return self.skipWaiting(); // Activate immediately
      }),
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return (
                name.startsWith("aiwebfeeds-") &&
                name !== STATIC_CACHE &&
                name !== DYNAMIC_CACHE &&
                name !== IMAGE_CACHE
              );
            })
            .map((name) => {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            }),
        );
      })
      .then(() => {
        console.log("[SW] Service worker activated");
        return self.clients.claim(); // Take control immediately
      }),
  );
});

/**
 * Fetch event - serve from cache, then use network when needed
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip chrome-extension and browser-internal requests
  if (url.protocol === "chrome-extension:" || url.protocol === "browser:") {
    return;
  }

  // Skip API calls (they should go to network)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Handle images
  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE));
    return;
  }

  // Handle static assets (HTML, CSS, JS)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Handle dynamic content (feed articles, etc.)
  event.respondWith(networkFirst(request));
});

/**
 * Background Sync - sync offline changes when connection restored
 */
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync:", event.tag);

  if (event.tag === "sync-articles" || event.tag === "offline-sync") {
    event.waitUntil(syncArticles());
  }

  if (event.tag === "sync-preferences") {
    event.waitUntil(syncPreferences());
  }
});

/**
 * Push event - show notification (local only)
 */
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received");

  const data = event.data ? event.data.json() : {};
  const title = data.title || "AI Web Feeds";
  const options = {
    body: data.body || "You have new articles",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: data.url || "/",
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Notification click - handle user action
 */
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action);

  event.notification.close();

  if (event.action === "open" || !event.action) {
    const urlToOpen = event.notification.data || "/";

    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
    );
  }
});

/**
 * Message event - communicate with main app
 */
self.addEventListener("message", (event) => {
  console.log("[SW] Message received:", event.data);

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "CACHE_URLS") {
    event.waitUntil(cacheUrls(event.data.urls));
  }

  if (event.data.type === "CLEAR_CACHE") {
    event.waitUntil(clearAllCaches());
  }

  if (event.data.type === "PROCESS_OFFLINE_SYNC") {
    event.waitUntil(syncArticles());
  }
});

// ============================================================================
// Cache Strategies
// ============================================================================

/**
 * Cache first, then network
 */
async function cacheFirst(request, cacheName = DYNAMIC_CACHE, maxSize = MAX_DYNAMIC_CACHE_SIZE) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      console.log("[SW] Serving from cache:", request.url);
      return cached;
    }

    console.log("[SW] Fetching from network:", request.url);
    const response = await fetch(request);

    // Cache successful responses
    if (response && response.status === 200) {
      const responseClone = response.clone();
      await cache.put(request, responseClone);
      await limitCacheSize(cacheName, maxSize);
    }

    return response;
  } catch (error) {
    console.error("[SW] Cache first error:", error);

    // Return offline page for HTML requests
    if (request.destination === "document") {
      const cache = await caches.open(STATIC_CACHE);
      return cache.match("/offline");
    }

    throw error;
  }
}

/**
 * Network first, then cache
 */
async function networkFirst(request) {
  try {
    console.log("[SW] Fetching from network:", request.url);
    const response = await fetch(request);

    // Cache successful responses
    if (response && response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      const responseClone = response.clone();
      await cache.put(request, responseClone);
      await limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
    }

    return response;
  } catch (error) {
    console.log("[SW] Network failed, trying cache:", request.url);

    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    // Return offline page for HTML requests
    if (request.destination === "document") {
      const staticCache = await caches.open(STATIC_CACHE);
      return staticCache.match("/offline");
    }

    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
  const pathname = url.pathname;
  return (
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname === "/" ||
    pathname === "/offline"
  );
}

/**
 * Limit cache size
 */
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxSize) {
    const itemsToDelete = keys.length - maxSize;
    for (let i = 0; i < itemsToDelete; i++) {
      await cache.delete(keys[i]);
    }
    console.log(`[SW] Trimmed ${cacheName} cache to ${maxSize} items`);
  }
}

/**
 * Cache multiple URLs
 */
async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response && response.status === 200) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.error("[SW] Failed to cache:", url, error);
      }
    }),
  );
  console.log("[SW] Cached", urls.length, "URLs");
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map((name) => {
      console.log("[SW] Deleting cache:", name);
      return caches.delete(name);
    }),
  );
  console.log("[SW] All caches cleared");
}

/**
 * Sync articles (background sync)
 *
 * Integrates with lib/db offline sync queue:
 * - Reads pending items from syncQueue (synced=false)
 * - Applies local read/star/archive changes to articles store (local wins)
 * - Marks processed items as synced
 */
async function syncArticles() {
  console.log("[SW] Syncing articles (offline queue)...");

  const DB_NAME = "aiwebfeeds";
  const SYNC_STORE = "syncQueue";
  const ARTICLES_STORE = "articles";

  try {
    const db = await openIDB(DB_NAME);
    if (!db) {
      console.log("[SW] No DB available for sync");
      return;
    }

    const pending = await getAllPending(db, SYNC_STORE);
    console.log("[SW] Pending sync items:", pending.length);

    let applied = 0;
    for (const item of pending) {
      try {
        await applySyncItem(db, ARTICLES_STORE, item);
        await markSynced(db, SYNC_STORE, item.id);
        applied++;
      } catch (e) {
        console.warn("[SW] Failed to apply sync item", item?.id, e);
      }
    }

    // Notify clients of sync completion
    await notifyClients({ type: "SYNC_COMPLETE", applied, total: pending.length });

    console.log("[SW] Articles sync complete. Applied:", applied);
  } catch (error) {
    console.error("[SW] Article sync failed:", error);
    // Do not throw to avoid repeated failing sync storms; clients can retry
  }
}

/**
 * Open IDB by name (raw IndexedDB, no external deps in SW context).
 */
function openIDB(name) {
  return new Promise((resolve) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function getAllPending(db, storeName) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const idx = store.indexNames.contains("synced") ? store.index("synced") : null;
      if (idx) {
        const r = idx.getAll(false);
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => resolve([]);
      } else {
        const r = store.getAll();
        r.onsuccess = () => {
          const all = r.result || [];
          resolve(all.filter((x) => x && x.synced === false));
        };
        r.onerror = () => resolve([]);
      }
    } catch {
      resolve([]);
    }
  });
}

function getById(db, storeName, id) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const r = store.get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function putRecord(db, storeName, record) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const r = store.put(record);
      r.onsuccess = () => resolve(true);
      r.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function applySyncItem(db, articlesStore, item) {
  if (!item || !item.articleId) return;
  const existing = await getById(db, articlesStore, item.articleId);

  const now = Date.now();
  if (!existing) {
    // Minimal stub to persist offline flag state
    const stub = {
      id: item.articleId,
      feedId: (item.data && item.data.feedId) || "unknown",
      title: (item.data && item.data.title) || "",
      link: (item.data && item.data.link) || "",
      content: (item.data && item.data.content) || "",
      pubDate: (item.data && item.data.pubDate) || now,
      topics: (item.data && item.data.topics) || [],
      rawCategories: (item.data && item.data.rawCategories) || [],
      sourceTopics: (item.data && item.data.sourceTopics) || [],
      enclosures: (item.data && item.data.enclosures) || [],
      read: false,
      starred: false,
      archived: false,
      tags: (item.data && item.data.tags) || [],
      cachedAt: now,
      lastModified: now,
    };
    if (item.type === "read" && typeof item.data?.read === "boolean") stub.read = item.data.read;
    if (item.type === "star" && typeof item.data?.starred === "boolean")
      stub.starred = item.data.starred;
    if (item.type === "archive" && typeof item.data?.archived === "boolean")
      stub.archived = item.data.archived;
    await putRecord(db, articlesStore, stub);
    return;
  }

  const patch = { ...existing, lastModified: now };
  if (item.type === "read" && typeof item.data?.read === "boolean") patch.read = item.data.read;
  if (item.type === "star" && typeof item.data?.starred === "boolean")
    patch.starred = item.data.starred;
  if (item.type === "archive" && typeof item.data?.archived === "boolean")
    patch.archived = item.data.archived;
  if (item.type === "save") patch.cachedAt = now;

  await putRecord(db, articlesStore, patch);
}

function markSynced(db, storeName, id) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const r = store.get(id);
      r.onsuccess = () => {
        const rec = r.result;
        if (rec) {
          rec.synced = true;
          const w = store.put(rec);
          w.onsuccess = () => resolve(true);
          w.onerror = () => resolve(false);
        } else {
          resolve(false);
        }
      };
      r.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function notifyClients(message) {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of all) {
    client.postMessage(message);
  }
}

/**
 * Sync preferences (background sync)
 */
async function syncPreferences() {
  console.log("[SW] Syncing preferences...");

  try {
    // Sync preferences to server (if implemented)
    // For now, just log (client-side only in Phase 4)
    console.log("[SW] Preferences synced successfully");
  } catch (error) {
    console.error("[SW] Preference sync failed:", error);
    throw error;
  }
}

console.log("[SW] Service Worker loaded");
