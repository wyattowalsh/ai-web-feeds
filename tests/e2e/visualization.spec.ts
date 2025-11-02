/**
 * E2E tests for visualization features.
 *
 * Tests complete user workflows using Playwright.
 */

import { test, expect } from "@playwright/test";

test.describe("Visualization Dashboard", () => {
  test("should create a new line chart", async ({ page }) => {
    await page.goto("/analytics/visualizations/new");

    // Step 1: Select data source
    await page.click('text="Topics"');
    await expect(page.locator('text="Selected: Topics"')).toBeVisible();

    // Wait for auto-advance
    await page.waitForTimeout(500);

    // Step 2: Select chart type
    await page.click('text="Line Chart"');
    await expect(page.locator('text="Line Chart"')).toBeVisible();

    // Step 3: Select date range
    await page.click('text="Last 30 Days"');
    await expect(page.locator('text="Selected range:"')).toBeVisible();

    // Step 4: Customize (optional)
    await page.fill('input[placeholder="Enter chart title..."]', "My Test Chart");

    // Save
    await page.click('text="Save Visualization"');

    // Should redirect to list
    await expect(page).toHaveURL("/analytics/visualizations");
  });

  test("should display saved visualizations", async ({ page }) => {
    await page.goto("/analytics/visualizations");

    // Should show list
    await expect(page.locator("h1")).toContainText("Visualizations");

    // Should have create button
    await expect(page.locator('text="+ Create Visualization"')).toBeVisible();
  });

  test("should export chart as PNG", async ({ page }) => {
    await page.goto("/analytics/visualizations/1");

    // Wait for chart to load
    await page.waitForSelector("canvas");

    // Click export button
    const downloadPromise = page.waitForEvent("download");
    await page.click('text="300 DPI (Print)"');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });
});

test.describe("3D Topic Clustering", () => {
  test("should render 3D visualization", async ({ page }) => {
    await page.goto("/analytics/3d-topics");

    // Wait for 3D scene to load
    await page.waitForSelector("canvas");

    // Should show controls instructions
    await expect(page.locator('text="Controls:"')).toBeVisible();
  });

  test("should select a topic node", async ({ page }) => {
    await page.goto("/analytics/3d-topics");

    await page.waitForSelector("canvas");

    // Click on canvas (simulates node selection)
    await page.click("canvas");

    // Should show topic details
    await expect(page.locator('text="Topic Details"')).toBeVisible();
  });

  test("should change color scheme", async ({ page }) => {
    await page.goto("/analytics/3d-topics");

    // Select different color scheme
    await page.selectOption('select[name="colorScheme"]', "size");

    // Should update visualization
    await page.waitForTimeout(500);
  });
});

test.describe("Dashboard Builder", () => {
  test("should create a new dashboard", async ({ page }) => {
    await page.goto("/analytics/dashboards/new");

    // Enter dashboard name
    await page.fill('input[placeholder="Dashboard Name"]', "Test Dashboard");

    // Add a widget
    await page.click('text="+ Add Widget"');
    await page.click('text="Chart"');

    // Wait for widget to appear
    await page.waitForSelector('text="New chart"');

    // Save dashboard
    await page.click('text="Save Dashboard"');

    // Should redirect
    await expect(page).toHaveURL("/analytics/dashboards");
  });

  test("should drag and resize widgets", async ({ page }) => {
    await page.goto("/analytics/dashboards/1");

    // Enter edit mode
    await page.click('text="Edit"');

    // Wait for grid layout
    await page.waitForSelector(".react-grid-layout");

    // Drag widget (requires specific coordinates)
    const widget = page.locator(".react-grid-item").first();
    await widget.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.up();

    // Save changes
    await page.click('text="Save Dashboard"');
  });
});

test.describe("Forecasting", () => {
  test("should view forecast", async ({ page }) => {
    await page.goto("/analytics/forecasts");

    // Should show forecasts list
    await expect(page.locator('text="Time-Series Forecasting"')).toBeVisible();

    // Click on a forecast
    await page.click(".border-blue-500");

    // Should show forecast chart
    await page.waitForSelector("canvas");
    await expect(page.locator('text="Model Performance Metrics"')).toBeVisible();
  });

  test("should display confidence intervals", async ({ page }) => {
    await page.goto("/analytics/forecasts");

    // Select first forecast
    await page.click("button:has-text('topics')");

    // Should show confidence bands in legend
    await expect(page.locator('text="Confidence Interval"')).toBeVisible();
  });
});

test.describe("Comparative Analytics", () => {
  test("should compare multiple feeds", async ({ page }) => {
    await page.goto("/analytics/comparison");

    // Select feeds to compare
    await page.selectOption("select[multiple]", ["feed-1", "feed-2", "feed-3"]);

    // Should show comparison chart
    await page.waitForSelector("canvas");

    // Should show comparison cards
    await expect(page.locator('text="Key Metrics Comparison"')).toBeVisible();
  });

  test("should display correlation matrix", async ({ page }) => {
    await page.goto("/analytics/comparison");

    // Scroll to correlation matrix
    await page.locator('text="Correlation Matrix"').scrollIntoViewIfNeeded();

    // Should show matrix table
    await expect(page.locator("table")).toBeVisible();
  });
});

test.describe("Data Export", () => {
  test("should export data as JSON", async ({ page }) => {
    await page.goto("/analytics/export");

    // Select a table
    await page.click('text="topic_metrics"');

    // Select format
    await page.click('text="JSON"');

    // Export
    const downloadPromise = page.waitForEvent("download");
    await page.click('text="Export Data"');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test("should bulk export multiple tables", async ({ page }) => {
    await page.goto("/analytics/export");

    // Select multiple tables
    await page.click('text="topic_metrics"');
    await page.click('text="feed_health"');
    await page.click('text="article_metadata"');

    // Should show count
    await expect(page.locator('text="3"')).toBeVisible();

    // Export
    await page.click('text="Export Data"');
  });
});

test.describe("Accessibility", () => {
  test("should navigate with keyboard", async ({ page }) => {
    await page.goto("/analytics/visualizations");

    // Tab through elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Should focus on create button
    const focused = await page.evaluateHandle(() => document.activeElement);
    const tagName = await focused.evaluate((el) => el?.tagName);
    expect(tagName).toBe("BUTTON");
  });

  test("should have proper ARIA labels", async ({ page }) => {
    await page.goto("/analytics/visualizations/new");

    // Check for ARIA labels
    const buttons = await page.$$("button[aria-label]");
    expect(buttons.length).toBeGreaterThan(0);
  });
});

test.describe("Responsive Design", () => {
  test("should work on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/analytics/visualizations");

    // Should show mobile layout
    await expect(page.locator("h1")).toBeVisible();
  });

  test("should work on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/analytics/dashboards");

    // Should show tablet layout
    await expect(page.locator("h1")).toBeVisible();
  });
});
