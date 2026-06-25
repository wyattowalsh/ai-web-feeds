import { expect, test } from "@playwright/test";

import { gotoWithRetry } from "./helpers/navigation";

test.use({ video: "off" });

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.describe("Account page auth", () => {
  test("redirects unauthenticated visitors to login with a next param", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWithRetry(page, "/account", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/login\?next=%2Faccount/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Pick up where you left off." })).toBeVisible();
  });
});

test.describe("Account merge API", () => {
  test("returns 401 without an authenticated session", async ({ request }) => {
    const identityResponse = await request.get("/api/identity");
    expect(identityResponse.ok()).toBeTruthy();

    const identityBody = (await identityResponse.json()) as { user_id?: string };
    const fromUserId = identityBody.user_id;
    expect(fromUserId).toMatch(UUID_V4_REGEX);

    const mergeResponse = await request.post("/api/user/merge", {
      data: {
        from_user_id: fromUserId,
        to_user_id: fromUserId,
      },
    });

    expect(mergeResponse.status()).toBe(401);
    const body = (await mergeResponse.json()) as { error?: string };
    expect(body.error).toMatch(/authenticated session/i);
  });
});
