/**
 * Service Worker Registration and Lifecycle Helpers
 * 
 * Provides utilities for registering, updating, and managing the Service Worker
 * lifecycle. Handles graceful degradation when Service Workers are unavailable.
 * 
 * @see specs/004-client-side-features/spec.md#service-worker-failures
 * @see specs/004-client-side-features/tasks.md#t008
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Service Worker registration status
 */
export type SWStatus = 
  | 'unsupported'   // Browser doesn't support Service Workers
  | 'disabled'      // Service Workers disabled by user/policy
  | 'registering'   // Registration in progress
  | 'registered'    // Successfully registered
  | 'updated'       // New version available
  | 'error';        // Registration failed

/**
 * Service Worker lifecycle state
 */
export interface SWState {
  status:        SWStatus;
  registration?: ServiceWorkerRegistration;
  error?:        Error;
  updateAvailable: boolean;
}

/**
 * Service Worker registration options
 */
export interface SWRegistrationOptions {
  scope?:           string; // Default '/'
  updateViaCache?:  ServiceWorkerUpdateViaCache; // Default 'none'
  onUpdate?:        (registration: ServiceWorkerRegistration) => void;
  onError?:         (error: Error) => void;
  onOffline?:       () => void;
  onOnline?:        () => void;
}

// ============================================================================
// Service Worker Registration
// ============================================================================

/**
 * Register Service Worker
 * 
 * Registers the service worker with error handling and lifecycle callbacks.
 * Returns null if Service Workers are unsupported or registration fails.
 * 
 * @param scriptURL - Path to service worker script (e.g., '/sw.js')
 * @param options - Registration options and callbacks
 * @returns Service Worker registration or null
 * 
 * @example
 * ```ts
 * const registration = await registerServiceWorker('/sw.js', {
 *   onUpdate: (reg) => {
 *     showUpdateNotification(reg);
 *   },
 *   onError: (error) => {
 *     console.error('SW registration failed:', error);
 *   },
 * });
 * ```
 */
export async function registerServiceWorker(
  scriptURL: string,
  options: SWRegistrationOptions = {}
): Promise<ServiceWorkerRegistration | null> {
  // Check if Service Workers are supported
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Workers not supported in this browser');
    options.onError?.(new Error('Service Workers not supported'));
    return null;
  }

  // Check if running on HTTPS (required for SW except on localhost)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    console.warn('[SW] Service Workers require HTTPS or localhost');
    options.onError?.(new Error('Service Workers require HTTPS'));
    return null;
  }

  try {
    console.log('[SW] Registering service worker:', scriptURL);

    // Register service worker
    const registration = await navigator.serviceWorker.register(scriptURL, {
      scope:          options.scope || '/',
      updateViaCache: options.updateViaCache || 'none',
    });

    console.log('[SW] Service worker registered successfully');

    // Check for updates
    setupUpdateHandler(registration, options);

    // Setup network status listeners
    setupNetworkListeners(options);

    return registration;
  } catch (error) {
    console.error('[SW] Service worker registration failed:', error);
    options.onError?.(error instanceof Error ? error : new Error('Registration failed'));
    return null;
  }
}

/**
 * Unregister Service Worker
 * 
 * Unregisters the service worker and clears all caches.
 * Useful for debugging or complete reset.
 * 
 * @returns True if successfully unregistered
 * 
 * @example
 * ```ts
 * const unregistered = await unregisterServiceWorker();
 * if (unregistered) {
 *   console.log('Service worker removed');
 * }
 * ```
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const unregistered = await registration.unregister();

    if (unregistered) {
      console.log('[SW] Service worker unregistered successfully');
      
      // Clear all caches
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      
      console.log('[SW] All caches cleared');
    }

    return unregistered;
  } catch (error) {
    console.error('[SW] Failed to unregister service worker:', error);
    return false;
  }
}

/**
 * Check if Service Worker is registered
 * 
 * @returns Current registration or null
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.getRegistration();
  } catch (error) {
    console.error('[SW] Failed to get registration:', error);
    return null;
  }
}

/**
 * Update Service Worker
 * 
 * Manually trigger service worker update check.
 * 
 * @returns Updated registration or null
 */
export async function updateServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  const registration = await getServiceWorkerRegistration();

  if (!registration) {
    return null;
  }

  try {
    console.log('[SW] Checking for updates...');
    await registration.update();
    console.log('[SW] Update check complete');
    return registration;
  } catch (error) {
    console.error('[SW] Failed to update service worker:', error);
    return null;
  }
}

/**
 * Skip waiting and activate new service worker immediately
 * 
 * Forces the waiting service worker to become active immediately,
 * bypassing the normal lifecycle wait.
 * 
 * @example
 * ```ts
 * // After user clicks "Update now" button
 * await skipWaiting();
 * window.location.reload();
 * ```
 */
export async function skipWaiting(): Promise<void> {
  const registration = await getServiceWorkerRegistration();

  if (!registration || !registration.waiting) {
    return;
  }

  // Send skip waiting message to service worker
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });

  // Wait for controller change
  return new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      resolve();
    }, { once: true });
  });
}

// ============================================================================
// Service Worker State Management
// ============================================================================

/**
 * Get current service worker state
 * 
 * @returns Current SW status and registration info
 */
export async function getServiceWorkerState(): Promise<SWState> {
  // Check support
  if (!('serviceWorker' in navigator)) {
    return {
      status:         'unsupported',
      updateAvailable: false,
    };
  }

  try {
    const registration = await getServiceWorkerRegistration();

    if (!registration) {
      return {
        status:         'error',
        updateAvailable: false,
      };
    }

    // Check if update is available
    const updateAvailable = !!registration.waiting;

    return {
      status:         updateAvailable ? 'updated' : 'registered',
      registration,
      updateAvailable,
    };
  } catch (error) {
    return {
      status:         'error',
      error:          error instanceof Error ? error : new Error('Unknown error'),
      updateAvailable: false,
    };
  }
}

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
 * Setup service worker update handler
 */
function setupUpdateHandler(
  registration: ServiceWorkerRegistration,
  options: SWRegistrationOptions
): void {
  // Check for updates periodically (every hour)
  setInterval(() => {
    registration.update().catch((error) => {
      console.error('[SW] Update check failed:', error);
    });
  }, 60 * 60 * 1000); // 1 hour

  // Listen for new service worker installation
  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;

    if (!newWorker) {
      return;
    }

    console.log('[SW] New service worker found, installing...');

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('[SW] New service worker installed, update available');
        options.onUpdate?.(registration);
      }
    });
  });
}

/**
 * Setup online/offline network listeners
 */
function setupNetworkListeners(options: SWRegistrationOptions): void {
  window.addEventListener('online', () => {
    console.log('[SW] Network online');
    options.onOnline?.();
  });

  window.addEventListener('offline', () => {
    console.log('[SW] Network offline');
    options.onOffline?.();
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if browser supports Service Workers
 */
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

/**
 * Check if currently running under a service worker
 */
export function isControlledByServiceWorker(): boolean {
  return !!navigator.serviceWorker?.controller;
}

/**
 * Wait for service worker to be ready
 * 
 * @param timeoutMs - Timeout in milliseconds (default 10s)
 * @returns Registration when ready, or null on timeout
 */
export async function waitForServiceWorker(
  timeoutMs: number = 10000
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    return registration;
  } catch (error) {
    console.error('[SW] Error waiting for service worker:', error);
    return null;
  }
}

/**
 * Send message to service worker
 * 
 * @param message - Message to send
 * @returns Response from service worker or null
 */
export async function sendMessageToServiceWorker(message: unknown): Promise<unknown> {
  const registration = await getServiceWorkerRegistration();

  if (!registration || !registration.active) {
    console.warn('[SW] No active service worker to send message to');
    return null;
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      resolve(event.data);
    };

    registration.active.postMessage(message, [messageChannel.port2]);
  });
}
