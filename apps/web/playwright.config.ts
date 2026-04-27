import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

const reporters: any[] = [
  ["list"],
  ["html", { open: "never" }],
  ["json", { outputFile: "test-results/results.json" }],
];

if (process.env.CI) {
  reporters.push(["github"]);
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: reporters,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL:
        process.env.DATABASE_URL ||
        // pragma: allowlist secret - test placeholder for local Playwright runs
        "postgresql://user:pass@localhost:5432/test?sslmode=require",
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET || "test-better-auth-secret-key-for-playwright",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "test-google-client-id",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "test-google-client-secret",
      GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "test-github-client-id",
      GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || "test-github-client-secret",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
});
