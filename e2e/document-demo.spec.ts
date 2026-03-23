import { test, expect } from '@playwright/test';

test.describe('Document Demo Page', () => {
  test('demo page loads without auth', async ({ page }) => {
    await page.goto('/document/demo');
    // Demo page should be accessible without authentication
    await expect(page.locator('body')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('demo page has editor UI', async ({ page }) => {
    await page.goto('/document/demo');
    await page.waitForLoadState('networkidle');
    // Should have a textarea or editor element
    const hasEditor = await page.locator('textarea, [contenteditable], [role="textbox"]').count() > 0;
    const hasDocumentContent = await page.locator('text=/document|colaborat|editor/i').count() > 0;
    expect(hasEditor || hasDocumentContent).toBeTruthy();
  });
});
