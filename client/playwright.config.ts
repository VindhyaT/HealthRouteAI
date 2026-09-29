import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    channel: 'chrome',
    headless: true,
    // Only for local production-container checks using a self-signed certificate.
    ignoreHTTPSErrors: process.env.E2E_ALLOW_SELF_SIGNED === '1',
    trace: 'off',
  },
});
