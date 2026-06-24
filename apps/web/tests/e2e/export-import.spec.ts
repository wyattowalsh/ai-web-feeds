import { expect, test } from "@playwright/test";

test.describe("data portability", () => {
  test("export buttons complete within budget", async ({ page }) => {
    await page.goto("/settings/data-portability");
    await expect(page.getByRole("heading", { name: "Data portability" })).toBeVisible();

    const started = Date.now();
    await page.getByRole("button", { name: "Export JSON" }).click();
    await expect(page.getByText(/Exported json/i)).toBeVisible({ timeout: 10_000 });
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  test("import control is available", async ({ page }) => {
    await page.goto("/settings/data-portability");
    await expect(page.getByText(/Import JSON/i)).toBeVisible();
  });
});
