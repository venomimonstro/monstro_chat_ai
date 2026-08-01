import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'api-smoke',
      testMatch: /smoke\.spec\.ts/,
    },
    {
      name: 'visitor',
      testMatch: /visitor\.spec\.ts/,
      use: {
        baseURL: process.env.E2E_PUBLIC_URL ?? 'http://localhost:4321',
      },
    },
    {
      name: 'client',
      testMatch: /client\.spec\.ts/,
      use: {
        baseURL: process.env.E2E_CLIENT_URL ?? 'http://localhost:5173',
      },
    },
    {
      name: 'admin',
      testMatch: /admin\.spec\.ts/,
      use: {
        baseURL: process.env.E2E_ADMIN_URL ?? 'http://localhost:5174',
      },
    },
  ],
});
