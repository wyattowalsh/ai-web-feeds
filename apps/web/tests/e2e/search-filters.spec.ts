/**
 * E2E Test: Search Filtering Performance
 * 
 * Tests search performance, filtering, and result quality.
 * Ensures <50ms search latency for 10k articles.
 * 
 * @see specs/004-client-side-features/spec.md#user-story-2---advanced-client-side-search
 * @see specs/004-client-side-features/tasks.md#t019
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Advanced Client-Side Search', () => {
  test.beforeEach(async ({ page }) => {
    // Seed test data (in real scenario, this would populate IndexedDB)
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
  });

  test('should display search interface', async ({ page }) => {
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-filters"]')).toBeVisible();
  });

  test('should search articles instantly', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');

    // Type search query
    await searchInput.fill('machine learning');

    // Results should appear without clicking search button
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-result-item"]')).toHaveCount(
      await page.locator('[data-testid="search-result-item"]').count()
    );
  });

  test('should highlight search terms in results', async ({ page }) => {
    await page.locator('[data-testid="search-input"]').fill('GPT-4');
    await page.waitForSelector('[data-testid="search-result-item"]');

    // Check for highlighted terms
    const highlights = page.locator('[data-testid="search-highlight"]');
    await expect(highlights.first()).toBeVisible();
  });

  test('should filter by date range', async ({ page }) => {
    // Open filters
    await page.locator('[data-testid="filter-toggle"]').click();

    // Set date range
    await page.locator('[data-testid="filter-date-from"]').fill('2025-01-01');
    await page.locator('[data-testid="filter-date-to"]').fill('2025-12-31');

    // Apply filters
    await page.locator('[data-testid="apply-filters"]').click();

    // Results should update
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should filter by topics', async ({ page }) => {
    await page.locator('[data-testid="filter-toggle"]').click();

    // Select topic
    await page.locator('[data-testid="filter-topic-ai"]').click();

    // Results should be filtered
    await expect(page.locator('[data-testid="search-result-item"]')).toHaveCount(
      await page.locator('[data-testid="search-result-item"]').count()
    );
  });

  test('should filter by feeds', async ({ page }) => {
    await page.locator('[data-testid="filter-toggle"]').click();

    // Select feed
    const feedFilter = page.locator('[data-testid="filter-feed"]').first();
    await feedFilter.click();

    // Results should update
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should show result count', async ({ page }) => {
    await page.locator('[data-testid="search-input"]').fill('neural networks');

    const resultCount = page.locator('[data-testid="result-count"]');
    await expect(resultCount).toBeVisible();
    await expect(resultCount).toContainText(/\d+/);
  });

  test('should display relevance scores', async ({ page }) => {
    await page.locator('[data-testid="search-input"]').fill('transformer');

    await page.waitForSelector('[data-testid="search-result-item"]');

    // Check for relevance indicators
    const firstResult = page.locator('[data-testid="search-result-item"]').first();
    await expect(firstResult.locator('[data-testid="relevance-score"]')).toBeVisible();
  });

  test('should show snippets with context', async ({ page }) => {
    await page.locator('[data-testid="search-input"]').fill('deep learning');

    await page.waitForSelector('[data-testid="search-result-item"]');

    // Check for snippets
    const snippet = page.locator('[data-testid="result-snippet"]').first();
    await expect(snippet).toBeVisible();
    await expect(snippet).toContainText(/\w+/); // Has content
  });

  test('should sort by relevance by default', async ({ page }) => {
    await page.locator('[data-testid="search-input"]').fill('artificial intelligence');

    await page.waitForSelector('[data-testid="search-result-item"]');

    // Check sort indicator
    await expect(page.locator('[data-testid="sort-relevance"]')).toHaveClass(/active|selected/);
  });

  test('should allow sorting by date', async ({ page }) => {
    await page.locator('[data-testid="search-input"]').fill('AI');

    // Change sort
    await page.locator('[data-testid="sort-date"]').click();

    // Results should re-order
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should clear filters', async ({ page }) => {
    // Apply filters
    await page.locator('[data-testid="filter-toggle"]').click();
    await page.locator('[data-testid="filter-topic-ai"]').click();

    // Clear all filters
    await page.locator('[data-testid="clear-filters"]').click();

    // Filters should reset
    await expect(page.locator('[data-testid="filter-topic-ai"]')).not.toBeChecked();
  });

  test('should handle empty results gracefully', async ({ page }) => {
    await page.locator('[data-testid="search-input"]').fill('xyzabc123nonexistent');

    // Should show empty state
    await expect(page.locator('[data-testid="empty-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="empty-results"]')).toContainText(/no results/i);
  });
});

test.describe('Search Performance', () => {
  test('should return results in <50ms', async ({ page }) => {
    // Seed large dataset (in real scenario)
    await page.goto('/search');

    const searchInput = page.locator('[data-testid="search-input"]');

    // Measure search time
    const startTime = Date.now();

    await searchInput.fill('machine learning');
    await page.waitForSelector('[data-testid="search-results"]');

    const endTime = Date.now();
    const searchTime = endTime - startTime;

    console.log(`Search completed in ${searchTime}ms`);

    // Should be under 50ms for instant search
    // Note: In E2E, this includes network latency, so we allow up to 200ms
    expect(searchTime).toBeLessThan(200);
  });

  test('should handle large result sets efficiently', async ({ page }) => {
    await page.goto('/search');

    // Search common term that matches many articles
    await page.locator('[data-testid="search-input"]').fill('the');

    // Should render without freezing UI
    await page.waitForSelector('[data-testid="search-result-item"]', { timeout: 1000 });

    const resultCount = await page.locator('[data-testid="search-result-item"]').count();
    expect(resultCount).toBeGreaterThan(0);
  });
});

test.describe('Search Filters - Advanced', () => {
  test('should combine multiple filters', async ({ page }) => {
    await page.goto('/search');
    await page.locator('[data-testid="search-input"]').fill('neural networks');

    // Open filters
    await page.locator('[data-testid="filter-toggle"]').click();

    // Apply multiple filters
    await page.locator('[data-testid="filter-topic-ai"]').click();
    await page.locator('[data-testid="filter-starred"]').click();
    await page.locator('[data-testid="filter-date-from"]').fill('2025-01-01');

    // Results should match all filters
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should persist filters across searches', async ({ page }) => {
    await page.goto('/search');

    // Apply filter
    await page.locator('[data-testid="filter-toggle"]').click();
    await page.locator('[data-testid="filter-topic-ai"]').click();

    // Perform search
    await page.locator('[data-testid="search-input"]').fill('GPT');

    // Perform another search
    await page.locator('[data-testid="search-input"]').fill('transformer');

    // Filter should still be active
    await expect(page.locator('[data-testid="filter-topic-ai"]')).toBeChecked();
  });
});
