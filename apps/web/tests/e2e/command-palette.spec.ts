import { expect, test } from "@playwright/test";

import { gotoWithRetry } from "./helpers/navigation";

test.use({ video: "off" });

const paletteShortcut = process.platform === "darwin" ? "Meta+k" : "Control+k";

test.describe("Hub command palette", () => {
  test("opens with shortcut, closes with Escape, and reopens", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWithRetry(page, "/docs", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Documentation", exact: true })).toBeVisible();

    await page.locator("body").click({ position: { x: 8, y: 8 } });
    await page.keyboard.press(paletteShortcut);
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#hub-command-input")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await page.keyboard.press(paletteShortcut);
    await expect(dialog).toBeVisible();
    await expect(page.locator("#hub-command-input")).toBeFocused();
  });

  test("does not open while reader search input is focused", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWithRetry(page, "/reader", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#reader-search")).toBeVisible();

    await page.locator("#reader-search").click();
    await page.keyboard.press(paletteShortcut);

    await expect(page.getByRole("dialog", { name: "Command palette" })).toHaveCount(0);
  });
});
