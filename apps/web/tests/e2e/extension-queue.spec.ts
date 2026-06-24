import { expect, test } from "@playwright/test";

test.describe("extension reading list", () => {
  test("reading list queue page loads with bridge", async ({ page }) => {
    await page.goto("/feeds/reading-list");
    await expect(page.getByRole("heading", { name: "Reading list queue" })).toBeVisible();
    await expect(page.getByText(/queue is empty|SAVE_ARTICLE|SUBSCRIBE_FEED/i)).toBeVisible();
  });

  test("extension message handler accepts queued payloads in localStorage", async ({ page }) => {
    await page.goto("/feeds/reading-list");
    await page.evaluate(() => {
      localStorage.setItem(
        "aiwebfeeds.extensionQueue",
        JSON.stringify([
          {
            id: "e2e_1",
            type: "SAVE_ARTICLE",
            payload: { url: "https://example.com/article", title: "E2E Article" },
            receivedAt: Date.now(),
            status: "queued",
          },
        ]),
      );
    });
    await page.reload();
    await expect(page.getByText("SAVE_ARTICLE")).toBeVisible();
    await expect(page.getByText("https://example.com/article")).toBeVisible();
  });
});
