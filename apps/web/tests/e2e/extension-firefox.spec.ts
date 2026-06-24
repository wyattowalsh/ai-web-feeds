import { expect, test } from "@playwright/test";

test.describe("extension compatibility", () => {
  test("MV3 manifest is served for unpacked extension loading", async ({ request }) => {
    const response = await request.get("/extension/manifest.json");
    expect(response.ok()).toBeTruthy();
    const manifest = (await response.json()) as {
      manifest_version: number;
      background?: { service_worker?: string };
    };
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background?.service_worker).toBeTruthy();
  });

  test("reading list bridge works in Firefox", async ({ page }) => {
    await page.goto("/feeds/reading-list");
    await expect(page.getByRole("heading", { name: "Reading list queue" })).toBeVisible();
  });
});
