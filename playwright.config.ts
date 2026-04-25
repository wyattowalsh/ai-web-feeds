/**
 * Playwright configuration for E2E tests.
 */

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const runFullMatrix = process.env.PLAYWRIGHT_FULL_MATRIX === "1";
const useDevServer = process.env.PLAYWRIGHT_USE_DEV_SERVER !== "0";
const smokeProjects = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
];
const fullMatrixProjects = [
  ...smokeProjects,
  {
    name: "firefox",
    use: { ...devices["Desktop Firefox"] },
  },
  {
    name: "webkit",
    use: { ...devices["Desktop Safari"] },
  },
  {
    name: "Mobile Chrome",
    use: { ...devices["Pixel 5"] },
  },
  {
    name: "Mobile Safari",
    use: { ...devices["iPhone 12"] },
  },
];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: runFullMatrix ? fullMatrixProjects : smokeProjects,

  webServer: {
    command: useDevServer
      ? "cd apps/web && pnpm dev"
      : "cd apps/web && pnpm build && pnpm start",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      PORT: "3000",
    },
  },
});
