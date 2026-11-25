import { defineConfig, devices } from '@playwright/test';

const UI_BASE_URL = process.env.UI_BASE_URL ?? 'https://www.saucedemo.com';
const API_BASE_URL = process.env.API_BASE_URL ?? 'https://restful-booker.herokuapp.com';
const isCI = !!process.env.CI;

export default defineConfig({
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    // saucedemo marks elements with data-test. Keep in sync with .mcp.json.
    testIdAttribute: 'data-test',
  },
  projects: [
    {
      name: 'ui',
      testDir: './tests/ui',
      testIgnore: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: UI_BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        // Recorded for every UI test, kept and attached to the report only when the test fails.
        video: 'retain-on-failure',
      },
    },
    {
      // restful-booker is a shared public service that cold-starts.
      // Only the api project waits for it, so an outage cannot fail UI tests.
      name: 'api-setup',
      testDir: './tests/api',
      testMatch: /.*\.setup\.ts/,
      timeout: 45_000, // longer than the 30 s poll in ping.setup.ts
      use: { baseURL: API_BASE_URL },
    },
    {
      name: 'api',
      testDir: './tests/api',
      testIgnore: /.*\.setup\.ts/,
      dependencies: ['api-setup'],
      timeout: 45_000,
      use: {
        baseURL: API_BASE_URL,
        extraHTTPHeaders: { Accept: 'application/json' },
      },
    },
  ],
});
