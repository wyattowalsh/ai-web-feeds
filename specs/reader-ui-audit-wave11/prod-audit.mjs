import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = "https://aiwebfeeds.vercel.app";
const outRoot = path.resolve(
  import.meta.dirname,
  "screenshots",
);

async function shot(page, parts, name) {
  const dir = path.join(outRoot, ...parts);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

const results = {};

await page.goto(`${base}/reader`, { waitUntil: "domcontentloaded", timeout: 60000 });
results.readerEmpty = {
  screenshot: await shot(page, ["reader", "1440x900", "light"], "reader-empty"),
  articles: await page.locator("article h3").count(),
  search: await page.locator("#reader-search").count(),
};

const loadBtn = page.getByRole("button", { name: "Load live sample" });
if ((await loadBtn.count()) > 0) {
  await loadBtn.click();
  await page.waitForTimeout(12000);
  results.afterLiveSample = {
    screenshot: await shot(page, ["reader", "1440x900", "light"], "reader-after-live-sample"),
    articles: await page.locator("article h3").count(),
    search: await page.locator("#reader-search").count(),
    chips: await page.getByRole("button", { name: /Search:/ }).count(),
  };
}

await page.goto(`${base}/reader?q=agent`, { waitUntil: "domcontentloaded" });
results.readerQAgent = {
  screenshot: await shot(page, ["reader", "1440x900", "light"], "reader-q-agent"),
  chips: await page.getByRole("button", { name: /Search: agent/i }).count(),
  heading: (await page.locator("h2").first().textContent())?.trim() ?? null,
};

await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
results.home = {
  screenshot: await shot(page, ["home", "1440x900", "light"], "home"),
};

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/reader`, { waitUntil: "domcontentloaded" });
results.readerMobile = {
  screenshot: await shot(page, ["reader", "390x844", "light"], "reader-mobile-empty"),
  filtersSummary: await page.getByText("Filters and view").count(),
};

results.consoleErrors = consoleErrors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
