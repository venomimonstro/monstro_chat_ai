import { test, expect } from '@playwright/test';

const publicUrl = process.env.E2E_PUBLIC_URL ?? 'http://localhost:4321';

test.describe('Посетитель публичного сайта', () => {
  test('главная страница загружается', async ({ page }) => {
    const response = await page.goto(publicUrl);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('страница тарифов показывает планы', async ({ page }) => {
    await page.goto(`${publicUrl}/pricing`);
    await expect(page.getByRole('heading', { name: /тариф/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /начать бесплатно/i }).first()).toBeVisible();
  });

  test('форма регистрации доступна', async ({ page }) => {
    await page.goto(`${publicUrl}/register`);
    await expect(page.getByLabel(/название компании/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/пароль/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /создать аккаунт/i })).toBeVisible();
  });

  test('юридические страницы открываются', async ({ page }) => {
    for (const path of ['/legal/privacy', '/legal/terms', '/legal/consent']) {
      const response = await page.goto(`${publicUrl}${path}`);
      expect(response?.ok()).toBeTruthy();
    }
  });

  test('прокси регистрации отвечает (если API запущен)', async ({ request }) => {
    const response = await request.post(`${publicUrl}/api/auth/register`, {
      data: {
        companyName: 'E2E Test',
        email: `e2e-${Date.now()}@example.com`,
        password: 'Test1234!',
        pdConsent: true,
      },
      failOnStatusCode: false,
    });
    expect([200, 201, 409, 502, 503]).toContain(response.status());
  });
});
