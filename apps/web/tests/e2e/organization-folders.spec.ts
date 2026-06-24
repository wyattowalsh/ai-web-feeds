import { expect, test } from "@playwright/test";

import { gotoWithRetry, typeIntoControlledInput } from "./helpers/navigation";

test.describe("feed organization", () => {
  test("custom views page persists a saved view", async ({ page }) => {
    await gotoWithRetry(page, "/feeds/views");
    await expect(page.getByRole("heading", { name: "Feed organization" })).toBeVisible();

    const viewName = `E2E View ${Date.now()}`;
    const nameInput = page.getByLabel(/view name/i);
    await typeIntoControlledInput(nameInput, viewName);
    await page.getByRole("button", { name: /save view/i }).click();
    await expect(page.getByRole("listitem").filter({ hasText: viewName })).toBeVisible({
      timeout: 15_000,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("listitem").filter({ hasText: viewName })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("folder tree renders on organization page", async ({ page }) => {
    await page.goto("/feeds/views");
    await expect(page.getByRole("heading", { name: /folders/i })).toBeVisible();
  });
});
