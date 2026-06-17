import { expect, test } from "@playwright/test";

test.use({ video: "off" });

test.describe("Reader handoff flows", () => {
  test("sources search opens reader with feed scope preserved", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/sources", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Browse sources" })).toBeVisible();

    const input = page.locator("#search");
    await input.fill("agent");
    await expect(input).toHaveValue("agent");

    const readInReader = page.getByRole("link", { name: /Read .+ in the reader/i }).first();
    await expect(readInReader).toBeVisible({ timeout: 15_000 });

    await readInReader.click();
    await expect(page).toHaveURL(/\/reader\?.*feed=/, { timeout: 15_000 });
    await expect(page.getByTestId("reader-workspace-grid")).toBeVisible();
  });

  test("search continue-in-reader link preserves query", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search?q=agent", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/Showing results for/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: "Continue in reader" }).click();

    await expect(page).toHaveURL(/\/reader\?q=agent/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Search: agent/i })).toBeVisible();
  });

  test("for you recommendation opens reader with pinned feed", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/for-you", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "For You" })).toBeVisible();

    const readInReader = page.getByRole("link", { name: "Read in reader" }).first();
    const hasRecommendations = (await readInReader.count()) > 0;
    test.skip(!hasRecommendations, "No recommendations loaded in this environment");

    await readInReader.click();
    await expect(page).toHaveURL(/\/reader\?.*feed=/, { timeout: 15_000 });
    await expect(page.getByTestId("reader-workspace-grid")).toBeVisible();
  });
});

test.describe("Hub dark-mode smoke", () => {
  test("reader and docs load under dark color scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const route of ["/reader", "/docs"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });
});
