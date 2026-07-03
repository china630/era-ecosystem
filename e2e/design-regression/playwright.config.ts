import { defineConfig, devices } from '@playwright/test';

const HOTEL_URL = process.env.PLAYWRIGHT_HOTEL_URL ?? 'http://127.0.0.1:3201';
const CLINIC_URL = process.env.PLAYWRIGHT_CLINIC_URL ?? 'http://127.0.0.1:3203';

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    trace: 'on-first-retry',
    launchOptions: {
      channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    },
  },
  projects: [
    {
      name: 'hotel',
      testMatch: /hotel-.*\.spec\.ts|design-smoke-hotel\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: HOTEL_URL,
      },
      snapshotPathTemplate: '{testDir}/snapshots/hotel/{arg}{ext}',
    },
    {
      name: 'clinic',
      testMatch: /clinic-.*\.spec\.ts|design-smoke-clinic\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: CLINIC_URL,
      },
      snapshotPathTemplate: '{testDir}/snapshots/clinic/{arg}{ext}',
    },
  ],
});
