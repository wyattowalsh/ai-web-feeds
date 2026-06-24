import { expect, test } from "@playwright/test";

test.describe("cached search filters", () => {
  test("search page renders cached worker section", async ({ page }) => {
    await page.goto("/search?q=agent");
    await expect(page.getByRole("heading", { name: "Cached articles (offline)" })).toBeVisible();
    await expect(page.getByLabel("Advanced search query")).toBeVisible();
  });
});
