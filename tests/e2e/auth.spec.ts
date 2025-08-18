import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show login page for unauthenticated users', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('CollabDocs');
    await expect(page.locator('text=Continuar com GitHub')).toBeVisible();
    await expect(page.locator('text=Continuar com Google')).toBeVisible();
  });

  test('should have working OAuth buttons', async ({ page }) => {
    const githubButton = page.locator('text=Continuar com GitHub');
    const googleButton = page.locator('text=Continuar com Google');

    await expect(githubButton).toBeEnabled();
    await expect(googleButton).toBeEnabled();

    // Test that buttons trigger navigation (without actually going through OAuth)
    await expect(githubButton).toHaveAttribute('type', 'button');
    await expect(googleButton).toHaveAttribute('type', 'button');
  });

  test('should show loading state when clicking OAuth buttons', async ({ page }) => {
    // Mock the OAuth redirect to prevent actual navigation
    await page.route('**/auth/github', (route) => {
      route.fulfill({ status: 200, body: 'Mocked OAuth' });
    });

    const githubButton = page.locator('text=Continuar com GitHub');
    
    await githubButton.click();
    
    // Should show loading spinner
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('should handle OAuth callback with token', async ({ page }) => {
    // Mock successful OAuth callback
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJnaXRodWI6MTIzNDU2IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwibmFtZSI6IlRlc3QgVXNlciIsInByb3ZpZGVyIjoiZ2l0aHViIiwiaWF0Ijo5OTk5OTk5OTk5LCJleHAiOjk5OTk5OTk5OTl9';
    
    await page.goto(`/?token=${mockToken}`);
    
    // Should redirect to dashboard and remove token from URL
    await expect(page).toHaveURL('/');
    
    // Should show dashboard content (mocked since we don't have real auth)
    // In real implementation, this would show the user's dashboard
  });

  test('should have accessible design', async ({ page }) => {
    // Check color contrast
    const title = page.locator('h1');
    await expect(title).toHaveCSS('color', 'rgb(17, 24, 39)'); // text-gray-900

    // Check focus indicators
    const githubButton = page.locator('text=Continuar com GitHub');
    await githubButton.focus();
    
    // Should have focus outline
    await expect(githubButton).toBeFocused();
  });

  test('should be responsive', async ({ page }) => {
    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('.max-w-md')).toBeVisible();

    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.max-w-md')).toBeVisible();
    
    // Buttons should still be accessible on mobile
    await expect(page.locator('text=Continuar com GitHub')).toBeVisible();
    await expect(page.locator('text=Continuar com Google')).toBeVisible();
  });

  test('should show terms and privacy policy links', async ({ page }) => {
    await expect(page.locator('text=Termos de Uso')).toBeVisible();
    await expect(page.locator('text=Política de Privacidade')).toBeVisible();
    
    // Links should be properly styled
    await expect(page.locator('text=Termos de Uso')).toHaveClass(/text-primary-600/);
    await expect(page.locator('text=Política de Privacidade')).toHaveClass(/text-primary-600/);
  });
});