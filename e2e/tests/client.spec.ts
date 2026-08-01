import { test, expect } from '@playwright/test';

const clientUrl = process.env.E2E_CLIENT_URL ?? 'http://localhost:5173';
const clientEmail = process.env.E2E_CLIENT_EMAIL ?? 'client@demo.local';
const clientPassword = process.env.E2E_CLIENT_PASSWORD ?? 'Test1234!';

async function loginAsClient(page: import('@playwright/test').Page) {
  await page.goto(`${clientUrl}/login`);
  await page.getByLabel(/email/i).fill(clientEmail);
  await page.getByLabel(/пароль/i).fill(clientPassword);
  await page.getByRole('button', { name: /войти/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

test.describe('Клиент личного кабинета', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsClient(page);
  });

  test('дашборд после входа', async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('раздел источников', async ({ page }) => {
    await page.goto(`${clientUrl}/sources`);
    await expect(page.getByRole('heading', { name: /источник/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('CRM kanban', async ({ page }) => {
    await page.goto(`${clientUrl}/crm`);
    await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('интеграции', async ({ page }) => {
    await page.goto(`${clientUrl}/integrations`);
    await expect(page.getByRole('heading', { name: /интеграции/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('биллинг', async ({ page }) => {
    await page.goto(`${clientUrl}/billing`);
    await expect(page.getByRole('heading', { name: /биллинг|тариф|подписк/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('команда', async ({ page }) => {
    await page.goto(`${clientUrl}/team`);
    await expect(page.getByRole('heading', { name: /команд/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
