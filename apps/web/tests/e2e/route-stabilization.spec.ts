import { getViolations, injectAxe } from "axe-playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  PLAYWRIGHT_AXE_OPTIONS,
  buildAxeFailureMessage,
  summarizeAxeViolations,
} from "../../lib/accessibility/axe-tests";

test.use({ video: "off" });
test.describe.configure({ mode: "serial" });

function trackClientErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const ignoredConsoleErrors = [
    "Failed to load resource: net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin",
    "Failed to load resource: net::ERR_NAME_NOT_RESOLVED",
  ];

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!ignoredConsoleErrors.includes(text)) {
        consoleErrors.push(text);
      }
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

async function warnOnA11yViolations(page: Page, testInfo: TestInfo) {
  if (page.isClosed() || page.url() === "about:blank") {
    return;
  }

  await injectAxe(page);
  const violations = await getViolations(page, undefined, PLAYWRIGHT_AXE_OPTIONS);

  if (violations.length === 0) {
    return;
  }

  const summary = summarizeAxeViolations(violations);
  await testInfo.attach("axe-violations.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          title: testInfo.title,
          url: page.url(),
          violationCount: summary.length,
          violations: summary,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
  console.warn(buildAxeFailureMessage(`[axe warning] ${testInfo.title}`, summary));
}

async function firstArticleSearchToken(page: Page): Promise<string> {
  const title = (await page.locator("article h3").first().textContent())?.trim() ?? "ai";
  const token =
    title
      .split(/\s+/)
      .map((part) => part.replace(/[^\p{L}\p{N}-]/gu, ""))
      .find((part) => part.length >= 4) ?? "feeds";
  return token.toLowerCase();
}

test.afterEach(async ({ page }, testInfo) => {
  await warnOnA11yViolations(page, testInfo);
});

test.describe("Route stabilization smoke", () => {
  const publicRoutes: Array<{
    path: string;
    text: string;
    role: "heading";
    exact?: boolean;
    timeout?: number;
  }> = [
    {
      path: "/",
      text: "Read AI writing across the open web",
      role: "heading" as const,
    },
    {
      path: "/reader",
      text: "Read AI writing across the open web",
      role: "heading" as const,
    },
    {
      path: "/sources",
      text: "Browse sources",
      role: "heading" as const,
    },
    {
      path: "/docs",
      text: "Documentation",
      role: "heading" as const,
      exact: true,
      timeout: 120_000,
    },
    {
      path: "/dashboard",
      text: "Catalog health without the control room.",
      role: "heading" as const,
    },
  ];

  for (const route of publicRoutes) {
    test(`loads ${route.path}`, async ({ page }) => {
      test.setTimeout(route.timeout ?? 60_000);
      const tracker = trackClientErrors(page);

      await gotoWithRetry(page, route.path, { waitUntil: "domcontentloaded" });
      const locator =
        route.role === "heading"
          ? page.getByRole("heading", {
              name: route.text,
              exact: route.exact ?? false,
            })
          : page.getByText(route.text);
      await expect(locator).toBeVisible({ timeout: 30_000 });

      await expectNoClientErrors(page, tracker);
    });
  }

  test("reader search applies explicitly and updates the canonical URL", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await gotoWithRetry(page, "/reader", { waitUntil: "domcontentloaded" });
    await expect(page.locator("article h3").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Close preview" })).toHaveCount(0);

    const token = await firstArticleSearchToken(page);

    const desktopSearch = page.getByRole("textbox", { name: "Search posts" });
    await desktopSearch.fill(token);
    await page.getByRole("button", { name: "Apply filters" }).first().click();

    await expect(page).toHaveURL(new RegExp(`/reader\\?q=`));
    await expect(
      page.getByRole("heading", { name: new RegExp(`Results for .+${token}`, "i") }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: new RegExp(`Search: ${token}`, "i") }),
    ).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("desktop preview opens and closes explicitly without blocking the filter rail", async ({
    page,
  }) => {
    const tracker = trackClientErrors(page);

    await gotoWithRetry(page, "/reader", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Close preview" })).toHaveCount(0);

    await page.getByRole("button", { name: "Preview" }).first().click();
    await expect(page.getByRole("button", { name: "Close preview" })).toBeVisible();

    const desktopSearch = page.getByRole("textbox", { name: "Search posts" });
    await desktopSearch.fill("agent");
    await page.getByRole("button", { name: "Apply filters" }).first().click();

    await expect(page).toHaveURL(/\/reader\?q=agent$/);
    await expect(page.getByRole("heading", { name: /Results for .+agent/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close preview" })).toHaveCount(0);

    await page.getByRole("button", { name: "Preview" }).first().click();
    await expect(page.getByRole("button", { name: "Close preview" })).toBeVisible();
    await page.getByRole("button", { name: "Close preview" }).click();
    await expect(page.getByRole("button", { name: "Close preview" })).toHaveCount(0);

    await expectNoClientErrors(page, tracker);
  });

  test("catalog mode can hand a source slice back into the reader", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await gotoWithRetry(page, "/sources", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Browse sources" })).toBeVisible();

    await page
      .getByRole("link", { name: /Read .+ in the reader/ })
      .first()
      .click();

    await expect(page).not.toHaveURL(/mode=catalog/);
    await expect(page).toHaveURL(/feed=/);
    await expect(
      page.getByRole("heading", { name: "Read AI writing across the open web" }),
    ).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("mobile keeps filters collapsed until needed and preserves URL-driven reader state", async ({
    page,
  }) => {
    const tracker = trackClientErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoWithRetry(page, "/reader", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Filters and view")).toBeVisible();
    await expect(page.locator("article h3").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Close preview" })).toHaveCount(0);

    await page.getByRole("button", { name: "Preview" }).first().click();
    await expect(page.getByRole("button", { name: "Close preview" })).toBeVisible();
    await page.getByRole("button", { name: "Close preview" }).click();
    await expect(page.getByRole("button", { name: "Close preview" })).toHaveCount(0);

    const token = await firstArticleSearchToken(page);

    await page.getByText("Filters and view").click();
    const mobileSearch = page.getByRole("textbox", { name: "Search posts mobile" });
    await expect(mobileSearch).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const input = document.querySelector<HTMLInputElement>(
            'input[aria-label="Search posts mobile"]',
          );
          if (!input) {
            return null;
          }

          const rect = input.getBoundingClientRect();
          const target = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );

          return target?.getAttribute("aria-label") ?? target?.textContent?.trim() ?? null;
        }),
      )
      .toBe("Search posts mobile");
    await mobileSearch.fill(token);
    await page.getByRole("button", { name: "Apply filters" }).last().click();

    await expect(page).toHaveURL(new RegExp(`/reader\\?q=`));
    await expect(
      page.getByRole("heading", { name: new RegExp(`Results for .+${token}`, "i") }),
    ).toBeVisible();

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
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();

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
});
