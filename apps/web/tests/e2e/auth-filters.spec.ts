import { expect, test } from "@playwright/test";

import { gotoWithRetry } from "./helpers/navigation";

test.use({ video: "off" });

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.describe("Anonymous reader identity", () => {
  test("anonymous user can use reader with a client UUID", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWithRetry(page, "/reader", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("reader-workspace-grid")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("article h3").first()).toBeVisible({ timeout: 30_000 });

    const identity = await page.evaluate(async () => {
      const response = await fetch("/api/identity", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const headerUserId = response.headers.get("x-aiwf-anon-user-id");
      if (headerUserId) {
        window.localStorage.setItem("aiwebfeeds_user_id", headerUserId);
      }
      const payload = (await response.json()) as { user_id?: string };
      return {
        apiUserId: payload.user_id ?? headerUserId,
        storedUserId: window.localStorage.getItem("aiwebfeeds_user_id"),
      };
    });

    expect(identity.apiUserId).toMatch(UUID_V4_REGEX);
    expect(identity.storedUserId).toMatch(UUID_V4_REGEX);
    expect(identity.storedUserId).toBe(identity.apiUserId);
  });
});

test.describe("Saved reader filter API", () => {
  test("degrades gracefully when persistence is unavailable (503 or empty)", async ({
    request,
  }) => {
    const identityResponse = await request.get("/api/identity");
    expect(identityResponse.ok()).toBeTruthy();

    const identityBody = (await identityResponse.json()) as { user_id?: string };
    const userId = identityBody.user_id;
    expect(userId).toMatch(UUID_V4_REGEX);

    const filtersResponse = await request.get(`/api/user/filters?user_id=${userId}`);
    const status = filtersResponse.status();

    if (status === 503) {
      const body = (await filtersResponse.json()) as { error?: string };
      expect(body.error).toMatch(/DATABASE_URL|unavailable/i);
      return;
    }

    expect(status).toBe(200);
    const body = (await filtersResponse.json()) as {
      user_id?: string;
      filters?: unknown[];
      count?: number;
    };
    expect(body.user_id).toBe(userId);
    expect(body.filters).toEqual([]);
    expect(body.count).toBe(0);
  });
});

test.describe("Reader saved filter presets", () => {
  test("shows sign-in hint for anonymous visitors without a stored user id", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("aiwebfeeds_user_id");
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWithRetry(page, "/reader", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("reader-workspace-grid")).toBeVisible({ timeout: 30_000 });

    const savedFilters = page.getByTestId("reader-saved-filters-desktop");
    await expect(savedFilters).toBeVisible({ timeout: 15_000 });
    await expect(savedFilters.getByText("Sign in to save presets")).toBeVisible();
    await expect(savedFilters.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Freader",
    );
  });
});

test.describe("Login page smoke", () => {
  test("renders OAuth providers and email sign-in tabs", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWithRetry(page, "/login", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Pick up where you left off." })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Magic link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await page.getByRole("tab", { name: "Magic link" }).click();
    await expect(page.locator('form[data-mode="magic"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("login-password-field")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Email magic link" })).toBeVisible();
  });
});
