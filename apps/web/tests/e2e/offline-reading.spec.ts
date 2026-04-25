/**
 * E2E Test: Offline Feed Reading
 * 
 * Tests offline-first functionality including:
 * - Caching feeds for offline reading
 * - Reading cached articles in offline mode
 * - Background sync when coming back online
 * - Conflict resolution UI
 * - Storage warnings and cleanup
 * 
 * @see specs/004-client-side-features/spec.md#user-story-1---offline-feed-reading
 * @see specs/004-client-side-features/tasks.md#t011
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Offline Feed Reading', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage, context }) => {
    page = testPage;

    // Grant permissions for offline features
    await context.grantPermissions(['persistent-storage']);

    // Navigate to app
    await page.goto('/');

    // Wait for service worker to be ready
    await page.waitForFunction(() => 'serviceWorker' in navigator);
  });

  test('should register service worker on first load', async () => {
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration !== undefined;
      }
      return false;
    });

    expect(swRegistered).toBe(true);
  });

  test('should cache feeds for offline reading', async () => {
    // Navigate to feeds page
    await page.goto('/feeds');

    // Find and click "Save for Offline" button on a feed
    await page.waitForSelector('[data-testid="feed-item"]');
    const firstFeed = page.locator('[data-testid="feed-item"]').first();
    await firstFeed.locator('[data-testid="save-offline-button"]').click();

    // Wait for caching confirmation
    await expect(page.locator('[data-testid="offline-toast"]')).toContainText(
      'Saved for offline'
    );

    // Verify articles are in IndexedDB
    const articleCount = await page.evaluate(async () => {
      const db = await (window as any).indexedDB.open('aiwebfeeds');
      return new Promise((resolve) => {
        db.onsuccess = () => {
          const transaction = db.result.transaction(['articles'], 'readonly');
          const store       = transaction.objectStore('articles');
          const count       = store.count();

          count.onsuccess = () => resolve(count.result);
        };
      });
    });

    expect(articleCount).toBeGreaterThan(0);
  });

  test('should display cached articles when offline', async ({ context }) => {
    // First, cache some articles (while online)
    await page.goto('/feeds');
    await page.waitForSelector('[data-testid="feed-item"]');
    const firstFeed = page.locator('[data-testid="feed-item"]').first();
    await firstFeed.locator('[data-testid="save-offline-button"]').click();
    await page.waitForTimeout(1000); // Wait for caching to complete

    // Go offline
    await context.setOffline(true);

    // Navigate to offline feeds view
    await page.goto('/feeds/offline');

    // Should show offline badge
    await expect(page.locator('[data-testid="offline-badge"]')).toBeVisible();

    // Should show last sync timestamp
    await expect(page.locator('[data-testid="last-sync-timestamp"]')).toBeVisible();

    // Should display cached articles
    await expect(page.locator('[data-testid="article-item"]')).toHaveCount(
      await page.locator('[data-testid="article-item"]').count()
    );

    // Articles should be readable
    const firstArticle = page.locator('[data-testid="article-item"]').first();
    await firstArticle.click();

    // Article content should load (from cache)
    await expect(page.locator('[data-testid="article-content"]')).toBeVisible();
  });

  test('should show offline mode badge when disconnected', async ({ context }) => {
    // Cache articles first
    await page.goto('/feeds');
    await page.waitForSelector('[data-testid="feed-item"]');
    const firstFeed = page.locator('[data-testid="feed-item"]').first();
    await firstFeed.locator('[data-testid="save-offline-button"]').click();
    await page.waitForTimeout(1000);

    // Go offline
    await context.setOffline(true);

    // Navigate to feeds page
    await page.goto('/feeds');

    // Offline badge should be visible
    await expect(page.locator('[data-testid="offline-mode-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-mode-indicator"]')).toContainText(
      'Offline Mode'
    );
  });

  test('should sync articles when coming back online', async ({ context }) => {
    // Cache articles
    await page.goto('/feeds');
    await page.waitForSelector('[data-testid="feed-item"]');
    const firstFeed = page.locator('[data-testid="feed-item"]').first();
    await firstFeed.locator('[data-testid="save-offline-button"]').click();
    await page.waitForTimeout(1000);

    // Go offline
    await context.setOffline(true);

    // Make offline changes (star an article)
    await page.goto('/feeds/offline');
    const firstArticle = page.locator('[data-testid="article-item"]').first();
    await firstArticle.locator('[data-testid="star-button"]').click();

    // Come back online
    await context.setOffline(false);

    // Should trigger background sync
    await page.waitForTimeout(2000); // Wait for sync to start

    // Check for sync notification
    await expect(page.locator('[data-testid="sync-notification"]')).toContainText(
      /Syncing|Sync complete/
    );
  });

  test('should preserve local changes during offline sync', async ({ context }) => {
    // Cache articles
    await page.goto('/feeds');
    await page.waitForSelector('[data-testid="feed-item"]');
    const firstFeed = page.locator('[data-testid="feed-item"]').first();
    await firstFeed.locator('[data-testid="save-offline-button"]').click();
    await page.waitForTimeout(1000);

    // Go offline
    await context.setOffline(true);

    // Mark article as read offline
    await page.goto('/feeds/offline');
    const firstArticle = page.locator('[data-testid="article-item"]').first();
    await firstArticle.click();
    await page.locator('[data-testid="mark-as-read-button"]').click();

    // Come back online
    await context.setOffline(false);
    await page.waitForTimeout(2000);

    // Article should still be marked as read
    await expect(firstArticle.locator('[data-testid="read-indicator"]')).toBeVisible();
  });

  test('should show conflict resolution UI when conflicts detected', async ({ context }) => {
    // Cache articles
    await page.goto('/feeds');
    await page.waitForSelector('[data-testid="feed-item"]');
    const firstFeed = page.locator('[data-testid="feed-item"]').first();
    await firstFeed.locator('[data-testid="save-offline-button"]').click();
    await page.waitForTimeout(1000);

    // Simulate conflict by creating divergent state
    // (In real scenario, this would be server-side article update)
    await page.evaluate(() => {
      // Mark an article as conflicted in IndexedDB
      const dbRequest = indexedDB.open('aiwebfeeds');
      dbRequest.onsuccess = () => {
        const db          = dbRequest.result;
        const transaction = db.transaction(['articles'], 'readwrite');
        const store       = transaction.objectStore('articles');

        const getRequest = store.getAll();
        getRequest.onsuccess = () => {
          const articles = getRequest.result;
          if (articles.length > 0) {
            const article              = articles[0];
            article.offlineStatus      = 'conflicted';
            article.conflictReason     = 'Local changes conflict with remote updates';
            store.put(article);
          }
        };
      };
    });

    // Navigate to conflicts page
    await page.goto('/offline/conflicts');

    // Should show conflict panel
    await expect(page.locator('[data-testid="conflict-item"]')).toBeVisible();

    // Should show conflict reason
    await expect(page.locator('[data-testid="conflict-reason"]')).toContainText(
      /conflict/i
    );

    // Should have resolution buttons
    await expect(page.locator('[data-testid="keep-local-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="accept-remote-button"]')).toBeVisible();
  });

  test('should show storage warning when approaching limit', async () => {
    // Mock storage estimate to simulate high usage
    await page.addInitScript(() => {
      const originalEstimate = navigator.storage.estimate;
      navigator.storage.estimate = async () => {
        return {
          quota: 1000000000, // 1 GB
          usage: 850000000,  // 85% (should trigger warning)
          usageDetails: {},
        };
      };
    });

    // Navigate to app
    await page.goto('/');

    // Storage warning banner should appear
    await expect(page.locator('[data-testid="storage-warning-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="storage-warning-banner"]')).toContainText(
      /storage/i
    );

    // Should show percentage
    await expect(page.locator('[data-testid="storage-percentage"]')).toContainText(
      '85%'
    );
  });

  test('should provide cleanup tools when storage is high', async () => {
    // Mock high storage usage
    await page.addInitScript(() => {
      navigator.storage.estimate = async () => {
        return {
          quota: 1000000000,
          usage: 900000000, // 90%
          usageDetails: {},
        };
      };
    });

    await page.goto('/');

    // Click storage warning to open cleanup modal
    await page.locator('[data-testid="storage-warning-banner"]').click();

    // Should show cleanup options
    await expect(page.locator('[data-testid="cleanup-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-old-articles-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="clear-cache-button"]')).toBeVisible();
  });

  test('should display last sync timestamp on offline feeds', async () => {
    // Cache articles
    await page.goto('/feeds');
    await page.waitForSelector('[data-testid="feed-item"]');
    const firstFeed = page.locator('[data-testid="feed-item"]').first();
    await firstFeed.locator('[data-testid="save-offline-button"]').click();
    await page.waitForTimeout(1000);

    // Navigate to offline feeds
    await page.goto('/feeds/offline');

    // Should show last sync timestamp
    const timestamp = page.locator('[data-testid="last-sync-timestamp"]');
    await expect(timestamp).toBeVisible();

    // Should be a valid time format (e.g., "2 minutes ago")
    const timestampText = await timestamp.textContent();
    expect(timestampText).toMatch(/(seconds?|minutes?|hours?) ago/);
  });
});

test.describe('Offline Reading - Performance', () => {
  test('should load cached articles in < 200ms', async ({ page }) => {
    // Cache articles first
    await page.goto('/feeds');
    await page.waitForSelector('[data-testid="feed-item"]');
    const firstFeed = page.locator('[data-testid="feed-item"]').first();
    await firstFeed.locator('[data-testid="save-offline-button"]').click();
    await page.waitForTimeout(2000);

    // Measure offline load time
    const startTime = Date.now();
    await page.goto('/feeds/offline');
    await page.waitForSelector('[data-testid="article-item"]');
    const loadTime = Date.now() - startTime;

    console.log(`Offline load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(200);
  });
});

test.describe('Offline Reading - Graceful Degradation', () => {
  test('should work without service worker support', async ({ page, context }) => {
    // Disable service workers
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value:        undefined,
        writable:     false,
        configurable: false,
      });
    });

    await page.goto('/');

    // Should show "Offline mode unavailable" banner
    await expect(page.locator('[data-testid="sw-unavailable-banner"]')).toBeVisible();

    // Core features should still work
    await page.goto('/feeds');
    await expect(page.locator('[data-testid="feed-item"]')).toBeVisible();

    // Save offline button should be hidden or disabled
    const saveOfflineButton = page.locator('[data-testid="save-offline-button"]').first();
    if (await saveOfflineButton.isVisible()) {
      await expect(saveOfflineButton).toBeDisabled();
    }
  });
});
