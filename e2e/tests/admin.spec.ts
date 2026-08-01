import { test, expect } from '@playwright/test';

const adminUrl = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@chat24ai.local';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'Test1234!';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${adminUrl}/login`);
  await page.getByLabel(/email/i).fill(adminEmail);
  await page.getByLabel(/пароль/i).fill(adminPassword);
  await page.getByRole('button', { name: /войти/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

test.describe('Администратор платформы', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('дашборд админки', async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('список тенантов', async ({ page }) => {
    await page.goto(`${adminUrl}/tenants`);
    await expect(page.getByRole('heading', { name: /тенант/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('тарифы', async ({ page }) => {
    await page.goto(`${adminUrl}/tariffs`);
    await expect(page.getByRole('heading', { name: /тариф/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('аудит-лог', async ({ page }) => {
    await page.goto(`${adminUrl}/audit`);
    await expect(page.getByRole('heading', { name: /аудит/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
