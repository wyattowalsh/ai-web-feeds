import { expect, test, type Page } from "@playwright/test";

function trackClientErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return { consoleErrors, pageErrors };
}

async function expectNoClientErrors(page: Page, tracker: ReturnType<typeof trackClientErrors>) {
  await expect.poll(() => tracker.consoleErrors, { timeout: 1000 }).toEqual([]);
  await expect.poll(() => tracker.pageErrors, { timeout: 1000 }).toEqual([]);
}

test.describe("Route stabilization smoke", () => {
  const publicRoutes = [
    {
      path: "/",
      text: "Feeds is the main product. Everything else supports reading, filtering, and export.",
    },
    {
      path: "/feeds",
      text: "Reader-first feeds workspace",
    },
    {
      path: "/feeds?mode=catalog",
      text: "Narrow the catalog",
    },
    {
      path: "/downloads",
      text: "Download Feeds",
    },
    {
      path: "/docs",
      text: "Getting Started",
      role: "heading" as const,
    },
    {
      path: "/explorer",
      text: "Inspect the catalog, then open the current slice in Feeds.",
      role: "heading" as const,
    },
    {
      path: "/stats",
      text: "Track collection health instead of guessing at it.",
    },
  ];

  for (const route of publicRoutes) {
    test(`loads ${route.path}`, async ({ page }) => {
      test.setTimeout(60_000);
      const tracker = trackClientErrors(page);

      await page.goto(route.path, { waitUntil: "commit" });
      const locator =
        route.role === "heading"
          ? page.getByRole("heading", { name: route.text })
          : page.getByText(route.text);
      await expect(locator).toBeVisible({ timeout: 30_000 });

      await expectNoClientErrors(page, tracker);
    });
  }

  test("shows the intentional unavailable state on /recommendations without a backend", async ({
    page,
  }) => {
    const tracker = trackClientErrors(page);

    await page.goto("/recommendations", { waitUntil: "networkidle" });
    await expect(page.getByText("Recommendations backend unavailable")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open catalog" })).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("shows the intentional unavailable state on /analytics without a backend", async ({
    page,
  }) => {
    const tracker = trackClientErrors(page);

    await page.goto("/analytics", { waitUntil: "networkidle" });
    await expect(page.getByText("Analytics backend unavailable")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open catalog" })).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("renders comparison charts without Chart.js controller errors", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await page.goto("/analytics/comparison", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Comparative Analytics" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("renders forecast charts without Chart.js controller errors", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await page.goto("/analytics/forecasts", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Time-Series Forecasting" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });
});

test.describe("Admin auth", () => {
  test("loads /admin/login for unauthenticated users", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await page.goto("/admin/login", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Protected observability for API telemetry." }),
    ).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("redirects unauthenticated /admin traffic to login", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    await expect(
      page.getByRole("heading", { name: "Protected observability for API telemetry." }),
    ).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("supports login and logout without redirect loops", async ({ page }) => {
    test.setTimeout(60_000);
    const tracker = trackClientErrors(page);

    await page.goto("/admin/login", { waitUntil: "networkidle" });
    await page.getByLabel("Admin password").fill("test-admin-password");
    await page.getByRole("button", { name: "Unlock admin" }).click();

    await expect(page).toHaveURL("/admin", { timeout: 30_000 });
    await expect(page.getByText("API observability")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/admin/login", { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Unlock admin" })).toBeVisible({
      timeout: 30_000,
    });

    await expectNoClientErrors(page, tracker);
  });
});
