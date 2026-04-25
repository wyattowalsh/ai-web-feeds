#!/usr/bin/env tsx
/**
 * Worker Build Pipeline
 * 
 * Bundles Web Workers and Service Worker for production deployment.
 * Workers are compiled separately to avoid Next.js compilation issues
 * and to enable proper code splitting for background tasks.
 * 
 * Usage: pnpm build:workers
 */

import { build } from 'esbuild';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const rootDir   = join(__dirname, '..');
const workersDir = join(rootDir, 'workers');
const swDir     = join(rootDir, 'service-worker');
const outDir    = join(rootDir, 'public', 'workers');

interface WorkerConfig {
  entryPoint: string;
  outFile:    string;
  name:       string;
}

const workers: WorkerConfig[] = [
  {
    name:       'Search Worker',
    entryPoint: join(workersDir, 'search.worker.ts'),
    outFile:    'search.worker.js',
  },
  {
    name:       'Service Worker',
    entryPoint: join(swDir, 'sw.ts'),
    outFile:    'sw.js',
  },
];

async function buildWorker(config: WorkerConfig): Promise<void> {
  console.log(`📦 Building ${config.name}...`);
  
  try {
    await build({
      entryPoints: [config.entryPoint],
      bundle:      true,
      minify:      process.env.NODE_ENV === 'production',
      sourcemap:   process.env.NODE_ENV !== 'production',
      format:      'iife',
      target:      ['es2020'],
      outfile:     join(outDir, config.outFile),
      platform:    'browser',
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
      logLevel: 'info',
    });
    
    console.log(`✅ ${config.name} built successfully`);
  } catch (error) {
    console.error(`❌ Failed to build ${config.name}:`, error);
    throw error;
  }
}

async function createWorkerStubs(): Promise<void> {
  console.log('📝 Creating worker stubs for missing files...');
  
  const stubs: Array<{ path: string; content: string }> = [];
  
  // Create search worker stub if it doesn't exist
  const searchWorkerPath = join(workersDir, 'search.worker.ts');
  if (!existsSync(searchWorkerPath)) {
    stubs.push({
      path:    searchWorkerPath,
      content: `/**
 * Search Worker - Full-text search indexing and querying
 * 
 * Handles background indexing of articles and instant search queries
 * without blocking the main UI thread.
 * 
 * @see specs/004-client-side-features/spec.md#user-story-2---advanced-client-side-search
 */

// Worker message types
interface IndexArticleMessage {
  type: 'INDEX_ARTICLE';
  payload: {
    articleId: string;
    title: string;
    content: string;
    tags: string[];
  };
}

interface SearchQueryMessage {
  type: 'SEARCH_QUERY';
  payload: {
    query: string;
    filters?: {
      feedIds?: string[];
      topics?: string[];
      dateRange?: { from: string; to: string };
    };
    limit?: number;
  };
}

type WorkerMessage = IndexArticleMessage | SearchQueryMessage;

// Placeholder implementation - will be completed in US2
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'INDEX_ARTICLE':
      console.log('[Search Worker] Indexing article:', payload.articleId);
      // TODO: Implement indexing logic in T020
      self.postMessage({ type: 'INDEX_COMPLETE', articleId: payload.articleId });
      break;
      
    case 'SEARCH_QUERY':
      console.log('[Search Worker] Executing search:', payload.query);
      // TODO: Implement search logic in T020
      self.postMessage({
        type:      'SEARCH_RESULTS',
        results:   [],
        latencyMs: 0,
      });
      break;
      
    default:
      console.warn('[Search Worker] Unknown message type:', type);
  }
});

console.log('[Search Worker] Initialized');
`,
    });
  }
  
  // Create service worker stub if it doesn't exist
  const swPath = join(swDir, 'sw.ts');
  if (!existsSync(swPath)) {
    stubs.push({
      path:    swPath,
      content: `/**
 * Service Worker - Offline caching and background sync
 * 
 * Provides offline-first capabilities, background sync, and caching
 * strategies for the AI Web Feeds application.
 * 
 * @see specs/004-client-side-features/spec.md#user-story-1---offline-feed-reading
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'aiwebfeeds-v1';
const CACHE_ASSETS  = [
  '/',
  '/manifest.json',
  '/icon.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(CACHE_ASSETS);
    })
  );
  
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    })
  );
  
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event: FetchEvent) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      
      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        
        return response;
      });
    })
  );
});

// Background sync event - will be implemented in T013
self.addEventListener('sync', (event: SyncEvent) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-feeds') {
    event.waitUntil(
      // TODO: Implement sync logic in T013
      Promise.resolve()
    );
  }
});

console.log('[Service Worker] Loaded');
`,
    });
  }
  
  // Create directories and write stubs
  for (const stub of stubs) {
    const dir = join(stub.path, '..');
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(stub.path, stub.content, 'utf-8');
    console.log(`  ✅ Created stub: ${stub.path}`);
  }
  
  if (stubs.length === 0) {
    console.log('  ℹ️  All worker files exist, no stubs needed');
  }
}

async function main(): Promise<void> {
  console.log('🚀 Worker Build Pipeline\n');
  
  // Create output directory
  if (!existsSync(outDir)) {
    await mkdir(outDir, { recursive: true });
    console.log(`📁 Created output directory: ${outDir}\n`);
  }
  
  // Create worker stubs for missing files
  await createWorkerStubs();
  console.log('');
  
  // Build all workers
  for (const worker of workers) {
    await buildWorker(worker);
  }
  
  console.log('\n✨ All workers built successfully!\n');
}

main().catch((error) => {
  console.error('❌ Worker build failed:', error);
  process.exit(1);
});
