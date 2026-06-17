import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = "https://aiwebfeeds.vercel.app";
const outRoot = path.resolve(
  import.meta.dirname,
  "../../../specs/reader-ui-audit-wave11/screenshots",
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
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
const homeLightShot = await shot(page, ["home", "1440x900", "light"], "home-hero");

await page.emulateMedia({ colorScheme: "dark" });
await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
const homeDarkShot = await shot(page, ["home", "1440x900", "dark"], "home-hero");

await page.emulateMedia({ colorScheme: "light" });
await page.goto(`${base}/sources`, { waitUntil: "domcontentloaded", timeout: 60000 });
const sourcesLightShot = await shot(page, ["sources", "1440x900", "light"], "sources-browse");

await page.goto(`${base}/reader`, { waitUntil: "domcontentloaded", timeout: 60000 });
const emptyShot = await shot(page, ["reader", "1440x900", "light"], "reader-empty");

let after = {};
const loadBtn = page.getByRole("button", { name: "Load live sample" });
if ((await loadBtn.count()) > 0) {
  await loadBtn.click();
  await page.waitForTimeout(20000);
  after = {
    shot: await shot(page, ["reader", "1440x900", "light"], "reader-after-live-sample"),
    articles: await page.locator("article h3").count(),
    search: await page.locator("#reader-search").count(),
    chips: await page.getByRole("button", { name: /Search:/ }).count(),
    closePreview: await page.getByRole("button", { name: "Close preview" }).count(),
  };
}

await page.goto(`${base}/reader?q=agent`, { waitUntil: "domcontentloaded" });
const qShot = await shot(page, ["reader", "1440x900", "light"], "reader-q-agent");
const qChips = await page.getByRole("button", { name: /Search: agent/i }).count();
const h2 = (await page.locator("h2").first().textContent({ timeout: 5000 }).catch(() => null))?.trim() ?? null;

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/reader`, { waitUntil: "domcontentloaded" });
const mobShot = await shot(page, ["reader", "390x844", "light"], "reader-mobile-empty");

await page.setViewportSize({ width: 1440, height: 900 });
await page.emulateMedia({ colorScheme: "dark" });
await page.goto(`${base}/reader?q=agent`, { waitUntil: "domcontentloaded" });
const readerDarkShot = await shot(page, ["reader", "1440x900", "dark"], "reader-q-agent");

if (qChips < 1 && process.env.AUDIT_STRICT === "1") {
  console.error("FAIL: expected Search chip on /reader?q=agent after wave-11 fix");
  process.exitCode = 1;
}

console.log(
  JSON.stringify(
    {
      homeLightShot,
      homeDarkShot,
      sourcesLightShot,
      emptyShot,
      after,
      qShot,
      qChips,
      h2,
      errors,
      mobShot,
      readerDarkShot,
    },
    null,
    2,
  ),
);
await browser.close();
