import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Miniflare } from 'miniflare';

describe('API Integration Tests', () => {
  let mf: Miniflare;
  let mockToken: string;

  beforeAll(async () => {
    mf = new Miniflare({
      scriptPath: '../workers/index.ts',
      modules: true,
      bindings: {
        JWT_SECRET: 'test_jwt_secret',
        FRONTEND_URL: 'http://localhost:3000',
      },
      kvNamespaces: ['CACHE'],
      d1Databases: ['DB'],
      r2Buckets: ['SNAPSHOTS'],
      durableObjects: {
        DOCUMENT_DO: 'DocumentDurableObject',
      },
    });

    // Create mock JWT token
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: 'test:123456',
      email: 'test@example.com',
      name: 'Test User',
      provider: 'github',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));
    const signature = btoa(`${header}.${payload}.test_jwt_secret`);
    mockToken = `${header}.${payload}.${signature}`;
  });

  afterAll(async () => {
    await mf.dispose();
  });

  beforeEach(async () => {
    // Reset database state before each test
    const db = await mf.getD1Database('DB');
    
    // Create tables if they don't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        avatar_url TEXT,
        provider TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        visibility TEXT DEFAULT 'private',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_snapshot_r2_key TEXT
      );
      
      CREATE TABLE IF NOT EXISTS permissions (
        document_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (document_id, user_id)
      );
    `);

    // Insert test user
    await db.prepare(`
      INSERT OR REPLACE INTO users (id, email, name, provider, provider_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind('test:123456', 'test@example.com', 'Test User', 'github', '123456').run();
  });

  describe('Document CRUD', () => {
    it('should require authentication', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/api/documents');
      
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should get empty documents list for new user', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/api/documents', {
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.documents).toEqual([]);
    });

    it('should create a new document', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({
          title: 'Test Document',
          visibility: 'private',
        }),
      });
      
      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(data.document.title).toBe('Test Document');
      expect(data.document.owner_id).toBe('test:123456');
      expect(data.document.visibility).toBe('private');
      expect(data.document.id).toMatch(/^[a-f0-9-]+$/);
    });

    it('should validate required fields when creating document', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({
          // Missing title
          visibility: 'private',
        }),
      });
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Title is required');
    });

    it('should get document details', async () => {
      // First create a document
      const createResponse = await mf.dispatchFetch('http://localhost:8787/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: JSON.stringify({
          title: 'Test Document',
          visibility: 'public',
        }),
      });
      
      const createData = await createResponse.json();
      const documentId = createData.document.id;
      
      // Then get document details
      const response = await mf.dispatchFetch(`http://localhost:8787/api/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.document.id).toBe(documentId);
      expect(data.document.title).toBe('Test Document');
      expect(data.permission).toBe('owner');
    });

    it('should return 404 for non-existent document', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/api/documents/non-existent', {
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toBe('Document not found');
    });
  });

  describe('Document Permissions', () => {
    it('should deny access to documents without permission', async () => {
      // Create document with different user
      const db = await mf.getD1Database('DB');
      const docId = 'test-doc-123';
      
      await db.prepare(`
        INSERT INTO documents (id, owner_id, title, visibility)
        VALUES (?, ?, ?, ?)
      `).bind(docId, 'other-user', 'Other User Document', 'private').run();
      
      const response = await mf.dispatchFetch(`http://localhost:8787/api/documents/${docId}`, {
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      
      expect(response.status).toBe(403);
      
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/health');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown API endpoints', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/api/unknown', {
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      });
      
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toBe('Not Found');
    });

    it('should handle malformed JSON in requests', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
        body: 'invalid json',
      });
      
      expect(response.status).toBe(500);
      
      const data = await response.json();
      expect(data.error).toBe('Internal Server Error');
    });
  });
});