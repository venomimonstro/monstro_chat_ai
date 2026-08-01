import { test, expect } from '@playwright/test';

test('health endpoint returns ok', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe('ok');
});

test('database health endpoint', async ({ request }) => {
  const response = await request.get('/api/health/db');
  expect(response.ok()).toBeTruthy();
});

test('redis health endpoint', async ({ request }) => {
  const response = await request.get('/api/health/redis');
  expect(response.ok()).toBeTruthy();
});
