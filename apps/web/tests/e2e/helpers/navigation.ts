import { expect, type Locator, type Page } from "@playwright/test";

export type GotoWithRetryOptions = Parameters<Page["goto"]>[1] & {
  attempts?: number;
};

/**
 * Navigate with retries for transient dev-server failures (ERR_ABORTED, timeouts).
 */
export async function gotoWithRetry(page: Page, path: string, options?: GotoWithRetryOptions) {
  const { attempts = 3, ...gotoOptions } = options ?? {};
  const mergedOptions: Parameters<Page["goto"]>[1] = {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
    ...gotoOptions,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(path, mergedOptions);
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isRetryable =
        message.includes("ERR_ABORTED") ||
        message.includes("Timeout") ||
        message.includes("net::ERR");
      if (!isRetryable || attempt === attempts - 1) {
        throw error;
      }
      await page.waitForTimeout(500 * (attempt + 1));
    }
  }

  throw lastError;
}

/** Fill a React-controlled input via real keystrokes (fill() alone can skip onChange in webkit CI). */
export async function typeIntoControlledInput(input: Locator, value: string) {
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 30 });

  try {
    await expect(input).toHaveValue(value, { timeout: 5_000 });
    return;
  } catch {
    // WebKit CI: synthesize input/change so React controlled state catches up.
    await input.evaluate((el, nextValue) => {
      const node = el as HTMLInputElement;
      const descriptor = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      );
      descriptor?.set?.call(node, nextValue);
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await expect(input).toHaveValue(value, { timeout: 10_000 });
  }
}

/**
 * Force the app into dark theme for this page.
 * Works with next-themes + fumadocs by toggling the 'dark' class and persisting preference.
 */
export async function forceDarkTheme(page: Page): Promise<void> {
  await page.evaluate(async () => {
    try {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      document.documentElement.style.colorScheme = "dark";
      try {
        localStorage.setItem("theme", "dark");
      } catch {
        // ignore
      }

      // HubThemeSync reads IndexedDB preferences — persist dark so hydration does not revert.
      await new Promise<void>((resolve) => {
        const req = indexedDB.open("aiwebfeeds");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("preferences")) {
            db.close();
            resolve();
            return;
          }
          const tx = db.transaction("preferences", "readwrite");
          const store = tx.objectStore("preferences");
          const getReq = store.get("user_prefs");
          getReq.onsuccess = () => {
            const current = (getReq.result as Record<string, unknown> | undefined) ?? {
              id: "user_prefs",
            };
            store.put({ ...current, id: "user_prefs", theme: "dark", updatedAt: Date.now() });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        };
        req.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  });

  await expect
    .poll(async () => page.evaluate(() => document.documentElement.classList.contains("dark")))
    .toBe(true);
}
