import { test, expect } from '@playwright/test';

test.describe('Collaborative Editing', () => {
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJnaXRodWI6MTIzNDU2IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwibmFtZSI6IlRlc3QgVXNlciIsInByb3ZpZGVyIjoiZ2l0aHViIiwiaWF0Ijo5OTk5OTk5OTk5LCJleHAiOjk5OTk5OTk5OTl9';

  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript((token) => {
      localStorage.setItem('collabdocs_token', token);
    }, mockToken);

    // Mock API responses
    await page.route('**/api/documents', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            documents: [
              {
                id: 'test-doc-123',
                title: 'Test Document',
                owner_id: 'github:123456',
                visibility: 'private',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              }
            ]
          }),
        });
      } else if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            document: {
              id: 'new-doc-456',
              title: 'New Document',
              owner_id: 'github:123456',
              visibility: 'private',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            }
          }),
        });
      }
    });

    await page.route('**/api/documents/*', (route) => {
      const url = route.request().url();
      const docId = url.split('/').pop()?.split('?')[0];
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          document: {
            id: docId,
            title: 'Test Document',
            owner_id: 'github:123456',
            visibility: 'private',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          permission: 'owner',
        }),
      });
    });
  });

  test('should show dashboard with documents', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('h1')).toContainText('CollabDocs');
    await expect(page.locator('h2')).toContainText('Meus Documentos');
    await expect(page.locator('text=Test Document')).toBeVisible();
    await expect(page.locator('text=+ Novo Documento')).toBeVisible();
  });

  test('should create new document', async ({ page }) => {
    await page.goto('/');
    
    // Click create new document
    await page.locator('text=+ Novo Documento').click();
    
    // Fill in modal
    await expect(page.locator('text=Novo Documento')).toBeVisible();
    await page.fill('input[placeholder*="título"]', 'My New Document');
    
    // Select visibility
    await page.check('input[value="private"]');
    
    // Submit
    await page.click('button:has-text("Criar Documento")');
    
    // Should redirect to document editor
    await expect(page).toHaveURL(/\/document\/new-doc-456/);
  });

  test('should open document editor', async ({ page }) => {
    await page.goto('/');
    
    // Click on a document
    await page.locator('text=Test Document').click();
    
    // Should navigate to document page
    await expect(page).toHaveURL(/\/document\/test-doc-123/);
  });

  test('should show document editor interface', async ({ page }) => {
    // Mock WebSocket connection
    await page.route('**/ws/*', (route) => {
      route.fulfill({ status: 200 });
    });

    await page.goto('/document/test-doc-123');
    
    // Should show editor header
    await expect(page.locator('text=Test Document')).toBeVisible();
    await expect(page.locator('button[aria-label*="back" i], button:has-text("voltar" i), button:has-text("←"), svg[aria-label*="back" i]')).toBeVisible();
    
    // Should show connection status
    await expect(page.locator('text=Conectado, text=Desconectado')).toBeVisible();
    
    // Should show user avatar
    await expect(page.locator('.presence-indicator')).toBeVisible();
  });

  test('should handle editor loading states', async ({ page }) => {
    await page.goto('/document/test-doc-123');
    
    // Should show loading spinner initially
    await expect(page.locator('.animate-spin, text=Carregando')).toBeVisible();
  });

  test('should handle document not found', async ({ page }) => {
    // Mock 404 response
    await page.route('**/api/documents/non-existent', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Document not found' }),
      });
    });

    await page.goto('/document/non-existent');
    
    await expect(page.locator('text=Erro')).toBeVisible();
    await expect(page.locator('text=Documento não encontrado')).toBeVisible();
    await expect(page.locator('text=Voltar ao Dashboard')).toBeVisible();
  });

  test('should handle permission denied', async ({ page }) => {
    // Mock 403 response
    await page.route('**/api/documents/forbidden', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden' }),
      });
    });

    await page.goto('/document/forbidden');
    
    await expect(page.locator('text=Erro')).toBeVisible();
    await expect(page.locator('text=permissão')).toBeVisible();
  });

  test('should show empty state for new users', async ({ page }) => {
    // Mock empty documents response
    await page.route('**/api/documents', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [] }),
      });
    });

    await page.goto('/');
    
    await expect(page.locator('text=Nenhum documento ainda')).toBeVisible();
    await expect(page.locator('text=Criar Primeiro Documento')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Dashboard should be responsive
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=+ Novo Documento')).toBeVisible();
    
    // Document cards should stack on mobile
    await expect(page.locator('.grid')).toHaveClass(/grid-cols-1/);
  });

  test('should handle logout', async ({ page }) => {
    await page.goto('/');
    
    // Click logout
    await page.locator('text=Sair').click();
    
    // Should redirect to login
    await expect(page.locator('text=Continuar com GitHub')).toBeVisible();
  });
});