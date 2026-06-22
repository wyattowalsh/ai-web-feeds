import { expect, test, type Page } from "@playwright/test";

test.use({ video: "off" });

async function gotoReader(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/reader", { waitUntil: "domcontentloaded" });
  await expect(page.locator("article h3").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("reader-workspace-grid")).toBeVisible();
  await page.locator("body").click({ position: { x: 8, y: 8 } });
}

test.describe("Reader keyboard shortcuts", () => {
  test("j and k move article preview selection", async ({ page }) => {
    await gotoReader(page);

    const articleButtons = page.locator("article button[aria-pressed]");
    await expect(articleButtons.first()).toHaveAttribute("aria-pressed", "false");

    await expect
      .poll(async () => {
        await page.keyboard.press("j");
        return articleButtons.first().getAttribute("aria-pressed");
      })
      .toBe("true");

    const count = await articleButtons.count();
    if (count > 1) {
      await page.keyboard.press("j");
      await expect(articleButtons.nth(1)).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("k");
      await expect(articleButtons.first()).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("question mark opens keyboard shortcuts sheet", async ({ page }) => {
    await gotoReader(page);
    await page.locator("body").click({ position: { x: 8, y: 8 } });

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    });

    await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
    await expect(page.getByText("Navigate to next article")).toBeVisible();
  });

  test("j does not change selection while shortcuts sheet is open", async ({ page }) => {
    await gotoReader(page);
    await page.locator("body").click({ position: { x: 8, y: 8 } });

    const articleButtons = page.locator("article button[aria-pressed]");
    await expect(articleButtons.first()).toHaveAttribute("aria-pressed", "false");

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    });
    await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();

    await page.keyboard.press("j");
    await expect(articleButtons.first()).toHaveAttribute("aria-pressed", "false");
  });

  test("slash focuses the reader search field", async ({ page }) => {
    await gotoReader(page);

    await expect
      .poll(async () => {
        await page.keyboard.press("/");
        return page.locator("#reader-search").evaluate((el) => document.activeElement === el);
      })
      .toBe(true);
  });
});
