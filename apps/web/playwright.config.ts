import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for E2E Testing
 * 
 * Configures end-to-end testing with:
 * - Multi-browser support (Chromium, Firefox, WebKit)
 * - Offline context testing for PWA features
 * - Mobile viewport emulation
 * - Video and screenshot capture on failure
 * 
 * @see specs/004-client-side-features/tasks.md#t004
 * @see https://playwright.dev/docs/test-configuration
 */

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: process.env.CI
    ? [['html'], ['json', { outputFile: 'test-results/results.json' }], ['github']]
    : [['html'], ['list']],
  
  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Default timeout for actions
    actionTimeout: 10000,
    
    // Default timeout for navigation
    navigationTimeout: 30000,
  },
  
  // Projects for different browsers and contexts
  projects: [
    // Desktop Chromium
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable PWA/offline features
        serviceWorkers: 'allow',
        permissions:    ['notifications', 'persistent-storage'],
      },
    },
    
    // Desktop Firefox
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        serviceWorkers: 'allow',
        permissions:    ['notifications'],
      },
    },
    
    // Desktop Safari
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        serviceWorkers: 'allow',
      },
    },
    
    // Mobile Chrome
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        serviceWorkers: 'allow',
        permissions:    ['notifications'],
      },
    },
    
    // Mobile Safari
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        serviceWorkers: 'allow',
      },
    },
    
    // Offline context (for testing PWA offline capabilities)
    {
      name: 'chromium-offline',
      use: {
        ...devices['Desktop Chrome'],
        offline:        true,
        serviceWorkers: 'allow',
      },
    },
    
    // Firefox with browser-polyfill (for extension testing)
    {
      name: 'firefox-extension',
      use: {
        ...devices['Desktop Firefox'],
        serviceWorkers: 'allow',
        permissions:    ['notifications'],
        // Extension testing requires special setup
        // Will be configured in T032
      },
    },
  ],
  
  // Web server configuration
  webServer: {
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url:     process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes
  },
  
  // Global setup/teardown
  globalSetup:    './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  
  // Output directory
  outputDir: 'test-results',
  
  // Timeouts
  timeout: 30000, // 30 seconds per test
  expect:  {
    timeout: 5000, // 5 seconds for assertions
  },
});
