import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';

describe('Auth API Integration Tests', () => {
  let mf: Miniflare;

  beforeAll(async () => {
    mf = new Miniflare({
      scriptPath: '../workers/index.ts',
      modules: true,
      bindings: {
        GITHUB_CLIENT_ID: 'test_github_client_id',
        GITHUB_CLIENT_SECRET: 'test_github_client_secret',
        GOOGLE_CLIENT_ID: 'test_google_client_id',
        GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
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
  });

  afterAll(async () => {
    await mf.dispose();
  });

  describe('OAuth Redirects', () => {
    it('should redirect to GitHub OAuth', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/auth/github');
      
      expect(response.status).toBe(302);
      
      const location = response.headers.get('Location');
      expect(location).toContain('https://github.com/login/oauth/authorize');
      expect(location).toContain('client_id=test_github_client_id');
      expect(location).toContain('scope=user%3Aemail');
    });

    it('should redirect to Google OAuth', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/auth/google');
      
      expect(response.status).toBe(302);
      
      const location = response.headers.get('Location');
      expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(location).toContain('client_id=test_google_client_id');
      expect(location).toContain('scope=openid%20profile%20email');
    });
  });

  describe('Auth Endpoints', () => {
    it('should return 404 for unknown auth endpoints', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/auth/unknown');
      
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toBe('Auth endpoint not found');
    });

    it('should handle logout', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/auth/logout');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.message).toBe('Logged out');
      
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('token=;');
      expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in responses', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/auth/logout');
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });

    it('should handle preflight requests', async () => {
      const response = await mf.dispatchFetch('http://localhost:8787/auth/logout', {
        method: 'OPTIONS',
      });
      
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });
  });
});