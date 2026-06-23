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
  await expect(input).toHaveValue(value, { timeout: 10_000 });
}
