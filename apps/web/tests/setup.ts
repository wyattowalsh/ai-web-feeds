/**
 * Vitest Global Setup
 * 
 * Configures test environment with:
 * - Testing Library matchers
 * - JSDOM environment setup
 * - Mock IndexedDB and Service Worker APIs
 * - Global test utilities
 * 
 * @see specs/004-client-side-features/tasks.md#t003
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock browser APIs not available in JSDOM
beforeAll(() => {
  // Mock IndexedDB (basic implementation)
  if (!global.indexedDB) {
    const fakeIndexedDB = {
      open: vi.fn(),
      deleteDatabase: vi.fn(),
      databases: vi.fn().mockResolvedValue([]),
    };
    global.indexedDB = fakeIndexedDB as unknown as IDBFactory;
  }
  
  // Mock Service Worker registration
  if (!global.navigator.serviceWorker) {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue({
          active: null,
          installing: null,
          waiting: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
        getRegistration: vi.fn().mockResolvedValue(undefined),
        getRegistrations: vi.fn().mockResolvedValue([]),
        ready: Promise.resolve({
          active: null,
          installing: null,
          waiting: null,
        }),
      },
      writable: true,
      configurable: true,
    });
  }
  
  // Mock Storage API
  if (!global.navigator.storage) {
    Object.defineProperty(global.navigator, 'storage', {
      value: {
        estimate: vi.fn().mockResolvedValue({
          quota: 1000000000, // 1GB
          usage: 100000000,  // 100MB (10%)
          usageDetails: {},
        }),
        persist: vi.fn().mockResolvedValue(true),
        persisted: vi.fn().mockResolvedValue(false),
      },
      writable: true,
      configurable: true,
    });
  }
  
  // Mock BroadcastChannel
  if (!global.BroadcastChannel) {
    global.BroadcastChannel = class BroadcastChannel {
      name: string;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;
      
      constructor(name: string) {
        this.name = name;
      }
      
      postMessage(message: unknown): void {
        // Mock implementation
        console.log(`[BroadcastChannel:${this.name}]`, message);
      }
      
      close(): void {
        // Mock implementation
      }
      
      addEventListener(): void {
        // Mock implementation
      }
      
      removeEventListener(): void {
        // Mock implementation
      }
      
      dispatchEvent(): boolean {
        return true;
      }
    } as unknown as typeof BroadcastChannel;
  }
  
  // Mock localStorage with in-memory implementation
  if (!global.localStorage) {
    const storage = new Map<string, string>();
    global.localStorage = {
      getItem:    (key: string) => storage.get(key) || null,
      setItem:    (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear:      () => storage.clear(),
      key:        (index: number) => Array.from(storage.keys())[index] || null,
      length:     storage.size,
    };
  }
  
  // Mock Worker
  if (!global.Worker) {
    global.Worker = class Worker extends EventTarget {
      onmessage:      ((event: MessageEvent) => void) | null = null;
      onmessageerror: ((event: MessageEvent) => void) | null = null;
      onerror:        ((event: ErrorEvent) => void) | null = null;
      
      constructor(public url: string | URL, public options?: WorkerOptions) {
        super();
      }
      
      postMessage(message: unknown): void {
        // Mock implementation - immediately echo back
        if (this.onmessage) {
          this.onmessage(new MessageEvent('message', { data: message }));
        }
      }
      
      terminate(): void {
        // Mock implementation
      }
    } as unknown as typeof Worker;
  }
  
  // Mock notification API
  if (!global.Notification) {
    global.Notification = class Notification extends EventTarget {
      static permission: NotificationPermission = 'default';
      
      static requestPermission(): Promise<NotificationPermission> {
        return Promise.resolve('granted');
      }
      
      title:   string;
      body?:   string;
      icon?:   string;
      tag?:    string;
      data?:   unknown;
      onclick: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onclose: ((event: Event) => void) | null = null;
      onshow:  ((event: Event) => void) | null = null;
      
      constructor(title: string, options?: NotificationOptions) {
        super();
        this.title = title;
        this.body  = options?.body;
        this.icon  = options?.icon;
        this.tag   = options?.tag;
        this.data  = options?.data;
      }
      
      close(): void {
        // Mock implementation
      }
    } as unknown as typeof Notification;
  }
  
  // Suppress console errors in tests (optional, can be configured)
  if (process.env.VITEST_SUPPRESS_CONSOLE) {
    global.console.error = vi.fn();
    global.console.warn  = vi.fn();
  }
});

// Add custom matchers or utilities here
export {};
