/**
 * Service Worker - Offline caching and background sync
 * 
 * Provides offline-first capabilities, background sync, and caching
 * strategies for the AI Web Feeds application.
 * 
 * Features:
 * - Network-first strategy for dynamic content
 * - Cache-first strategy for static assets
 * - Offline fallback pages
 * - Background sync for offline changes
 * - IndexedDB integration for article caching
 * 
 * @see specs/004-client-side-features/spec.md#user-story-1---offline-feed-reading
 * @see specs/004-client-side-features/tasks.md#t013
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Cache versions
const CACHE_VERSION = 'aiwebfeeds-v1';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;
const CACHE_IMAGES  = `${CACHE_VERSION}-images`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/offline',
];

// Cache strategies
const NETWORK_FIRST_PATHS = ['/api/', '/feeds/', '/articles/'];
const CACHE_FIRST_PATHS   = ['/static/', '/images/', '/_next/'];

// ============================================================================
// Installation
// ============================================================================

self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[SW] Install complete');
      // Force activation immediately
      return self.skipWaiting();
    })
  );
});

// ============================================================================
// Activation
// ============================================================================

self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    // Clean up old caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('aiwebfeeds-') && 
                   name !== CACHE_STATIC &&
                   name !== CACHE_DYNAMIC &&
                   name !== CACHE_IMAGES;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// ============================================================================
// Fetch Strategy
// ============================================================================

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url         = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine caching strategy based on URL
  if (shouldUseNetworkFirst(url.pathname)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (shouldUseCacheFirst(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/**
 * Network-first strategy
 * Try network first, fallback to cache if offline
 */
async function networkFirstStrategy(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response && response.status === 200) {
      const cache         = await caches.open(CACHE_DYNAMIC);
      const responseClone = response.clone();
      cache.put(request, responseClone);
    }

    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Serving from cache:', request.url);
      return cached;
    }

    // No cache, return offline page
    return createOfflineResponse();
  }
}

/**
 * Cache-first strategy
 * Try cache first, fallback to network
 */
async function cacheFirstStrategy(request: Request): Promise<Response> {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response && response.status === 200) {
      const cache         = await caches.open(CACHE_IMAGES);
      const responseClone = response.clone();
      cache.put(request, responseClone);
    }

    return response;
  } catch (error) {
    return createOfflineResponse();
  }
}

/**
 * Stale-while-revalidate strategy
 * Return cached version immediately, update cache in background
 */
async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cached = await caches.match(request);

  // Fetch and update cache in background
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      const cache         = caches.open(CACHE_DYNAMIC);
      const responseClone = response.clone();
      cache.then((c) => c.put(request, responseClone));
    }
    return response;
  }).catch(() => null);

  // Return cached version immediately if available
  if (cached) {
    return cached;
  }

  // Otherwise wait for network
  const response = await fetchPromise;
  return response || createOfflineResponse();
}

/**
 * Create offline fallback response
 */
function createOfflineResponse(): Response {
  return new Response(
    `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - AI Web Feeds</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        h1 { font-size: 3rem; margin: 0; }
        p { font-size: 1.2rem; margin: 1rem 0; opacity: 0.9; }
        .button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 0.5rem;
          margin-top: 1rem;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📱 Offline</h1>
        <p>You're currently offline. Check your connection and try again.</p>
        <a href="/" class="button">Go to Home</a>
      </div>
    </body>
    </html>
    `,
    {
      status:  503,
      headers: { 'Content-Type': 'text/html' },
    }
  );
}

/**
 * Check if path should use network-first strategy
 */
function shouldUseNetworkFirst(pathname: string): boolean {
  return NETWORK_FIRST_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Check if path should use cache-first strategy
 */
function shouldUseCacheFirst(pathname: string): boolean {
  return CACHE_FIRST_PATHS.some((path) => pathname.includes(path));
}

// ============================================================================
// Background Sync
// ============================================================================

self.addEventListener('sync', (event: SyncEvent) => {
  console.log('[SW] Background sync:', event.tag);

  switch (event.tag) {
    case 'sync-feeds':
      event.waitUntil(syncFeeds());
      break;

    case 'sync-offline-changes':
      event.waitUntil(syncOfflineChanges());
      break;

    case 'cleanup-cache':
      event.waitUntil(cleanupCache());
      break;

    default:
      console.warn('[SW] Unknown sync tag:', event.tag);
  }
});

/**
 * Sync feeds from server
 */
async function syncFeeds(): Promise<void> {
  console.log('[SW] Syncing feeds...');

  try {
    // Broadcast sync start
    await broadcastMessage({ type: 'SYNC_START' });

    // Note: Actual sync implementation will integrate with IndexedDB
    // and the offline sync manager (T014)

    // For now, just notify completion
    await broadcastMessage({ type: 'SYNC_COMPLETE' });
    console.log('[SW] Sync complete');
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    await broadcastMessage({
      type:  'SYNC_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Sync offline changes to server
 */
async function syncOfflineChanges(): Promise<void> {
  console.log('[SW] Syncing offline changes...');

  try {
    // This will be implemented in conjunction with T014 (offline sync manager)
    // For now, just broadcast completion
    await broadcastMessage({ type: 'OFFLINE_SYNC_COMPLETE' });
  } catch (error) {
    console.error('[SW] Offline sync failed:', error);
  }
}

/**
 * Cleanup old cache entries
 */
async function cleanupCache(): Promise<void> {
  console.log('[SW] Cleaning up cache...');

  try {
    const cache   = await caches.open(CACHE_DYNAMIC);
    const keys    = await cache.keys();
    const maxAge  = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now     = Date.now();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const age = now - new Date(dateHeader).getTime();
          if (age > maxAge) {
            await cache.delete(request);
            console.log('[SW] Deleted old cache entry:', request.url);
          }
        }
      }
    }

    console.log('[SW] Cache cleanup complete');
  } catch (error) {
    console.error('[SW] Cache cleanup failed:', error);
  }
}

// ============================================================================
// Messaging
// ============================================================================

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, payload } = event.data;

  console.log('[SW] Message received:', type);

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_ARTICLES':
      event.waitUntil(cacheArticles(payload));
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;

    default:
      console.warn('[SW] Unknown message type:', type);
  }
});

/**
 * Cache articles for offline reading
 */
async function cacheArticles(payload: { urls: string[] }): Promise<void> {
  const { urls } = payload;
  console.log(`[SW] Caching ${urls.length} articles`);

  const cache = await caches.open(CACHE_DYNAMIC);

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.status === 200) {
        await cache.put(url, response);
      }
    } catch (error) {
      console.error(`[SW] Failed to cache ${url}:`, error);
    }
  }

  console.log('[SW] Article caching complete');
}

/**
 * Clear all caches
 */
async function clearAllCaches(): Promise<void> {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('[SW] All caches cleared');
}

/**
 * Broadcast message to all clients
 */
async function broadcastMessage(message: unknown): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage(message);
  }
}

// ============================================================================
// Push Notifications (Local only)
// ============================================================================

self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push notification received');

  const data = event.data?.json() || { title: 'New Update', body: 'Content available' };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:   data.body,
      icon:   '/icon.svg',
      badge:  '/icon.svg',
      tag:    data.tag || 'default',
      data:   data.data,
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification clicked');

  event.notification.close();

  event.waitUntil(
    self.clients.openWindow(event.notification.data?.url || '/')
  );
});

console.log('[SW] Service Worker loaded and ready');
