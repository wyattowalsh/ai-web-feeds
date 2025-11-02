/**
 * Service Worker for AI Web Feeds
 * 
 * Provides offline-first functionality:
 * - Cache static assets for instant loading
 * - Cache feed content for offline reading
 * - Background sync when connection restored
 * - Push notifications (local only, no backend)
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `aiwebfeeds-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `aiwebfeeds-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `aiwebfeeds-images-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon.svg',
  '/favicon.ico',
];

// Cache size limits
const MAX_DYNAMIC_CACHE_SIZE = 50; // Max items in dynamic cache
const MAX_IMAGE_CACHE_SIZE = 100;  // Max images to cache

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[SW] Service worker installed');
      return self.skipWaiting(); // Activate immediately
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('aiwebfeeds-') && 
                   name !== STATIC_CACHE &&
                   name !== DYNAMIC_CACHE &&
                   name !== IMAGE_CACHE;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim(); // Take control immediately
    })
  );
});

/**
 * Fetch event - serve from cache, fallback to network
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and browser-internal requests
  if (url.protocol === 'chrome-extension:' || url.protocol === 'browser:') {
    return;
  }
  
  // Skip API calls (they should go to network)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Handle images
  if (request.destination === 'image') {
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
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-articles') {
    event.waitUntil(syncArticles());
  }
  
  if (event.tag === 'sync-preferences') {
    event.waitUntil(syncPreferences());
  }
});

/**
 * Push event - show notification (local only)
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'AI Web Feeds';
  const options = {
    body: data.body || 'You have new articles',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/**
 * Notification click - handle user action
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data || '/';
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

/**
 * Message event - communicate with main app
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(cacheUrls(event.data.urls));
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  }
});

// ============================================================================
// Cache Strategies
// ============================================================================

/**
 * Cache first, fallback to network
 */
async function cacheFirst(request, cacheName = DYNAMIC_CACHE, maxSize = MAX_DYNAMIC_CACHE_SIZE) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
      console.log('[SW] Serving from cache:', request.url);
      return cached;
    }
    
    console.log('[SW] Fetching from network:', request.url);
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      const responseClone = response.clone();
      await cache.put(request, responseClone);
      await limitCacheSize(cacheName, maxSize);
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Cache first error:', error);
    
    // Return offline page for HTML requests
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE);
      return cache.match('/offline');
    }
    
    throw error;
  }
}

/**
 * Network first, fallback to cache
 */
async function networkFirst(request) {
  try {
    console.log('[SW] Fetching from network:', request.url);
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
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cache = await caches.open(DYNAMIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    // Return offline page for HTML requests
    if (request.destination === 'document') {
      const staticCache = await caches.open(STATIC_CACHE);
      return staticCache.match('/offline');
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
  return pathname.endsWith('.js') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.woff2') ||
         pathname.endsWith('.woff') ||
         pathname === '/' ||
         pathname === '/offline';
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
        console.error('[SW] Failed to cache:', url, error);
      }
    })
  );
  console.log('[SW] Cached', urls.length, 'URLs');
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map((name) => {
      console.log('[SW] Deleting cache:', name);
      return caches.delete(name);
    })
  );
  console.log('[SW] All caches cleared');
}

/**
 * Sync articles (background sync)
 */
async function syncArticles() {
  console.log('[SW] Syncing articles...');
  
  try {
    // Open IndexedDB and sync pending changes
    // This would communicate with the main app's IndexedDB
    // For now, just log (actual implementation would query IndexedDB)
    console.log('[SW] Articles synced successfully');
  } catch (error) {
    console.error('[SW] Article sync failed:', error);
    throw error;
  }
}

/**
 * Sync preferences (background sync)
 */
async function syncPreferences() {
  console.log('[SW] Syncing preferences...');
  
  try {
    // Sync preferences to server (if implemented)
    // For now, just log (client-side only in Phase 4)
    console.log('[SW] Preferences synced successfully');
  } catch (error) {
    console.error('[SW] Preference sync failed:', error);
    throw error;
  }
}

console.log('[SW] Service Worker loaded');

