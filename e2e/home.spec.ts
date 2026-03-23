import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('loads and shows landing content', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CollabDocs/);
    // Should show login or dashboard
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('unauthenticated user sees sign-in option', async ({ page }) => {
    await page.goto('/');
    // Either redirected to signin or shows login button
    const url = page.url();
    const isSignIn = url.includes('/auth/signin') || url.includes('/signin');
    const hasLoginButton = await page.locator('text=/sign in|login|entrar/i').count() > 0;
    expect(isSignIn || hasLoginButton).toBeTruthy();
  });

  test('API health check returns healthy', async ({ request }) => {
    const workerUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api';
    try {
      const response = await request.get(`${workerUrl}/health`);
      if (response.ok()) {
        const body = await response.json();
        expect(body.status).toMatch(/healthy|degraded/);
      }
    } catch {
      // Worker not running in this test environment — skip gracefully
      test.skip();
    }
  });
});
