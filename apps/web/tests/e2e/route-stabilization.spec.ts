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

async function gotoWithRetry(
  page: Page,
  path: string,
  options?: Parameters<Page["goto"]>[1],
  attempts = 2,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(path, options);
      return;
    } catch (error) {
      lastError = error;
      const isAbortError = error instanceof Error && error.message.includes("ERR_ABORTED");
      if (!isAbortError || attempt === attempts - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

test.describe("Route stabilization smoke", () => {
  const publicRoutes = [
    {
      path: "/",
      text: "Follow AI and machine learning sources in one place.",
      role: "heading" as const,
    },
    {
      path: "/feeds",
      text: "Read and filter your feeds",
      role: "heading" as const,
    },
    {
      path: "/feeds?mode=catalog",
      text: "Narrow the catalog",
      role: "heading" as const,
    },
    {
      path: "/downloads",
      text: "Download the feed catalog",
      role: "heading" as const,
    },
    {
      path: "/docs",
      text: "Documentation",
      role: "heading" as const,
      timeout: 120_000,
    },
    {
      path: "/explorer",
      text: "Explore topics and sources before opening them in Feeds.",
      role: "heading" as const,
    },
    {
      path: "/stats",
      text: "Track collection health instead of guessing at it.",
      role: "heading" as const,
    },
  ];

  for (const route of publicRoutes) {
    test(`loads ${route.path}`, async ({ page }) => {
      test.setTimeout(route.timeout ?? 60_000);
      const tracker = trackClientErrors(page);

      await gotoWithRetry(page, route.path, { waitUntil: "commit", timeout: route.timeout });
      const locator = page.getByRole("heading", { name: route.text });
      await expect(locator).toBeVisible({ timeout: 30_000 });

      await expectNoClientErrors(page, tracker);
    });
  }

  test("shows the intentional unavailable state on /recommendations without a backend", async ({
    page,
  }) => {
    const tracker = trackClientErrors(page);

    await gotoWithRetry(page, "/recommendations", { waitUntil: "networkidle" });
    await expect(page.getByText("Recommendations backend unavailable")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open catalog" })).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("shows the intentional unavailable state on /analytics without a backend", async ({
    page,
  }) => {
    const tracker = trackClientErrors(page);

    await gotoWithRetry(page, "/analytics", { waitUntil: "networkidle" });
    await expect(page.getByText("Analytics backend unavailable")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open catalog" })).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("renders comparison charts without Chart.js controller errors", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await gotoWithRetry(page, "/analytics/comparison", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Comparative Analytics" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("renders forecast charts without Chart.js controller errors", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await gotoWithRetry(page, "/analytics/forecasts", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Time-Series Forecasting" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });
});

test.describe("Admin auth", () => {
  test("loads /admin/login for unauthenticated users", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await gotoWithRetry(page, "/admin/login", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Protected observability for API telemetry." }),
    ).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("redirects unauthenticated /admin traffic to login", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await gotoWithRetry(page, "/admin", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    await expect(
      page.getByRole("heading", { name: "Protected observability for API telemetry." }),
    ).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("supports login and logout without redirect loops", async ({ page }) => {
    test.setTimeout(60_000);
    const tracker = trackClientErrors(page);

    await gotoWithRetry(page, "/admin/login", { waitUntil: "networkidle" });
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
