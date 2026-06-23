import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ video: "off" });

async function typeIntoControlledInput(input: Locator, value: string) {
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 30 });
  await expect(input).toHaveValue(value, { timeout: 10_000 });
}

async function gotoWithRetry(page: Page, path: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 45_000 });
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isRetryable =
        message.includes("ERR_ABORTED") ||
        message.includes("Timeout") ||
        message.includes("net::ERR");
      if (!isRetryable || attempt === attempts - 1) {
        throw error;
      }
      await page.waitForTimeout(500 * (attempt + 1));
    }
  }
  throw lastError;
}

test.describe("Reader handoff flows", () => {
  test("sources search opens reader with feed scope preserved", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWithRetry(page, "/sources");
    await expect(page.getByRole("heading", { name: "Browse sources" })).toBeVisible();

    const input = page.locator("#search");
    await typeIntoControlledInput(input, "agent");

    const readInReader = page.getByRole("link", { name: /Read .+ in the reader/i }).first();
    await expect(readInReader).toBeVisible({ timeout: 15_000 });
    await expect(readInReader).toHaveAttribute("href", /feed=/);

    await readInReader.click();
    await expect(page).toHaveURL(/\/reader\?.*feed=/, { timeout: 20_000 });
    await expect(page.getByTestId("reader-workspace-grid")).toBeVisible();
  });

  test("search continue-in-reader link preserves query", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search?q=agent", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/Showing results for/i)).toBeVisible({ timeout: 15_000 });
    const continueInReader = page.getByRole("link", { name: "Continue in reader" });
    await expect(continueInReader).toBeVisible();
    await expect(continueInReader).toHaveAttribute("href", /\/reader\?q=agent/);
    await continueInReader.click();
    await expect(page).toHaveURL(/\/reader\?q=agent/, { timeout: 20_000 });
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
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoWithRetry(page, "/reader");
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });

    await expect(async () => {
      await gotoWithRetry(page, "/docs", 4);
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    }).toPass({ timeout: 120_000 });
  });
});
