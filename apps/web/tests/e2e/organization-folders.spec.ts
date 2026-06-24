import { expect, test } from "@playwright/test";

test.describe("feed organization", () => {
  test("custom views page persists a saved view", async ({ page }) => {
    await page.goto("/feeds/views");
    await expect(page.getByRole("heading", { name: "Feed organization" })).toBeVisible();

    const viewName = `E2E View ${Date.now()}`;
    await page.getByLabel(/view name/i).fill(viewName);
    await page.getByRole("button", { name: /save view/i }).click();
    await expect(page.getByText(viewName)).toBeVisible();

    await page.reload();
    await expect(page.getByText(viewName)).toBeVisible();
  });

  test("folder tree renders on organization page", async ({ page }) => {
    await page.goto("/feeds/views");
    await expect(page.getByRole("heading", { name: /folders/i })).toBeVisible();
  });
});
