import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('sign in page renders', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.locator('body')).toBeVisible();
    // Should have OAuth provider buttons or a form
    const hasGoogle = await page.locator('text=/google/i').count() > 0;
    const hasGithub = await page.locator('text=/github/i').count() > 0;
    expect(hasGoogle || hasGithub).toBeTruthy();
  });

  test('invalid route redirects appropriately', async ({ page }) => {
    const response = await page.goto('/nonexistent-route-12345');
    // Either 404 page or redirect to home
    expect([200, 404]).toContain(response?.status() ?? 200);
  });
});
