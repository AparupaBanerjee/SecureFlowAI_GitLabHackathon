import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['junit', { outputFile: 'results.xml' }]]
    : 'html',
  use: {
    // BASE_URL is injected by CI from deploy.env (PREVIEW_FRONTEND_URL).
    // For local runs: start the app with `make dev` then set BASE_URL or rely on default.
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // Generous timeout for Render cold-starts
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  expect: {
    timeout: 15_000,
  },
  timeout: 60_000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: './global-setup.ts',
});
