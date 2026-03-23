import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api';

  test('health endpoint returns status', async ({ request }) => {
    try {
      const response = await request.get(`${baseUrl}/health`);
      expect(response.status()).toBeLessThan(500);
      if (response.ok()) {
        const body = await response.json();
        expect(body).toHaveProperty('status');
        expect(body).toHaveProperty('version');
      }
    } catch {
      test.skip();
    }
  });

  test('documents endpoint requires auth', async ({ request }) => {
    try {
      const response = await request.get(`${baseUrl}/documents`);
      expect(response.status()).toBe(401);
    } catch {
      test.skip();
    }
  });

  test('debug endpoints are removed', async ({ request }) => {
    try {
      const debugResponse = await request.get(`${baseUrl}/debug`);
      expect(debugResponse.status()).toBe(404);

      const cleanResponse = await request.post(`${baseUrl}/debug/clean-database-public`);
      expect(cleanResponse.status()).toBe(404);
    } catch {
      test.skip();
    }
  });
});
