import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const articleCorpusPath = path.resolve(
  process.cwd(),
  "..",
  "..",
  "data",
  "articles.generated.json",
);
const corpusFixture = {
  metadata: {
    generated_at: "2026-04-22T00:00:00.000Z",
    source_db: "playwright-fixture",
    article_count: 2,
    feed_count: 2,
    latest_published_at: "2026-04-21T15:00:00.000Z",
  },
  articles: [
    {
      id: "fixture-article-1",
      feed_id: "fixture-feed-1",
      feed_title: "Fixture Feed One",
      title: "OpenAI models weekly briefing",
      link: "https://example.com/fixture-article-1",
      summary: "A deterministic precomputed article for route-level workflow tests.",
      content_html: "<p>A deterministic precomputed article for route-level workflow tests.</p>",
      author: "Fixture Author",
      published_at: "2026-04-21T15:00:00.000Z",
      categories: ["models", "llm"],
      topics: ["models", "llm"],
      source_type: "blog",
      verified: true,
      is_active: true,
    },
    {
      id: "fixture-article-2",
      feed_id: "fixture-feed-2",
      feed_title: "Fixture Feed Two",
      title: "Agent systems roundup",
      link: "https://example.com/fixture-article-2",
      summary: "A second article keeps list and preview interactions realistic.",
      content_html: "<p>A second article keeps list and preview interactions realistic.</p>",
      author: "Fixture Author",
      published_at: "2026-04-20T12:00:00.000Z",
      categories: ["agents"],
      topics: ["agents"],
      source_type: "newsletter",
      verified: false,
      is_active: true,
    },
  ],
};

let originalCorpus: string | null = null;

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

async function firstArticleSearchToken(page: Page): Promise<string> {
  const title = (await page.locator("article h3").first().textContent())?.trim() ?? "ai";
  const token =
    title
      .split(/\s+/)
      .map((part) => part.replace(/[^\p{L}\p{N}-]/gu, ""))
      .find((part) => part.length >= 4) ?? "feeds";
  return token.toLowerCase();
}

test.beforeAll(async () => {
  originalCorpus = await readFile(articleCorpusPath, "utf8").catch(() => null);
  await mkdir(path.dirname(articleCorpusPath), { recursive: true });
  await writeFile(articleCorpusPath, JSON.stringify(corpusFixture, null, 2), "utf8");
});

test.afterAll(async () => {
  if (originalCorpus === null) {
    await rm(articleCorpusPath, { force: true });
    return;
  }
  await writeFile(articleCorpusPath, originalCorpus, "utf8");
});

test.describe("Route stabilization smoke", () => {
  const publicRoutes = [
    {
      path: "/",
      text: "Latest AI posts from across the open web",
      role: "heading" as const,
    },
    {
      path: "/feeds",
      text: "Latest AI posts from across the open web",
      role: "heading" as const,
    },
    {
      path: "/feeds?mode=catalog",
      text: "Browse sources",
      role: "heading" as const,
    },
    {
      path: "/docs",
      text: "Documentation",
      role: "heading" as const,
      exact: true,
    },
    {
      path: "/explorer",
      text: "Inspect the catalog map, then hand the slice back to the reader.",
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

      await page.goto(route.path, { waitUntil: "commit" });
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

  test("reader search applies explicitly and updates the canonical URL", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("article h3").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Close preview" })).toHaveCount(0);

    const token = await firstArticleSearchToken(page);

    const desktopSearch = page.getByRole("textbox", { name: "Search posts" });
    await desktopSearch.fill(token);
    await page.getByRole("button", { name: "Apply filters" }).first().click();

    await expect(page).toHaveURL(new RegExp(`\\/?\\?q=${token}`));
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

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Close preview" })).toHaveCount(0);

    await page.getByRole("button", { name: "Preview" }).first().click();
    await expect(page.getByRole("button", { name: "Close preview" })).toBeVisible();

    const desktopSearch = page.getByRole("textbox", { name: "Search posts" });
    await desktopSearch.fill("agent");
    await page.getByRole("button", { name: "Apply filters" }).first().click();

    await expect(page).toHaveURL(/\?q=agent$/);
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

    await page.goto("/?mode=catalog", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Browse sources" })).toBeVisible();

    await page.getByRole("link", { name: "Open in reader" }).first().click();

    await expect(page).not.toHaveURL(/mode=catalog/);
    await expect(page).toHaveURL(/feed=/);
    await expect(
      page.getByRole("heading", { name: "Latest AI posts from across the open web" }),
    ).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("mobile keeps filters collapsed until needed and preserves URL-driven reader state", async ({
    page,
  }) => {
    const tracker = trackClientErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
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
    await mobileSearch.fill(token);
    await page.getByRole("button", { name: "Apply filters" }).last().click();

    await expect(page).toHaveURL(new RegExp(`\\/?\\?q=${token}`));
    await expect(
      page.getByRole("heading", { name: new RegExp(`Results for .+${token}`, "i") }),
    ).toBeVisible();

    await expectNoClientErrors(page, tracker);
  });

  test("explorer keeps graph tuning behind an explicit advanced disclosure", async ({ page }) => {
    const tracker = trackClientErrors(page);

    await page.goto("/explorer", { waitUntil: "networkidle" });
    const advancedSummary = page.getByText("Advanced controls", { exact: true });
    await expect(advancedSummary).toBeVisible();
    await expect(page.getByLabel("Layout")).toBeHidden();

    await advancedSummary.click();
    await expect(page.getByLabel("Layout")).toBeVisible();

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
